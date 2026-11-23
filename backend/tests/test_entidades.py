"""
Tests de app/routers/entidades.py -- lectura abierta a cualquier rol
activo, escritura (crear/actualizar/cambiar estado/asignar-desasignar
usuario) solo ADMIN, y GET /{id}/usuarios (ADMIN, o el TITULAR de esa
misma entidad -- ver policies equivalentes en usuarios_de_entidad()).

Semilla: una sola entidad (id_entidad=1, "Empresa de Acueducto
Municipal"), cuyo único usuario ENTIDAD es el titular (id_usuario=2).
"""

import pytest

pytestmark = pytest.mark.integration

ENTIDAD_SHAPE = {
    "id_entidad", "nombre_entidad", "nit_rut", "correo_institucional",
    "telefono", "direccion", "funcionario_responsable",
    "documento_funcionario", "sitio_web", "estado_cuenta", "created_at",
    "updated_at",
}


def _crear_entidad(client_admin, **overrides):
    payload = {
        "nombre_entidad": "Entidad de Prueba", "nit_rut": "TEST-NIT-001",
        "correo_institucional": "entidad.prueba@example.com",
    }
    payload.update(overrides)
    return client_admin.post("/entidades/", json=payload)


# ── GET /entidades/ -- cualquier rol activo ─────────────────────────────


def test_401_sin_token_listar(client_anon):
    assert client_anon.get("/entidades/").status_code == 401


@pytest.mark.parametrize("client_fixture", [
    "client_ciudadano", "client_entidad", "client_moderador", "client_admin",
])
def test_200_listar_cualquier_rol_activo(request, client_fixture):
    client = request.getfixturevalue(client_fixture)
    res = client.get("/entidades/")
    assert res.status_code == 200
    filas = res.json()
    assert len(filas) == 1
    assert set(filas[0].keys()) == ENTIDAD_SHAPE
    assert filas[0]["nombre_entidad"] == "Empresa de Acueducto Municipal"


# ── GET /entidades/{id} ──────────────────────────────────────────────────


def test_detalle_entidad_existente(client_ciudadano):
    res = client_ciudadano.get("/entidades/1")
    assert res.status_code == 200
    assert res.json()["nit_rut"] == "900123456-7"


def test_detalle_entidad_inexistente_da_404(client_ciudadano):
    assert client_ciudadano.get("/entidades/9999").status_code == 404


# ── POST /entidades/ -- solo ADMIN ──────────────────────────────────────


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_anon", 401),
    ("client_ciudadano", 403),
    ("client_entidad", 403),
    ("client_moderador", 403),
])
def test_crear_entidad_rbac_rechaza(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    res = _crear_entidad(client) if client_fixture != "client_anon" else client.post(
        "/entidades/", json={
            "nombre_entidad": "X", "nit_rut": "X", "correo_institucional": "x@example.com",
        },
    )
    assert res.status_code == esperado


def test_crear_entidad_admin_201(client_admin):
    res = _crear_entidad(client_admin)
    assert res.status_code == 201
    body = res.json()
    assert body["nombre_entidad"] == "Entidad de Prueba"
    assert isinstance(body["id_entidad"], int)

    detalle = client_admin.get(f"/entidades/{body['id_entidad']}").json()
    assert detalle["estado_cuenta"] == "ACTIVO"


def test_crear_entidad_nit_duplicado_da_400(client_admin):
    res = _crear_entidad(client_admin, nit_rut="900123456-7", correo_institucional="otro@example.com")
    assert res.status_code == 400


def test_crear_entidad_correo_duplicado_da_400(client_admin):
    res = _crear_entidad(client_admin, correo_institucional="contacto@acueducto.gov.co")
    assert res.status_code == 400


# ── PUT /entidades/{id} -- solo ADMIN ───────────────────────────────────


def test_actualizar_entidad_admin(client_admin):
    res = client_admin.put("/entidades/1", json={"telefono": "6019999999"})
    assert res.status_code == 200
    assert client_admin.get("/entidades/1").json()["telefono"] == "6019999999"


def test_actualizar_entidad_sin_campos_da_400(client_admin):
    assert client_admin.put("/entidades/1", json={}).status_code == 400


def test_actualizar_entidad_inexistente_da_404(client_admin):
    res = client_admin.put("/entidades/9999", json={"telefono": "123"})
    assert res.status_code == 404


def test_actualizar_entidad_correo_duplicado_da_400(client_admin):
    otra = _crear_entidad(client_admin).json()
    res = client_admin.put(
        f"/entidades/{otra['id_entidad']}", json={"correo_institucional": "contacto@acueducto.gov.co"}
    )
    assert res.status_code == 400


def test_actualizar_entidad_no_admin_da_403(client_entidad):
    assert client_entidad.put("/entidades/1", json={"telefono": "123"}).status_code == 403


# ── PUT /entidades/{id}/estado -- solo ADMIN ────────────────────────────


def test_cambiar_estado_entidad_admin(client_admin):
    res = client_admin.put("/entidades/1/estado", json={"id_estado_cuenta": 3})
    assert res.status_code == 200
    assert res.json()["nuevo_estado"] == "SUSPENDIDO"
    assert client_admin.get("/entidades/1").json()["estado_cuenta"] == "SUSPENDIDO"


def test_cambiar_estado_entidad_no_admin_da_403(client_moderador):
    assert client_moderador.put("/entidades/1/estado", json={"id_estado_cuenta": 3}).status_code == 403


def test_cambiar_estado_entidad_inexistente_da_404(client_admin):
    res = client_admin.put("/entidades/9999/estado", json={"id_estado_cuenta": 1})
    assert res.status_code == 404


def test_cambiar_estado_entidad_fuera_de_rango_da_422(client_admin):
    res = client_admin.put("/entidades/1/estado", json={"id_estado_cuenta": 99})
    assert res.status_code == 422


# ── PUT /entidades/{id}/asignar-usuario/{id_usuario} -- solo ADMIN ──────


def test_asignar_usuario_vuelve_titular(client_admin):
    otra = _crear_entidad(client_admin).json()
    # maria.test@correo.com (id_usuario=4) es CIUDADANO en el seed -- se
    # necesita un usuario con rol ENTIDAD para poder asignarlo; se crea uno
    # nuevo directo en la base del lado del test, único camino sin invitar.
    res = client_admin.post(
        "/invitaciones/", json={"id_rol": 2, "id_entidad": otra["id_entidad"]}
    )
    token = res.json()["token"]
    client_admin.post(
        "/usuarios/registro-invitacion",
        json={
            "token": token, "nombre_completo": "Nuevo Entidad", "correo": "nuevo.entidad@demo.com",
            "password": "demo2025",
        },
    )
    nuevo_id = next(
        u["id_usuario"] for u in client_admin.get("/usuarios/").json()
        if u["correo"] == "nuevo.entidad@demo.com"
    )

    res = client_admin.put(f"/entidades/1/asignar-usuario/{nuevo_id}")
    assert res.status_code == 200
    assert res.json()["entidad"] == "Empresa de Acueducto Municipal"

    usuarios_entidad_1 = client_admin.get("/entidades/1/usuarios").json()["usuarios"]
    asignado = next(u for u in usuarios_entidad_1 if u["id_usuario"] == nuevo_id)
    assert asignado["es_titular_entidad"] is True


def test_asignar_usuario_rol_no_entidad_da_400(client_admin):
    # juan@test.com (id_usuario=1) es CIUDADANO.
    res = client_admin.put("/entidades/1/asignar-usuario/1")
    assert res.status_code == 400


def test_asignar_usuario_entidad_inexistente_da_404(client_admin):
    assert client_admin.put("/entidades/9999/asignar-usuario/2").status_code == 404


def test_asignar_usuario_inexistente_da_404(client_admin):
    assert client_admin.put("/entidades/1/asignar-usuario/9999").status_code == 404


def test_asignar_usuario_no_admin_da_403(client_entidad):
    assert client_entidad.put("/entidades/1/asignar-usuario/2").status_code == 403


# ── DELETE /entidades/{id}/desasignar-usuario/{id_usuario} ─────────────


def test_desasignar_usuario_quita_el_vinculo(client_admin):
    res = client_admin.delete("/entidades/1/desasignar-usuario/2")
    assert res.status_code == 200
    detalle = client_admin.get("/usuarios/2").json()
    assert detalle["id_entidad"] is None


def test_desasignar_usuario_que_no_pertenece_a_esa_entidad_da_400(client_admin):
    otra = _crear_entidad(client_admin).json()
    res = client_admin.delete(f"/entidades/{otra['id_entidad']}/desasignar-usuario/2")
    assert res.status_code == 400


def test_desasignar_usuario_inexistente_da_404(client_admin):
    assert client_admin.delete("/entidades/1/desasignar-usuario/9999").status_code == 404


def test_desasignar_usuario_no_admin_da_403(client_entidad):
    assert client_entidad.delete("/entidades/1/desasignar-usuario/2").status_code == 403


# ── GET /entidades/{id}/usuarios -- ADMIN, o el titular de esa entidad ──


def test_usuarios_de_entidad_admin_ve_cualquiera(client_admin):
    res = client_admin.get("/entidades/1/usuarios")
    assert res.status_code == 200
    body = res.json()
    assert body["total_usuarios"] == 1
    assert body["usuarios"][0]["correo"] == "operador.acueducto@demo.com"


def test_usuarios_de_entidad_titular_ve_la_propia(client_entidad):
    res = client_entidad.get("/entidades/1/usuarios")
    assert res.status_code == 200
    assert res.json()["total_usuarios"] == 1


def test_usuarios_de_entidad_titular_no_ve_otra(client_admin, client_entidad):
    otra = _crear_entidad(client_admin).json()
    res = client_entidad.get(f"/entidades/{otra['id_entidad']}/usuarios")
    assert res.status_code == 403


def test_usuarios_de_entidad_trabajador_no_titular_sin_permiso(client_admin, client_anon):
    token = client_admin.post("/invitaciones/", json={"id_rol": 2, "id_entidad": 1}).json()["token"]
    client_anon.post(
        "/usuarios/registro-invitacion",
        json={
            "token": token, "nombre_completo": "Trabajador", "correo": "trabajador.lista@demo.com",
            "password": "demo2025",
        },
    )
    login = client_anon.post(
        "/auth/login", json={"correo": "trabajador.lista@demo.com", "password": "demo2025"}
    )
    client_anon.headers.update({"Authorization": f"Bearer {login.json()['access_token']}"})

    res = client_anon.get("/entidades/1/usuarios")
    assert res.status_code == 403


def test_usuarios_de_entidad_ciudadano_sin_permiso(client_ciudadano):
    assert client_ciudadano.get("/entidades/1/usuarios").status_code == 403


def test_usuarios_de_entidad_inexistente_da_404(client_admin):
    assert client_admin.get("/entidades/9999/usuarios").status_code == 404
