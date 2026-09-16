"""
Tests de app/routers/siasar.py (solo lectura).

Usa las mismas fixtures CSV que test_importar_siasar.py (7 comunidades /
4 sistemas en tests/fixtures/siasar/) importadas de verdad al arrancar cada
test vía `siasar_seed`, en vez de INSERTs a mano -- así los tests de API
también validan que lo que el importador realmente produce es lo que la
API espera servir.
"""

from pathlib import Path

import pytest

from scripts.importar_siasar import ejecutar_importacion

pytestmark = pytest.mark.integration

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "siasar"

ENDPOINTS_ACTIVE_USER = [
    ("GET", "/siasar/municipios", {}),
    ("GET", "/siasar/comunidades/mapa", {"municipio": "ZIPAQUIRÁ"}),
    ("GET", "/siasar/sistemas/mapa", {"municipio": "ZIPAQUIRÁ"}),
    ("GET", "/siasar/cercana", {"lat": 5.0231, "lon": -74.0041}),
    ("GET", "/siasar/comunidades/80001", {}),
    ("GET", "/siasar/sistemas/90001", {}),
]


@pytest.fixture
def siasar_seed():
    return ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)


# ── 401 sin token ────────────────────────────────────────────────────────


@pytest.mark.parametrize("method,path,params", ENDPOINTS_ACTIVE_USER)
def test_401_sin_token(client_anon, siasar_seed, method, path, params):
    res = client_anon.request(method, path, params=params)
    assert res.status_code == 401


def test_401_sin_token_resumen_municipios(client_anon, siasar_seed):
    assert client_anon.get("/siasar/resumen-municipios").status_code == 401


# ── resumen-municipios: solo ADMIN/MODERADOR ────────────────────────────


def test_403_ciudadano_resumen_municipios(client_ciudadano, siasar_seed):
    assert client_ciudadano.get("/siasar/resumen-municipios").status_code == 403


def test_403_entidad_resumen_municipios(client_entidad, siasar_seed):
    assert client_entidad.get("/siasar/resumen-municipios").status_code == 403


def test_200_moderador_y_admin_resumen_municipios(client_moderador, client_admin, siasar_seed):
    assert client_moderador.get("/siasar/resumen-municipios").status_code == 200
    assert client_admin.get("/siasar/resumen-municipios").status_code == 200


def test_resumen_municipios_shape(client_admin, siasar_seed):
    res = client_admin.get("/siasar/resumen-municipios")
    assert res.status_code == 200
    fila = next(m for m in res.json() if m["municipio"] == "ZIPAQUIRÁ")
    assert set(fila.keys()) == {
        "municipio", "comunidades", "comunidades_d", "sistemas",
        "sistemas_sin_cloracion", "sistemas_no_pasa_coliformes",
        "sistemas_sin_prueba_coliformes", "reportes_total", "reportes_abiertos",
        "fecha_encuesta_min", "fecha_encuesta_max",
    }
    # 5 comunidades válidas en la fixture, 1 con calificacion D (80002)
    assert fila["comunidades"] == 5
    assert fila["comunidades_d"] == 1
    assert fila["sistemas"] == 3  # 90004 es de otro municipio (COTA)


# ── municipio requerido / desconocido ────────────────────────────────────


def test_422_municipio_faltante_en_comunidades_mapa(client_ciudadano, siasar_seed):
    assert client_ciudadano.get("/siasar/comunidades/mapa").status_code == 422


def test_422_municipio_faltante_en_sistemas_mapa(client_ciudadano, siasar_seed):
    assert client_ciudadano.get("/siasar/sistemas/mapa").status_code == 422


def test_municipio_desconocido_devuelve_lista_vacia(client_ciudadano, siasar_seed):
    res = client_ciudadano.get("/siasar/comunidades/mapa", params={"municipio": "NARNIA"})
    assert res.status_code == 200
    assert res.json() == []


def test_comunidades_mapa_no_lo_captura_la_ruta_de_detalle(client_ciudadano, siasar_seed):
    res = client_ciudadano.get("/siasar/comunidades/mapa", params={"municipio": "ZIPAQUIRÁ"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) == 5


def test_sistemas_mapa_shape(client_ciudadano, siasar_seed):
    res = client_ciudadano.get("/siasar/sistemas/mapa", params={"municipio": "ZIPAQUIRÁ"})
    assert res.status_code == 200
    filas = res.json()
    assert len(filas) == 3
    assert set(filas[0].keys()) == {"id_siasar", "nombre", "latitud", "longitud", "cloracion", "prueba_coliformes"}


# ── detalle: 404 y shape ─────────────────────────────────────────────────


def test_404_comunidad_inexistente(client_ciudadano, siasar_seed):
    assert client_ciudadano.get("/siasar/comunidades/999999").status_code == 404


def test_404_sistema_inexistente(client_ciudadano, siasar_seed):
    assert client_ciudadano.get("/siasar/sistemas/999999").status_code == 404


def test_comunidad_detalle_shape_y_sistemas_enlazados(client_ciudadano, siasar_seed):
    res = client_ciudadano.get("/siasar/comunidades/80003")  # enlaza con 90001 y 90002
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {
        "id_siasar", "nombre", "municipio", "localidad", "latitud", "longitud",
        "poblacion", "viviendas", "poblacion_atipica", "cobertura_agua",
        "cobertura_saneamiento", "n_escuelas", "sistemas_texto", "prestador",
        "calificacion", "fecha_encuesta", "fecha_importacion", "sistemas", "fuente",
    }
    assert body["fuente"] == "SIASAR – Ministerio de Vivienda, Ciudad y Territorio"
    ids_sistemas = {s["id_siasar"] for s in body["sistemas"]}
    assert ids_sistemas == {90001, 90002}
    for s in body["sistemas"]:
        assert set(s.keys()) == {
            "id_siasar", "nombre", "cloracion", "prueba_coliformes",
            "prueba_fisicoquimica", "horas_servicio", "fecha_encuesta",
        }


def test_sistema_detalle_shape_y_comunidades_enlazadas(client_ciudadano, siasar_seed):
    res = client_ciudadano.get("/siasar/sistemas/90001")  # enlaza con 80001 y 80003
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {
        "id_siasar", "nombre", "municipio", "localidad", "latitud", "longitud",
        "comunidades_texto", "prestador", "poblacion_servida", "viviendas_servidas",
        "poblacion_atipica", "horas_servicio", "cloracion", "prueba_coliformes",
        "prueba_fisicoquimica", "fecha_encuesta", "fecha_importacion",
        "comunidades", "fuente",
    }
    ids_comunidades = {c["id_siasar"] for c in body["comunidades"]}
    assert ids_comunidades == {80001, 80003}
    for c in body["comunidades"]:
        assert set(c.keys()) == {"id_siasar", "nombre", "calificacion"}


# ── /cercana ──────────────────────────────────────────────────────────────


def test_cercana_encuentra_dentro_del_radio(client_ciudadano, siasar_seed):
    # 80001 está en (5.0231, -74.0041) -- el mismo punto exacto.
    res = client_ciudadano.get(
        "/siasar/cercana", params={"lat": 5.0231, "lon": -74.0041, "radio_m": 2000}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["comunidad"] is not None
    assert body["comunidad"]["id_siasar"] == 80001
    assert body["distancia_m"] == 0


def test_cercana_null_fuera_del_radio(client_ciudadano, siasar_seed):
    # Lejos de cualquier comunidad de la fixture (todas en ~5.0-5.03/-74.0-74.02).
    res = client_ciudadano.get(
        "/siasar/cercana", params={"lat": 5.5, "lon": -73.5, "radio_m": 2000}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["comunidad"] is None
    assert body["distancia_m"] is None


@pytest.mark.parametrize("radio_m", [10, 20000])
def test_cercana_422_radio_fuera_de_rango(client_ciudadano, siasar_seed, radio_m):
    res = client_ciudadano.get(
        "/siasar/cercana", params={"lat": 5.0231, "lon": -74.0041, "radio_m": radio_m}
    )
    assert res.status_code == 422


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), (0, -181)])
def test_cercana_422_lat_lon_fuera_de_rango(client_ciudadano, siasar_seed, lat, lon):
    res = client_ciudadano.get("/siasar/cercana", params={"lat": lat, "lon": lon})
    assert res.status_code == 422


# ── /municipios shape ─────────────────────────────────────────────────────


def test_municipios_shape_y_orden(client_ciudadano, siasar_seed):
    res = client_ciudadano.get("/siasar/municipios")
    assert res.status_code == 200
    filas = res.json()
    assert set(filas[0].keys()) == {"municipio", "comunidades", "sistemas"}
    municipios = [f["municipio"] for f in filas]
    assert municipios == sorted(municipios)
    zip_row = next(f for f in filas if f["municipio"] == "ZIPAQUIRÁ")
    assert zip_row["comunidades"] == 5
    assert zip_row["sistemas"] == 3
