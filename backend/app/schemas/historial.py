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
