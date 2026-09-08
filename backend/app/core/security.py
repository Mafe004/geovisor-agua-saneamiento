import os
from datetime import UTC, datetime, timedelta
from typing import Any

from dotenv import load_dotenv
from jose import jwt
from passlib.context import CryptContext

load_dotenv()

# =========================
# PASSWORD HASHING (SIN BCRYPT)
# =========================
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],  # ✅ estable en Windows/Python 3.13
    deprecated="auto",
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# =========================
# JWT
# =========================
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY ausente o demasiado corta (mínimo 32 caracteres). "
        'Genérala con: python -c "import secrets; print(secrets.token_hex(32))"'
    )

# Fijo: un valor leído del entorno sería superficie de ataque (permitiría
# forzar "alg": "none" u otro algoritmo débil).
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def create_access_token(data: dict[str, Any], expires_minutes: int | None = None) -> str:
    to_encode = data.copy()
    now = datetime.now(UTC)
    expire = now + timedelta(
        minutes=expires_minutes if expires_minutes is not None else ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"iat": now, "exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
