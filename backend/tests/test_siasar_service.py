"""Tests de app/services/siasar.py (buscar_comunidad_cercana)."""

import pytest

from app.db.database import get_connection
from app.services.siasar import buscar_comunidad_cercana

pytestmark = pytest.mark.integration


def _sembrar_comunidad(cursor, id_siasar, lat, lon, nombre="Test"):
    cursor.execute(
        """
        INSERT INTO siasar_comunidad (
            id_siasar, nombre, municipio, latitud, longitud,
            fecha_encuesta, fecha_importacion
        ) VALUES (%s, %s, 'ZIPAQUIRÁ', %s, %s, '2021-01-01', NOW());
        """,
        (id_siasar, nombre, lat, lon),
    )


def test_encuentra_la_comunidad_mas_cercana_dentro_del_radio():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            _sembrar_comunidad(cur, 70001, 5.0231, -74.0041, "Cerca")
            _sembrar_comunidad(cur, 70002, 5.0500, -74.0500, "Lejos")
        conn.commit()

        with conn.cursor() as cur:
            resultado = buscar_comunidad_cercana(cur, 5.0232, -74.0042, radio_m=2000)
    finally:
        conn.close()

    assert resultado is not None
    comunidad, distancia_m = resultado
    assert comunidad["id_siasar"] == 70001
    assert isinstance(distancia_m, int)
    assert distancia_m < 50


def test_devuelve_none_si_nada_esta_dentro_del_radio():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            _sembrar_comunidad(cur, 70003, 5.2000, -74.3000, "MuyLejos")
        conn.commit()

        with conn.cursor() as cur:
            resultado = buscar_comunidad_cercana(cur, 5.0231, -74.0041, radio_m=2000)
    finally:
        conn.close()

    assert resultado is None


def test_devuelve_none_si_no_hay_comunidades():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            resultado = buscar_comunidad_cercana(cur, 5.0231, -74.0041, radio_m=2000)
    finally:
        conn.close()

    assert resultado is None


def test_respeta_el_radio_exacto():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # ~0.01 grados de latitud ~= 1110 m -- dentro de 2000, fuera de 500.
            _sembrar_comunidad(cur, 70004, 5.0231 + 0.01, -74.0041, "Media")
        conn.commit()

        with conn.cursor() as cur:
            dentro = buscar_comunidad_cercana(cur, 5.0231, -74.0041, radio_m=2000)
            fuera = buscar_comunidad_cercana(cur, 5.0231, -74.0041, radio_m=500)
    finally:
        conn.close()

    assert dentro is not None
    assert fuera is None
