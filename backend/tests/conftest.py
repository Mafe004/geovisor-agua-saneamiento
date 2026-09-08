"""
Fixtures de la suite de integración.

Corren contra una base de datos MySQL real y desechable (geovisor_test),
nunca contra la base de desarrollo — ver el guard justo debajo de la carga
de env vars. Cada test arranca desde el mismo estado semilla exacto del
dump (backend/geovisor_backup_limpio.sql): un fixture autouse trunca todas
las tablas y las vuelve a poblar antes de cada test, así que el orden de
ejecución nunca importa.
"""

import os
from pathlib import Path

import pymysql
import pytest
from dotenv import load_dotenv

# ── Cargar config de test ANTES de importar la app ──────────────────────
# app.core.security lee SECRET_KEY al importarse y lanza RuntimeError si
# falta o es corta — por eso esto tiene que pasar antes de que cualquier
# módulo de test haga `from main import app` o `from app... import ...`.
load_dotenv(Path(__file__).parent / ".env.test", override=True)

# ── Guard: nunca correr esta suite contra algo que no sea una base de   ──
# ── datos de pruebas desechable — es destructiva (TRUNCATE + reseed)    ──
_DB_NAME = os.environ.get("DB_NAME", "")
if not _DB_NAME.endswith("_test"):
    pytest.exit(
        f"DB_NAME={_DB_NAME!r} no termina en '_test'. Esta suite trunca y "
        "vuelve a poblar tablas antes de cada test — se niega a correr "
        "contra algo que no sea una base de datos de pruebas desechable. "
        "Revisa tests/.env.test (o la variable de entorno DB_NAME).",
        returncode=1,
    )

from fastapi.testclient import TestClient  # noqa: E402 (después del guard)

from app.core.security import hash_password  # noqa: E402
from app.db.database import get_connection  # noqa: E402
from main import app  # noqa: E402

DUMP_PATH = Path(__file__).parent.parent / "geovisor_backup_limpio.sql"

# Orden con dependencias de FK resueltas (padres antes que hijos) — se usa
# para el reseed; el TRUNCATE en sí corre con FOREIGN_KEY_CHECKS=0 así que
# ahí el orden no importa.
TABLES = [
    "categoria_incidente",
    "estado_cuenta",
    "estado_reporte",
    "roles",
    "severidad",
    "tipo_incidente",
    "entidades",
    "usuarios",
    "reportes",
    "historial_reportes",
    "notificaciones",
    "logs_auditoria",
    "recuperacion_contrasena",
    "infraestructura_hidrica",
]

SEED_PASSWORD = "demo2025"  # ver el comentario al final del dump


def _split_statements(sql_text: str) -> list[str]:
    """
    Separa el dump en sentencias individuales ejecutables una por una.

    El dump no necesita DELIMITER hasta la vista y el procedimiento
    almacenado al final (sp_cambiar_estado_reporte) — ninguno de los dos lo
    usa la aplicación (reportes.cambiar_estado reimplementa la misma lógica
    directamente), así que se corta el texto justo antes de esa sección y
    se evita tener que parsear bloques DELIMITER a mano.
    """
    marker = "VISTA: reportes completos"
    if marker in sql_text:
        sql_text = sql_text.split(marker)[0]

    # Quitar líneas de comentario ANTES de partir por ";". Varios INSERT en
    # el dump tienen un comentario "-- ..." pegado justo arriba sin un ";"
    # de por medio (p. ej. antes de INSERT INTO usuarios) — sin este paso,
    # ese comentario queda fusionado con el INSERT que le sigue en la misma
    # sentencia partida, y como el bloque completo empieza con "--" se
    # descartaría el INSERT entero junto con el comentario.
    sql_text = "\n".join(
        line for line in sql_text.splitlines() if not line.strip().startswith("--")
    )

    statements = []
    for raw in sql_text.split(";"):
        stmt = raw.strip()
        if not stmt:
            continue
        upper = stmt.upper()
        # La base y el USE los maneja este fixture (crea geovisor_test, no
        # geovisor_agua_saneamiento como dice el dump) — el resto del script
        # usa nombres de tabla sin calificar, así que basta con `USE` una vez.
        if upper.startswith("CREATE DATABASE") or upper.startswith("USE "):
            continue
        statements.append(stmt)
    return statements


@pytest.fixture(scope="session")
def _seed_snapshot():
    """
    Recrea geovisor_test desde cero (una vez por sesión) ejecutando el
    mismo dump que ships con la app, y devuelve una foto de cada tabla
    semilla para que el reseed entre tests no tenga que volver a correr
    todo el script cada vez.
    """
    admin_conn = pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 3306)),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with admin_conn.cursor() as cur:
            cur.execute(f"DROP DATABASE IF EXISTS `{_DB_NAME}`;")
            cur.execute(
                f"CREATE DATABASE `{_DB_NAME}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        admin_conn.select_db(_DB_NAME)

        sql_text = DUMP_PATH.read_text(encoding="utf-8")
        with admin_conn.cursor() as cur:
            for stmt in _split_statements(sql_text):
                cur.execute(stmt)

        # El dump dice "contraseña de todos los usuarios de prueba:
        # demo2025", pero el hash semilla en realidad no corresponde a esa
        # contraseña (ni a ninguna adivinable) — es un placeholder. Para que
        # los fixtures de login real funcionen como está documentado, se
        # sobreescribe con un hash real de "demo2025" solo en geovisor_test;
        # el dump de origen no se toca.
        with admin_conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET password_hash = %s;", (hash_password(SEED_PASSWORD),)
            )

        snapshot: dict[str, list[dict]] = {}
        with admin_conn.cursor() as cur:
            for table in TABLES:
                cur.execute(f"SELECT * FROM `{table}`;")
                snapshot[table] = cur.fetchall()
    finally:
        admin_conn.close()

    return snapshot


@pytest.fixture(autouse=True)
def _reseed(_seed_snapshot):
    """
    Trunca todas las tablas y reinserta exactamente los datos semilla antes
    de cada test.

    Se prefirió esto sobre "envolver el test en una transacción y hacer
    rollback" porque la app no inyecta una sesión/conexión compartida: cada
    handler abre su propia conexión vía get_connection()/transaccion(). No
    hay una transacción del lado del test que pueda envolver eso y
    revertirlo. Truncar + resembrar antes de cada test logra el mismo
    aislamiento (estado idéntico y conocido al empezar cada test, sin
    depender del orden de ejecución) sin necesitar reescribir cómo la app
    maneja sus conexiones.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS=0;")
            for table in TABLES:
                cur.execute(f"TRUNCATE TABLE `{table}`;")
            for table in TABLES:
                rows = _seed_snapshot[table]
                if not rows:
                    continue
                cols = list(rows[0].keys())
                col_list = ", ".join(f"`{c}`" for c in cols)
                placeholders = ", ".join(["%s"] * len(cols))
                cur.executemany(
                    f"INSERT INTO `{table}` ({col_list}) VALUES ({placeholders});",
                    [tuple(row[c] for c in cols) for row in rows],
                )
            cur.execute("SET FOREIGN_KEY_CHECKS=1;")
    finally:
        conn.close()
    yield


# ── Clientes HTTP ─────────────────────────────────────────────────────


@pytest.fixture
def client():
    return TestClient(app)


def _login(http_client: TestClient, correo: str, password: str = SEED_PASSWORD) -> TestClient:
    res = http_client.post("/auth/login", json={"correo": correo, "password": password})
    assert res.status_code == 200, f"login de {correo} falló: {res.status_code} {res.text}"
    token = res.json()["access_token"]
    http_client.headers.update({"Authorization": f"Bearer {token}"})
    return http_client


@pytest.fixture
def client_ciudadano():
    """
    juan@test.com — id_usuario=1, id_rol=1 (CIUDADANO).

    OJO: cada fixture de rol crea su PROPIA instancia de TestClient (no
    depende del fixture `client`) — si dos de estos se pidieran a la vez en
    el mismo test y compartieran una sola instancia, el segundo login
    pisaría la cabecera Authorization del primero y ambos terminarían
    autenticados como el último rol logueado.
    """
    return _login(TestClient(app), "juan@test.com")


@pytest.fixture
def client_entidad():
    """operador.acueducto@demo.com — id_usuario=2, id_rol=2, id_entidad=1."""
    return _login(TestClient(app), "operador.acueducto@demo.com")


@pytest.fixture
def client_moderador():
    """moderador@demo.com — id_usuario=3, id_rol=3 (MODERADOR)."""
    return _login(TestClient(app), "moderador@demo.com")


@pytest.fixture
def client_admin():
    """admin@geovisor.com — id_usuario=5, id_rol=4 (ADMINISTRADOR)."""
    return _login(TestClient(app), "admin@geovisor.com")


@pytest.fixture
def client_anon():
    """Sin cabecera Authorization."""
    return TestClient(app)
