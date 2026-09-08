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

from app.core.roles import Rol


def scope_reportes(user: dict, alias: str = "r") -> tuple[list[str], list]:
    """
    Devuelve (condiciones, params) que limitan la consulta al alcance del rol.
    CIUDADANO: solo propios. ENTIDAD: solo de su entidad. MODERADOR/ADMIN: todo.

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
        return [f"{alias}.id_entidad = %s"], [user["id_entidad"]]

    if id_rol in (Rol.MODERADOR, Rol.ADMIN):
        return [], []

    raise HTTPException(status_code=403, detail="Rol desconocido")


def puede_ver_reporte(user: dict, reporte: dict) -> bool:
    """Autorización a nivel de fila, para cuando el reporte ya está cargado."""
    id_rol = user.get("id_rol")

    if id_rol == Rol.CIUDADANO:
        return reporte.get("id_usuario") == user.get("id_usuario")
    if id_rol == Rol.ENTIDAD:
        return bool(user.get("id_entidad")) and reporte.get("id_entidad") == user.get(
            "id_entidad"
        )
    # rol desconocido: fail closed, nunca fail open
    return id_rol in (Rol.MODERADOR, Rol.ADMIN)


def puede_cambiar_estado(user: dict, reporte: dict) -> bool:
    """CIUDADANO nunca. ENTIDAD solo los de su entidad. MODERADOR/ADMIN siempre."""
    id_rol = user.get("id_rol")

    if id_rol == Rol.CIUDADANO:
        return False
    if id_rol == Rol.ENTIDAD:
        return bool(user.get("id_entidad")) and reporte.get("id_entidad") == user.get(
            "id_entidad"
        )
    # rol desconocido: fail closed, nunca fail open
    return id_rol in (Rol.MODERADOR, Rol.ADMIN)
