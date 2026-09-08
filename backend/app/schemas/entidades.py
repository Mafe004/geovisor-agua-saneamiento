from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EntidadDetalle(BaseModel):
    """Forma de _select_entidad_sql() — JOIN estado_cuenta es INNER, nunca None."""

    model_config = ConfigDict(from_attributes=True)

    id_entidad: int
    nombre_entidad: str
    nit_rut: str
    correo_institucional: str
    telefono: str | None
    direccion: str | None
    funcionario_responsable: str | None
    documento_funcionario: str | None
    sitio_web: str | None
    estado_cuenta: str
    created_at: datetime
    updated_at: datetime


class CrearEntidadResponse(BaseModel):
    message: str
    id_entidad: int
    nombre_entidad: str


class ActualizarEntidadResponse(BaseModel):
    message: str


class CambiarEstadoEntidadResponse(BaseModel):
    message: str
    entidad: str
    nuevo_estado: str


class AsignarUsuarioResponse(BaseModel):
    message: str
    usuario: str
    entidad: str


class DesasignarUsuarioResponse(BaseModel):
    message: str
    usuario: str


class UsuarioDeEntidadItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_usuario: int
    nombre_completo: str
    correo: str
    telefono: str | None
    rol: str
    estado_cuenta: str


class UsuariosDeEntidadResponse(BaseModel):
    entidad: str
    total_usuarios: int
    usuarios: list[UsuarioDeEntidadItem]
