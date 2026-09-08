import os
from contextlib import contextmanager

import pymysql
from dbutils.pooled_db import PooledDB
from dotenv import load_dotenv
from pymysql.constants import FIELD_TYPE
from pymysql.converters import conversions

load_dotenv()

# DECIMAL/NEWDECIMAL columns (latitud, longitud, etc.) llegan como
# decimal.Decimal por defecto. FastAPI infiere un response model desde
# las anotaciones `-> dict[str, Any]` de los routers, y Pydantic v2
# serializa Decimal como STRING en JSON (no como número) para no perder
# precisión. Los convertimos a float aquí, en el driver, para que la
# API siempre devuelva números reales sin tener que tocar cada router.
DECIMAL_AS_FLOAT = dict(conversions)
DECIMAL_AS_FLOAT[FIELD_TYPE.DECIMAL] = float
DECIMAL_AS_FLOAT[FIELD_TYPE.NEWDECIMAL] = float

# Toda la config de conexión vive acá, en un solo dict, para que sea
# imposible que el pool y una conexión "a mano" terminen con settings
# distintos — especialmente cursorclass y conv, que si se pierden hacen
# que las filas dejen de venir como dict y que latitud/longitud vuelvan a
# serializar como string en vez de número (rompiendo el mapa en
# silencio).
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "geovisor_agua_saneamiento"),
    "cursorclass": pymysql.cursors.DictCursor,
    "autocommit": True,
    "conv": DECIMAL_AS_FLOAT,
}

# DB_POOL_SIZE debe quedar por debajo del max_connections configurado en
# el servidor MySQL (151 por defecto) — si uvicorn corre con varios
# procesos worker, cada uno abre su propio pool, así que la suma de todos
# los DB_POOL_SIZE (workers × DB_POOL_SIZE) es lo que hay que comparar
# contra ese límite, no un solo pool aislado.
_pool = PooledDB(
    creator=pymysql,
    mincached=2,
    maxconnections=int(os.getenv("DB_POOL_SIZE", 10)),
    blocking=True,
    # Revalida la conexión (un SELECT 1 barato) antes de entregarla cada
    # vez que se pide una — sin esto, una conexión que el servidor MySQL
    # cerró por inactividad (wait_timeout, típicamente 8h) se entregaría
    # igual y el primer query fallaría con "MySQL server has gone away".
    ping=1,
    **DB_CONFIG,
)


def get_connection():
    """
    Devuelve una conexión del pool, no una conexión nueva por request.
    `.close()` en lo que esto devuelve NO cierra el socket — lo regresa al
    pool para reuso (así es como funciona PooledDB.connection() en
    DBUtils) — por eso ningún call site existente necesita cambiar: seguir
    llamando `.close()` cuando se termina de usar la conexión sigue siendo
    exactamente lo correcto.
    """
    return _pool.connection()


@contextmanager
def transaccion():
    """
    Cursor transaccional: commit al salir, rollback ante cualquier excepción
    — incluida HTTPException, que también es una Exception y por lo tanto
    revierte la transacción antes de propagarse hacia FastAPI (el cliente
    sigue viendo el status code original, no un 500).

    Solo para handlers que escriben en más de una tabla, o que escriben una
    tabla de negocio y además una fila de auditoría (registrar_auditoria
    exige un cursor ya abierto en la transacción del llamador). Los
    handlers de solo lectura deben seguir usando get_connection() con
    autocommit — envolverlos aquí sería overhead sin beneficio.

    Usa conn.begin() en vez de conn.autocommit(False): lo que devuelve el
    pool no es una conexión pymysql cruda, es un proxy de DBUtils
    (SteadyDBConnection) que solo expone un subconjunto fijo de métodos
    DB-API — no reenvía .autocommit(), que es una extensión propia de
    PyMySQL. .begin() sí está en ese subconjunto y además es más correcto
    acá: emite un BEGIN explícito que MySQL respeta sin importar el modo
    autocommit de la sesión, y lo suspende solo durante la transacción —
    al hacer commit()/rollback() la conexión vuelve sola a autocommit
    normal antes de regresar al pool. Con autocommit(False) habría que
    acordarse de revertirlo a mano, o el siguiente request que tome esta
    misma conexión del pool heredaría autocommit apagado sin saberlo.
    """
    conn = get_connection()
    conn.begin()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
