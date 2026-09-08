"""
Contract tests — corren contra geovisor_test (ver tests/conftest.py), no
contra la base de desarrollo.

Para cada GET: FastAPI valida la respuesta contra su response_model antes de
serializarla, así que un 500 aquí normalmente significa que el schema no
coincide con lo que el handler realmente devuelve — ese es justamente el bug
que este archivo existe para atrapar.

Autenticación: se generan JWT directamente con create_access_token en vez
de hacer login real — a diferencia de tests/test_auth.py y
tests/conftest.py (client_ciudadano y compañía), que sí prueban el flujo de
login real y son la mejor referencia para eso.
"""

import json

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.schemas.reportes import EstadisticasResponse
from main import app

pytestmark = pytest.mark.integration

client = TestClient(app)

# IDs de los usuarios semilla (geovisor_backup_limpio.sql)
CIUDADANO_ID = 1
ENTIDAD_ID = 2
MODERADOR_ID = 3
ADMIN_ID = 5


def _token(id_usuario: int, id_rol: int) -> str:
    return create_access_token({"sub": str(id_usuario), "id_rol": id_rol})


def _auth(id_usuario: int, id_rol: int) -> dict:
    return {"Authorization": f"Bearer {_token(id_usuario, id_rol)}"}


@pytest.fixture(scope="module")
def ciudadano():
    return _auth(CIUDADANO_ID, 1)


@pytest.fixture(scope="module")
def entidad():
    return _auth(ENTIDAD_ID, 2)


@pytest.fixture(scope="module")
def moderador():
    return _auth(MODERADOR_ID, 3)


@pytest.fixture(scope="module")
def admin():
    return _auth(ADMIN_ID, 4)


# ── Cada GET responde 200 y valida contra su response_model ────────────
# (FastAPI dispara un 500 si la respuesta real no encaja en el schema
# declarado, así que 200 aquí es la prueba de que el contrato es correcto.)


def test_get_reportes_listar(moderador):
    assert client.get("/reportes/", headers=moderador).status_code == 200


def test_get_reportes_detalle(moderador):
    assert client.get("/reportes/1", headers=moderador).status_code == 200


def test_get_reportes_mapa(ciudadano):
    assert client.get("/reportes/mapa", headers=ciudadano).status_code == 200


def test_get_reportes_historial_por_id(ciudadano):
    assert client.get("/reportes/1/historial", headers=ciudadano).status_code == 200


def test_get_historial_global(moderador):
    assert client.get("/historial/", headers=moderador).status_code == 200


@pytest.mark.parametrize(
    "path",
    [
        "/catalogos/estado-reporte",
        "/catalogos/tipo-incidente",
        "/catalogos/severidad",
        "/catalogos/categoria-incidente",
    ],
)
def test_get_catalogos(ciudadano, path):
    assert client.get(path, headers=ciudadano).status_code == 200


def test_get_notificaciones(ciudadano):
    assert client.get("/notificaciones/", headers=ciudadano).status_code == 200


def test_get_entidades_listar(ciudadano):
    assert client.get("/entidades/", headers=ciudadano).status_code == 200


def test_get_entidades_detalle(ciudadano):
    assert client.get("/entidades/1", headers=ciudadano).status_code == 200


def test_get_entidad_usuarios(admin):
    assert client.get("/entidades/1/usuarios", headers=admin).status_code == 200


def test_get_usuarios_perfil(ciudadano):
    assert client.get("/usuarios/perfil", headers=ciudadano).status_code == 200


def test_get_usuarios_listar(admin):
    assert client.get("/usuarios/", headers=admin).status_code == 200


def test_get_usuarios_pendientes(admin):
    """
    Antes de este refactor, este endpoint devolvía 500 siempre: su firma
    decía `-> list[dict]` pero en tiempo de ejecución retornaba un dict
    ({"total_pendientes", "usuarios"}). Con response_model correcto, ahora
    responde 200 — justo el tipo de bug que response_model está pensado
    para atrapar.
    """
    assert client.get("/usuarios/pendientes", headers=admin).status_code == 200


def test_get_usuario_detalle(admin):
    assert client.get(f"/usuarios/{CIUDADANO_ID}", headers=admin).status_code == 200


def test_get_infraestructura_listar(ciudadano):
    assert client.get("/infraestructura/", headers=ciudadano).status_code == 200


def test_get_infraestructura_detalle(ciudadano):
    assert client.get("/infraestructura/1", headers=ciudadano).status_code == 200


def test_get_auditoria_listar(admin):
    assert client.get("/auditoria/", headers=admin).status_code == 200


def test_get_auditoria_modulos(admin):
    assert client.get("/auditoria/modulos", headers=admin).status_code == 200


def test_get_auth_me(ciudadano):
    assert client.get("/auth/me", headers=ciudadano).status_code == 200


def test_get_health():
    assert client.get("/health").status_code == 200


def test_get_db_test(admin):
    assert client.get("/db-test", headers=admin).status_code == 200


def test_get_reportes_estadisticas(moderador):
    # Antes corregido en el módulo de tests de integración: DATE_FORMAT(...,
    # '%Y-%m') dentro de un f-string SQL chocaba con la sustitución de
    # parámetros %-style de pymysql (siempre lanzaba 500). Se arregló
    # escapando el literal como '%%Y-%%m'.
    res = client.get("/reportes/estadisticas", headers=moderador)
    assert res.status_code == 200


# ── password_hash nunca debe aparecer en ninguna respuesta ─────────────


def test_password_hash_never_in_login_response():
    res = client.post(
        "/auth/login", json={"correo": "no-existe@example.com", "password": "x"}
    )
    assert "password_hash" not in res.text


def test_password_hash_never_in_usuarios_responses(admin, ciudadano):
    for res in (
        client.get("/usuarios/", headers=admin),
        client.get(f"/usuarios/{CIUDADANO_ID}", headers=admin),
        client.get("/usuarios/perfil", headers=ciudadano),
        client.get("/auth/me", headers=ciudadano),
    ):
        assert "password_hash" not in res.text


def test_password_hash_never_in_openapi_schema():
    spec = client.get("/openapi.json")
    assert spec.status_code == 200
    assert "password_hash" not in json.dumps(spec.json())


# ── Snapshot de campos: guarda contra SELECT y schema desincronizándose ─

EXPECTED_REPORTE_DETALLE_FIELDS = {
    "id_reporte",
    "descripcion",
    "direccion",
    "latitud",
    "longitud",
    "imagen_url",
    "fuente_reporte",
    "created_at",
    "id_usuario",
    "id_entidad",
    "id_tipo_incidente",
    "id_severidad",
    "id_estado",
    "usuario",
    "estado",
    "tipo_incidente",
    "severidad",
}


def test_reportes_listar_field_snapshot(moderador):
    res = client.get("/reportes/", headers=moderador)
    assert res.status_code == 200
    rows = res.json()
    assert rows, "se esperaban reportes semilla para poder comparar el shape"
    assert set(rows[0].keys()) == EXPECTED_REPORTE_DETALLE_FIELDS


def test_reportes_detalle_field_snapshot(moderador):
    res = client.get("/reportes/1", headers=moderador)
    assert res.status_code == 200
    assert set(res.json().keys()) == EXPECTED_REPORTE_DETALLE_FIELDS


def test_reportes_estadisticas_schema_field_snapshot():
    assert set(EstadisticasResponse.model_fields.keys()) == {
        "total_reportes",
        "por_estado",
        "por_tipo_incidente",
        "por_severidad",
        "por_mes",
    }


def test_reportes_estadisticas_live_field_snapshot(moderador):
    res = client.get("/reportes/estadisticas", headers=moderador)
    assert res.status_code == 200
    assert set(res.json().keys()) == {
        "total_reportes",
        "por_estado",
        "por_tipo_incidente",
        "por_severidad",
        "por_mes",
    }
