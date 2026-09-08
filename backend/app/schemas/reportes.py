from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReporteDetalle(BaseModel):
    """Forma de _select_reporte_detalle_sql() en reportes.py — todos los JOIN son INNER,
    así que usuario/estado/tipo_incidente/severidad nunca son None."""

    model_config = ConfigDict(from_attributes=True)

    id_reporte: int
    descripcion: str
    direccion: str | None
    latitud: float
    longitud: float
    imagen_url: str | None
    fuente_reporte: str
    created_at: datetime
    id_usuario: int
    id_entidad: int | None
    id_tipo_incidente: int
    id_severidad: int
    id_estado: int
    usuario: str
    estado: str
    tipo_incidente: str
    severidad: str


class ReporteMapaPunto(BaseModel):
    """Forma de la SELECT ligera en reportes_mapa()."""

    model_config = ConfigDict(from_attributes=True)

    id_reporte: int
    latitud: float
    longitud: float
    direccion: str | None
    tipo_incidente: str
    severidad: str
    estado: str
    fecha_reporte: datetime


class CrearReporteResponse(BaseModel):
    message: str
    reporte: ReporteDetalle


class CambiarEstadoResponse(BaseModel):
    message: str
    reporte: ReporteDetalle


class EstadisticaEstadoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    estado: str
    total: int


class EstadisticaTipoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    tipo_incidente: str
    total: int


class EstadisticaSeveridadItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    severidad: str
    total: int


class EstadisticaMesItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    mes: str
    total: int


class EstadisticasResponse(BaseModel):
    """
    Forma real de estadisticas_reportes(): arreglos de {clave, total}, no un
    diccionario indexado — este es exactamente el shape cuya versión
    incorrecta (dict) causó el bug del dashboard que se corrigió antes.
    """

    total_reportes: int
    por_estado: list[EstadisticaEstadoItem]
    por_tipo_incidente: list[EstadisticaTipoItem]
    por_severidad: list[EstadisticaSeveridadItem]
    por_mes: list[EstadisticaMesItem]
