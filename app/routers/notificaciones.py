from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pymysql

from app.db.database import get_connection

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])

class MarcarLeidaRequest(BaseModel):
    leida: bool = Field(True)

@router.get("/", summary="Listar notificaciones por usuario")
def listar_notificaciones(id_usuario: int) -> List[Dict[str, Any]]:
    """
    Se manda id_usuario como query param:
    /notificaciones?id_usuario=1
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                  n.id_notificacion,
                  n.id_usuario,
                  n.id_reporte,
                  n.tipo_notificacion,
                  n.mensaje,
                  n.leida,
                  n.fecha_envio
                FROM notificaciones n
                WHERE n.id_usuario = %s
                ORDER BY n.fecha_envio DESC;
            """, (id_usuario,))
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()

@router.put("/{id_notificacion}/leer", summary="Marcar notificación como leída")
def marcar_leida(id_notificacion: int, payload: MarcarLeidaRequest) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_notificacion FROM notificaciones WHERE id_notificacion=%s;", (id_notificacion,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Notificación no encontrada")

            cursor.execute(
                "UPDATE notificaciones SET leida=%s WHERE id_notificacion=%s;",
                (1 if payload.leida else 0, id_notificacion)
            )
        return {"message": "ok", "id_notificacion": id_notificacion, "leida": payload.leida}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()
