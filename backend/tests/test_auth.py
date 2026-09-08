"""
tests/test_auth.py — login y validación de token, sobre HTTP real.
"""

import pytest

from app.core.security import create_access_token

pytestmark = pytest.mark.integration

SEED_PASSWORD = "demo2025"


def test_login_valido_devuelve_token_y_usuario(client_anon):
    res = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": SEED_PASSWORD}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert body["user"]["correo"] == "juan@test.com"
    assert body["user"]["id_rol"] == 1


def test_login_response_nunca_incluye_password_hash(client_anon):
    res = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": SEED_PASSWORD}
    )
    assert res.status_code == 200
    assert "password_hash" not in res.text


def test_password_incorrecta_y_correo_inexistente_dan_la_misma_respuesta(client_anon):
    res_wrong_password = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": "esto-no-es-la-clave"}
    )
    res_unknown_email = client_anon.post(
        "/auth/login",
        json={"correo": "no-existe-este-correo@example.com", "password": "cualquier-cosa"},
    )
    assert res_wrong_password.status_code == res_unknown_email.status_code == 401
    assert res_wrong_password.json() == res_unknown_email.json()


def test_cuenta_suspendida_con_credenciales_correctas_da_403(client_anon, client_admin):
    # id_usuario=1 (juan@test.com) — el ADMIN lo suspende antes del intento.
    res = client_admin.put("/usuarios/1/estado", json={"id_estado_cuenta": 3})
    assert res.status_code == 200

    res_login = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": SEED_PASSWORD}
    )
    assert res_login.status_code == 403
    assert res_login.json()["detail"] == "Cuenta no activa"


def test_me_con_token_valido_devuelve_el_usuario_actual(client_ciudadano):
    res = client_ciudadano.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["correo"] == "juan@test.com"


def test_me_sin_token_da_401(client_anon):
    res = client_anon.get("/auth/me")
    assert res.status_code == 401


def test_me_con_token_valido_pero_cuenta_suspendida_da_403(client_ciudadano, client_admin):
    """
    Guardia de regresión para /auth/me: si un token sigue siendo
    criptográficamente válido pero la cuenta fue suspendida DESPUÉS de
    emitirlo, /me debe reflejarlo con un 403 — no basta con que el JWT
    tenga buena firma, la cuenta detrás también tiene que seguir activa.
    Esto es justo lo que el frontend usa para revalidar la sesión al
    abrir la app (AuthContext.loadStoredAuth).
    """
    # client_ciudadano ya tiene un token válido y vigente cuando llega acá.
    res_suspender = client_admin.put("/usuarios/1/estado", json={"id_estado_cuenta": 3})
    assert res_suspender.status_code == 200

    res_me = client_ciudadano.get("/auth/me")
    assert res_me.status_code == 403
    assert "no activa" in res_me.json()["detail"].lower()


def test_me_con_token_malformado_da_401(client_anon):
    client_anon.headers.update({"Authorization": "Bearer esto-no-es-un-jwt-valido"})
    res = client_anon.get("/auth/me")
    assert res.status_code == 401


def test_me_con_token_firmado_por_otra_clave_da_401(client_anon):
    from jose import jwt

    token_ajeno = jwt.encode(
        {"sub": "1", "id_rol": 1}, "una-clave-que-no-es-la-del-servidor", algorithm="HS256"
    )
    client_anon.headers.update({"Authorization": f"Bearer {token_ajeno}"})
    res = client_anon.get("/auth/me")
    assert res.status_code == 401


def test_me_con_token_expirado_da_401(client_anon):
    token_expirado = create_access_token({"sub": "1", "id_rol": 1}, expires_minutes=-5)
    client_anon.headers.update({"Authorization": f"Bearer {token_expirado}"})
    res = client_anon.get("/auth/me")
    assert res.status_code == 401


# ── app.core.deps: la MISMA cadena get_current_user/require_active_user/
# require_roles que protege el resto de la API (no la de auth.py, que solo
# usa /auth/me) — vale la pena probarla directamente, no solo vía /auth/me.


def test_endpoint_protegido_con_token_sin_sub_da_401(client_anon):
    from jose import jwt

    from app.core.security import ALGORITHM, SECRET_KEY

    token_sin_sub = jwt.encode({"id_rol": 1}, SECRET_KEY, algorithm=ALGORITHM)
    client_anon.headers.update({"Authorization": f"Bearer {token_sin_sub}"})
    res = client_anon.get("/reportes/")
    assert res.status_code == 401


def test_endpoint_protegido_con_usuario_inexistente_da_401(client_anon):
    # Token con firma válida, pero apuntando a un id_usuario que no existe.
    token = create_access_token({"sub": "999999", "id_rol": 1})
    client_anon.headers.update({"Authorization": f"Bearer {token}"})
    res = client_anon.get("/reportes/")
    assert res.status_code == 401


def test_endpoint_protegido_con_cuenta_suspendida_da_403(client_admin, client_anon):
    res_suspender = client_admin.put("/usuarios/1/estado", json={"id_estado_cuenta": 3})
    assert res_suspender.status_code == 200

    token = create_access_token({"sub": "1", "id_rol": 1})
    client_anon.headers.update({"Authorization": f"Bearer {token}"})
    res = client_anon.get("/reportes/")
    assert res.status_code == 403
    assert "no activa" in res.json()["detail"].lower()


def test_nombre_rol_y_estado_desconocidos_no_lanzan(monkeypatch):
    """
    _nombre_rol/_nombre_estado alimentan los mensajes de error de
    require_roles/require_active_user — deben degradar a "DESCONOCIDO" en
    vez de lanzar, incluso ante un valor que no está en el enum (nunca
    debería pasar con la FK de la BD real, pero el código no debe asumirlo).
    """
    from app.core import deps

    assert deps._nombre_rol(999) == "DESCONOCIDO"
    assert deps._nombre_estado(999) == "DESCONOCIDO"


def test_get_client_ip_usa_x_forwarded_for_solo_con_trust_proxy(
    monkeypatch, client_anon, client_admin
):
    """
    get_client_ip alimenta ip_origen en logs_auditoria. Con TRUST_PROXY=true
    debe usar X-Forwarded-For; el login (que audita) es la forma más directa
    de observar el valor que terminó guardado.
    """
    monkeypatch.setenv("TRUST_PROXY", "true")
    client_anon.headers.update({"X-Forwarded-For": "203.0.113.7, 10.0.0.1"})

    res = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": SEED_PASSWORD}
    )
    assert res.status_code == 200

    res_logs = client_admin.get("/auditoria/", params={"modulo": "AUTH", "id_usuario": 1})
    assert res_logs.status_code == 200
    logs = res_logs.json()["logs"]
    assert logs, "se esperaba una fila de auditoría LOGIN para id_usuario=1"
    # No se usa logs[0]: el ORDER BY es por fecha_accion, y la fila semilla
    # trae su fecha_accion congelada desde que se tomó la foto de la sesión
    # (ver _seed_snapshot) — puede ordenar después de una fila recién
    # insertada según cuándo haya corrido cada NOW(). id_log sí es
    # monótono, así que la fila más nueva es la de id_log más alto.
    fila_mas_nueva = max(logs, key=lambda log: log["id_log"])
    assert fila_mas_nueva["ip_origen"] == "203.0.113.7"
