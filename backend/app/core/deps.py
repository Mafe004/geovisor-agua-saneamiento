from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.security import ALGORITHM, SECRET_KEY  # deben existir en security.py
from app.db.database import get_connection

# ✅ CAMBIO: usar HTTPBearer (NO OAuth2PasswordBearer)
bearer_scheme = HTTPBearer()

ROLE_NAME = {
    1: "CIUDADANO",
    2: "ENTIDAD",
    3: "MODERADOR",
    4: "ADMINISTRADOR",
}

ESTADO_NAME = {
    1: "ACTIVO",
    2: "INACTIVO",
    3: "SUSPENDIDO",
    4: "PENDIENTE",
}


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
                SELECT id_usuario, correo, id_rol, id_estado_cuenta, id_entidad
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
    if user.get("id_estado_cuenta") != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cuenta no activa: {ESTADO_NAME.get(user.get('id_estado_cuenta'), 'DESCONOCIDO')}",
        )
    return user


def require_roles(*allowed_roles: int) -> Callable:
    allowed = set(allowed_roles)

    def _dep(user: dict[str, Any] = Depends(require_active_user)) -> dict[str, Any]:
        if user.get("id_rol") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol sin permiso. Tu rol: {ROLE_NAME.get(user.get('id_rol'), 'DESCONOCIDO')}",
            )
        return user

    return _dep
