from typing import Any

import pymysql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.deps import require_active_user
from app.db.database import get_connection

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


class MarcarLeidaRequest(BaseModel):
    leida: bool = Field(True, description="true para marcar como leída, false para no leída")


@router.get("/", summary="Mis notificaciones (usuario autenticado)")
def listar_mis_notificaciones(
    solo_no_leidas: bool = False,
    user: dict[str, Any] = Depends(require_active_user),  # ✅ id_usuario sale del token
) -> dict[str, Any]:
    """
    Devuelve las notificaciones del usuario autenticado.
    Parámetro opcional: ?solo_no_leidas=true para filtrar solo las pendientes.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            query = """
                SELECT
                    n.id_notificacion,
                    n.id_reporte,
                    n.tipo_notificacion,
                    n.mensaje,
                    n.leida,
                    n.fecha_envio
                FROM notificaciones n
                WHERE n.id_usuario = %s
            """
            params: list[Any] = [user["id_usuario"]]

            if solo_no_leidas:
                query += " AND n.leida = 0"

            query += " ORDER BY n.fecha_envio DESC;"
            cursor.execute(query, params)
            notificaciones = cursor.fetchall()

            # Contador de no leídas
            cursor.execute(
                "SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = %s AND leida = 0;",
                (user["id_usuario"],),
            )
            no_leidas = cursor.fetchone()["total"]

        return {"total_no_leidas": no_leidas, "notificaciones": notificaciones}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}") from e
    finally:
        conn.close()


@router.put("/marcar-todas-leidas", summary="Marcar todas mis notificaciones como leídas")
def marcar_todas_leidas(user: dict[str, Any] = Depends(require_active_user)) -> dict[str, Any]:
    """Marca todas las notificaciones no leídas del usuario autenticado."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE notificaciones SET leida = 1 WHERE id_usuario = %s AND leida = 0;",
                (user["id_usuario"],),
            )
        return {"message": "Todas las notificaciones marcadas como leídas"}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}") from e
    finally:
        conn.close()


@router.put("/{id_notificacion}/leer", summary="Marcar una notificación como leída o no leída")
def marcar_leida(
    id_notificacion: int,
    payload: MarcarLeidaRequest,
    user: dict[str, Any] = Depends(require_active_user),  # ✅ Requiere token
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verificar que existe y pertenece al usuario autenticado
            cursor.execute(
                "SELECT id_notificacion, id_usuario FROM notificaciones WHERE id_notificacion = %s;",
                (id_notificacion,),
            )
            notif = cursor.fetchone()
            if not notif:
                raise HTTPException(status_code=404, detail="Notificación no encontrada")
            if notif["id_usuario"] != user["id_usuario"]:
                raise HTTPException(
                    status_code=403, detail="No puedes modificar notificaciones de otro usuario"
                )

            cursor.execute(
                "UPDATE notificaciones SET leida = %s WHERE id_notificacion = %s;",
                (1 if payload.leida else 0, id_notificacion),
            )
        return {"message": "ok", "id_notificacion": id_notificacion, "leida": payload.leida}
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}") from e
    finally:
        conn.close()
