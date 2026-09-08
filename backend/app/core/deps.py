import os
from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.roles import EstadoCuenta, Rol
from app.core.security import ALGORITHM, SECRET_KEY  # deben existir en security.py
from app.db.database import get_connection

# ✅ CAMBIO: usar HTTPBearer (NO OAuth2PasswordBearer)
bearer_scheme = HTTPBearer()


def _nombre_rol(value: Any) -> str:
    try:
        return Rol(value).name
    except ValueError:
        return "DESCONOCIDO"


def _nombre_estado(value: Any) -> str:
    try:
        return EstadoCuenta(value).name
    except ValueError:
        return "DESCONOCIDO"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict[str, Any]:
    """
    1) Lee token desde Authorization: Bearer <token>
    2) Valida token
    3) Saca sub = id_usuario
    4) Consulta BD y devuelve usuario REAL con rol/estado/id_entidad
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials  # ✅ aquí viene SOLO el token, sin "Bearer "

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise credentials_exc
        id_usuario = int(sub)
    except (JWTError, ValueError):
        raise credentials_exc from None

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id_usuario, correo, nombre_completo, id_rol, id_estado_cuenta, id_entidad
                FROM usuarios
                WHERE id_usuario = %s;
                """,
                (id_usuario,),
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    if not user:
        raise credentials_exc

    return user


def require_active_user(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if user.get("id_estado_cuenta") != EstadoCuenta.ACTIVO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cuenta no activa: {_nombre_estado(user.get('id_estado_cuenta'))}",
        )
    return user


def require_roles(*allowed_roles: Rol) -> Callable:
    allowed = set(allowed_roles)

    def _dep(user: dict[str, Any] = Depends(require_active_user)) -> dict[str, Any]:
        if user.get("id_rol") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol sin permiso. Tu rol: {_nombre_rol(user.get('id_rol'))}",
            )
        return user

    return _dep


def get_client_ip(request: Request) -> str | None:
    """
    IP del cliente, para el log de auditoría.

    X-Forwarded-For lo controla el cliente y por lo tanto es falsificable —
    solo se confía en él cuando TRUST_PROXY=true, es decir, cuando de verdad
    hay un proxy/load balancer delante que lo setea de forma confiable. Por
    defecto se usa la IP de la conexión TCP directa (request.client.host).
    """
    if os.getenv("TRUST_PROXY", "false").lower() == "true":
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()[:45]  # varchar(45) en logs_auditoria
    return request.client.host[:45] if request.client else None
