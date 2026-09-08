from datetime import date

import pymysql
from fastapi import APIRouter, Depends, Query

from app.core.deps import require_roles
from app.core.errors import handle_db_error
from app.core.roles import Rol
from app.db.database import get_connection
from app.schemas.auditoria import ListarLogsResponse, ResumenModuloItem

router = APIRouter(prefix="/auditoria", tags=["Auditoría"])


@router.get("/", summary="Listar logs de auditoría (solo ADMIN)", response_model=ListarLogsResponse)
def listar_logs(
    modulo: str | None = Query(None),
    id_usuario: int | None = Query(None),
    desde: date | None = Query(None, description="Filtra fecha_accion >= desde (inclusive)"),
    hasta: date | None = Query(None, description="Filtra fecha_accion <= hasta (inclusive)"),
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(require_roles(Rol.ADMIN)),
):
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            query = """
                SELECT
                    l.id_log,
                    l.id_usuario,
                    u.nombre_completo AS usuario,
                    l.accion,
                    l.modulo,
                    l.ip_origen,
                    l.fecha_accion
                FROM logs_auditoria l
                LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
                WHERE 1=1
            """
            params = []
            if modulo:
                query += " AND l.modulo = %s"
                params.append(modulo)
            if id_usuario:
                query += " AND l.id_usuario = %s"
                params.append(id_usuario)
            if desde:
                query += " AND DATE(l.fecha_accion) >= %s"
                params.append(desde)
            if hasta:
                query += " AND DATE(l.fecha_accion) <= %s"
                params.append(hasta)
            query += " ORDER BY l.fecha_accion DESC LIMIT %s OFFSET %s"
            params.extend([limite, offset])
            cursor.execute(query, params)
            logs = cursor.fetchall()
        return {"total": len(logs), "logs": logs}
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        if conn:
            conn.close()


@router.get(
    "/modulos",
    summary="Resumen de acciones por módulo (solo ADMIN)",
    response_model=list[ResumenModuloItem],
)
def resumen_modulos(user=Depends(require_roles(Rol.ADMIN))):
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT modulo, COUNT(*) AS total_acciones
                FROM logs_auditoria
                GROUP BY modulo
                ORDER BY total_acciones DESC
            """)
            resultado = cursor.fetchall()
        return resultado
    except pymysql.MySQLError as e:
        handle_db_error(e)
    finally:
        if conn:
            conn.close()
