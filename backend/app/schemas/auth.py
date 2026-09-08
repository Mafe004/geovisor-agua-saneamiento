from pydantic import BaseModel, ConfigDict


class UserPublic(BaseModel):
    """Nunca incluye el hash de la contraseña — este modelo es el único que
    sale de /auth/login y /auth/me, y ambos handlers construyen
    explícitamente el dict sin ese campo antes de devolverlo (login) o lo
    excluyen del SELECT (_get_user_by_id)."""

    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    id_rol: int
    id_estado_cuenta: int
    id_entidad: int | None
    nombre_completo: str
    correo: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserPublic
