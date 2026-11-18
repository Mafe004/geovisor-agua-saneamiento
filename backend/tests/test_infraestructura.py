"""
Tests de app/routers/infraestructura.py (puntos de infraestructura
hídrica -- PTAR, acueductos, pozos, embalses, alcantarillado).

Datos semilla (geovisor_backup_limpio.sql): 3 puntos. Los dos placeholders
que alguna vez tuvieron fuente='SIASAR' (id 1 y 4) ya no existen -- ver
SIASAR_INTEGRATION_NOTES.md, "Removed placeholder rows": esta capa nunca
tuvo datos reales de SIASAR, así que no hay solapamiento que probar aquí
con esa fuente.
  id 2  'Acueducto Norte Zipaquirá'   ACUEDUCTO       / CAR
  id 3  'Embalse del Neusa'           EMBALSE         / CAR
  id 5  'Red Alcantarillado Centro'   ALCANTARILLADO  / Municipio

Las "capas SIASAR" (comunidades/sistemas) ya tienen su propia suite
completa en test_siasar_api.py -- no se duplican aquí.
"""

import pytest

from app.db.database import get_connection

pytestmark = pytest.mark.integration

SHAPE = {
    "id_infraestructura", "nombre", "tipo", "latitud", "longitud",
    "fuente", "estado", "fecha_actualizacion",
}


def _count_logs(accion: str, modulo: str) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM logs_auditoria WHERE accion = %s AND modulo = %s;",
                (accion, modulo),
            )
            return cur.fetchone()["c"]
    finally:
        conn.close()


# ── listar: 200 para cualquier rol activo, forma, orden, sin scope por rol ──


def test_401_sin_token_listar(client_anon):
    assert client_anon.get("/infraestructura/").status_code == 401


@pytest.mark.parametrize("client_fixture", [
    "client_ciudadano", "client_entidad", "client_moderador", "client_admin",
])
def test_200_listar_cualquier_rol_activo(request, client_fixture):
    client = request.getfixturevalue(client_fixture)
    assert client.get("/infraestructura/").status_code == 200


def test_listar_shape_y_orden_alfabetico(client_ciudadano):
    res = client_ciudadano.get("/infraestructura/")
    assert res.status_code == 200
    filas = res.json()
    assert len(filas) == 3
    assert set(filas[0].keys()) == SHAPE
    nombres = [f["nombre"] for f in filas]
    assert nombres == sorted(nombres)
    assert nombres == [
        "Acueducto Norte Zipaquirá", "Embalse del Neusa", "Red Alcantarillado Centro",
    ]


def test_listar_no_filtra_por_rol(client_ciudadano, client_entidad, client_moderador, client_admin):
    # A diferencia de /reportes (scope_reportes), esta capa es la misma
    # lista completa para los cuatro roles -- no hay alcance por entidad.
    listas = [
        tuple(f["id_infraestructura"] for f in c.get("/infraestructura/").json())
        for c in (client_ciudadano, client_entidad, client_moderador, client_admin)
    ]
    assert len(set(listas)) == 1


# ── detalle: 200, forma, 404 ─────────────────────────────────────────────


def test_401_sin_token_detalle(client_anon):
    assert client_anon.get("/infraestructura/2").status_code == 401


def test_200_detalle_shape(client_ciudadano):
    res = client_ciudadano.get("/infraestructura/2")
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == SHAPE
    assert body["nombre"] == "Acueducto Norte Zipaquirá"
    assert body["tipo"] == "ACUEDUCTO"
    assert body["fuente"] == "CAR"
    assert body["estado"] == "ACTIVA"


def test_404_detalle_inexistente(client_ciudadano):
    assert client_ciudadano.get("/infraestructura/999999").status_code == 404


# ── crear: solo MODERADOR/ADMIN ──────────────────────────────────────────


def test_401_sin_token_crear(client_anon):
    payload = {"nombre": "x", "tipo": "POZO", "latitud": 5.0, "longitud": -74.0}
    assert client_anon.post("/infraestructura/", json=payload).status_code == 401


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_ciudadano", 403),
    ("client_entidad", 403),
    ("client_moderador", 201),
    ("client_admin", 201),
])
def test_crear_control_de_acceso(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    payload = {
        "nombre": "Pozo de prueba", "tipo": "POZO",
        "latitud": 5.01, "longitud": -74.01, "fuente": "test", "estado": "ACTIVA",
    }
    assert client.post("/infraestructura/", json=payload).status_code == esperado


def test_crear_devuelve_id_consultable_y_audita(client_admin):
    antes = _count_logs("CREAR", "INFRAESTRUCTURA")
    payload = {"nombre": "Pozo nuevo", "tipo": "POZO", "latitud": 5.02, "longitud": -74.02}
    res = client_admin.post("/infraestructura/", json=payload)
    assert res.status_code == 201
    nuevo_id = res.json()["id_infraestructura"]

    detalle = client_admin.get(f"/infraestructura/{nuevo_id}")
    assert detalle.status_code == 200
    assert detalle.json()["nombre"] == "Pozo nuevo"
    assert detalle.json()["fuente"] is None  # no se envió -- columna nullable

    assert _count_logs("CREAR", "INFRAESTRUCTURA") == antes + 1


def test_crear_422_campos_invalidos(client_admin):
    payload = {"nombre": "", "tipo": "POZO", "latitud": 200, "longitud": -74.0}
    assert client_admin.post("/infraestructura/", json=payload).status_code == 422


# ── actualizar: solo MODERADOR/ADMIN ─────────────────────────────────────


def test_401_sin_token_actualizar(client_anon):
    assert client_anon.put("/infraestructura/2", json={"estado": "INACTIVA"}).status_code == 401


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_ciudadano", 403),
    ("client_entidad", 403),
    ("client_moderador", 200),
])
def test_actualizar_control_de_acceso(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    res = client.put("/infraestructura/2", json={"estado": "INACTIVA"})
    assert res.status_code == esperado


def test_actualizar_persiste_el_cambio_y_audita(client_admin):
    antes = _count_logs("ACTUALIZAR", "INFRAESTRUCTURA")
    res = client_admin.put("/infraestructura/3", json={"estado": "EN_MANTENIMIENTO"})
    assert res.status_code == 200

    detalle = client_admin.get("/infraestructura/3")
    assert detalle.json()["estado"] == "EN_MANTENIMIENTO"
    # Campos no enviados (nombre, tipo, latitud, longitud, fuente) deben
    # quedar intactos -- solo "estado" iba en el payload.
    assert detalle.json()["nombre"] == "Embalse del Neusa"
    assert detalle.json()["fuente"] == "CAR"

    assert _count_logs("ACTUALIZAR", "INFRAESTRUCTURA") == antes + 1


def test_404_actualizar_inexistente(client_admin):
    assert client_admin.put("/infraestructura/999999", json={"estado": "ACTIVA"}).status_code == 404


def test_400_actualizar_sin_campos(client_admin):
    assert client_admin.put("/infraestructura/2", json={}).status_code == 400
