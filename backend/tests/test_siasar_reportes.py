"""
Tests del vínculo reportes <-> SIASAR (Fase 4): al crear un reporte se
enlaza en la misma transacción a la comunidad más cercana (si hay una a
menos de 2km), el campo aditivo `vereda_siasar` aparece en list/detail, y
`municipio_siasar` filtra /reportes/ por el municipio de la comunidad
enlazada.
"""

from pathlib import Path

import pytest

from scripts.importar_siasar import ejecutar_importacion

pytestmark = pytest.mark.integration

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "siasar"

# 80001 está en (5.0231, -74.0041) -- mismas coordenadas de un reporte de
# prueba "cerca". 2 grados de latitud más al norte queda muy lejos de
# cualquier comunidad de la fixture (todas rondan 5.0-5.03/-74.0-74.02).
CERCA = {"latitud": 5.0231, "longitud": -74.0041}
LEJOS = {"latitud": 7.0231, "longitud": -74.0041}

REPORTE_BASE = {"id_tipo_incidente": 1, "id_severidad": 1, "descripcion": "test siasar link"}


@pytest.fixture
def siasar_seed():
    return ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)


def test_reporte_cerca_de_una_comunidad_guarda_el_vinculo(client_ciudadano, siasar_seed):
    res = client_ciudadano.post("/reportes/", json={**REPORTE_BASE, **CERCA})
    assert res.status_code == 201
    reporte = res.json()["reporte"]
    assert reporte["vereda_siasar"] is not None
    assert reporte["vereda_siasar"]["id_siasar"] == 80001
    assert reporte["vereda_siasar"]["distancia_m"] == 0
    assert reporte["vereda_siasar"]["municipio"] == "ZIPAQUIRÁ"


def test_reporte_lejos_de_toda_comunidad_guarda_null(client_ciudadano, siasar_seed):
    res = client_ciudadano.post("/reportes/", json={**REPORTE_BASE, **LEJOS})
    assert res.status_code == 201
    assert res.json()["reporte"]["vereda_siasar"] is None


def test_reporte_sin_siasar_importado_guarda_null(client_ciudadano):
    # Sin `siasar_seed`: siasar_comunidad está vacía (autouse _reseed la
    # deja así) -- buscar_comunidad_cercana no tiene nada que encontrar.
    res = client_ciudadano.post("/reportes/", json={**REPORTE_BASE, **CERCA})
    assert res.status_code == 201
    assert res.json()["reporte"]["vereda_siasar"] is None


def test_cliente_no_puede_enviar_id_siasar_comunidad(client_ciudadano, siasar_seed):
    # ReporteCreateRequest no declara estos campos -- Pydantic los ignora
    # calladamente en vez de fallar por "extra field", así que un reporte
    # lejos de cualquier comunidad sigue guardando NULL aunque el cliente
    # intente forzar un id_siasar_comunidad.
    res = client_ciudadano.post("/reportes/", json={
        **REPORTE_BASE, **LEJOS,
        "id_siasar_comunidad": 80001, "distancia_siasar_m": 0,
    })
    assert res.status_code == 201
    assert res.json()["reporte"]["vereda_siasar"] is None


def test_listar_y_detalle_incluyen_vereda_siasar(client_ciudadano, siasar_seed):
    creado = client_ciudadano.post("/reportes/", json={**REPORTE_BASE, **CERCA}).json()["reporte"]

    listado = client_ciudadano.get("/reportes/")
    assert listado.status_code == 200
    fila = next(r for r in listado.json() if r["id_reporte"] == creado["id_reporte"])
    assert "vereda_siasar" in fila
    assert fila["vereda_siasar"]["id_siasar"] == 80001

    detalle = client_ciudadano.get(f"/reportes/{creado['id_reporte']}")
    assert detalle.status_code == 200
    assert detalle.json()["vereda_siasar"]["id_siasar"] == 80001


def test_municipio_siasar_filtra_el_listado(client_moderador, client_ciudadano, siasar_seed):
    cerca = client_ciudadano.post("/reportes/", json={**REPORTE_BASE, **CERCA}).json()["reporte"]
    lejos = client_ciudadano.post("/reportes/", json={**REPORTE_BASE, **LEJOS}).json()["reporte"]

    res = client_moderador.get("/reportes/", params={"municipio_siasar": "ZIPAQUIRÁ"})
    assert res.status_code == 200
    ids = {r["id_reporte"] for r in res.json()}
    assert cerca["id_reporte"] in ids
    assert lejos["id_reporte"] not in ids

    res_otro = client_moderador.get("/reportes/", params={"municipio_siasar": "COTA"})
    assert res_otro.status_code == 200
    assert cerca["id_reporte"] not in {r["id_reporte"] for r in res_otro.json()}
