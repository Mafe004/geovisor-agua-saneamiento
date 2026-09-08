from enum import Enum

_MAX_LEN = 100  # varchar(100) en logs_auditoria.accion y .modulo


class Modulo(str, Enum):
    AUTH = "AUTH"
    REPORTES = "REPORTES"
    USUARIOS = "USUARIOS"
    ENTIDADES = "ENTIDADES"
    INFRAESTRUCTURA = "INFRAESTRUCTURA"


class Accion(str, Enum):
    LOGIN = "LOGIN"
    CREAR_REPORTE = "CREAR_REPORTE"
    CAMBIAR_ESTADO = "CAMBIAR_ESTADO"
    CAMBIAR_ESTADO_CUENTA = "CAMBIAR_ESTADO_CUENTA"
    REGISTRO = "REGISTRO"
    CREAR = "CREAR"
    ACTUALIZAR = "ACTUALIZAR"
    ASIGNAR_USUARIO = "ASIGNAR_USUARIO"
    # Valor presente en los datos semilla; ningún código nuevo lo emite —
    # ver nota en Part B: auditar cada lectura inundaría la tabla.
    LISTAR_USUARIOS = "LISTAR_USUARIOS"


def registrar_auditoria(
    cursor,
    *,
    id_usuario: int | None,
    accion: Accion,
    modulo: Modulo,
    ip: str | None,
) -> None:
    """
    Inserta una fila en logs_auditoria usando un cursor ya abierto por el
    llamador dentro de su propia transacción (ver db.database.transaccion) —
    nunca abre su propia conexión. Si esa transacción hace rollback, esta
    fila se revierte con ella: un log que registra acciones que nunca
    ocurrieron es peor que no tener log.
    """
    cursor.execute(
        """
        INSERT INTO logs_auditoria (id_usuario, accion, modulo, ip_origen, fecha_accion)
        VALUES (%s, %s, %s, %s, NOW());
        """,
        (
            id_usuario,
            accion.value[:_MAX_LEN],
            modulo.value[:_MAX_LEN],
            ip[:45] if ip else None,
        ),
    )
