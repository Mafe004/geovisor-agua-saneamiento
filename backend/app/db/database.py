import os

import pymysql
from dotenv import load_dotenv
from pymysql.constants import FIELD_TYPE
from pymysql.converters import conversions

load_dotenv()

# DECIMAL/NEWDECIMAL columns (latitud, longitud, etc.) llegan como
# decimal.Decimal por defecto. FastAPI infiere un response model desde
# las anotaciones `-> dict[str, Any]` de los routers, y Pydantic v2
# serializa Decimal como STRING en JSON (no como número) para no perder
# precisión. Los convertimos a float aquí, en el driver, para que la
# API siempre devuelva números reales sin tener que tocar cada router.
DECIMAL_AS_FLOAT = dict(conversions)
DECIMAL_AS_FLOAT[FIELD_TYPE.DECIMAL] = float
DECIMAL_AS_FLOAT[FIELD_TYPE.NEWDECIMAL] = float


def get_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "geovisor_agua_saneamiento"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        conv=DECIMAL_AS_FLOAT,
    )
