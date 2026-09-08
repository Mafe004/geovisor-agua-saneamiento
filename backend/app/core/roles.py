from enum import IntEnum


class Rol(IntEnum):
    CIUDADANO = 1
    ENTIDAD = 2
    MODERADOR = 3
    ADMIN = 4


class EstadoCuenta(IntEnum):
    ACTIVO = 1
    INACTIVO = 2
    SUSPENDIDO = 3
    PENDIENTE = 4
