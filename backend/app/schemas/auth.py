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
    # Solo tiene sentido cuando id_rol=ENTIDAD (migración 0007): el titular
    # ve/gestiona todo el pool de reportes de su entidad y puede agregar
    # trabajadores; un trabajador normal solo ve lo que se le asignó a él.
    # False para cualquier otro rol.
    es_titular_entidad: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserPublic
