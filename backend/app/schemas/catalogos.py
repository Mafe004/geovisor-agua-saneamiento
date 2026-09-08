from pydantic import BaseModel, ConfigDict


class EstadoReporteItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_estado: int
    nombre: str


class TipoIncidenteItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_tipo_incidente: int
    nombre: str


class SeveridadItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_severidad: int
    nombre: str


class CategoriaIncidenteItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_categoria: int
    nombre: str
