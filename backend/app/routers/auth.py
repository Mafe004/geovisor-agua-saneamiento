import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel, Field

from app.core.audit import Accion, Modulo, registrar_auditoria
from app.core.deps import get_client_ip
from app.core.roles import EstadoCuenta
from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.db.database import get_connection, transaccion
from app.schemas.auth import LoginResponse, UserPublic

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()

# Hash constante contra el que se verifica cuando el correo no existe, para
# que el tiempo de respuesta no revele si una cuenta está registrada.
_DUMMY_HASH = hash_password("dummy-password-not-a-real-account")

# =========================
# MODELOS
# =========================


class LoginRequest(BaseModel):
    correo: str = Field(..., description="Correo del usuario")
    password: str = Field(
        ..., min_length=1, description="Contraseña en texto plano (solo se envía para validar)"
    )


# =========================
# HELPERS
# =========================


def _get_user_by_email(correo: str) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id_usuario, id_rol, id_estado_cuenta, id_entidad,
                    nombre_completo, correo, password_hash
                FROM usuarios
                WHERE correo = %s
                LIMIT 1;
            """,
                (correo,),
            )
            user = cursor.fetchone()
        return user
    finally:
        conn.close()


def _get_user_by_id(id_usuario: int) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id_usuario, id_rol, id_estado_cuenta, id_entidad,
                    nombre_completo, correo
                FROM usuarios
                WHERE id_usuario = %s
                LIMIT 1;
            """,
                (id_usuario,),
            )
            user = cursor.fetchone()
        return user
    finally:
        conn.close()


# =========================
# DEPENDENCY (PROTECCIÓN)
# =========================


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict[str, Any]:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Token inválido (sin sub)")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido") from None

    user = _get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no existe")

    return user


# =========================
# ENDPOINTS
# =========================


@router.post(
    "/login",
    summary="Login: devuelve JWT",
    response_model=LoginResponse,
    responses={401: {"description": "Credenciales incorrectas"}, 403: {"description": "Cuenta no activa"}},
)
def login(payload: LoginRequest, ip: str | None = Depends(get_client_ip)):
    user = _get_user_by_email(payload.correo)

    # La contraseña se verifica siempre, antes de mirar ningún estado de
    # cuenta, y con el mismo costo computacional exista o no el usuario —
    # así ni el contenido ni el tiempo de la respuesta delatan si un correo
    # está registrado.
    if user:
        hashed = user.get("password_hash") or ""
        if not hashed.startswith("$pbkdf2-sha256$"):
            # Hash no migrado a PBKDF2: se registra en el log, pero al
            # cliente se le responde igual que a una credencial incorrecta.
            logger.warning(
                "Login rechazado: password_hash no migrado a PBKDF2 (id_usuario=%s)",
                user.get("id_usuario"),
            )
            password_ok = False
        else:
            password_ok = verify_password(payload.password, hashed)
    else:
        verify_password(payload.password, _DUMMY_HASH)
        password_ok = False

    if not user or not password_ok:
        # Los intentos fallidos NO se escriben en logs_auditoria: no hay un
        # id_usuario válido para el caso "correo no existe" (la FK lo
        # rechazaría), y para el caso "password incorrecta" registrar cada
        # intento en una tabla pensada para acciones exitosas la inundaría
        # con ruido potencialmente generado por un atacante. Se registran
        # solo en el logger de la aplicación.
        logger.info("Login fallido para correo=%s desde ip=%s", payload.correo, ip)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Solo tras probar que la credencial es correcta se revela el estado
    # de la cuenta (según tu tabla estado_cuenta: 1=ACTIVO).
    if user.get("id_estado_cuenta") != EstadoCuenta.ACTIVO:
        raise HTTPException(status_code=403, detail="Cuenta no activa")

    with transaccion() as cur:
        registrar_auditoria(
            cur,
            id_usuario=user["id_usuario"],
            accion=Accion.LOGIN,
            modulo=Modulo.AUTH,
            ip=ip,
        )

    token = create_access_token({"sub": str(user["id_usuario"]), "id_rol": user["id_rol"]})

    # devolver user sin password_hash
    user_public = {
        "id_usuario": user["id_usuario"],
        "id_rol": user["id_rol"],
        "id_estado_cuenta": user["id_estado_cuenta"],
        "id_entidad": user["id_entidad"],
        "nombre_completo": user["nombre_completo"],
        "correo": user["correo"],
    }

    return {"access_token": token, "token_type": "bearer", "user": user_public}


@router.get(
    "/me", summary="Devuelve el usuario logueado (token)", response_model=UserPublic
)
def me(current_user: dict[str, Any] = Depends(get_current_user)):
    return current_user
