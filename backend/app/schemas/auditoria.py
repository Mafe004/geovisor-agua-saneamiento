from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LogAuditoriaItem(BaseModel):
    """Forma de listar_logs() — LEFT JOIN usuarios, así que id_usuario/usuario
    pueden ser None (logs_auditoria.id_usuario ON DELETE SET NULL)."""

    model_config = ConfigDict(from_attributes=True)

    id_log: int
    id_usuario: int | None
    usuario: str | None
    accion: str
    modulo: str
    ip_origen: str | None
    fecha_accion: datetime


class ListarLogsResponse(BaseModel):
    total: int
    logs: list[LogAuditoriaItem]


class ResumenModuloItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    modulo: str
    total_acciones: int
