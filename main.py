from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import get_connection
from app.routers.catalogos import router as catalogos_router
from app.routers.reportes import router as reportes_router
from app.routers.historial import router as historial_router
from app.routers.notificaciones import router as notificaciones_router
from app.routers.infraestructura import router as infraestructura_router



app = FastAPI(title="Geovisor API")
app.include_router(historial_router)
app.include_router(notificaciones_router)
app.include_router(infraestructura_router)


# CORS (para que el frontend pueda consumir la API sin bloqueo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # luego puedes cambiarlo por tu URL del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Geovisor API running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/db-test")
def db_test():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS ok;")
            result = cursor.fetchone()
        return {"db": "connected", "result": result}
    finally:
        conn.close()

# Routers
app.include_router(catalogos_router)
app.include_router(reportes_router)

