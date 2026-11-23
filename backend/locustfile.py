"""
Pruebas de carga con Locust -- 9 escenarios sobre los endpoints reales de
este backend (ver app/routers/*.py).

Uso (contra un servidor ya corriendo, p.ej. `uvicorn main:app --port 8000`):

    locust -f locustfile.py --host http://localhost:8000

Modo headless (50 usuarios, spawn rate 10, 30 segundos), con el reporte de
tiempos promedio/p95 al final:

    locust -f locustfile.py --host http://localhost:8000 \
        --headless -u 50 -r 10 -t 30s --csv=resultados --print-stats

`--print-stats` imprime la tabla de estadísticas (incluye "Average" y
"95%") en stdout al terminar; `--csv=resultados` además deja
resultados_stats.csv con las mismas columnas en formato ligero. Los
tiempos de respuesta en ambos están en milisegundos.

── Credenciales ──────────────────────────────────────────────────────────
Los dos usuarios de abajo inician sesión de verdad contra POST /auth/login
-- no hay forma de "saltarse" el login real sin tocar el servidor. Las
constantes CIUDADANO_* / STAFF_* traen el correo+contraseña de los
usuarios semilla de geovisor_backup_limpio.sql, pero el hash que trae ESE
dump es un placeholder que no corresponde a "demo2025" de verdad (ver
tests/conftest.py, donde sí se sobreescribe con un hash real -- pero solo
en la base de pruebas geovisor_test, nunca en la base de desarrollo).

Si vas a correr esto contra la base de desarrollo real
(geovisor_agua_saneamiento) y el login falla con 401 en los logs de
Locust, es por eso -- exporta LOCUST_CIUDADANO_EMAIL/LOCUST_CIUDADANO_PASS
y LOCUST_STAFF_EMAIL/LOCUST_STAFF_PASS con credenciales que sí funcionen
en esa base (o cambia la contraseña de un usuario semilla a "demo2025" a
mano, solo para esta prueba).
"""

import os
import random

from locust import HttpUser, between, task

CIUDADANO_EMAIL = os.environ.get("LOCUST_CIUDADANO_EMAIL", "juan@test.com")
CIUDADANO_PASSWORD = os.environ.get("LOCUST_CIUDADANO_PASSWORD", "demo2025")

# MODERADOR, no ENTIDAD: puede cambiar el estado de CUALQUIER reporte (ver
# app/core/policies.py) sin depender de a qué entidad/trabajador quedó
# asignado un reporte semilla concreto -- más estable para una prueba de
# carga que no controla ese dato.
STAFF_EMAIL = os.environ.get("LOCUST_STAFF_EMAIL", "moderador@demo.com")
STAFF_PASSWORD = os.environ.get("LOCUST_STAFF_PASSWORD", "demo2025")

# Catálogo semilla real (geovisor_backup_limpio.sql) -- 1 "Fuga de agua"
# (categoría 1 = AGUA), severidad 1 "BAJA". Si el catálogo cambia, estos
# dos ids son el único lugar que hay que tocar.
ID_TIPO_INCIDENTE = 1
ID_SEVERIDAD = 1

# Alternar entre estos dos (nunca RESUELTO): cambiar_estado exige al menos
# una foto de evidencia para marcar RESUELTO (ver reportes.py) -- fuera de
# alcance para una prueba de carga que no sube archivos.
ESTADOS_SEGUROS = [2, 3]  # EN_REVISION, EN_PROCESO

# Centro aproximado de Zipaquirá, con jitter para no insertar siempre el
# mismo punto exacto.
LAT_BASE, LNG_BASE = 5.0231, -74.0041


def _login(client, correo: str, password: str) -> str | None:
    res = client.post(
        "/auth/login",
        json={"correo": correo, "password": password},
        name="/auth/login",
    )
    if res.status_code != 200:
        return None
    return res.json().get("access_token")


class CiudadanoUser(HttpUser):
    """
    La mayoría del tráfico real: un vecino reportando y revisando sus
    propios reportes -- nunca cambia estados ni ve infraestructura/SIASAR
    como tarea propia (eso lo hace StaffUser).
    """

    wait_time = between(1, 3)
    weight = 4  # ver StaffUser: 4:1, más ciudadanos que personal en todo momento

    def on_start(self):
        self.token = _login(self.client, CIUDADANO_EMAIL, CIUDADANO_PASSWORD)
        self.ultimo_id_reporte: int | None = None

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    # 1. Login -- ya ocurrió en on_start; se repite algunas veces durante
    # la corrida (como alguien que cierra/abre la app) para que el
    # endpoint también entre en las estadísticas con varias muestras.
    @task(1)
    def login(self):
        self.token = _login(self.client, CIUDADANO_EMAIL, CIUDADANO_PASSWORD)

    # 2. Listado de reportes.
    @task(5)
    def listar_reportes(self):
        self.client.get("/reportes/", headers=self._headers(), name="/reportes/ [GET]")

    # 3. Creación de reporte.
    @task(2)
    def crear_reporte(self):
        payload = {
            "descripcion": "Reporte de carga (Locust) -- fuga menor en el andén.",
            "direccion": "Calle de prueba Locust",
            "latitud": LAT_BASE + random.uniform(-0.01, 0.01),
            "longitud": LNG_BASE + random.uniform(-0.01, 0.01),
            "id_tipo_incidente": ID_TIPO_INCIDENTE,
            "id_severidad": ID_SEVERIDAD,
            "fuente_reporte": "CIUDADANO",
        }
        res = self.client.post(
            "/reportes/", json=payload, headers=self._headers(), name="/reportes/ [POST]"
        )
        if res.status_code == 201:
            self.ultimo_id_reporte = res.json()["reporte"]["id_reporte"]

    # 4. Detalle de reporte -- el que este mismo usuario acaba de crear, si
    # ya tiene uno; si no, no insiste (evita 404 artificiales al principio
    # de la corrida, antes del primer crear_reporte exitoso).
    @task(4)
    def detalle_reporte(self):
        if self.ultimo_id_reporte is None:
            return
        self.client.get(
            f"/reportes/{self.ultimo_id_reporte}",
            headers=self._headers(),
            name="/reportes/{id} [GET]",
        )

    # 8. Notificaciones propias.
    @task(3)
    def notificaciones(self):
        self.client.get("/notificaciones/", headers=self._headers(), name="/notificaciones/ [GET]")


class StaffUser(HttpUser):
    """Moderador: triage (cambiar estado) + las capas de solo lectura que
    en la app usan Moderador/Entidad/Admin (infraestructura, SIASAR,
    estadísticas)."""

    wait_time = between(1, 3)
    weight = 1

    def on_start(self):
        self.token = _login(self.client, STAFF_EMAIL, STAFF_PASSWORD)

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    # 5. Cambio de estado de un reporte real -- toma el primero de la lista
    # (MODERADOR ve todos, sin scope por entidad) en vez de un id fijo, así
    # no depende de que un id concreto siga existiendo.
    @task(3)
    def cambiar_estado(self):
        res = self.client.get(
            "/reportes/", headers=self._headers(), name="/reportes/ [GET]"
        )
        if res.status_code != 200 or not res.json():
            return
        id_reporte = res.json()[0]["id_reporte"]
        nuevo_estado = random.choice(ESTADOS_SEGUROS)
        self.client.put(
            f"/reportes/{id_reporte}/estado",
            json={"id_estado_nuevo": nuevo_estado, "comentario": "Actualización de carga (Locust)."},
            headers=self._headers(),
            name="/reportes/{id}/estado [PUT]",
        )

    # 6. Puntos de infraestructura hídrica.
    @task(2)
    def infraestructura(self):
        self.client.get(
            "/infraestructura/", headers=self._headers(), name="/infraestructura/ [GET]"
        )

    # 7. Capas SIASAR -- lista de municipios (la capa más liviana y la que
    # no exige un parámetro de municipio, a diferencia de comunidades/mapa
    # y sistemas/mapa).
    @task(2)
    def siasar_municipios(self):
        self.client.get("/siasar/municipios", headers=self._headers(), name="/siasar/municipios [GET]")

    # 9. Estadísticas / indicadores.
    @task(2)
    def estadisticas(self):
        self.client.get(
            "/reportes/estadisticas", headers=self._headers(), name="/reportes/estadisticas [GET]"
        )
