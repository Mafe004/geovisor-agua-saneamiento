from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CrearSolicitudAcceso(BaseModel):
    nombre_completo: str = Field(..., min_length=2, max_length=150)
    correo: EmailStr
    motivo: str = Field(..., min_length=20, description="Mínimo 20 caracteres")


class MensajeResponse(BaseModel):
    """Forma de crear_solicitud() y rechazar_solicitud() -- la clave es
    `mensaje` (no `message` como en el resto de la API) a propósito: así se
    pidió explícitamente el contrato de este endpoint."""

    mensaje: str


class AprobarSolicitudResponse(BaseModel):
    """Forma de aprobar_solicitud() -- a diferencia de MensajeResponse,
    incluye el token de 6 caracteres recién generado. El envío automático
    por correo depende de un dominio verificado en Resend (ver
    send_invitation_email, email_service.py); mientras eso no esté
    configurado, `nota` le recuerda al ADMIN que puede necesitar compartir
    `token_invitacion` a mano."""

    mensaje: str
    token_invitacion: str
    nota: str


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
