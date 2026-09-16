"""
Tests del importador SIASAR (scripts/importar_siasar.py) contra las CSV de
fixture en tests/fixtures/siasar/ (7 comunidades, 4 sistemas -- ver el
encabezado de esos archivos para qué caso cubre cada fila).

Corre contra geovisor_test como el resto de la suite: el autouse `_reseed`
de conftest.py deja siasar_comunidad/siasar_sistema/siasar_comunidad_sistema
vacías antes de cada test (están en TABLES pero el dump no las siembra con
filas -- los datos reales solo entran por este importador).
"""

from pathlib import Path

import pytest

from app.db.database import get_connection
from scripts import importar_siasar
from scripts.importar_siasar import (
    ImportAbortado,
    ImportadorError,
    ejecutar_importacion,
)

pytestmark = pytest.mark.integration

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "siasar"


def _contar(sql: str, params: tuple = ()) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()["n"]
    finally:
        conn.close()


def _fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


# ── Conteos, descartes, categorías, atípicos, enlaces ───────────────────


def test_importa_y_reporta_conteos_correctos():
    reporte = ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)

    assert reporte.comunidades_leidas == 7
    assert reporte.comunidades_insertadas == 5
    assert reporte.comunidades_descartadas["coordenadas_invalidas"] == 1
    assert reporte.comunidades_descartadas["departamento_distinto_de_cundinamarca"] == 1
    assert reporte.comunidades_atipicas == 1

    assert reporte.sistemas_leidos == 4
    assert reporte.sistemas_insertados == 4
    assert reporte.sistemas_atipicos == 1

    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad;") == 5
    assert _contar("SELECT COUNT(*) AS n FROM siasar_sistema;") == 4


def test_fila_fuera_de_cundinamarca_no_se_inserta():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    fila = _fetch_all(
        "SELECT * FROM siasar_comunidad WHERE nombre LIKE %s;", ("%Otro Departamento%",)
    )
    assert len(fila) == 0


def test_fila_fuera_del_rango_de_coordenadas_no_se_inserta():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    fila = _fetch_all(
        "SELECT * FROM siasar_comunidad WHERE nombre LIKE %s;", ("%Fuera De Rango%",)
    )
    assert len(fila) == 0


def test_normalizacion_de_texto_colapsa_espacios():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    fila = _fetch_all(
        "SELECT nombre FROM siasar_comunidad WHERE id_siasar = 80001;"
    )[0]
    # "Vereda  Prueba" (doble espacio en el CSV) -> "Vereda Prueba"
    assert fila["nombre"] == "Vereda Prueba"


def test_mapeo_categorico_cloro_y_pruebas():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    sistemas = {
        row["id_siasar"]: row
        for row in _fetch_all("SELECT * FROM siasar_sistema;")
    }
    assert sistemas[90001]["cloracion"] == "FUNCIONA"
    assert sistemas[90001]["prueba_coliformes"] == "PASA"
    assert sistemas[90001]["prueba_fisicoquimica"] == "NO_PASA"

    assert sistemas[90002]["cloracion"] == "NO_FUNCIONA"
    assert sistemas[90002]["prueba_coliformes"] == "NO_PASA"
    # "No aplica" -> SIN_PRUEBA (nunca hubo prueba registrada)
    assert sistemas[90002]["prueba_fisicoquimica"] == "SIN_PRUEBA"
    assert sistemas[90002]["horas_servicio"] is None  # dist_horas vacío

    assert sistemas[90003]["cloracion"] == "NO_SE_REALIZA"
    assert sistemas[90003]["prueba_coliformes"] == "SIN_PRUEBA"
    assert sistemas[90003]["prueba_fisicoquimica"] == "PASA"

    # Valor no reconocido ("Valor Raro") -> SIN_DATO, no se inventa nada
    assert sistemas[90004]["cloracion"] == "SIN_DATO"


def test_valor_categorico_no_reconocido_se_reporta():
    reporte = ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    assert reporte.otros_valores_cloro == {"Valor Raro": 1}


def test_poblacion_atipica_se_marca_sin_alterar_el_numero():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    fila = _fetch_all(
        "SELECT poblacion, viviendas, poblacion_atipica FROM siasar_comunidad WHERE id_siasar = 80005;"
    )[0]
    assert fila["poblacion"] == 5000  # el spec prohíbe "corregir" el número
    assert fila["viviendas"] == 100
    assert fila["poblacion_atipica"] == 1


def test_n_escuelas_vacio_es_null():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    fila = _fetch_all("SELECT n_escuelas FROM siasar_comunidad WHERE id_siasar = 80001;")[0]
    assert fila["n_escuelas"] is None


def test_enlaces_comunidad_sistema():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    pares = {
        (r["id_siasar_comunidad"], r["id_siasar_sistema"])
        for r in _fetch_all("SELECT * FROM siasar_comunidad_sistema;")
    }
    # 80001 -> 90001 (nombre completo coincide con un solo sistema)
    assert (80001, 90001) in pares
    # 80002 -> 90003 (con tildes y doble espacio, vía la clave normalizada)
    assert (80002, 90003) in pares
    # 80003 lista DOS sistemas separados por coma -> ambos enlazados
    assert (80003, 90001) in pares
    assert (80003, 90002) in pares
    assert len(pares) == 4


def test_nombre_de_sistema_sin_coincidencia_queda_sin_enlazar():
    reporte = ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    assert "Sistema Inexistente XYZ" in reporte.nombres_sin_enlazar
    assert reporte.nombres_ambiguos == []


# ── Idempotencia y borrado sincronizado ─────────────────────────────────


def test_segunda_corrida_es_idempotente():
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    reporte2 = ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)

    assert reporte2.comunidades_insertadas == 0
    assert reporte2.comunidades_eliminadas == 0
    assert reporte2.sistemas_insertados == 0
    assert reporte2.sistemas_eliminados == 0
    assert reporte2.comunidades_actualizadas == 5
    assert reporte2.sistemas_actualizados == 4


def test_borrar_comunidad_vinculada_pone_null_en_el_reporte(tmp_path, client_ciudadano):
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)

    # Crear un reporte lejos de CUALQUIER otra comunidad de la fixture (para
    # que el backfill del propio import, que corre después del DELETE en la
    # misma transacción, no vuelva a enlazarlo con una distinta) y
    # vincularlo A MANO a la comunidad 80001 -- más simple y determinista
    # que depender de la distancia real para el vínculo inicial.
    res = client_ciudadano.post("/reportes/", json={
        "id_tipo_incidente": 1, "id_severidad": 1,
        "descripcion": "test sync delete siasar",
        "latitud": 5.10, "longitud": -74.10,
    })
    id_reporte = res.json()["reporte"]["id_reporte"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reportes SET id_siasar_comunidad = 80001, distancia_siasar_m = 10 "
                "WHERE id_reporte = %s;",
                (id_reporte,),
            )
    finally:
        conn.close()

    # Reimportar SIN la comunidad 80001 (CSV reducido en un directorio temporal).
    reducido = tmp_path / "siasar"
    reducido.mkdir()
    original = (FIXTURES_DIR / "community_main.csv").read_text(encoding="utf-8")
    sin_80001 = "\n".join(
        line for line in original.splitlines() if not line.startswith("80001,")
    )
    (reducido / "community_main.csv").write_text(sin_80001, encoding="utf-8")
    (reducido / "system_main.csv").write_text(
        (FIXTURES_DIR / "system_main.csv").read_text(encoding="utf-8"), encoding="utf-8"
    )

    ejecutar_importacion(reducido, allow_shrink=True)

    fila = _fetch_all(
        "SELECT id_siasar_comunidad, distancia_siasar_m FROM reportes WHERE id_reporte = %s;",
        (id_reporte,),
    )[0]
    assert fila["id_siasar_comunidad"] is None
    assert fila["distancia_siasar_m"] is None


# ── Guarda de encogimiento y --dry-run ───────────────────────────────────


def test_shrink_guard_aborta_sin_allow_shrink(tmp_path):
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)  # siembra 5 comunidades

    # Un CSV con una sola fila válida es menos de la mitad de las 5 que ya
    # hay en la base -- debe abortar sin --allow-shrink.
    reducido = tmp_path / "siasar"
    reducido.mkdir()
    (reducido / "community_main.csv").write_text(
        (FIXTURES_DIR / "community_main.csv").read_text(encoding="utf-8").splitlines()[0]
        + "\n"
        + (FIXTURES_DIR / "community_main.csv").read_text(encoding="utf-8").splitlines()[1]
        + "\n",
        encoding="utf-8",
    )
    (reducido / "system_main.csv").write_text(
        (FIXTURES_DIR / "system_main.csv").read_text(encoding="utf-8"), encoding="utf-8"
    )

    with pytest.raises(ImportAbortado):
        ejecutar_importacion(reducido, allow_shrink=False)
    # nada cambió: sigue habiendo exactamente lo que sembró la corrida anterior
    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad;") == 5

    # Con --allow-shrink sí procede.
    reporte = ejecutar_importacion(reducido, allow_shrink=True)
    assert reporte.abortado is None
    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad;") == 1


def test_dry_run_no_escribe_nada():
    reporte = ejecutar_importacion(FIXTURES_DIR, dry_run=True)

    assert reporte.dry_run is True
    assert reporte.reportes_backfill is None
    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad;") == 0
    assert _contar("SELECT COUNT(*) AS n FROM siasar_sistema;") == 0
    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad_sistema;") == 0


# ── Transacción y auditoría ──────────────────────────────────────────────


def test_falla_inyectada_revierte_todo(monkeypatch):
    def _explota(*args, **kwargs):
        raise RuntimeError("falla inyectada por el test")

    monkeypatch.setattr(importar_siasar, "registrar_auditoria", _explota)

    with pytest.raises(RuntimeError):
        ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)

    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad;") == 0
    assert _contar("SELECT COUNT(*) AS n FROM siasar_sistema;") == 0
    assert _contar("SELECT COUNT(*) AS n FROM siasar_comunidad_sistema;") == 0


def test_una_sola_fila_de_auditoria_por_corrida_exitosa():
    antes = _contar("SELECT COUNT(*) AS n FROM logs_auditoria WHERE accion = 'IMPORTACION';")
    ejecutar_importacion(FIXTURES_DIR, allow_shrink=True)
    despues = _contar("SELECT COUNT(*) AS n FROM logs_auditoria WHERE accion = 'IMPORTACION';")
    assert despues - antes == 1


def test_columna_requerida_faltante_falla_claro(tmp_path):
    directorio = tmp_path / "siasar"
    directorio.mkdir()
    (directorio / "community_main.csv").write_text(
        "ID,nombre,departamento,municipio\n1,X,CUNDINAMARCA,ZIPAQUIRÁ\n", encoding="utf-8"
    )
    (directorio / "system_main.csv").write_text(
        (FIXTURES_DIR / "system_main.csv").read_text(encoding="utf-8"), encoding="utf-8"
    )

    with pytest.raises(ImportadorError, match="community_main.csv"):
        ejecutar_importacion(directorio, allow_shrink=True)
