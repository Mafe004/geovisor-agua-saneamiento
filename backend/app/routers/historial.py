from typing import Any

import pymysql
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import require_active_user, require_roles
from app.core.errors import handle_db_error
from app.core.policies import puede_ver_reporte, scope_reportes
from app.core.roles import Rol
from app.db.database import get_connection
from app.schemas.historial import HistorialEntry

# ✅ Sin prefix propio para no chocar con reportes.py
router = APIRouter(tags=["Historial"])


def _select_historial_sql() -> str:
    return """
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
        JOIN reportes rp ON rp.id_reporte = h.id_reporte
    """


@router.get(
    "/reportes/{id_reporte}/historial",
    summary="Ver historial de cambios de estado de un reporte",
    response_model=list[HistorialEntry],
    responses={404: {"description": "Reporte no encontrado"}, 403: {"description": "Sin permiso"}},
)
def historial_reporte(
    id_reporte: int, user: dict[str, Any] = Depends(require_active_user)
) -> list[dict[str, Any]]:
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
                (id_reporte,),
            )
            reporte = cursor.fetchone()
            if not reporte:
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            # Control de acceso por rol
            if not puede_ver_reporte(user, reporte):
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permiso para ver el historial de este reporte",
                )

            cursor.execute(
                _select_historial_sql() + " WHERE h.id_reporte = %s ORDER BY h.fecha_cambio ASC;",
                (id_reporte,),
            )
            return cursor.fetchall()

    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/historial/",
    summary="Historial global de cambios (MODERADOR / ADMIN ven todo, ENTIDAD solo lo suyo)",
    response_model=list[HistorialEntry],
    responses={403: {"description": "Rol sin permiso"}},
)
def listar_historial_global(
    id_reporte: int | None = Query(None, description="Filtrar por un reporte"),
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: dict[str, Any] = Depends(require_roles(Rol.ENTIDAD, Rol.MODERADOR, Rol.ADMIN)),
) -> list[dict[str, Any]]:
    """
    Feed global de cambios de estado, más reciente primero.
    MODERADOR/ADMIN ven todo; ENTIDAD solo el historial de reportes de su
    propia entidad (mismo scope_reportes que listar_reportes/reportes_mapa/
    estadisticas_reportes -- nunca se había aplicado acá porque este
    endpoint nunca dejaba pasar a ENTIDAD en absoluto).
    """
    conn = get_connection()
    try:
        sql = _select_historial_sql()
        conditions, params = scope_reportes(user, alias="rp")

        if id_reporte is not None:
            conditions.append("h.id_reporte = %s")
            params.append(id_reporte)

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        sql += " ORDER BY h.fecha_cambio DESC LIMIT %s OFFSET %s;"
        params.extend([limite, offset])

        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()

    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()
