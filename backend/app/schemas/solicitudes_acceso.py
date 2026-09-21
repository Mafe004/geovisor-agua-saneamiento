from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CrearSolicitudAcceso(BaseModel):
    nombre_completo: str = Field(..., min_length=2, max_length=150)
    correo: EmailStr
    motivo: str = Field(..., min_length=20, description="Mínimo 20 caracteres")


class MensajeResponse(BaseModel):
    """Forma común de las tres respuestas de este router -- la clave es
    `mensaje` (no `message` como en el resto de la API) a propósito: así se
    pidió explícitamente el contrato de este endpoint."""

    mensaje: str


class SolicitudAccesoItem(BaseModel):
    """Forma de listar_solicitudes() -- revisado_por_nombre es el nombre de
    quien revisó (JOIN a usuarios), no el id crudo; None mientras la
    solicitud siga PENDIENTE."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_completo: str
    correo: str
    motivo: str
    estado: str
    creado_en: datetime
    revisado_en: datetime | None
    revisado_por_nombre: str | None
