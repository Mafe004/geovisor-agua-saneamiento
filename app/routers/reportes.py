from typing import Optional, Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pymysql
from pymysql.err import IntegrityError, ProgrammingError, OperationalError

from app.db.database import get_connection

router = APIRouter(prefix="/reportes", tags=["reportes"])


# =========================
# MODELOS (Swagger / Validación)
# =========================

class ReporteCreateRequest(BaseModel):
    id_usuario: int = Field(..., ge=1, description="ID del usuario que reporta (debe existir en tabla usuarios)")
    id_tipo_incidente: int = Field(..., ge=1, description="ID válido de tipo_incidente (NO uses 0)")
    id_severidad: int = Field(..., ge=1, description="ID válido de severidad (NO uses 0)")
    descripcion: str = Field(..., min_length=1, max_length=5000)
    direccion: Optional[str] = Field(None, max_length=255)
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    imagen_url: Optional[str] = Field(None, max_length=500)
    fuente_reporte: str = Field("CIUDADANO", max_length=50)


class CambiarEstadoRequest(BaseModel):
    id_estado_nuevo: int = Field(..., ge=1, description="ID válido de estado_reporte (NO uses 0)")
    # Si después haces historial, puedes usar estos campos, por ahora no son obligatorios:
    id_usuario_accion: Optional[int] = Field(None, ge=1)
    comentario: Optional[str] = Field(None, max_length=500)


# =========================
# HELPERS
# =========================

def _raise_db_error(e: Exception):
    # Mensajes claros para que sepas exactamente qué falló
    if isinstance(e, ProgrammingError):
        # Ej: columna inexistente, error de SQL
        raise HTTPException(status_code=500, detail=f"DB error (SQL): {e}")
    if isinstance(e, IntegrityError):
        # Ej: foreign key fails (id=0 o no existe)
        raise HTTPException(
            status_code=400,
            detail=(
                f"DB error (Integridad/FK): {e}. "
                "Verifica que los IDs existan (id_usuario, id_tipo_incidente, id_severidad, id_estado). "
                "No uses 0."
            ),
        )
    if isinstance(e, OperationalError):
        # Ej: no conecta, credenciales malas, etc.
        raise HTTPException(status_code=500, detail=f"DB error (Conexión): {e}")

    raise HTTPException(status_code=500, detail=f"DB error: {e}")


def _get_usuario_entidad(cursor, id_usuario: int) -> Optional[int]:
    """
    Para no pedir id_entidad en el body:
    lo sacamos desde la tabla usuarios (columna id_entidad)
    """
    cursor.execute("SELECT id_entidad FROM usuarios WHERE id_usuario = %s;", (id_usuario,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="id_usuario no existe en la tabla usuarios")
    return row.get("id_entidad")


def _select_reporte_detalle_sql() -> str:
    # Consulta “correcta” con nombre_completo (NO apellido / NO nombre)
    return """
    SELECT
      r.id_reporte,
      r.descripcion,
      r.direccion,
      r.created_at,
      r.id_usuario,
      r.id_entidad,
      r.id_tipo_incidente,
      r.id_severidad,
      r.id_estado,
      u.nombre_completo AS usuario,
      er.nombre AS estado,
      ti.nombre AS tipo_incidente,
      s.nombre AS severidad
    FROM reportes r
    JOIN usuarios u ON r.id_usuario = u.id_usuario
    JOIN estado_reporte er ON r.id_estado = er.id_estado
    JOIN tipo_incidente ti ON r.id_tipo_incidente = ti.id_tipo_incidente
    JOIN severidad s ON r.id_severidad = s.id_severidad
    """


# =========================
# ENDPOINTS
# =========================

@router.get("/", summary="Listar Reportes")
def listar_reportes() -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        sql = _select_reporte_detalle_sql() + " ORDER BY r.created_at DESC;"
        with conn.cursor() as cursor:
            cursor.execute(sql)
            rows = cursor.fetchall()
        return rows
    except Exception as e:
        _raise_db_error(e)
    finally:
        conn.close()


@router.get("/{id_reporte}", summary="Obtener Reporte")
def obtener_reporte(id_reporte: int) -> Dict[str, Any]:
    conn = get_connection()
    try:
        sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
        with conn.cursor() as cursor:
            cursor.execute(sql, (id_reporte,))
            row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")

        return row
    except HTTPException:
        raise
    except Exception as e:
        _raise_db_error(e)
    finally:
        conn.close()


@router.post("/", summary="Crear Reporte")
def crear_reporte(payload: ReporteCreateRequest) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 1) Validación: obtener id_entidad desde usuarios
            id_entidad = _get_usuario_entidad(cursor, payload.id_usuario)

            # 2) Estado inicial (ajústalo si tu catálogo usa otro ID)
            # Lo normal: 1 = "Pendiente" (depende tu tabla estado_reporte)
            id_estado_inicial = 1

            # 3) Insert (IMPORTANTE: NO uses 0 en ids)
            insert_sql = """
            INSERT INTO reportes (
              id_usuario, id_entidad, id_tipo_incidente, id_severidad, id_estado,
              descripcion, direccion, latitud, longitud, imagen_url, fuente_reporte
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """
            cursor.execute(
                insert_sql,
                (
                    payload.id_usuario,
                    id_entidad,
                    payload.id_tipo_incidente,
                    payload.id_severidad,
                    id_estado_inicial,
                    payload.descripcion,
                    payload.direccion,
                    payload.latitud,
                    payload.longitud,
                    payload.imagen_url,
                    payload.fuente_reporte,
                ),
            )
            new_id = cursor.lastrowid

            # 4) Devolver el reporte recién creado con JOINs (bonito para el frontend)
            sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
            cursor.execute(sql, (new_id,))
            row = cursor.fetchone()

        return {"message": "created", "reporte": row}
    except HTTPException:
        raise
    except Exception as e:
        _raise_db_error(e)
    finally:
        conn.close()


@router.put("/{id_reporte}/estado", summary="Cambiar Estado")
def cambiar_estado(id_reporte: int, payload: CambiarEstadoRequest) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verificar que exista
            cursor.execute("SELECT id_reporte FROM reportes WHERE id_reporte = %s;", (id_reporte,))
            existe = cursor.fetchone()
            if not existe:
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            # Actualizar estado
            cursor.execute(
                "UPDATE reportes SET id_estado = %s WHERE id_reporte = %s;",
                (payload.id_estado_nuevo, id_reporte),
            )

            # Devolver actualizado
            sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
            cursor.execute(sql, (id_reporte,))
            row = cursor.fetchone()

        return {"message": "updated", "reporte": row}
    except HTTPException:
        raise
    except Exception as e:
        _raise_db_error(e)
    finally:
        conn.close()
