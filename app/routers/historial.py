from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Depends
import pymysql

from app.db.database import get_connection
from app.core.deps import require_active_user

# ✅ Sin prefix propio para no chocar con reportes.py
router = APIRouter(tags=["Historial"])


@router.get(
    "/reportes/{id_reporte}/historial",
    summary="Ver historial de cambios de estado de un reporte"
)
def historial_reporte(
    id_reporte: int,
    user: Dict[str, Any] = Depends(require_active_user)
) -> List[Dict[str, Any]]:
    """
    Devuelve todos los cambios de estado de un reporte ordenados cronológicamente.
    - CIUDADANO: solo puede ver el historial de sus propios reportes.
    - ENTIDAD:   solo puede ver el historial de reportes de su entidad.
    - MODERADOR / ADMIN: pueden ver cualquier historial.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verificar que el reporte existe
            cursor.execute(
                "SELECT id_reporte, id_usuario, id_entidad FROM reportes WHERE id_reporte = %s;",
                (id_reporte,)
            )
            reporte = cursor.fetchone()
            if not reporte:
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            # Control de acceso por rol
            id_rol = user["id_rol"]
            if id_rol == 1:  # CIUDADANO
                if reporte["id_usuario"] != user["id_usuario"]:
                    raise HTTPException(
                        status_code=403,
                        detail="No tienes permiso para ver el historial de este reporte"
                    )
            elif id_rol == 2:  # ENTIDAD
                if reporte["id_entidad"] != user.get("id_entidad"):
                    raise HTTPException(
                        status_code=403,
                        detail="No tienes permiso para ver el historial de este reporte"
                    )
            # MODERADOR (3) y ADMIN (4): acceso total

            cursor.execute("""
                SELECT
                    h.id_historial,
                    h.id_reporte,
                    h.estado_anterior,
                    h.estado_nuevo,
                    h.comentario,
                    h.id_usuario_accion,
                    u.nombre_completo AS usuario_accion,
                    r.nombre          AS rol_usuario_accion,
                    h.fecha_cambio
                FROM historial_reportes h
                JOIN usuarios u ON u.id_usuario = h.id_usuario_accion
                JOIN roles    r ON r.id_rol     = u.id_rol
                WHERE h.id_reporte = %s
                ORDER BY h.fecha_cambio ASC;
            """, (id_reporte,))
            return cursor.fetchall()

    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()