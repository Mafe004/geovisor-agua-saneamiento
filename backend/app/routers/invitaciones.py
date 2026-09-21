"""
Códigos de invitación para altas de ENTIDAD/MODERADOR/ADMINISTRADOR.

Un ADMIN genera un token de 6 caracteres (POST /) que le comparte
manualmente a la persona invitada; esa persona lo valida (GET /{token},
público) y lo consume en POST /usuarios/registro-invitacion
(app/routers/usuarios.py) para crear su cuenta ya ACTIVA, sin pasar por el
estado PENDIENTE que sí requieren las solicitudes de admin sin invitación.
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Any

import pymysql
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_roles
from app.core.errors import handle_db_error
from app.core.roles import Rol
from app.db.database import get_connection
from app.schemas.invitaciones import (
    CrearInvitacionRequest,
    CrearInvitacionResponse,
    ValidarInvitacionResponse,
)

router = APIRouter(prefix="/invitaciones", tags=["Invitaciones"])
logger = logging.getLogger(__name__)

TOKEN_LENGTH = 6
# Sin caracteres ambiguos excluidos a propósito -- el código se comparte
# manualmente (voz, chat, papel) así que mantenerlo en un alfabeto simple
# (mayúsculas + dígitos) importa más que evitar 0/O o 1/I; el formulario de
# captura (InvitacionScreen, frontend) fuerza mayúsculas de todas formas.
TOKEN_ALPHABET = string.ascii_uppercase + string.digits
INVITACION_VIGENCIA_DIAS = 7
_MAX_INTENTOS_TOKEN = 5

# CIUDADANO (1) nunca se invita -- se registra libremente por
# POST /usuarios/registro.
ROLES_INVITABLES = {Rol.ENTIDAD, Rol.MODERADOR, Rol.ADMIN}


def _generar_token() -> str:
    return "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(TOKEN_LENGTH))


def crear_token_invitacion(
    cursor, *, id_rol: int, id_entidad: int | None, creado_por: int
) -> tuple[str, datetime]:
    """
    INSERT en `invitaciones` con reintento ante colisión de token, usando un
    cursor ya abierto por el llamador (misma convención que
    registrar_auditoria -- no abre su propia conexión/transacción).

    Compartido entre crear_invitacion (acá abajo) y aprobar_solicitud
    (app/routers/solicitudes_acceso.py) para no duplicar la lógica de
    reintento -- ver su comentario original para el porqué del retry.
    """
    expira_en = datetime.now() + timedelta(days=INVITACION_VIGENCIA_DIAS)

    for intento in range(_MAX_INTENTOS_TOKEN):
        candidato = _generar_token()
        try:
            cursor.execute(
                """
                INSERT INTO invitaciones
                    (token, id_rol, id_entidad, creado_por, expira_en, usado)
                VALUES (%s, %s, %s, %s, %s, 0);
                """,
                (candidato, id_rol, id_entidad, creado_por, expira_en),
            )
            return candidato, expira_en
        except pymysql.err.IntegrityError as e:
            errno = e.args[0] if e.args else None
            if errno == 1062 and intento < _MAX_INTENTOS_TOKEN - 1:
                continue
            raise

    raise HTTPException(
        status_code=500, detail="No se pudo generar un código único, intenta de nuevo"
    )


@router.post(
    "/",
    status_code=201,
    summary="Generar un código de invitación (solo ADMINISTRADOR)",
    response_model=CrearInvitacionResponse,
    responses={
        400: {"description": "id_rol inválido, o id_entidad faltante/no permitido para ese rol"}
    },
)
def crear_invitacion(
    data: CrearInvitacionRequest,
    user: dict[str, Any] = Depends(require_roles(Rol.ADMIN)),
) -> dict[str, Any]:
    if data.id_rol not in ROLES_INVITABLES:
        raise HTTPException(
            status_code=400,
            detail="id_rol inválido -- solo se puede invitar a ENTIDAD (2), MODERADOR (3) o ADMINISTRADOR (4)",
        )
    if data.id_rol == Rol.ENTIDAD and not data.id_entidad:
        raise HTTPException(
            status_code=400,
            detail="id_entidad es obligatorio para invitaciones de rol ENTIDAD",
        )
    if data.id_rol != Rol.ENTIDAD and data.id_entidad is not None:
        raise HTTPException(
            status_code=400,
            detail="id_entidad solo aplica a invitaciones de rol ENTIDAD",
        )

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            if data.id_entidad is not None:
                cursor.execute(
                    "SELECT id_entidad FROM entidades WHERE id_entidad = %s;",
                    (data.id_entidad,),
                )
                if not cursor.fetchone():
                    raise HTTPException(status_code=400, detail="id_entidad no existe")

            token, expira_en = crear_token_invitacion(
                cursor,
                id_rol=data.id_rol,
                id_entidad=data.id_entidad,
                creado_por=user["id_usuario"],
            )

        return {
            "token": token,
            "id_rol": data.id_rol,
            "id_entidad": data.id_entidad,
            "expira_en": expira_en,
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/{token}",
    summary="Validar un código de invitación (público, sin autenticación)",
    response_model=ValidarInvitacionResponse,
    responses={
        404: {"description": "Token no encontrado"},
        400: {"description": "Token ya utilizado o expirado"},
    },
)
def validar_invitacion(token: str) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    i.id, i.id_rol, i.id_entidad, i.expira_en, i.usado,
                    r.nombre          AS rol_nombre,
                    e.nombre_entidad  AS entidad_nombre,
                    u.nombre_completo AS invitado_por
                FROM invitaciones i
                JOIN roles    r ON r.id_rol      = i.id_rol
                JOIN usuarios u ON u.id_usuario  = i.creado_por
                LEFT JOIN entidades e ON e.id_entidad = i.id_entidad
                WHERE i.token = %s;
                """,
                (token.strip().upper(),),
            )
            inv = cursor.fetchone()

        if not inv:
            raise HTTPException(status_code=404, detail="Código de invitación no encontrado")
        if inv["usado"]:
            raise HTTPException(status_code=400, detail="Este código ya fue utilizado")
        if datetime.now() > inv["expira_en"]:
            raise HTTPException(status_code=400, detail="Este código ha expirado")

        dias_restantes = max(0, (inv["expira_en"] - datetime.now()).days)

        return {
            "id_rol": inv["id_rol"],
            "rol": inv["rol_nombre"],
            "id_entidad": inv["id_entidad"],
            "entidad": inv["entidad_nombre"],
            "invitado_por": inv["invitado_por"],
            "dias_restantes": dias_restantes,
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        conn.close()
