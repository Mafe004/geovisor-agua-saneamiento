import pymysql
from fastapi import APIRouter

from app.core.errors import handle_db_error
from app.db.database import get_connection
from app.schemas.catalogos import (
    CategoriaIncidenteItem,
    EstadoReporteItem,
    SeveridadItem,
    TipoIncidenteItem,
)

router = APIRouter(prefix="/catalogos", tags=["catalogos"])


def fetch_all(query: str):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query)
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get("/estado-reporte", response_model=list[EstadoReporteItem])
def estados_reporte():
    return fetch_all("SELECT id_estado, nombre FROM estado_reporte ORDER BY id_estado;")


@router.get("/tipo-incidente", response_model=list[TipoIncidenteItem])
def tipos_incidente():
    return fetch_all(
        "SELECT id_tipo_incidente, nombre FROM tipo_incidente ORDER BY id_tipo_incidente;"
    )


@router.get("/severidad", response_model=list[SeveridadItem])
def severidades():
    return fetch_all("SELECT id_severidad, nombre FROM severidad ORDER BY id_severidad;")


@router.get("/categoria-incidente", response_model=list[CategoriaIncidenteItem])
def categorias():
    return fetch_all("SELECT id_categoria, nombre FROM categoria_incidente ORDER BY id_categoria;")
