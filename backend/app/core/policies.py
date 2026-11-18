"""
Política de autorización para reportes — quién puede ver / listar / modificar
qué. Única fuente de verdad para esta regla, antes reimplementada con estilos
y mensajes ligeramente distintos en cada endpoint que la necesitaba.

Módulo puro: sin imports de base de datos ni HTTP, salvo HTTPException (usada
únicamente para los casos que ya eran un 403 antes de este refactor —
ENTIDAD sin id_entidad asignado, y rol desconocido). Esto permite probarlo
con diccionarios simples, sin FastAPI ni MySQL de por medio.
"""

from fastapi import HTTPException

from app.core.roles import EstadoCuenta, Rol

# Nombre (no id) del único estado_reporte en que el ciudadano dueño todavía
# puede editar/eliminar su reporte -- mismo criterio nombre->catálogo que
# _resolve_estado_ids() en routers/reportes.py, sin asumir que su id es 1.
ESTADO_EDITABLE = "PENDIENTE"


def scope_reportes(user: dict, alias: str = "r") -> tuple[list[str], list]:
    """
    Devuelve (condiciones, params) que limitan la consulta al alcance del rol.
    CIUDADANO: solo propios. ENTIDAD titular: todo el pool de su entidad.
    ENTIDAD trabajador (no titular, ver migración 0007): solo los reportes
    que tiene asignados a él específicamente -- no el pool completo de la
    entidad, esa vista es del titular. MODERADOR/ADMIN: todo.

    Las condiciones se devuelven como lista (no como string "WHERE ..."), para
    que el llamador las combine con sus propios filtros usando "AND" y
    anteponga "WHERE" una sola vez — así el alcance por rol nunca compite con
    los filtros de la query por quién se queda con el "WHERE".
    """
    id_rol = user.get("id_rol")

    if id_rol == Rol.CIUDADANO:
        return [f"{alias}.id_usuario = %s"], [user["id_usuario"]]

    if id_rol == Rol.ENTIDAD:
        if not user.get("id_entidad"):
            raise HTTPException(
                status_code=403, detail="Usuario ENTIDAD sin id_entidad asignado"
            )
        if user.get("es_titular_entidad"):
            return [f"{alias}.id_entidad = %s"], [user["id_entidad"]]
        return [f"{alias}.id_usuario_asignado = %s"], [user["id_usuario"]]

    if id_rol in (Rol.MODERADOR, Rol.ADMIN):
        return [], []

    raise HTTPException(status_code=403, detail="Rol desconocido")


def scope_reportes_mapa(user: dict, alias: str = "r") -> tuple[list[str], list]:
    """
    Alcance para GET /reportes/mapa: igual a scope_reportes(), salvo que
    CIUDADANO ve aquí los reportes de toda la comunidad, no solo los propios
    -- el mapa es una vista comunitaria de incidentes (la respuesta de ese
    endpoint, ReporteMapaPunto, ya no lleva id_usuario/nombre, así que ampliar
    el alcance no expone datos personales). ENTIDAD/MODERADOR/ADMIN/rol
    desconocido: idéntico a scope_reportes().
    """
    if user.get("id_rol") == Rol.CIUDADANO:
        return [], []

    return scope_reportes(user, alias=alias)


def puede_ver_detalle_comunitario(user: dict) -> bool:
    """
    Complementa a puede_ver_reporte(): cuando esta última da False, el
    llamador debe consultar aquí antes de responder 403. Solo CIUDADANO
    tiene vista comunitaria del detalle/historial de reportes ajenos (sin
    datos personales del creador) -- igual que scope_reportes_mapa() ya
    amplía el alcance de CIUDADANO en /reportes/mapa. ENTIDAD/MODERADOR/
    ADMIN/rol desconocido: si puede_ver_reporte() les da False, se mantiene
    el 403 de siempre, sin cambios.
    """
    return user.get("id_rol") == Rol.CIUDADANO


def _es_de_mi_entidad(user: dict, reporte: dict) -> bool:
    """ENTIDAD titular: cualquier reporte de su entidad. ENTIDAD trabajador
    (no titular): solo el que tiene asignado a él -- mismo criterio que
    scope_reportes(), aplicado acá a una sola fila ya cargada."""
    if not user.get("id_entidad") or reporte.get("id_entidad") != user.get("id_entidad"):
        return False
    if user.get("es_titular_entidad"):
        return True
    return reporte.get("id_usuario_asignado") == user.get("id_usuario")


def puede_ver_reporte(user: dict, reporte: dict) -> bool:
    """Autorización a nivel de fila, para cuando el reporte ya está cargado."""
    id_rol = user.get("id_rol")

    if id_rol == Rol.CIUDADANO:
        return reporte.get("id_usuario") == user.get("id_usuario")
    if id_rol == Rol.ENTIDAD:
        return _es_de_mi_entidad(user, reporte)
    # rol desconocido: fail closed, nunca fail open
    return id_rol in (Rol.MODERADOR, Rol.ADMIN)


def puede_cambiar_estado(user: dict, reporte: dict) -> bool:
    """CIUDADANO nunca. ENTIDAD: solo el trabajador que tiene ESTE reporte
    asignado a él -- el titular reparte el trabajo, nunca lo resuelve él
    mismo (igual que ya no puede crearlo, ver crear_reporte). MODERADOR/
    ADMIN siempre.

    Distinto de puede_asignar_trabajador(): esa decide quién reparte a
    quién (el titular); esta decide quién mueve el estado del reporte ya
    repartido (el trabajador)."""
    id_rol = user.get("id_rol")

    if id_rol == Rol.CIUDADANO:
        return False
    if id_rol == Rol.ENTIDAD:
        if user.get("es_titular_entidad"):
            return False
        return _es_de_mi_entidad(user, reporte)
    # rol desconocido: fail closed, nunca fail open
    return id_rol in (Rol.MODERADOR, Rol.ADMIN)


def puede_asignar_trabajador(user: dict, reporte: dict) -> bool:
    """Repartir un reporte a un trabajador de la entidad: el TITULAR de esa
    entidad, o MODERADOR/ADMIN (p.ej. para intervenir si una entidad no se
    está organizando). Nunca un trabajador normal, ni siquiera para
    re-asignarse su propio reporte a otro -- esa decisión es del titular."""
    id_rol = user.get("id_rol")
    if id_rol == Rol.ENTIDAD:
        return bool(user.get("es_titular_entidad")) and reporte.get("id_entidad") == user.get(
            "id_entidad"
        )
    return id_rol in (Rol.MODERADOR, Rol.ADMIN)


def puede_editar_reporte(user: dict, reporte: dict) -> bool:
    """
    Editar o eliminar un reporte: solo cuando se cumplen TODAS a la vez --
      1. el usuario es CIUDADANO,
      2. su cuenta está ACTIVA,
      3. el reporte es suyo (id_usuario),
      4. el reporte no tiene entidad asignada (id_entidad IS NULL),
      5. el estado del reporte es exactamente PENDIENTE.

    ENTIDAD/MODERADOR/ADMIN nunca pasan por aquí: ningún otro rol edita ni
    elimina reportes. `reporte` debe traer `estado` como nombre (lo que
    devuelve _select_reporte_detalle_sql() / er.nombre). Cualquier dato
    faltante da False: fail closed, nunca fail open.
    """
    if user.get("id_rol") != Rol.CIUDADANO:
        return False
    if user.get("id_estado_cuenta") != EstadoCuenta.ACTIVO:
        return False

    id_usuario = user.get("id_usuario")
    if id_usuario is None or reporte.get("id_usuario") != id_usuario:
        return False
    # La clave debe existir Y valer None: .get() no distingue "NULL en la
    # base" de "columna no seleccionada", y lo segundo no prueba nada.
    if "id_entidad" not in reporte or reporte["id_entidad"] is not None:
        return False

    return reporte.get("estado") == ESTADO_EDITABLE
