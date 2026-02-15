from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
import pymysql

from app.db.database import get_connection

router = APIRouter(prefix="/reportes", tags=["historial"])

@router.get("/{id_reporte}/historial", summary="Historial del reporte")
def historial_reporte(id_reporte: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verifica que exista el reporte
            cursor.execute("SELECT id_reporte FROM reportes WHERE id_reporte=%s;", (id_reporte,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            cursor.execute("""
                SELECT
                  h.id_historial,
                  h.estado_anterior,
                  h.estado_nuevo,
                  h.comentario,
                  h.id_usuario_accion,
                  u.nombre_completo AS usuario_accion,
                  h.fecha_cambio
                FROM historial_reportes h
                JOIN usuarios u ON u.id_usuario = h.id_usuario_accion
                WHERE h.id_reporte = %s
                ORDER BY h.fecha_cambio DESC;
            """, (id_reporte,))
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()
