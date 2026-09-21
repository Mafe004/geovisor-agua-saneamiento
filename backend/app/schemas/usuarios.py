from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class RegistroResponse(BaseModel):
    message: str
    id_usuario: int
    estado: str
    instruccion: str


class RegistroInvitacionResponse(BaseModel):
    """Forma de registro_con_invitacion() -- a diferencia de RegistroResponse
    (registro público de ciudadano), incluye id_rol porque acá el rol lo
    decide la invitación, no un valor fijo, y es útil para que el frontend
    confirme con qué rol quedó creada la cuenta."""

    message: str
    id_usuario: int
    id_rol: int
    estado: str


class SolicitarRecuperacionResponse(BaseModel):
    """Mismo mensaje exista o no el correo -- por seguridad, la respuesta
    nunca revela si la cuenta existe ni contiene el token (ver
    solicitar_recuperacion en routers/usuarios.py; el token va solo por
    correo vía app/services/email_service.py)."""

    message: str


class RestablecerContrasenaResponse(BaseModel):
    message: str


class PerfilResponse(BaseModel):
    """Forma de ver_perfil() — JOIN roles/estado_cuenta son INNER, nunca None."""

    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre_completo: str
    cargo: str | None
    correo: str
    telefono: str | None
    pais: str | None
    ciudad: str | None
    direccion: str | None
    tipo_documento: str | None
    numero_documento: str | None
    fecha_nacimiento: date | None
    rol: str
    estado_cuenta: str
    created_at: datetime
    updated_at: datetime


class ActualizarPerfilResponse(BaseModel):
    message: str


class CambiarPasswordResponse(BaseModel):
    message: str


class UsuarioListItem(BaseModel):
    """Forma de listar_usuarios()."""

    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre_completo: str
    correo: str
    telefono: str | None
    ciudad: str | None
    rol: str
    estado_cuenta: str
    created_at: datetime


class UsuarioPendienteItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre_completo: str
    correo: str
    telefono: str | None
    ciudad: str | None
    tipo_documento: str | None
    numero_documento: str | None
    created_at: datetime


class PendientesResponse(BaseModel):
    """
    listar_pendientes() siempre devolvió {"total_pendientes", "usuarios"} en
    tiempo de ejecución, pero su firma decía `-> list[dict[str, Any]]`. Con
    response_model ausente FastAPI no lo notaba; con response_model presente
    el mismatch se vuelve un 500 en cada request. Se modela aquí como
    realmente es — un wrapper, no una lista — corrigiendo ese bug.
    """

    total_pendientes: int
    usuarios: list[UsuarioPendienteItem]


class UsuarioDetalleResponse(BaseModel):
    """Forma de detalle_usuario()."""

    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre_completo: str
    cargo: str | None
    correo: str
    telefono: str | None
    pais: str | None
    ciudad: str | None
    direccion: str | None
    tipo_documento: str | None
    numero_documento: str | None
    fecha_nacimiento: date | None
    rol: str
    estado_cuenta: str
    id_entidad: int | None
    created_at: datetime
    updated_at: datetime


class CambiarEstadoUsuarioResponse(BaseModel):
    message: str
    usuario: str
    nuevo_estado: str
