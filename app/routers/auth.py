from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from jose import JWTError

from app.db.database import get_connection
from app.core.security import verify_password, create_access_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()

# =========================
# MODELOS
# =========================

class LoginRequest(BaseModel):
    correo: str = Field(..., description="Correo del usuario")
    password: str = Field(..., min_length=1, description="Contraseña en texto plano (solo se envía para validar)")

# =========================
# HELPERS
# =========================

def _get_user_by_email(correo: str) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    id_usuario, id_rol, id_estado_cuenta, id_entidad,
                    nombre_completo, correo, password_hash
                FROM usuarios
                WHERE correo = %s
                LIMIT 1;
            """, (correo,))
            user = cursor.fetchone()
        return user
    finally:
        conn.close()

def _get_user_by_id(id_usuario: int) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    id_usuario, id_rol, id_estado_cuenta, id_entidad,
                    nombre_completo, correo
                FROM usuarios
                WHERE id_usuario = %s
                LIMIT 1;
            """, (id_usuario,))
            user = cursor.fetchone()
        return user
    finally:
        conn.close()

# =========================
# DEPENDENCY (PROTECCIÓN)
# =========================

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Token inválido (sin sub)")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido")

    user = _get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no existe")

    return user

# =========================
# ENDPOINTS
# =========================

@router.post("/login", summary="Login: devuelve JWT")
def login(payload: LoginRequest):
    user = _get_user_by_email(payload.correo)

    if not user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Validar estado cuenta (según tu tabla estado_cuenta: 1=ACTIVO)
    if user.get("id_estado_cuenta") != 1:
        raise HTTPException(status_code=403, detail="Cuenta no activa")

    hashed = user.get("password_hash") or ""
    # Si tu BD aún tiene "HASH_TEMPORA" u otro placeholder, esto fallará.
    if not hashed.startswith("$pbkdf2-sha256$"):
        raise HTTPException(
            status_code=500,
            detail="El password_hash de este usuario no está migrado a PBKDF2. Actualiza password_hash."
        )

    if not verify_password(payload.password, hashed):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({
        "sub": str(user["id_usuario"]),
        "id_rol": user["id_rol"]
    })

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

@router.get("/me", summary="Devuelve el usuario logueado (token)")
def me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user
