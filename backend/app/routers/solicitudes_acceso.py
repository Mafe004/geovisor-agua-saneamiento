"""
Solicitudes públicas de acceso como ADMINISTRADOR, para quien no tiene un
código de invitación (ver app/routers/invitaciones.py para el flujo normal
con invitación). Cualquiera manda nombre/correo/motivo sin autenticarse; un
ADMIN ya existente la revisa y aprueba o rechaza manualmente. Al aprobar,
se genera una invitación normal de rol ADMINISTRADOR y se envía por correo
-- desde ahí el flujo converge con POST /usuarios/registro-invitacion.
"""

import logging
from typing import Any

import pymysql
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_roles
from app.core.errors import handle_db_error
from app.core.roles import Rol
from app.db.database import get_connection, transaccion
from app.routers.invitaciones import crear_token_invitacion
from app.schemas.solicitudes_acceso import (
    CrearSolicitudAcceso,
    MensajeResponse,
    SolicitudAccesoItem,
)
from app.services.email_service import send_invitation_email

router = APIRouter(prefix="/solicitudes-acceso", tags=["Solicitudes de Acceso"])
logger = logging.getLogger(__name__)


@router.post(
    "/",
    status_code=201,
    summary="Solicitar acceso como Administrador (público, sin autenticación)",
    response_model=MensajeResponse,
    responses={400: {"description": "El correo ya tiene una cuenta registrada"}},
)
def crear_solicitud(data: CrearSolicitudAcceso) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s;", (data.correo,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=400, detail="Este correo ya tiene una cuenta registrada"
                )

            cursor.execute(
                """
                INSERT INTO solicitudes_acceso (nombre_completo, correo, motivo, estado)
                VALUES (%s, %s, %s, 'PENDIENTE');
                """,
                (data.nombre_completo, data.correo, data.motivo),
            )

        return {"mensaje": "Tu solicitud fue enviada. Un administrador la revisará pronto."}
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/",
    summary="Listar solicitudes de acceso (solo ADMINISTRADOR)",
    response_model=list[SolicitudAccesoItem],
)
def listar_solicitudes(
    user: dict[str, Any] = Depends(require_roles(Rol.ADMIN)),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    s.id, s.nombre_completo, s.correo, s.motivo, s.estado,
                    s.creado_en, s.revisado_en,
                    r.nombre_completo AS revisado_por_nombre
                FROM solicitudes_acceso s
                LEFT JOIN usuarios r ON r.id_usuario = s.revisado_por
                ORDER BY s.creado_en DESC;
                """
            )
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()


def _obtener_pendiente(cursor, id_solicitud: int) -> dict[str, Any]:
    """Bloquea la fila (FOR UPDATE) y valida que exista y siga PENDIENTE --
    compartido por aprobar_solicitud y rechazar_solicitud para que dos
    revisiones concurrentes de la misma solicitud no la procesen dos veces
    (misma razón que el FOR UPDATE en registro_con_invitacion, backend
    usuarios.py)."""
    cursor.execute(
        "SELECT id, nombre_completo, correo, estado FROM solicitudes_acceso WHERE id = %s FOR UPDATE;",
        (id_solicitud,),
    )
    solicitud = cursor.fetchone()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud["estado"] != "PENDIENTE":
        raise HTTPException(
            status_code=400, detail=f"Esta solicitud ya fue revisada ({solicitud['estado']})"
        )
    return solicitud


@router.patch(
    "/{id_solicitud}/aprobar",
    summary="Aprobar una solicitud de acceso -- genera y envía la invitación (solo ADMINISTRADOR)",
    response_model=MensajeResponse,
    responses={
        404: {"description": "Solicitud no encontrada"},
        400: {"description": "La solicitud ya fue revisada"},
    },
)
def aprobar_solicitud(
    id_solicitud: int, user: dict[str, Any] = Depends(require_roles(Rol.ADMIN))
) -> dict[str, Any]:
    try:
        with transaccion() as cursor:
            solicitud = _obtener_pendiente(cursor, id_solicitud)

            token, _expira_en = crear_token_invitacion(
                cursor, id_rol=Rol.ADMIN, id_entidad=None, creado_por=user["id_usuario"]
            )

            cursor.execute(
                """
                UPDATE solicitudes_acceso
                SET estado = 'APROBADO', revisado_por = %s, revisado_en = NOW()
                WHERE id = %s;
                """,
                (user["id_usuario"], id_solicitud),
            )

        # Fuera de la transacción a propósito: el envío de correo es una
        # llamada de red a un servicio externo, no debe tener una
        # transacción de MySQL abierta (y por lo tanto una fila bloqueada)
        # esperando la respuesta de Resend. La aprobación y la invitación
        # ya quedaron guardadas -- un fallo de entrega acá no las revierte,
        # solo se registra en el log (el ADMIN puede compartir el token
        # manualmente si hace falta).
        try:
            send_invitation_email(solicitud["correo"], token, "Administrador")
        except Exception:
            logger.exception(
                "Fallo enviando correo de invitación a %s tras aprobar solicitud %s",
                solicitud["correo"],
                id_solicitud,
            )

        return {"mensaje": "Solicitud aprobada. Se envió el código de invitación."}
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)


@router.patch(
    "/{id_solicitud}/rechazar",
    summary="Rechazar una solicitud de acceso (solo ADMINISTRADOR)",
    response_model=MensajeResponse,
    responses={
        404: {"description": "Solicitud no encontrada"},
        400: {"description": "La solicitud ya fue revisada"},
    },
)
def rechazar_solicitud(
    id_solicitud: int, user: dict[str, Any] = Depends(require_roles(Rol.ADMIN))
) -> dict[str, Any]:
    try:
        with transaccion() as cursor:
            _obtener_pendiente(cursor, id_solicitud)

            cursor.execute(
                """
                UPDATE solicitudes_acceso
                SET estado = 'RECHAZADO', revisado_por = %s, revisado_en = NOW()
                WHERE id = %s;
                """,
                (user["id_usuario"], id_solicitud),
            )

        return {"mensaje": "Solicitud rechazada."}
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
