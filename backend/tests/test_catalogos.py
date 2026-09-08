"""
tests/test_catalogos.py — barato y directo, pero es la garantía de que el
frontend siempre tiene un catálogo real y no vacío del cual leer los chips
de estado dinámicos.
"""

import pytest

pytestmark = pytest.mark.integration

CATALOGOS = [
    ("/catalogos/estado-reporte", "id_estado"),
    ("/catalogos/tipo-incidente", "id_tipo_incidente"),
    ("/catalogos/severidad", "id_severidad"),
    ("/catalogos/categoria-incidente", "id_categoria"),
]


@pytest.mark.parametrize("path,id_key", CATALOGOS)
def test_catalogo_no_vacio_con_las_claves_esperadas(client_ciudadano, path, id_key):
    res = client_ciudadano.get(path)
    assert res.status_code == 200
    items = res.json()
    assert items, f"{path} no debería devolver una lista vacía"
    for item in items:
        assert set(item.keys()) == {id_key, "nombre"}
        assert isinstance(item[id_key], int)
        assert isinstance(item["nombre"], str) and item["nombre"]
