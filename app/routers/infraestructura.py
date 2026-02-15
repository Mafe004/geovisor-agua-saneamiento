from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
import pymysql

from app.db.database import get_connection

router = APIRouter(prefix="/infraestructura", tags=["infraestructura"])

@router.get("/", summary="Listar infraestructura hídrica (capa informativa)")
def listar_infraestructura() -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                  id_infraestructura,
                  nombre,
                  tipo,
                  latitud,
                  longitud,
                  fuente,
                  estado,
                  fecha_actualizacion
                FROM infraestructura_hidrica
                ORDER BY id_infraestructura DESC;
            """)
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()
