from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HistorialEntry(BaseModel):
    """Forma de _select_historial_sql() — JOIN usuarios/roles son INNER, nunca None."""

    model_config = ConfigDict(from_attributes=True)

    id_historial: int
    id_reporte: int
    estado_anterior: str
    estado_nuevo: str
    comentario: str | None
    id_usuario_accion: int
    usuario_accion: str
    rol_usuario_accion: str
    fecha_cambio: datetime


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
    rol_usuario_accion: str
    fecha_cambio: datetime
