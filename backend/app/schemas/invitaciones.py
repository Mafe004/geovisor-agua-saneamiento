from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CrearInvitacionRequest(BaseModel):
    id_rol: int = Field(
        ..., description="Rol a invitar: 2=ENTIDAD, 3=MODERADOR, 4=ADMINISTRADOR"
    )
    id_entidad: int | None = Field(
        None, description="Obligatorio (y solo válido) cuando id_rol=2 (ENTIDAD)"
    )


class CrearInvitacionResponse(BaseModel):
    """Único lugar donde el token de 6 caracteres viaja en una respuesta
    HTTP -- lo genera crear_invitacion() y lo entrega solo al ADMIN que lo
    solicitó, para que se lo comparta manualmente con la persona invitada."""

    model_config = ConfigDict(from_attributes=True)

    token: str
    id_rol: int
    id_entidad: int | None
    expira_en: datetime


class ValidarInvitacionResponse(BaseModel):
    """Forma de validar_invitacion() -- pública, sin autenticación. Nunca
    incluye el token (el cliente ya lo tiene, es el que mandó) ni datos de
    contacto de quien invitó, solo su nombre."""

    id_rol: int
    rol: str
    id_entidad: int | None
    entidad: str | None
    invitado_por: str
    dias_restantes: int
