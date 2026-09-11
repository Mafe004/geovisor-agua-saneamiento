"""
Capa SIASAR (Cundinamarca) — solo lectura. Ver constraint 2:
sin POST/PUT/PATCH/DELETE ni endpoint de carga de archivo; los datos
entran únicamente por scripts/importar_siasar.py.

⚠️ Orden importa (igual que reportes.py): las rutas estáticas
(/municipios, /comunidades/mapa, /sistemas/mapa, /cercana,
/resumen-municipios) van antes de /comunidades/{id_siasar} y
/sistemas/{id_siasar}.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import require_active_user, require_roles
from app.core.errors import handle_db_error
from app.core.roles import Rol
from app.db.database import get_connection
from app.schemas.siasar import (
    CercanaResponse,
    ComunidadDetalle,
    ComunidadMapa,
    MunicipioSiasar,
    ResumenMunicipio,
    SistemaDetalle,
    SistemaMapa,
)
from app.services.siasar import FUENTE_ATRIBUCION, buscar_comunidad_cercana

router = APIRouter(prefix="/siasar", tags=["SIASAR"])

_MAX_FILAS = 1000


def _comunidad_detalle(cursor, id_siasar: int) -> dict[str, Any] | None:
    cursor.execute("SELECT * FROM siasar_comunidad WHERE id_siasar = %s;", (id_siasar,))
    comunidad = cursor.fetchone()
    if not comunidad:
        return None
    cursor.execute(
        """
        SELECT s.id_siasar, s.nombre, s.cloracion, s.prueba_coliformes,
               s.prueba_fisicoquimica, s.horas_servicio, s.fecha_encuesta
        FROM siasar_sistema s
        JOIN siasar_comunidad_sistema cs ON cs.id_siasar_sistema = s.id_siasar
        WHERE cs.id_siasar_comunidad = %s
        ORDER BY s.nombre;
        """,
        (id_siasar,),
    )
    sistemas = cursor.fetchall()
    return {**comunidad, "sistemas": sistemas, "fuente": FUENTE_ATRIBUCION}


def _sistema_detalle(cursor, id_siasar: int) -> dict[str, Any] | None:
    cursor.execute("SELECT * FROM siasar_sistema WHERE id_siasar = %s;", (id_siasar,))
    sistema = cursor.fetchone()
    if not sistema:
        return None
    cursor.execute(
        """
        SELECT c.id_siasar, c.nombre, c.calificacion
        FROM siasar_comunidad c
        JOIN siasar_comunidad_sistema cs ON cs.id_siasar_comunidad = c.id_siasar
        WHERE cs.id_siasar_sistema = %s
        ORDER BY c.nombre;
        """,
        (id_siasar,),
    )
    comunidades = cursor.fetchall()
    return {**sistema, "comunidades": comunidades, "fuente": FUENTE_ATRIBUCION}


@router.get(
    "/municipios",
    summary="Municipios con datos SIASAR y sus conteos",
    response_model=list[MunicipioSiasar],
)
def listar_municipios(user: dict[str, Any] = Depends(require_active_user)) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    m.municipio,
                    (SELECT COUNT(*) FROM siasar_comunidad c WHERE c.municipio = m.municipio) AS comunidades,
                    (SELECT COUNT(*) FROM siasar_sistema  s WHERE s.municipio = m.municipio) AS sistemas
                FROM (
                    SELECT municipio FROM siasar_comunidad
                    UNION
                    SELECT municipio FROM siasar_sistema
                ) m
                ORDER BY m.municipio
                LIMIT %s;
                """,
                (_MAX_FILAS,),
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/comunidades/mapa",
    summary="Comunidades SIASAR de un municipio (para el mapa)",
    response_model=list[ComunidadMapa],
)
def comunidades_mapa(
    municipio: str = Query(..., description="Debe coincidir exactamente con /siasar/municipios"),
    user: dict[str, Any] = Depends(require_active_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id_siasar, nombre, latitud, longitud, calificacion
                FROM siasar_comunidad
                WHERE municipio = %s
                ORDER BY nombre
                LIMIT %s;
                """,
                (municipio, _MAX_FILAS),
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/sistemas/mapa",
    summary="Sistemas (acueductos) SIASAR de un municipio (para el mapa)",
    response_model=list[SistemaMapa],
)
def sistemas_mapa(
    municipio: str = Query(..., description="Debe coincidir exactamente con /siasar/municipios"),
    user: dict[str, Any] = Depends(require_active_user),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id_siasar, nombre, latitud, longitud, cloracion, prueba_coliformes
                FROM siasar_sistema
                WHERE municipio = %s
                ORDER BY nombre
                LIMIT %s;
                """,
                (municipio, _MAX_FILAS),
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/cercana",
    summary="Comunidad SIASAR más cercana a un punto",
    response_model=CercanaResponse,
)
def cercana(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radio_m: int = Query(2000, ge=50, le=10000),
    user: dict[str, Any] = Depends(require_active_user),
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            resultado = buscar_comunidad_cercana(cursor, lat, lon, radio_m)
            if not resultado:
                return {"comunidad": None, "distancia_m": None}
            comunidad_row, distancia_m = resultado
            detalle = _comunidad_detalle(cursor, comunidad_row["id_siasar"])
            return {"comunidad": detalle, "distancia_m": distancia_m}
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/resumen-municipios",
    summary="SIASAR vs. reportes ciudadanos, agregado por municipio (ADMIN/MODERADOR)",
    response_model=list[ResumenMunicipio],
)
def resumen_municipios(
    user: dict[str, Any] = Depends(require_roles(Rol.MODERADOR, Rol.ADMIN)),
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    m.municipio,
                    (SELECT COUNT(*) FROM siasar_comunidad c WHERE c.municipio = m.municipio) AS comunidades,
                    (SELECT COUNT(*) FROM siasar_comunidad c WHERE c.municipio = m.municipio AND c.calificacion = 'D') AS comunidades_d,
                    (SELECT COUNT(*) FROM siasar_sistema s WHERE s.municipio = m.municipio) AS sistemas,
                    (SELECT COUNT(*) FROM siasar_sistema s WHERE s.municipio = m.municipio AND s.cloracion IN ('NO_SE_REALIZA','NO_FUNCIONA')) AS sistemas_sin_cloracion,
                    (SELECT COUNT(*) FROM siasar_sistema s WHERE s.municipio = m.municipio AND s.prueba_coliformes = 'NO_PASA') AS sistemas_no_pasa_coliformes,
                    (SELECT COUNT(*) FROM siasar_sistema s WHERE s.municipio = m.municipio AND s.prueba_coliformes = 'SIN_PRUEBA') AS sistemas_sin_prueba_coliformes,
                    (SELECT COUNT(*) FROM reportes r
                        JOIN siasar_comunidad c2 ON r.id_siasar_comunidad = c2.id_siasar
                        WHERE c2.municipio = m.municipio) AS reportes_total,
                    (SELECT COUNT(*) FROM reportes r
                        JOIN siasar_comunidad c2 ON r.id_siasar_comunidad = c2.id_siasar
                        JOIN estado_reporte er ON r.id_estado = er.id_estado
                        WHERE c2.municipio = m.municipio AND er.nombre NOT IN ('RESUELTO', 'RECHAZADO')) AS reportes_abiertos,
                    LEAST(
                        COALESCE((SELECT MIN(fecha_encuesta) FROM siasar_comunidad c WHERE c.municipio = m.municipio), '9999-12-31'),
                        COALESCE((SELECT MIN(fecha_encuesta) FROM siasar_sistema s WHERE s.municipio = m.municipio), '9999-12-31')
                    ) AS fecha_encuesta_min,
                    GREATEST(
                        COALESCE((SELECT MAX(fecha_encuesta) FROM siasar_comunidad c WHERE c.municipio = m.municipio), '0001-01-01'),
                        COALESCE((SELECT MAX(fecha_encuesta) FROM siasar_sistema s WHERE s.municipio = m.municipio), '0001-01-01')
                    ) AS fecha_encuesta_max
                FROM (
                    SELECT municipio FROM siasar_comunidad
                    UNION
                    SELECT municipio FROM siasar_sistema
                ) m
                ORDER BY comunidades_d DESC;
                """
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/comunidades/{id_siasar}",
    summary="Detalle de una comunidad (vereda) SIASAR",
    response_model=ComunidadDetalle,
    responses={404: {"description": "Comunidad no encontrada"}},
)
def obtener_comunidad(
    id_siasar: int, user: dict[str, Any] = Depends(require_active_user)
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            detalle = _comunidad_detalle(cursor, id_siasar)
        if not detalle:
            raise HTTPException(status_code=404, detail="Comunidad SIASAR no encontrada")
        return detalle
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()


@router.get(
    "/sistemas/{id_siasar}",
    summary="Detalle de un sistema (acueducto) SIASAR",
    response_model=SistemaDetalle,
    responses={404: {"description": "Sistema no encontrado"}},
)
def obtener_sistema(
    id_siasar: int, user: dict[str, Any] = Depends(require_active_user)
) -> dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            detalle = _sistema_detalle(cursor, id_siasar)
        if not detalle:
            raise HTTPException(status_code=404, detail="Sistema SIASAR no encontrado")
        return detalle
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e)
    finally:
        conn.close()
