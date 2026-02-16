import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from jose import jwt, JWTError
from passlib.context import CryptContext


load_dotenv()

# =========================
# PASSWORD HASHING (SIN BCRYPT)
# =========================
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],  # ✅ estable en Windows/Python 3.13
    deprecated="auto"
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# =========================
# JWT
# =========================
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_ME_PLEASE")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

def create_access_token(data: Dict[str, Any], expires_minutes: Optional[int] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_minutes if expires_minutes is not None else ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
