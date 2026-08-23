from fastapi import APIRouter, HTTPException
import pymysql
from app.db.database import get_connection

router = APIRouter(prefix="/catalogos", tags=["catalogos"])

def fetch_all(query: str):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query)
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()

@router.get("/estado-reporte")
def estados_reporte():
    return fetch_all("SELECT id_estado, nombre FROM estado_reporte ORDER BY id_estado;")

@router.get("/tipo-incidente")
def tipos_incidente():
    return fetch_all("SELECT id_tipo_incidente, nombre FROM tipo_incidente ORDER BY id_tipo_incidente;")

@router.get("/severidad")
def severidades():
    return fetch_all("SELECT id_severidad, nombre FROM severidad ORDER BY id_severidad;")

@router.get("/categoria-incidente")
def categorias():
    return fetch_all("SELECT id_categoria, nombre FROM categoria_incidente ORDER BY id_categoria;")
