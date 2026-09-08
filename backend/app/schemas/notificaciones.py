from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificacionItem(BaseModel):
    """`leida` es tinyint(1) en MySQL (0/1); Pydantic lo coerciona a bool.
    La app solo hace truthiness checks (`!item.leida`), que siguen
    funcionando igual con true/false que con 1/0."""

    model_config = ConfigDict(from_attributes=True)

    id_notificacion: int
    id_reporte: int | None
    tipo_notificacion: str
    mensaje: str
    leida: bool
    fecha_envio: datetime


class MarcarTodasLeidasResponse(BaseModel):
    message: str


class MarcarLeidaResponse(BaseModel):
    message: str
    id_notificacion: int
    leida: bool
