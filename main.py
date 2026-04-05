from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import get_connection
from app.routers.auth import router as auth_router
from app.routers.catalogos import router as catalogos_router
from app.routers.reportes import router as reportes_router
from app.routers.historial import router as historial_router
from app.routers.notificaciones import router as notificaciones_router
from app.routers.infraestructura import router as infraestructura_router
from app.routers.usuarios import router as usuarios_router

app = FastAPI(
    title="Geovisor API - Agua y Saneamiento",
    description="API REST para el Geovisor interactivo de agua y saneamiento en Cundinamarca",
    version="1.0.0"
)

# ✅ CORS SIEMPRE PRIMERO, antes de todos los routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ TODOS LOS ROUTERS DESPUÉS DEL MIDDLEWARE
app.include_router(auth_router)
app.include_router(catalogos_router)
app.include_router(reportes_router)
app.include_router(historial_router)
app.include_router(notificaciones_router)
app.include_router(infraestructura_router)
app.include_router(usuarios_router)


@app.get("/", tags=["Health"])
def root():
    return {"message": "Geovisor API running"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.get("/db-test", tags=["Health"])
def db_test():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS ok;")
            result = cursor.fetchone()
        return {"db": "connected", "result": result}
    finally:
        conn.close()
