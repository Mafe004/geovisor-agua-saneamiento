"""
Tests de transacciones + auditoría — corren contra geovisor_test (ver
tests/conftest.py), no contra la base de desarrollo.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import get_connection
from main import app

pytestmark = pytest.mark.integration

client = TestClient(app)

CIUDADANO_ID = 1  # Juan Pérez — dueño de los reportes semilla 1 y 2, entidad 1
ENTIDAD_ID = 2  # Operador Entidad - Acueducto — entidad 1
LOGIN_TEST_USER_ID = 4  # Maria Test — se le rota la contraseña temporalmente


def _token(id_usuario: int, id_rol: int) -> str:
    return create_access_token({"sub": str(id_usuario), "id_rol": id_rol})


def _count(table: str) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM {table};")  # noqa: S608 (nombre de tabla fijo)
            return cur.fetchone()["c"]
    finally:
        conn.close()


def _count_logins(id_usuario: int) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM logs_auditoria "
                "WHERE id_usuario = %s AND accion = 'LOGIN';",
                (id_usuario,),
            )
            return cur.fetchone()["c"]
    finally:
        conn.close()


def _borrar_reporte(id_reporte: int) -> None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM logs_auditoria WHERE accion='CREAR_REPORTE' AND modulo='REPORTES' "
                "ORDER BY id_log DESC LIMIT 1;"
            )
            cur.execute("DELETE FROM historial_reportes WHERE id_reporte = %s;", (id_reporte,))
            cur.execute("DELETE FROM notificaciones WHERE id_reporte = %s;", (id_reporte,))
            cur.execute("DELETE FROM reportes WHERE id_reporte = %s;", (id_reporte,))
    finally:
        conn.close()


@pytest.fixture
def ciudadano_headers():
    return {"Authorization": f"Bearer {_token(CIUDADANO_ID, 1)}"}


@pytest.fixture
def entidad_headers():
    return {"Authorization": f"Bearer {_token(ENTIDAD_ID, 2)}"}


REPORTE_PAYLOAD = {
    "id_tipo_incidente": 1,
    "id_severidad": 1,
    "descripcion": "test_transacciones: reporte de prueba",
    "latitud": 4.5,
    "longitud": -74.0,
}


# ── Part D, ítem 1: una escritura exitosa toca exactamente una fila por tabla ──


def test_crear_reporte_escribe_una_fila_en_cada_tabla(ciudadano_headers):
    tablas = ("reportes", "historial_reportes", "notificaciones", "logs_auditoria")
    antes = {t: _count(t) for t in tablas}

    res = client.post("/reportes/", headers=ciudadano_headers, json=REPORTE_PAYLOAD)
    assert res.status_code == 201
    nuevo_id = res.json()["reporte"]["id_reporte"]

    try:
        despues = {t: _count(t) for t in tablas}
        for tabla in tablas:
            assert despues[tabla] == antes[tabla] + 1, f"{tabla}: se esperaba +1 fila"
    finally:
        _borrar_reporte(nuevo_id)


# ── Part D, ítem 2: si falla el INSERT de historial, no sobrevive el reporte ──


def test_fallo_en_historial_revierte_el_insert_de_reporte(ciudadano_headers, monkeypatch):
    import app.routers.reportes as reportes_router

    def _falla(*args, **kwargs):
        raise RuntimeError("fallo simulado en _insertar_historial")

    monkeypatch.setattr(reportes_router, "_insertar_historial", _falla)

    antes = _count("reportes")

    res = client.post("/reportes/", headers=ciudadano_headers, json=REPORTE_PAYLOAD)

    # handle_db_error lo convierte en un 500 genérico, pero lo que importa
    # aquí es que NO haya sido un 201 con un reporte huérfano.
    assert res.status_code == 500

    despues = _count("reportes")
    assert despues == antes, "no debe sobrevivir ninguna fila de reportes tras el rollback"


# ── Part D, ítem 3: una HTTPException a mitad de transacción da el status ──
# ── original (403), no un 500, y no deja filas huérfanas ──────────────────


def test_entidad_cambiando_reporte_de_otra_entidad_da_403_no_500(entidad_headers):
    # El reporte semilla #3 no tiene entidad asignada (None) — un usuario de
    # la entidad 1 nunca puede modificarlo.
    tablas = ("historial_reportes", "notificaciones", "logs_auditoria")
    antes = {t: _count(t) for t in tablas}

    res = client.put(
        "/reportes/3/estado", headers=entidad_headers, json={"id_estado_nuevo": 2}
    )
    assert res.status_code == 403

    despues = {t: _count(t) for t in tablas}
    assert despues == antes, "un 403 a mitad de transacción no debe dejar filas huérfanas"


# ── Part D, ítem 4: login exitoso audita, login fallido no ────────────────


@pytest.fixture
def _password_temporal():
    """Rota la contraseña de un usuario semilla a un valor conocido y la
    restaura al terminar, para poder probar el flujo de login real."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM usuarios WHERE id_usuario = %s;",
                (LOGIN_TEST_USER_ID,),
            )
            hash_original = cur.fetchone()["password_hash"]
            cur.execute(
                "UPDATE usuarios SET password_hash = %s WHERE id_usuario = %s;",
                (hash_password("TestPass123!"), LOGIN_TEST_USER_ID),
            )
    finally:
        conn.close()

    yield "TestPass123!"

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET password_hash = %s WHERE id_usuario = %s;",
                (hash_original, LOGIN_TEST_USER_ID),
            )
    finally:
        conn.close()


def test_login_exitoso_escribe_una_fila_auth_login(_password_temporal):
    antes = _count_logins(LOGIN_TEST_USER_ID)

    res = client.post(
        "/auth/login",
        json={"correo": "maria.test@correo.com", "password": _password_temporal},
    )
    assert res.status_code == 200

    try:
        despues = _count_logins(LOGIN_TEST_USER_ID)
        assert despues == antes + 1
    finally:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM logs_auditoria WHERE id_usuario = %s AND accion = 'LOGIN' "
                    "ORDER BY id_log DESC LIMIT 1;",
                    (LOGIN_TEST_USER_ID,),
                )
        finally:
            conn.close()


def test_login_fallido_no_escribe_fila(_password_temporal):
    antes = _count_logins(LOGIN_TEST_USER_ID)

    res = client.post(
        "/auth/login",
        json={"correo": "maria.test@correo.com", "password": "contrasena-incorrecta"},
    )
    assert res.status_code == 401

    despues = _count_logins(LOGIN_TEST_USER_ID)
    assert despues == antes
