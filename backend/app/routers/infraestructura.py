from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import pymysql

from app.db.database import get_connection
from app.core.deps import require_active_user, require_roles

router = APIRouter(prefix="/infraestructura", tags=["Infraestructura Hídrica"])


# =========================
# MODELOS
# =========================

class InfraestructuraCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=120)
    tipo: str = Field(..., min_length=1, max_length=80,
                      description="Ej: PTAR, ACUEDUCTO, POZO, EMBALSE, ALCANTARILLADO")
    latitud: float = Field(..., ge=-90, le=90)
    longitud: float = Field(..., ge=-180, le=180)
    fuente: Optional[str] = Field(None, max_length=200,
                                   description="Fuente del dato, ej: SIASAR")
    estado: Optional[str] = Field(None, max_length=40,
                                   description="Ej: ACTIVA, INACTIVA, EN_MANTENIMIENTO")


class InfraestructuraUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=120)
    tipo: Optional[str] = Field(None, min_length=1, max_length=80)
    latitud: Optional[float] = Field(None, ge=-90, le=90)
    longitud: Optional[float] = Field(None, ge=-180, le=180)
    fuente: Optional[str] = Field(None, max_length=200)
    estado: Optional[str] = Field(None, max_length=40)


# =========================
# ENDPOINTS
# =========================

@router.get(
    "/",
    summary="Listar toda la infraestructura hídrica"
)
def listar_infraestructura(
    user: Dict[str, Any] = Depends(require_active_user)  # ✅ Requiere token
) -> List[Dict[str, Any]]:
    """
    Devuelve todos los puntos de infraestructura hídrica.
    Estos datos se usan para pintar la capa en el mapa del geovisor.
    Accesible para todos los roles activos.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    id_infraestructura,
                    nombre,
                    tipo,
                    latitud,
                    longitud,
                    fuente,
                    estado,
                    fecha_actualizacion
                FROM infraestructura_hidrica
                ORDER BY nombre ASC;
            """)
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.get(
    "/{id_infraestructura}",
    summary="Detalle de un punto de infraestructura"
)
def detalle_infraestructura(
    id_infraestructura: int,
    user: Dict[str, Any] = Depends(require_active_user)
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM infraestructura_hidrica WHERE id_infraestructura = %s;",
                (id_infraestructura,)
            )
            registro = cursor.fetchone()
            if not registro:
                raise HTTPException(status_code=404, detail="Infraestructura no encontrada")
            return registro
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.post(
    "/",
    status_code=201,
    summary="Registrar nueva infraestructura hídrica (MODERADOR / ADMIN)"
)
def crear_infraestructura(
    data: InfraestructuraCreate,
    user: Dict[str, Any] = Depends(require_roles(3, 4))  # ✅ Solo MODERADOR y ADMIN
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO infraestructura_hidrica
                    (nombre, tipo, latitud, longitud, fuente, estado)
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                data.nombre, data.tipo,
                data.latitud, data.longitud,
                data.fuente, data.estado
            ))
            nuevo_id = cursor.lastrowid
        return {
            "message": "Infraestructura registrada exitosamente",
            "id_infraestructura": nuevo_id
        }
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.put(
    "/{id_infraestructura}",
    summary="Actualizar infraestructura hídrica (MODERADOR / ADMIN)"
)
def actualizar_infraestructura(
    id_infraestructura: int,
    data: InfraestructuraUpdate,
    user: Dict[str, Any] = Depends(require_roles(3, 4))  # ✅ Solo MODERADOR y ADMIN
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id_infraestructura FROM infraestructura_hidrica WHERE id_infraestructura = %s;",
                (id_infraestructura,)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Infraestructura no encontrada")

            # Solo actualizar campos que vienen con valor
            campos = {k: v for k, v in data.model_dump().items() if v is not None}
            if not campos:
                raise HTTPException(status_code=400, detail="No se enviaron campos para actualizar")

            set_clause = ", ".join([f"{k} = %s" for k in campos])
            valores = list(campos.values()) + [id_infraestructura]

            cursor.execute(
                f"UPDATE infraestructura_hidrica SET {set_clause}, fecha_actualizacion = NOW() "
                f"WHERE id_infraestructura = %s;",
                valores
            )
        return {"message": "Infraestructura actualizada exitosamente"}
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()
