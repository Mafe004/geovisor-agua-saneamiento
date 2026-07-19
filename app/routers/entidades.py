from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr
import pymysql

from app.db.database import get_connection
from app.core.deps import require_active_user, require_roles

router = APIRouter(prefix="/entidades", tags=["Entidades"])

# ============================================================
# MODELOS
# ============================================================

class EntidadCreate(BaseModel):
    nombre_entidad:          str      = Field(..., min_length=2, max_length=150,
                                              description="Nombre oficial de la entidad")
    nit_rut:                 str      = Field(..., min_length=3, max_length=30,
                                              description="NIT o RUT de la entidad")
    correo_institucional:    EmailStr = Field(..., description="Correo oficial de contacto")
    telefono:                Optional[str]  = Field(None, max_length=20)
    direccion:               Optional[str]  = Field(None, max_length=150)
    funcionario_responsable: Optional[str]  = Field(None, max_length=150)
    documento_funcionario:   Optional[str]  = Field(None, max_length=50)
    sitio_web:               Optional[str]  = Field(None, max_length=200)


class EntidadUpdate(BaseModel):
    nombre_entidad:          Optional[str]  = Field(None, min_length=2, max_length=150)
    correo_institucional:    Optional[EmailStr] = None
    telefono:                Optional[str]  = Field(None, max_length=20)
    direccion:               Optional[str]  = Field(None, max_length=150)
    funcionario_responsable: Optional[str]  = Field(None, max_length=150)
    documento_funcionario:   Optional[str]  = Field(None, max_length=50)
    sitio_web:               Optional[str]  = Field(None, max_length=200)


class CambiarEstadoEntidad(BaseModel):
    id_estado_cuenta: int = Field(
        ..., ge=1, le=4,
        description="1=ACTIVO, 2=INACTIVO, 3=SUSPENDIDO, 4=PENDIENTE"
    )


# ============================================================
# HELPERS
# ============================================================

def _select_entidad_sql() -> str:
    return """
        SELECT
            e.id_entidad,
            e.nombre_entidad,
            e.nit_rut,
            e.correo_institucional,
            e.telefono,
            e.direccion,
            e.funcionario_responsable,
            e.documento_funcionario,
            e.sitio_web,
            ec.nombre AS estado_cuenta,
            e.created_at,
            e.updated_at
        FROM entidades e
        JOIN estado_cuenta ec ON ec.id_estado_cuenta = e.id_estado_cuenta
    """


# ============================================================
# ENDPOINTS — LECTURA (todos los roles activos)
# ============================================================

@router.get(
    "/",
    summary="Listar todas las entidades (cualquier usuario activo)"
)
def listar_entidades(
    user: Dict[str, Any] = Depends(require_active_user)
) -> List[Dict[str, Any]]:
    """
    Devuelve todas las entidades registradas con su estado de cuenta.
    Útil para que el ADMIN asigne una entidad a un usuario
    y para que el frontend muestre el nombre de la entidad en un reporte.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                _select_entidad_sql() + " ORDER BY e.nombre_entidad ASC;"
            )
            return cursor.fetchall()
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.get(
    "/{id_entidad}",
    summary="Detalle de una entidad (cualquier usuario activo)"
)
def detalle_entidad(
    id_entidad: int,
    user: Dict[str, Any] = Depends(require_active_user)
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                _select_entidad_sql() + " WHERE e.id_entidad = %s;",
                (id_entidad,)
            )
            registro = cursor.fetchone()
            if not registro:
                raise HTTPException(status_code=404, detail="Entidad no encontrada")
            return registro
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


# ============================================================
# ENDPOINTS — ESCRITURA (solo ADMIN)
# ============================================================

@router.post(
    "/",
    status_code=201,
    summary="Crear nueva entidad (solo ADMIN)"
)
def crear_entidad(
    data: EntidadCreate,
    user: Dict[str, Any] = Depends(require_roles(4))
) -> Dict[str, Any]:
    """
    El ADMINISTRADOR registra una nueva entidad institucional.
    La entidad se crea con estado ACTIVO (id_estado_cuenta=1) por defecto.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verificar NIT duplicado
            cursor.execute(
                "SELECT id_entidad FROM entidades WHERE nit_rut = %s;",
                (data.nit_rut,)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una entidad con ese NIT/RUT"
                )

            # Verificar correo duplicado
            cursor.execute(
                "SELECT id_entidad FROM entidades WHERE correo_institucional = %s;",
                (data.correo_institucional,)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una entidad con ese correo institucional"
                )

            cursor.execute("""
                INSERT INTO entidades
                    (id_estado_cuenta, nombre_entidad, nit_rut, correo_institucional,
                     telefono, direccion, funcionario_responsable,
                     documento_funcionario, sitio_web)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                1,  # ACTIVO por defecto
                data.nombre_entidad,
                data.nit_rut,
                data.correo_institucional,
                data.telefono,
                data.direccion,
                data.funcionario_responsable,
                data.documento_funcionario,
                data.sitio_web,
            ))
            nuevo_id = cursor.lastrowid

        return {
            "message": "Entidad creada exitosamente",
            "id_entidad": nuevo_id,
            "nombre_entidad": data.nombre_entidad
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.put(
    "/{id_entidad}",
    summary="Actualizar datos de una entidad (solo ADMIN)"
)
def actualizar_entidad(
    id_entidad: int,
    data: EntidadUpdate,
    user: Dict[str, Any] = Depends(require_roles(4))
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id_entidad FROM entidades WHERE id_entidad = %s;",
                (id_entidad,)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Entidad no encontrada")

            campos = {k: v for k, v in data.model_dump().items() if v is not None}
            if not campos:
                raise HTTPException(
                    status_code=400,
                    detail="No se enviaron campos para actualizar"
                )

            # Verificar correo duplicado si se está actualizando
            if "correo_institucional" in campos:
                cursor.execute(
                    "SELECT id_entidad FROM entidades WHERE correo_institucional = %s AND id_entidad != %s;",
                    (campos["correo_institucional"], id_entidad)
                )
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=400,
                        detail="Ese correo institucional ya está en uso por otra entidad"
                    )

            set_clause = ", ".join([f"{k} = %s" for k in campos])
            valores = list(campos.values()) + [id_entidad]

            cursor.execute(
                f"UPDATE entidades SET {set_clause}, updated_at = NOW() WHERE id_entidad = %s;",
                valores
            )

        return {"message": "Entidad actualizada exitosamente"}
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.put(
    "/{id_entidad}/estado",
    summary="Cambiar estado de una entidad (solo ADMIN)"
)
def cambiar_estado_entidad(
    id_entidad: int,
    data: CambiarEstadoEntidad,
    user: Dict[str, Any] = Depends(require_roles(4))
) -> Dict[str, Any]:
    """
    Permite al ADMINISTRADOR activar, suspender o desactivar una entidad.
    Estados: 1=ACTIVO, 2=INACTIVO, 3=SUSPENDIDO, 4=PENDIENTE
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id_entidad, nombre_entidad FROM entidades WHERE id_entidad = %s;",
                (id_entidad,)
            )
            entidad = cursor.fetchone()
            if not entidad:
                raise HTTPException(status_code=404, detail="Entidad no encontrada")

            cursor.execute(
                "SELECT id_estado_cuenta, nombre FROM estado_cuenta WHERE id_estado_cuenta = %s;",
                (data.id_estado_cuenta,)
            )
            estado = cursor.fetchone()
            if not estado:
                raise HTTPException(status_code=400, detail="Estado de cuenta inválido")

            cursor.execute(
                "UPDATE entidades SET id_estado_cuenta = %s, updated_at = NOW() WHERE id_entidad = %s;",
                (data.id_estado_cuenta, id_entidad)
            )

        return {
            "message": "Estado de la entidad actualizado exitosamente",
            "entidad": entidad["nombre_entidad"],
            "nuevo_estado": estado["nombre"]
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.put(
    "/{id_entidad}/asignar-usuario/{id_usuario}",
    summary="Asignar un usuario a una entidad (solo ADMIN)"
)
def asignar_usuario_entidad(
    id_entidad: int,
    id_usuario: int,
    user: Dict[str, Any] = Depends(require_roles(4))
) -> Dict[str, Any]:
    """
    Vincula un usuario con rol ENTIDAD a una entidad específica.
    Esto permite que el usuario gestione los reportes asignados a esa entidad.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verificar entidad
            cursor.execute(
                "SELECT id_entidad, nombre_entidad FROM entidades WHERE id_entidad = %s;",
                (id_entidad,)
            )
            entidad = cursor.fetchone()
            if not entidad:
                raise HTTPException(status_code=404, detail="Entidad no encontrada")

            # Verificar usuario
            cursor.execute(
                "SELECT id_usuario, nombre_completo, id_rol FROM usuarios WHERE id_usuario = %s;",
                (id_usuario,)
            )
            usuario = cursor.fetchone()
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            if usuario["id_rol"] != 2:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden asignar usuarios con rol ENTIDAD a una entidad"
                )

            cursor.execute(
                "UPDATE usuarios SET id_entidad = %s, updated_at = NOW() WHERE id_usuario = %s;",
                (id_entidad, id_usuario)
            )

        return {
            "message": "Usuario asignado a la entidad exitosamente",
            "usuario": usuario["nombre_completo"],
            "entidad": entidad["nombre_entidad"]
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.delete(
    "/{id_entidad}/desasignar-usuario/{id_usuario}",
    summary="Desasignar un usuario de una entidad (solo ADMIN)"
)
def desasignar_usuario_entidad(
    id_entidad: int,
    id_usuario: int,
    user: Dict[str, Any] = Depends(require_roles(4))
) -> Dict[str, Any]:
    """
    Desvincula un usuario de su entidad actual.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id_usuario, nombre_completo, id_entidad FROM usuarios WHERE id_usuario = %s;",
                (id_usuario,)
            )
            usuario = cursor.fetchone()
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            if usuario["id_entidad"] != id_entidad:
                raise HTTPException(
                    status_code=400,
                    detail="El usuario no pertenece a esa entidad"
                )

            cursor.execute(
                "UPDATE usuarios SET id_entidad = NULL, updated_at = NOW() WHERE id_usuario = %s;",
                (id_usuario,)
            )

        return {
            "message": "Usuario desasignado de la entidad exitosamente",
            "usuario": usuario["nombre_completo"]
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()


@router.get(
    "/{id_entidad}/usuarios",
    summary="Listar usuarios de una entidad (solo ADMIN)"
)
def usuarios_de_entidad(
    id_entidad: int,
    user: Dict[str, Any] = Depends(require_roles(4))
) -> Dict[str, Any]:
    """
    Lista todos los usuarios asignados a una entidad específica.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id_entidad, nombre_entidad FROM entidades WHERE id_entidad = %s;",
                (id_entidad,)
            )
            entidad = cursor.fetchone()
            if not entidad:
                raise HTTPException(status_code=404, detail="Entidad no encontrada")

            cursor.execute("""
                SELECT
                    u.id_usuario,
                    u.nombre_completo,
                    u.correo,
                    u.telefono,
                    r.nombre  AS rol,
                    ec.nombre AS estado_cuenta
                FROM usuarios u
                JOIN roles         r  ON r.id_rol            = u.id_rol
                JOIN estado_cuenta ec ON ec.id_estado_cuenta = u.id_estado_cuenta
                WHERE u.id_entidad = %s
                ORDER BY u.nombre_completo ASC;
            """, (id_entidad,))
            usuarios = cursor.fetchall()

        return {
            "entidad": entidad["nombre_entidad"],
            "total_usuarios": len(usuarios),
            "usuarios": usuarios
        }
    except HTTPException:
        raise
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    finally:
        conn.close()
