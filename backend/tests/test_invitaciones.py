"""
Tests de app/routers/invitaciones.py -- generación (ADMIN, o el TITULAR de
una entidad invitando a su propia entidad), validación pública, y el canje
completo vía POST /usuarios/registro-invitacion (app/routers/usuarios.py).

Semilla: una sola entidad (id_entidad=1), cuyo único usuario ENTIDAD
(operador.acueducto@demo.com, id_usuario=2) es el titular -- no hay ningún
trabajador en el seed, así que los tests que necesitan uno lo crean vía el
propio flujo de invitación + canje.
"""

import pytest

pytestmark = pytest.mark.integration


def _crear_y_loguear_trabajador(client_admin, client_anon, correo: str) -> None:
    """Invita y da de alta un trabajador de la entidad 1 (vía el titular
    sería más realista, pero ADMIN también puede y evita depender de otro
    test); deja la sesión de client_anon logueada como ese trabajador."""
    inv = client_admin.post(
        "/invitaciones/", json={"id_rol": 2, "id_entidad": 1, "es_titular": False}
    ).json()
    client_anon.post(
        "/usuarios/registro-invitacion",
        json={
            "token": inv["token"], "nombre_completo": "Trabajador Nuevo",
            "correo": correo, "password": "demo2025",
        },
    )
    login = client_anon.post("/auth/login", json={"correo": correo, "password": "demo2025"})
    client_anon.headers.update({"Authorization": f"Bearer {login.json()['access_token']}"})


# ── POST /invitaciones/ -- quién puede generar ──────────────────────────


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_anon", 401),
    ("client_ciudadano", 403),
    ("client_moderador", 403),
])
def test_crear_invitacion_rbac_rechaza(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    res = client.post("/invitaciones/", json={"id_rol": 3})
    assert res.status_code == esperado


def test_admin_puede_invitar_moderador(client_admin):
    res = client_admin.post("/invitaciones/", json={"id_rol": 3})
    assert res.status_code == 201
    body = res.json()
    assert body["id_rol"] == 3
    assert body["id_entidad"] is None
    assert len(body["token"]) == 6


def test_admin_puede_invitar_entidad_titular(client_admin):
    res = client_admin.post(
        "/invitaciones/", json={"id_rol": 2, "id_entidad": 1, "es_titular": True}
    )
    assert res.status_code == 201
    assert res.json()["es_titular"] is True


def test_titular_puede_invitar_trabajador_de_su_propia_entidad(client_entidad):
    res = client_entidad.post("/invitaciones/", json={"id_rol": 2, "id_entidad": 1})
    assert res.status_code == 201
    assert res.json()["id_entidad"] == 1


def test_titular_no_puede_autoasignar_es_titular_al_invitar(client_entidad):
    # crear_invitacion() fuerza es_titular=False sin importar qué mande el
    # cliente -- un titular nunca crea OTRO titular (ver docstring).
    res = client_entidad.post(
        "/invitaciones/", json={"id_rol": 2, "id_entidad": 1, "es_titular": True}
    )
    assert res.status_code == 201
    assert res.json()["es_titular"] is False


def test_titular_no_puede_invitar_a_otra_entidad(client_admin, client_entidad):
    otra = client_admin.post(
        "/entidades/", json={
            "nombre_entidad": "Otra Entidad", "nit_rut": "OTRA-001",
            "correo_institucional": "otra@example.com",
        },
    ).json()
    res = client_entidad.post(
        "/invitaciones/", json={"id_rol": 2, "id_entidad": otra["id_entidad"]}
    )
    assert res.status_code == 403


def test_titular_no_puede_invitar_moderador(client_entidad):
    res = client_entidad.post("/invitaciones/", json={"id_rol": 3})
    assert res.status_code == 403


def test_trabajador_no_titular_no_puede_invitar(client_admin, client_anon):
    _crear_y_loguear_trabajador(client_admin, client_anon, "trabajador.rbac@demo.com")
    res = client_anon.post("/invitaciones/", json={"id_rol": 2, "id_entidad": 1})
    assert res.status_code == 403


# ── POST /invitaciones/ -- validación del cuerpo ────────────────────────


def test_crear_invitacion_id_rol_ciudadano_invalido(client_admin):
    res = client_admin.post("/invitaciones/", json={"id_rol": 1})
    assert res.status_code == 400


def test_crear_invitacion_entidad_sin_id_entidad_da_400(client_admin):
    res = client_admin.post("/invitaciones/", json={"id_rol": 2})
    assert res.status_code == 400


def test_crear_invitacion_no_entidad_con_id_entidad_da_400(client_admin):
    res = client_admin.post("/invitaciones/", json={"id_rol": 3, "id_entidad": 1})
    assert res.status_code == 400


def test_crear_invitacion_no_entidad_con_es_titular_da_400(client_admin):
    res = client_admin.post("/invitaciones/", json={"id_rol": 3, "es_titular": True})
    assert res.status_code == 400


def test_crear_invitacion_id_entidad_inexistente_da_400(client_admin):
    res = client_admin.post("/invitaciones/", json={"id_rol": 2, "id_entidad": 9999})
    assert res.status_code == 400


# ── GET /invitaciones/{token} -- validación pública ─────────────────────


def test_validar_invitacion_token_inexistente_da_404(client_anon):
    assert client_anon.get("/invitaciones/ZZZZZZ").status_code == 404


def test_validar_invitacion_token_valido_no_requiere_auth(client_admin, client_anon):
    token = client_admin.post("/invitaciones/", json={"id_rol": 3}).json()["token"]
    res = client_anon.get(f"/invitaciones/{token}")
    assert res.status_code == 200
    body = res.json()
    assert body["id_rol"] == 3
    assert body["rol"] == "MODERADOR"
    assert body["invitado_por"] == "Admin Geovisor"


def test_validar_invitacion_acepta_minusculas(client_admin, client_anon):
    token = client_admin.post("/invitaciones/", json={"id_rol": 3}).json()["token"]
    assert client_anon.get(f"/invitaciones/{token.lower()}").status_code == 200


def test_validar_invitacion_ya_usada_da_400(client_admin, client_anon):
    token = client_admin.post("/invitaciones/", json={"id_rol": 3}).json()["token"]
    client_anon.post(
        "/usuarios/registro-invitacion",
        json={
            "token": token, "nombre_completo": "Moderador Nuevo",
            "correo": "moderador.nuevo@demo.com", "password": "demo2025",
        },
    )
    res = client_anon.get(f"/invitaciones/{token}")
    assert res.status_code == 400
    assert "ya fue utilizado" in res.json()["detail"]


# ── Canje completo: POST /usuarios/registro-invitacion ──────────────────


def test_canjear_invitacion_crea_la_cuenta_con_el_rol_y_entidad_del_token(client_admin, client_anon):
    token = client_admin.post(
        "/invitaciones/", json={"id_rol": 2, "id_entidad": 1, "es_titular": False}
    ).json()["token"]

    res = client_anon.post(
        "/usuarios/registro-invitacion",
        json={
            "token": token, "nombre_completo": "Trabajador Canje",
            "correo": "trabajador.canje@demo.com", "password": "demo2025",
            "cargo": "Fontanero",
        },
    )
    assert res.status_code == 201
    assert res.json()["id_rol"] == 2

    login = client_anon.post(
        "/auth/login", json={"correo": "trabajador.canje@demo.com", "password": "demo2025"}
    )
    assert login.status_code == 200
    perfil = client_anon.get(
        "/usuarios/perfil", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
    ).json()
    assert perfil["rol"] == "ENTIDAD"
    assert perfil["cargo"] == "Fontanero"


def test_canjear_invitacion_no_deja_reusar_el_token(client_admin, client_anon):
    token = client_admin.post("/invitaciones/", json={"id_rol": 3}).json()["token"]
    payload = {
        "token": token, "nombre_completo": "Primero", "correo": "primero@demo.com",
        "password": "demo2025",
    }
    assert client_anon.post("/usuarios/registro-invitacion", json=payload).status_code == 201

    payload2 = {**payload, "nombre_completo": "Segundo", "correo": "segundo@demo.com"}
    res = client_anon.post("/usuarios/registro-invitacion", json=payload2)
    assert res.status_code == 400
    assert "ya fue utilizado" in res.json()["detail"]


def test_canjear_invitacion_token_invalido_da_400(client_anon):
    res = client_anon.post(
        "/usuarios/registro-invitacion",
        json={
            "token": "AAAAAA", "nombre_completo": "Nadie", "correo": "nadie@demo.com",
            "password": "demo2025",
        },
    )
    assert res.status_code == 400


def test_canjear_invitacion_correo_duplicado_da_400(client_admin, client_anon):
    token = client_admin.post("/invitaciones/", json={"id_rol": 3}).json()["token"]
    res = client_anon.post(
        "/usuarios/registro-invitacion",
        json={
            # juan@test.com ya existe en el seed (id_usuario=1).
            "token": token, "nombre_completo": "Duplicado", "correo": "juan@test.com",
            "password": "demo2025",
        },
    )
    assert res.status_code == 400
