import logging
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.deps import require_roles
from app.core.roles import Rol
from app.db.database import get_connection
from app.routers import auditoria
from app.routers.auth import router as auth_router
from app.routers.catalogos import router as catalogos_router
from app.routers.entidades import router as entidades_router
from app.routers.historial import router as historial_router
from app.routers.infraestructura import router as infraestructura_router
from app.routers.notificaciones import router as notificaciones_router
from app.routers.reportes import router as reportes_router
from app.routers.siasar import router as siasar_router
from app.routers.usuarios import router as usuarios_router
from app.schemas.health import DbTestResponse, HealthResponse, RootResponse

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Geovisor API - Agua y Saneamiento",
    description="API REST para el Geovisor interactivo de agua y saneamiento en Cundinamarca",
    version="1.0.0",
)

# ✅ CORS SIEMPRE PRIMERO, antes de todos los routers
_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(
        ","
    )
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ✅ TODOS LOS ROUTERS DESPUÉS DEL MIDDLEWARE
app.include_router(auth_router)
app.include_router(catalogos_router)
app.include_router(reportes_router)
app.include_router(historial_router)
app.include_router(notificaciones_router)
app.include_router(infraestructura_router)
app.include_router(usuarios_router)
app.include_router(entidades_router)
app.include_router(siasar_router)
app.include_router(auditoria.router)


@app.get("/", tags=["Health"], response_model=RootResponse)
def root():
    return {"message": "Geovisor API running"}


@app.get("/health", tags=["Health"], response_model=HealthResponse)
def health():
    return {"status": "ok"}


@app.get("/db-test", tags=["Health"], response_model=DbTestResponse)
def db_test(user: dict[str, Any] = Depends(require_roles(Rol.ADMIN))):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS ok;")
            result = cursor.fetchone()
        return {"db": "connected", "result": result}
    finally:
        conn.close()
