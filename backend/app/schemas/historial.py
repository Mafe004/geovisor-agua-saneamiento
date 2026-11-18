from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.reportes import ImagenReporte


class HistorialEntry(BaseModel):
    """Forma de _select_historial_sql() — JOIN usuarios/roles son INNER, nunca None."""

    model_config = ConfigDict(from_attributes=True)

    id_historial: int
    id_reporte: int
    estado_anterior: str
    estado_nuevo: str
    comentario: str | None
    imagen_url: str | None
    id_usuario_accion: int
    usuario_accion: str
    rol_usuario_accion: str
    fecha_cambio: datetime
    # Migración 0008: evidencia adicional de esta transición (además de
    # imagen_url, que se conserva por compatibilidad). Vacía salvo que el
    # endpoint la llene explícitamente -- ver historial_reporte() en
    # historial.py, que sí lo hace; listar_historial_global() no, para no
    # pagar una consulta extra por fila en un feed que puede traer hasta 500.
    imagenes: list[ImagenReporte] = Field(default_factory=list)


class HistorialEntryComunidad(BaseModel):
    """Vista comunitaria de GET /reportes/{id_reporte}/historial: igual que
    HistorialEntry pero sin id_usuario_accion ni usuario_accion (quién hizo
    el cambio es un dato personal) -- ver puede_ver_detalle_comunitario() en
    app.core.policies.

    extra="forbid" por la misma razón que ReporteComunidadDetalle: el
    response_model de historial_reporte es list[HistorialEntry] |
    list[HistorialEntryComunidad], y sin este guardado una fila completa
    también validaría aquí, dejando la unión ambigua."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id_historial: int
    id_reporte: int
    estado_anterior: str
    estado_nuevo: str
    comentario: str | None
    imagen_url: str | None
    rol_usuario_accion: str
    fecha_cambio: datetime
    imagenes: list[ImagenReporte] = Field(default_factory=list)
