from fastapi import APIRouter, Depends, HTTPException
from app.core.deps import require_roles
from app.db.database import get_connection
import pymysql

router = APIRouter(prefix="/auditoria", tags=["Auditoría"])

ADMIN = 4

@router.get("/", summary="Listar logs de auditoría (solo ADMIN)")
def listar_logs(
    modulo: str = None,
    id_usuario: int = None,
    limite: int = 100,
    user=Depends(require_roles(ADMIN))
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
            query += " ORDER BY l.fecha_accion DESC LIMIT %s"
            params.append(limite)
            cursor.execute(query, params)
            logs = cursor.fetchall()
        return {"total": len(logs), "logs": logs}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Error BD: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/modulos", summary="Resumen de acciones por módulo (solo ADMIN)")
def resumen_modulos(user=Depends(require_roles(ADMIN))):
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
        raise HTTPException(status_code=500, detail=f"Error BD: {str(e)}")
    finally:
        if conn:
            conn.close()
