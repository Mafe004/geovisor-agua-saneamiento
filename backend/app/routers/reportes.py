from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.audit import Accion, Modulo, registrar_auditoria
from app.core.deps import get_client_ip, require_active_user, require_roles
from app.core.errors import handle_db_error
from app.core.policies import puede_cambiar_estado, puede_ver_reporte, scope_reportes
from app.core.roles import EstadoCuenta, Rol
from app.db.database import get_connection, transaccion
from app.schemas.reportes import (
    CambiarEstadoResponse,
    CrearReporteResponse,
    EstadisticasResponse,
    ReporteDetalle,
    ReporteMapaPunto,
)
from app.services.siasar import buscar_comunidad_cercana

router = APIRouter(prefix="/reportes", tags=["reportes"])


# =========================
# MODELOS
# =========================


class ReporteCreateRequest(BaseModel):
    id_usuario: int | None = Field(
        None,
        ge=1,
        description="(Opcional) debe coincidir con el usuario del token. Recomendado: NO enviarlo.",
    )
    id_tipo_incidente: int = Field(..., ge=1)
    id_severidad: int = Field(..., ge=1)
    descripcion: str = Field(..., min_length=1, max_length=5000)
    direccion: str | None = Field(None, max_length=255)
    latitud: float | None = None
    longitud: float | None = None
    imagen_url: str | None = Field(None, max_length=500)
    fuente_reporte: str = Field("CIUDADANO", max_length=50)


class CambiarEstadoRequest(BaseModel):
    id_estado_nuevo: int = Field(..., ge=1)
    comentario: str | None = Field(None, max_length=500)


class AsignarEntidadRequest(BaseModel):
    id_entidad: int = Field(..., ge=1)


# =========================
# HELPERS
# =========================


def _resolve_estado_ids(cursor, *nombres: str) -> list[int]:
    """
    Resuelve id_estado para uno o más nombres de estado_reporte.
    Único punto de resolución nombre→id del catálogo de estados, usado tanto
    para el estado inicial de un reporte nuevo como para el filtro
    solo_activos — evita duplicar esta lógica en dos sitios distintos.
    """
    placeholders = ", ".join(["%s"] * len(nombres))
    cursor.execute(
        f"SELECT id_estado FROM estado_reporte WHERE nombre IN ({placeholders});",
        nombres,
    )
    return [row["id_estado"] for row in cursor.fetchall()]


def _get_usuario_entidad(cursor, id_usuario: int) -> int | None:
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
      r.latitud,
      r.longitud,
      r.imagen_url,
      r.fuente_reporte,
      r.created_at,
      r.id_usuario,
      r.id_entidad,
      r.id_tipo_incidente,
      r.id_severidad,
      r.id_estado,
      u.nombre_completo AS usuario,
      er.nombre         AS estado,
      ti.nombre         AS tipo_incidente,
      s.nombre          AS severidad,
      tie.id_entidad    AS id_entidad_sugerida,
      esug.nombre_entidad AS entidad_sugerida,
      sc.id_siasar      AS vereda_id_siasar,
      sc.nombre         AS vereda_nombre,
      sc.localidad      AS vereda_localidad,
      sc.municipio      AS vereda_municipio,
      sc.calificacion   AS vereda_calificacion,
      sc.fecha_encuesta AS vereda_fecha_encuesta,
      r.distancia_siasar_m AS vereda_distancia_m
    FROM reportes r
    JOIN usuarios      u  ON r.id_usuario        = u.id_usuario
    JOIN estado_reporte er ON r.id_estado         = er.id_estado
    JOIN tipo_incidente ti ON r.id_tipo_incidente = ti.id_tipo_incidente
    JOIN severidad      s  ON r.id_severidad      = s.id_severidad
    LEFT JOIN tipo_incidente_entidad tie ON r.id_tipo_incidente = tie.id_tipo_incidente
    LEFT JOIN entidades esug ON tie.id_entidad = esug.id_entidad
    LEFT JOIN siasar_comunidad sc ON r.id_siasar_comunidad = sc.id_siasar
    """


def _anidar_vereda_siasar(row: dict[str, Any]) -> dict[str, Any]:
    """
    _select_reporte_detalle_sql() trae las columnas de la comunidad SIASAR
    enlazada "planas" (vereda_*, por el LEFT JOIN) -- ReporteDetalle.vereda_siasar
    las espera anidadas en un solo objeto (o None si el reporte no tiene
    comunidad enlazada). Muta y devuelve la misma fila.
    """
    id_siasar = row.pop("vereda_id_siasar")
    nombre = row.pop("vereda_nombre")
    localidad = row.pop("vereda_localidad")
    municipio = row.pop("vereda_municipio")
    calificacion = row.pop("vereda_calificacion")
    fecha_encuesta = row.pop("vereda_fecha_encuesta")
    distancia_m = row.pop("vereda_distancia_m")
    row["vereda_siasar"] = None if id_siasar is None else {
        "id_siasar": id_siasar,
        "nombre": nombre,
        "localidad": localidad,
        "municipio": municipio,
        "calificacion": calificacion,
        "distancia_m": distancia_m,
        "fecha_encuesta": fecha_encuesta,
    }
    return row


def _insertar_historial(
    cursor,
    id_reporte: int,
    estado_anterior: str,
    estado_nuevo: str,
    id_usuario_accion: int,
    comentario: str | None = None,
):
    """
    Inserta un registro en historial_reportes.
    Se llama tanto al CREAR un reporte como al CAMBIAR su estado.
    """
    cursor.execute(
        """
        INSERT INTO historial_reportes
            (id_reporte, estado_anterior, estado_nuevo, comentario, id_usuario_accion, fecha_cambio)
        VALUES (%s, %s, %s, %s, %s, NOW());
    """,
        (id_reporte, estado_anterior, estado_nuevo, comentario, id_usuario_accion),
    )


def _insertar_notificacion(cursor, id_usuario: int, id_reporte: int, tipo: str, mensaje: str):
    """Inserta una notificación para el dueño del reporte."""
    cursor.execute(
        """
        INSERT INTO notificaciones
            (id_usuario, id_reporte, tipo_notificacion, mensaje, leida, fecha_envio)
        VALUES (%s, %s, %s, %s, 0, NOW());
    """,
        (id_usuario, id_reporte, tipo, mensaje),
    )


# =========================
# ENDPOINTS
# =========================
#
# ⚠️ Orden importa: FastAPI/Starlette hacen match de rutas en el orden en
# que se registran. Las rutas estáticas (/mapa, /estadisticas) DEBEN ir
# antes de /{id_reporte}, o una request a /reportes/mapa hace match con
# /{id_reporte} primero (intenta parsear "mapa" como int -> 422).


@router.get("/", summary="Listar Reportes", response_model=list[ReporteDetalle])
def listar_reportes(
    id_estado: int | None = Query(None),
    id_severidad: int | None = Query(None),
    id_tipo_incidente: int | None = Query(None),
    solo_activos: bool = Query(False, description="Excluye RESUELTO y RECHAZADO"),
    municipio_siasar: str | None = Query(
        None, description="Filtra por el municipio de la comunidad SIASAR enlazada"
    ),
    limite: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict[str, Any] = Depends(require_active_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        base_sql = _select_reporte_detalle_sql()
        # Alcance por rol: control de seguridad, se aplica primero e
        # independientemente de cualquier filtro que envíe el cliente.
        conditions, params = scope_reportes(user, alias="r")

        if id_estado is not None:
            conditions.append("r.id_estado = %s")
            params.append(id_estado)
        if id_severidad is not None:
            conditions.append("r.id_severidad = %s")
            params.append(id_severidad)
        if id_tipo_incidente is not None:
            conditions.append("r.id_tipo_incidente = %s")
            params.append(id_tipo_incidente)
        if municipio_siasar is not None:
            # sc = LEFT JOIN siasar_comunidad en _select_reporte_detalle_sql();
            # un reporte sin comunidad enlazada tiene sc.municipio NULL y
            # nunca coincide, que es exactamente lo que se quiere.
            conditions.append("sc.municipio = %s")
            params.append(municipio_siasar)

        with conn.cursor() as cursor:
            if solo_activos:
                inactivos_ids = _resolve_estado_ids(cursor, "RESUELTO", "RECHAZADO")
                if inactivos_ids:
                    placeholders = ", ".join(["%s"] * len(inactivos_ids))
                    conditions.append(f"r.id_estado NOT IN ({placeholders})")
                    params.extend(inactivos_ids)

            if conditions:
                base_sql += " WHERE " + " AND ".join(conditions)

            sql = base_sql + " ORDER BY r.created_at DESC LIMIT %s OFFSET %s;"
            params.extend([limite, offset])

            cursor.execute(sql, params)
            return [_anidar_vereda_siasar(row) for row in cursor.fetchall()]

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/mapa",
    summary="Puntos para el mapa (respuesta ligera)",
    response_model=list[ReporteMapaPunto],
)
def reportes_mapa(user: dict[str, Any] = Depends(require_active_user)) -> list[dict[str, Any]]:
    """
    Endpoint optimizado para cargar los pines del geovisor.
    Devuelve solo los campos necesarios para pintar el mapa:
    id, latitud, longitud, tipo_incidente, severidad, estado.
    - CIUDADANO: solo sus reportes.
    - ENTIDAD:   solo los de su entidad.
    - MODERADOR / ADMIN: todos.
    """
    conn = get_connection()
    try:
        base_sql = """
            SELECT
                r.id_reporte,
                r.latitud,
                r.longitud,
                r.direccion,
                ti.nombre  AS tipo_incidente,
                s.nombre   AS severidad,
                er.nombre  AS estado,
                r.fecha_reporte
            FROM reportes r
            JOIN tipo_incidente  ti ON r.id_tipo_incidente = ti.id_tipo_incidente
            JOIN severidad        s ON r.id_severidad      = s.id_severidad
            JOIN estado_reporte  er ON r.id_estado         = er.id_estado
        """
        conditions, params = scope_reportes(user, alias="r")
        if conditions:
            base_sql += " WHERE " + " AND ".join(conditions)

        base_sql += " ORDER BY r.fecha_reporte DESC;"

        with conn.cursor() as cursor:
            cursor.execute(base_sql, params)
            return cursor.fetchall()

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/estadisticas",
    summary="Estadísticas generales de reportes (MODERADOR / ADMIN)",
    response_model=EstadisticasResponse,
    responses={403: {"description": "CIUDADANO no tiene permiso"}},
)
def estadisticas_reportes(user: dict[str, Any] = Depends(require_active_user)) -> dict[str, Any]:
    """
    Devuelve métricas agregadas para el dashboard:
    - Total de reportes por estado
    - Total de reportes por tipo de incidente
    - Total de reportes por severidad
    - Total de reportes por mes (últimos 6 meses)
    Solo MODERADOR y ADMIN pueden ver estadísticas globales.
    ENTIDAD solo ve las estadísticas de sus propios reportes.
    """
    # A diferencia del resto de endpoints de reportes, aquí CIUDADANO no se
    # "escoge" a sus propios datos: se bloquea por completo. Por eso este
    # caso se resuelve antes de delegar a scope_reportes, que solo cubre
    # ENTIDAD / MODERADOR / ADMIN aquí.
    if user["id_rol"] == Rol.CIUDADANO:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver estadísticas")

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Filtro según rol
            conditions, params_entidad = scope_reportes(user, alias="r")
            filtro_entidad = ("WHERE " + " AND ".join(conditions)) if conditions else ""

            # 1. Por estado
            cursor.execute(
                f"""
                SELECT er.nombre AS estado, COUNT(*) AS total
                FROM reportes r
                JOIN estado_reporte er ON r.id_estado = er.id_estado
                {filtro_entidad}
                GROUP BY er.nombre
                ORDER BY total DESC;
            """,
                params_entidad,
            )
            por_estado = cursor.fetchall()

            # 2. Por tipo de incidente
            cursor.execute(
                f"""
                SELECT ti.nombre AS tipo_incidente, COUNT(*) AS total
                FROM reportes r
                JOIN tipo_incidente ti ON r.id_tipo_incidente = ti.id_tipo_incidente
                {filtro_entidad}
                GROUP BY ti.nombre
                ORDER BY total DESC;
            """,
                params_entidad,
            )
            por_tipo = cursor.fetchall()

            # 3. Por severidad
            cursor.execute(
                f"""
                SELECT s.nombre AS severidad, COUNT(*) AS total
                FROM reportes r
                JOIN severidad s ON r.id_severidad = s.id_severidad
                {filtro_entidad}
                GROUP BY s.nombre
                ORDER BY s.id_severidad ASC;
            """,
                params_entidad,
            )
            por_severidad = cursor.fetchall()

            # 4. Por mes (últimos 6 meses)
            cursor.execute(
                f"""
                SELECT
                    DATE_FORMAT(r.fecha_reporte, '%%Y-%%m') AS mes,
                    COUNT(*) AS total
                FROM reportes r
                {filtro_entidad}
                {"WHERE" if not filtro_entidad else "AND"}
                    r.fecha_reporte >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY mes
                ORDER BY mes ASC;
            """,
                params_entidad,
            )
            por_mes = cursor.fetchall()

            # 5. Total general
            cursor.execute(
                f"""
                SELECT COUNT(*) AS total_reportes FROM reportes r {filtro_entidad};
            """,
                params_entidad,
            )
            total = cursor.fetchone()

        return {
            "total_reportes": total["total_reportes"],
            "por_estado": por_estado,
            "por_tipo_incidente": por_tipo,
            "por_severidad": por_severidad,
            "por_mes": por_mes,
        }

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/{id_reporte}",
    summary="Obtener Reporte",
    response_model=ReporteDetalle,
    responses={404: {"description": "Reporte no encontrado"}, 403: {"description": "Sin permiso"}},
)
def obtener_reporte(
    id_reporte: int, user: dict[str, Any] = Depends(require_active_user)
) -> dict[str, Any]:
    conn = get_connection()
    try:
        sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
        with conn.cursor() as cursor:
            cursor.execute(sql, (id_reporte,))
            row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        row = _anidar_vereda_siasar(row)

        if not puede_ver_reporte(user, row):
            if user["id_rol"] == Rol.CIUDADANO:
                raise HTTPException(
                    status_code=403, detail="No puedes ver reportes de otros usuarios"
                )
            raise HTTPException(status_code=403, detail="No puedes ver reportes de otra entidad")

        return row

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.post(
    "/",
    status_code=201,
    summary="Crear Reporte",
    response_model=CrearReporteResponse,
    responses={403: {"description": "Sin permiso para crear reportes"}},
)
def crear_reporte(
    payload: ReporteCreateRequest,
    user: dict[str, Any] = Depends(require_active_user),
    ip: str | None = Depends(get_client_ip),
) -> dict[str, Any]:
    if user.get("id_estado_cuenta") != EstadoCuenta.ACTIVO:
        raise HTTPException(status_code=403, detail="Tu cuenta no está ACTIVA")
    if user.get("id_rol") not in (Rol.CIUDADANO, Rol.ENTIDAD):
        raise HTTPException(status_code=403, detail="No tienes permisos para crear reportes")

    id_usuario_token = user["id_usuario"]

    if payload.id_usuario is not None and payload.id_usuario != id_usuario_token:
        raise HTTPException(
            status_code=403, detail="No puedes crear reportes a nombre de otro usuario"
        )

    try:
        with transaccion() as cursor:
            id_entidad = _get_usuario_entidad(cursor, id_usuario_token)

            if user["id_rol"] == Rol.ENTIDAD and not id_entidad:
                raise HTTPException(
                    status_code=403, detail="Usuario ENTIDAD sin id_entidad asignado"
                )

            pendiente_ids = _resolve_estado_ids(cursor, "PENDIENTE")
            if not pendiente_ids:
                raise HTTPException(
                    status_code=500,
                    detail="Catálogo estado_reporte no contiene 'PENDIENTE'",
                )
            id_estado_inicial = pendiente_ids[0]
            fuente = "CIUDADANO" if user["id_rol"] == Rol.CIUDADANO else "ENTIDAD"

            cursor.execute(
                """
                INSERT INTO reportes (
                    id_usuario, id_entidad, id_tipo_incidente, id_severidad, id_estado,
                    descripcion, direccion, latitud, longitud, imagen_url, fuente_reporte
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """,
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

            # Vínculo SIASAR: el cliente nunca envía id_siasar_comunidad/
            # distancia_siasar_m (ReporteCreateRequest no declara esos
            # campos, así que si los manda se ignoran) -- se calculan acá,
            # en la misma transacción del INSERT, igual que hace el
            # backfill del importador para reportes ya existentes.
            if payload.latitud is not None and payload.longitud is not None:
                resultado_siasar = buscar_comunidad_cercana(
                    cursor, payload.latitud, payload.longitud, 2000
                )
                if resultado_siasar:
                    comunidad_row, distancia_m = resultado_siasar
                    cursor.execute(
                        "UPDATE reportes SET id_siasar_comunidad = %s, distancia_siasar_m = %s "
                        "WHERE id_reporte = %s;",
                        (comunidad_row["id_siasar"], distancia_m, new_id),
                    )

            # ✅ REGISTRAR EN HISTORIAL: evento de creación
            _insertar_historial(
                cursor,
                id_reporte=new_id,
                estado_anterior="NINGUNO",  # no existía antes
                estado_nuevo="PENDIENTE",  # estado inicial
                id_usuario_accion=id_usuario_token,
                comentario="Reporte creado por el usuario",
            )

            # ✅ NOTIFICACIÓN: confirmación al creador
            _insertar_notificacion(
                cursor,
                id_usuario=id_usuario_token,
                id_reporte=new_id,
                tipo="REPORTE_CREADO",
                mensaje="Tu reporte fue creado exitosamente y está en estado PENDIENTE",
            )

            registrar_auditoria(
                cursor,
                id_usuario=id_usuario_token,
                accion=Accion.CREAR_REPORTE,
                modulo=Modulo.REPORTES,
                ip=ip,
            )

            # Retornar el reporte recién creado con todos los datos
            sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
            cursor.execute(sql, (new_id,))
            row = _anidar_vereda_siasar(cursor.fetchone())

        return {"message": "created", "reporte": row}

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)


@router.put(
    "/{id_reporte}/estado",
    summary="Cambiar Estado",
    response_model=CambiarEstadoResponse,
    responses={404: {"description": "Reporte no encontrado"}, 403: {"description": "Sin permiso"}, 400: {"description": "id_estado_nuevo no existe"}},
)
def cambiar_estado(
    id_reporte: int,
    payload: CambiarEstadoRequest,
    user: dict[str, Any] = Depends(require_active_user),
    ip: str | None = Depends(get_client_ip),
) -> dict[str, Any]:
    try:
        with transaccion() as cursor:
            # Obtener reporte actual con su estado actual
            cursor.execute(
                """
                SELECT r.id_reporte, r.id_entidad, r.id_usuario,
                       er.nombre AS estado_actual
                FROM reportes r
                JOIN estado_reporte er ON r.id_estado = er.id_estado
                WHERE r.id_reporte = %s;
            """,
                (id_reporte,),
            )
            rep = cursor.fetchone()
            if not rep:
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            if not puede_cambiar_estado(user, rep):
                if user["id_rol"] == Rol.ENTIDAD and not user.get("id_entidad"):
                    raise HTTPException(
                        status_code=403, detail="Usuario ENTIDAD sin id_entidad asignado"
                    )
                if user["id_rol"] == Rol.ENTIDAD:
                    raise HTTPException(
                        status_code=403, detail="No puedes modificar reportes de otra entidad"
                    )
                raise HTTPException(
                    status_code=403, detail="No tienes permisos para cambiar el estado"
                )

            # Obtener nombre del nuevo estado
            cursor.execute(
                "SELECT nombre FROM estado_reporte WHERE id_estado = %s;",
                (payload.id_estado_nuevo,),
            )
            nuevo_estado_row = cursor.fetchone()
            if not nuevo_estado_row:
                raise HTTPException(status_code=400, detail="id_estado_nuevo no existe")
            nombre_estado_nuevo = nuevo_estado_row["nombre"]

            # Actualizar estado del reporte
            cursor.execute(
                "UPDATE reportes SET id_estado = %s, updated_at = NOW() WHERE id_reporte = %s;",
                (payload.id_estado_nuevo, id_reporte),
            )

            # ✅ REGISTRAR EN HISTORIAL: cambio de estado
            _insertar_historial(
                cursor,
                id_reporte=id_reporte,
                estado_anterior=rep["estado_actual"],
                estado_nuevo=nombre_estado_nuevo,
                id_usuario_accion=user["id_usuario"],
                comentario=payload.comentario,
            )

            # ✅ NOTIFICACIÓN: avisar al dueño del reporte
            _insertar_notificacion(
                cursor,
                id_usuario=rep["id_usuario"],
                id_reporte=id_reporte,
                tipo="CAMBIO_ESTADO",
                mensaje=f"Tu reporte cambió a {nombre_estado_nuevo}",
            )

            registrar_auditoria(
                cursor,
                id_usuario=user["id_usuario"],
                accion=Accion.CAMBIAR_ESTADO,
                modulo=Modulo.REPORTES,
                ip=ip,
            )

            # Retornar reporte actualizado
            sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
            cursor.execute(sql, (id_reporte,))
            row = _anidar_vereda_siasar(cursor.fetchone())

        return {"message": "updated", "reporte": row}

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)


@router.put(
    "/{id_reporte}/entidad",
    summary="Asignar/reasignar la entidad de un reporte (MODERADOR/ADMIN)",
    response_model=CambiarEstadoResponse,
    responses={
        404: {"description": "Reporte o entidad no encontrada"},
        403: {"description": "Sin permiso"},
    },
)
def asignar_entidad(
    id_reporte: int,
    payload: AsignarEntidadRequest,
    user: dict[str, Any] = Depends(require_roles(Rol.MODERADOR, Rol.ADMIN)),
    ip: str | None = Depends(get_client_ip),
) -> dict[str, Any]:
    """
    A diferencia de cambiar_estado, esto SIEMPRE es MODERADOR/ADMIN (nunca
    la propia entidad ni el ciudadano dueño) — reasignar de qué entidad es
    un reporte es una decisión de triage, no algo que a nadie le convenga
    hacerse a sí mismo. Por eso el gate es require_roles a nivel de ruta
    (igual que infraestructura.py), no un chequeo puede_* a nivel de fila
    como cambiar_estado (que sí necesita dejar pasar a la propia entidad).
    """
    try:
        with transaccion() as cursor:
            cursor.execute("SELECT id_reporte FROM reportes WHERE id_reporte = %s;", (id_reporte,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Reporte no encontrado")

            cursor.execute(
                "SELECT id_entidad FROM entidades WHERE id_entidad = %s;", (payload.id_entidad,)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Entidad no encontrada")

            cursor.execute(
                "UPDATE reportes SET id_entidad = %s, updated_at = NOW() WHERE id_reporte = %s;",
                (payload.id_entidad, id_reporte),
            )

            # No se toca historial_reportes: esa tabla es para transiciones
            # de estado, no para reasignaciones de entidad -- el registro
            # de auditoría es el rastro de esta acción.
            registrar_auditoria(
                cursor,
                id_usuario=user["id_usuario"],
                accion=Accion.ASIGNAR_ENTIDAD,
                modulo=Modulo.REPORTES,
                ip=ip,
            )

            sql = _select_reporte_detalle_sql() + " WHERE r.id_reporte = %s;"
            cursor.execute(sql, (id_reporte,))
            row = _anidar_vereda_siasar(cursor.fetchone())

        return {"message": "updated", "reporte": row}

    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
