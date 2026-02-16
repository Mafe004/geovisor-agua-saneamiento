from typing import Optional, Any, Dict, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from pymysql.err import IntegrityError, ProgrammingError, OperationalError

from app.db.database import get_connection
from app.core.deps import require_active_user

router = APIRouter(prefix="/reportes", tags=["reportes"])

# Roles según tu tabla roles:
ROLE_CIUDADANO = 1
ROLE_ENTIDAD = 2
ROLE_MODERADOR = 3
ROLE_ADMIN = 4

# Estado cuenta según tu tabla estado_cuenta:
ESTADO_CUENTA_ACTIVO = 1


# =========================
# MODELOS (Swagger / Validación)
# =========================

class ReporteCreateRequest(BaseModel):
    id_usuario: Optional[int] = Field(
        None,
        ge=1,
        description="(Opcional) Si se envía, debe coincidir con el usuario del token. Recomendado: NO enviarlo."
    )
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
    id_usuario_accion: Optional[int] = Field(None, ge=1)
    comentario: Optional[str] = Field(None, max_length=500)


# =========================
# HELPERS
# =========================

def _raise_db_error(e: Exception):
    if isinstance(e, ProgrammingError):
        raise HTTPException(status_code=500, detail=f"DB error (SQL): {e}")
    if isinstance(e, IntegrityError):
        raise HTTPException(
            status_code=400,
            detail=(
                f"DB error (Integridad/FK): {e}. "
                "Verifica que los IDs existan (id_usuario, id_tipo_incidente, id_severidad, id_estado). "
                "No uses 0."
            ),
        )
    if isinstance(e, OperationalError):
        raise HTTPException(status_code=500, detail=f"DB error (Conexión): {e}")

    raise HTTPException(status_code=500, detail=f"DB error: {e}")


def _get_usuario_entidad(cursor, id_usuario: int) -> Optional[int]:
    cursor.execute("SELECT id_entidad FROM usuarios WHERE id_usuario = %s;", (id_usuario,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="id_usuario no existe en la tabla usuarios")
    return row.get("id_entidad")


def _select_reporte_detalle_sql() -> str:
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
def listar_reportes(user: Dict[str, Any] = Depends(require_active_user)) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        base_sql = _select_reporte_detalle_sql()
        params = []

        # 1 CIUDADANO: solo los suyos
        if user["id_rol"] == ROLE_CIUDADANO:
            base_sql += " WHERE r.id_usuario = %s "
            params.append(user["id_usuario"])

        # 2 ENTIDAD: solo los de su entidad
        elif user["id_rol"] == ROLE_ENTIDAD:
            if not user.get("id_entidad"):
                raise HTTPException(status_code=403, detail="Usuario ENTIDAD sin id_entidad asignado")
            base_sql += " WHERE r.id_entidad = %s "
            params.append(user["id_entidad"])

        # 3 MODERADOR / 4 ADMIN: todos
        elif user["id_rol"] in (ROLE_MODERADOR, ROLE_ADMIN):
            pass
        else:
            raise HTTPException(status_code=403, detail="Rol desconocido")

        sql = base_sql + " ORDER BY r.created_at DESC;"

        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()

    except HTTPException:
        raise
    except Exception as e:
        _raise_db_error(e)
    finally:
        conn.close()


@router.get("/{id_reporte}", summary="Obtener Reporte")
def obtener_reporte(id_reporte: int, user: Dict[str, Any] = Depends(require_active_user)) -> Dict[str, Any]:
    conn = get_connection()
    try:
        sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
        with conn.cursor() as cursor:
            cursor.execute(sql, (id_reporte,))
            row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")

        # Permisos por rol
        if user["id_rol"] == ROLE_CIUDADANO and row["id_usuario"] != user["id_usuario"]:
            raise HTTPException(status_code=403, detail="No puedes ver reportes de otros usuarios")

        if user["id_rol"] == ROLE_ENTIDAD and row["id_entidad"] != user.get("id_entidad"):
            raise HTTPException(status_code=403, detail="No puedes ver reportes de otra entidad")

        return row

    except HTTPException:
        raise
    except Exception as e:
        _raise_db_error(e)
    finally:
        conn.close()


@router.post("/", summary="Crear Reporte")
def crear_reporte(
    payload: ReporteCreateRequest,
    user: Dict[str, Any] = Depends(require_active_user),
) -> Dict[str, Any]:

    # Seguridad extra (por si require_active_user no lo valida)
    if user.get("id_estado_cuenta") != ESTADO_CUENTA_ACTIVO:
        raise HTTPException(status_code=403, detail="Tu cuenta no está ACTIVA")

    # Solo CIUDADANO o ENTIDAD crean reportes (según tu decisión)
    if user.get("id_rol") not in (ROLE_CIUDADANO, ROLE_ENTIDAD):
        raise HTTPException(status_code=403, detail="No tienes permisos para crear reportes")

    id_usuario_token = user["id_usuario"]

    # Si mandan id_usuario, debe coincidir con el token
    if payload.id_usuario is not None and payload.id_usuario != id_usuario_token:
        raise HTTPException(status_code=403, detail="No puedes crear reportes a nombre de otro usuario")

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # id_entidad sale de usuarios (en CIUDADANO puede ser NULL y está bien si tu tabla lo permite)
            id_entidad = _get_usuario_entidad(cursor, id_usuario_token)

            # Si es ENTIDAD, debe tener id_entidad sí o sí
            if user["id_rol"] == ROLE_ENTIDAD and not id_entidad:
                raise HTTPException(status_code=403, detail="Usuario ENTIDAD sin id_entidad asignado")

            id_estado_inicial = 1  # normalmente PENDIENTE

            # Fuente según rol (opcional)
            fuente = "CIUDADANO" if user["id_rol"] == ROLE_CIUDADANO else "ENTIDAD"

            insert_sql = """
            INSERT INTO reportes (
              id_usuario, id_entidad, id_tipo_incidente, id_severidad, id_estado,
              descripcion, direccion, latitud, longitud, imagen_url, fuente_reporte
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """
            cursor.execute(
                insert_sql,
                (
                    id_usuario_token,
                    id_entidad,
                    payload.id_tipo_incidente,
                    payload.id_severidad,
                    id_estado_inicial,
                    payload.descripcion,
                    payload.direccion,
                    payload.latitud,
                    payload.longitud,
                    payload.imagen_url,
                    fuente,
                ),
            )
            new_id = cursor.lastrowid

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
def cambiar_estado(
    id_reporte: int,
    payload: CambiarEstadoRequest,
    user: Dict[str, Any] = Depends(require_active_user),
) -> Dict[str, Any]:

    # CIUDADANO no cambia estados
    if user["id_rol"] == ROLE_CIUDADANO:
        raise HTTPException(status_code=403, detail="No tienes permisos para cambiar el estado")

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verificar que exista y traer id_entidad
            cursor.execute("SELECT id_reporte, id_entidad FROM reportes WHERE id_reporte = %s;", (id_reporte,))
            rep = cursor.fetchone()
            if not rep:
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            # ENTIDAD solo puede cambiar estados de su entidad
            if user["id_rol"] == ROLE_ENTIDAD:
                if not user.get("id_entidad"):
                    raise HTTPException(status_code=403, detail="Usuario ENTIDAD sin id_entidad asignado")
                if rep.get("id_entidad") != user["id_entidad"]:
                    raise HTTPException(status_code=403, detail="No puedes modificar reportes de otra entidad")

            # MODERADOR / ADMIN: permitido sin filtro extra

            cursor.execute(
                "UPDATE reportes SET id_estado = %s WHERE id_reporte = %s;",
                (payload.id_estado_nuevo, id_reporte),
            )

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
