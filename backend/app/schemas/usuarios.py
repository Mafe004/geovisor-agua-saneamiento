from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class RegistroResponse(BaseModel):
    message: str
    id_usuario: int
    estado: str
    instruccion: str


class SolicitarRecuperacionResponse(BaseModel):
    """El handler devuelve un mensaje genérico cuando el correo no existe
    (por seguridad, no revela si está registrado) y un token cuando sí —
    token/expira_en son opcionales para cubrir ambas ramas reales."""

    message: str
    token: str | None = None
    expira_en: str | None = None


class RestablecerContrasenaResponse(BaseModel):
    message: str


class PerfilResponse(BaseModel):
    """Forma de ver_perfil() — JOIN roles/estado_cuenta son INNER, nunca None."""

    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombre_completo: str
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
