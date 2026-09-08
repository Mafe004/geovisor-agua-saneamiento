import logging
from typing import NoReturn

from fastapi import HTTPException
from pymysql.err import IntegrityError

logger = logging.getLogger(__name__)

# Código de error MySQL para entrada duplicada (constraint UNIQUE).
_DUPLICATE_ENTRY_ERRNO = 1062


def handle_db_error(e: Exception) -> NoReturn:
    """
    Traduce un error de base de datos en una respuesta HTTP segura.

    Nunca expone nombres de tabla/columna/constraint al cliente: el error
    real, con su traceback completo (incluyendo el endpoint que lo originó),
    queda registrado en el log del servidor vía logger.exception.
    """
    logger.exception("Error de base de datos")

    if isinstance(e, IntegrityError):
        errno = e.args[0] if e.args else None
        if errno == _DUPLICATE_ENTRY_ERRNO:
            raise HTTPException(status_code=409, detail="El registro ya existe") from e
        # FK violation u otra restricción de integridad
        raise HTTPException(
            status_code=400, detail="Referencia inválida: verifica que los IDs existan"
        ) from e

    raise HTTPException(status_code=500, detail="Error interno del servidor") from e
