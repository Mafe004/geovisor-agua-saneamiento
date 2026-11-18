from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.siasar import VeredaSiasarResumen


class ImagenReporte(BaseModel):
    """Una fila de reporte_imagenes (migración 0008). `tipo` no viaja aquí
    -- cada lista (ReporteDetalle.imagenes vs HistorialEntry.imagenes) ya
    es de un solo tipo por construcción (el SELECT que la llena filtra por
    tipo), así que repetirlo en cada fila no agrega información."""

    model_config = ConfigDict(from_attributes=True)

    id_imagen: int
    imagen_url: str
    creado_en: datetime


class ReporteDetalle(BaseModel):
    """Forma de _select_reporte_detalle_sql() en reportes.py — los JOIN a
    usuarios/estado_reporte/tipo_incidente/severidad son INNER (nunca None),
    pero los de tipo_incidente_entidad/entidades (la sugerencia de a qué
    entidad triar el reporte) son LEFT — un tipo_incidente sin fila en
    tipo_incidente_entidad da id_entidad_sugerida/entidad_sugerida = None,
    y eso es válido: significa "sin sugerencia todavía", no un error."""

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
    id_entidad_sugerida: int | None
    entidad_sugerida: str | None
    # Campo aditivo (Fase 4 de SIASAR_INTEGRATION_NOTES.md): None cuando el
    # reporte no cayó dentro de los 2km de ninguna comunidad SIASAR
    # registrada al crearse -- nunca se recalcula después.
    vereda_siasar: VeredaSiasarResumen | None = None
    # Reparto interno de la entidad (migración 0006): None = todavía sin
    # asignar a un trabajador específico, el pool de la entidad sigue
    # viéndolo como disponible. No confundir con id_entidad/entidad_sugerida
    # (a qué ENTIDAD pertenece/se sugiere el reporte) -- esto es a qué
    # TRABAJADOR dentro de esa entidad.
    id_usuario_asignado: int | None
    usuario_asignado: str | None
    # Migración 0008: fotos adicionales del INCIDENTE (además de
    # imagen_url, que se conserva por compatibilidad con reportes viejos
    # de una sola foto). Vacía salvo que el endpoint la llene explícitamente
    # (obtener_reporte/crear_reporte/cambiar_estado/asignar_* sí;
    # listar_reportes no, para no pagar una consulta extra por fila).
    imagenes: list[ImagenReporte] = Field(default_factory=list)


class ReporteComunidadDetalle(BaseModel):
    """Vista comunitaria de GET /reportes/{id_reporte}: misma fuente que
    ReporteDetalle (_select_reporte_detalle_sql()), pero sin id_usuario ni
    usuario (nombre del creador) -- la que ve un CIUDADANO que consulta el
    reporte de otro (ver puede_ver_detalle_comunitario()).

    extra="forbid" es intencional: el response_model de obtener_reporte es
    ReporteDetalle | ReporteComunidadDetalle, y sin este guardado la fila
    completa de un dueño (que sí trae id_usuario/usuario, campos "extra"
    para este schema) también validaría aquí, dejando la unión ambigua."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id_reporte: int
    descripcion: str
    direccion: str | None
    latitud: float
    longitud: float
    imagen_url: str | None
    fuente_reporte: str
    created_at: datetime
    id_entidad: int | None
    id_tipo_incidente: int
    id_severidad: int
    id_estado: int
    estado: str
    tipo_incidente: str
    severidad: str
    id_entidad_sugerida: int | None
    entidad_sugerida: str | None
    vereda_siasar: VeredaSiasarResumen | None = None
    imagenes: list[ImagenReporte] = Field(default_factory=list)


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


class SubirImagenResponse(BaseModel):
    """Respuesta de POST /reportes/imagen: ruta relativa (sin host) que el
    cliente manda luego como imagen_url al crear el reporte -- el host lo
    pone el frontend al mostrarla (API_URL), así una IP LAN que cambie no
    deja URLs rotas guardadas en la base."""

    imagen_url: str


class CambiarEstadoResponse(BaseModel):
    message: str
    reporte: ReporteDetalle


class AsignarUsuarioReporteResponse(BaseModel):
    """Respuesta de PUT /reportes/{id_reporte}/asignar-usuario."""

    message: str
    reporte: ReporteDetalle


class EditarReporteResponse(BaseModel):
    """Respuesta de PUT /reportes/{id_reporte}: el reporte ya editado, con
    la misma forma completa que devuelve crear_reporte()."""

    message: str
    reporte: ReporteDetalle


class EliminarReporteResponse(BaseModel):
    """Respuesta de DELETE /reportes/{id_reporte}: el reporte ya no existe,
    así que solo se devuelve su id para que el cliente lo saque de sus
    listas/mapa."""

    message: str
    id_reporte: int


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
