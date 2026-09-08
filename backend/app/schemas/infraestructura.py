from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InfraestructuraItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_infraestructura: int
    nombre: str
    tipo: str
    latitud: float
    longitud: float
    fuente: str | None
    estado: str | None
    fecha_actualizacion: datetime


class CrearInfraestructuraResponse(BaseModel):
    message: str
    id_infraestructura: int


class ActualizarInfraestructuraResponse(BaseModel):
    message: str
