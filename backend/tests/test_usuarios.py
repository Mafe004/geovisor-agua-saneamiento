"""
Tests de app/routers/usuarios.py -- perfil propio (ver/actualizar/cambiar
contraseña) y administración de cuentas (listar/detalle/pendientes/cambiar
estado, solo ADMIN).

Semilla (geovisor_backup_limpio.sql): 5 usuarios, todos ACTIVOS --
  id 1  juan@test.com               CIUDADANO
  id 2  operador.acueducto@demo.com ENTIDAD (titular, id_entidad=1)
  id 3  moderador@demo.com          MODERADOR
  id 4  maria.test@correo.com       CIUDADANO
  id 5  admin@geovisor.com          ADMINISTRADOR
Ninguno está PENDIENTE -- /usuarios/pendientes se prueba vacío.
"""

import pytest

pytestmark = pytest.mark.integration

PERFIL_SHAPE = {
    "id_usuario", "nombre_completo", "cargo", "correo", "telefono", "pais",
    "ciudad", "direccion", "tipo_documento", "numero_documento",
    "fecha_nacimiento", "rol", "estado_cuenta", "created_at", "updated_at",
}
LIST_ITEM_SHAPE = {
    "id_usuario", "nombre_completo", "correo", "telefono", "ciudad", "rol",
    "estado_cuenta", "created_at",
}


# ── GET /usuarios/perfil -- cada rol ve el suyo ─────────────────────────


def test_401_sin_token_ver_perfil(client_anon):
    assert client_anon.get("/usuarios/perfil").status_code == 401


@pytest.mark.parametrize(
    "client_fixture,correo_esperado,rol_esperado",
    [
        ("client_ciudadano", "juan@test.com", "CIUDADANO"),
        ("client_entidad", "operador.acueducto@demo.com", "ENTIDAD"),
        ("client_moderador", "moderador@demo.com", "MODERADOR"),
        ("client_admin", "admin@geovisor.com", "ADMINISTRADOR"),
    ],
)
def test_ver_perfil_devuelve_el_propio(request, client_fixture, correo_esperado, rol_esperado):
    client = request.getfixturevalue(client_fixture)
    res = client.get("/usuarios/perfil")
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == PERFIL_SHAPE
    assert body["correo"] == correo_esperado
    assert body["rol"] == rol_esperado


# ── PUT /usuarios/perfil ─────────────────────────────────────────────────


def test_actualizar_perfil_cambia_los_campos_enviados(client_ciudadano):
    res = client_ciudadano.put("/usuarios/perfil", json={"ciudad": "Nueva Ciudad", "telefono": "3009999999"})
    assert res.status_code == 200

    perfil = client_ciudadano.get("/usuarios/perfil").json()
    assert perfil["ciudad"] == "Nueva Ciudad"
    assert perfil["telefono"] == "3009999999"


def test_actualizar_perfil_sin_campos_da_400(client_ciudadano):
    res = client_ciudadano.put("/usuarios/perfil", json={})
    assert res.status_code == 400


def test_actualizar_perfil_no_toca_el_de_otro_usuario(client_ciudadano, client_admin):
    client_ciudadano.put("/usuarios/perfil", json={"ciudad": "Solo Mío"})
    perfil_admin = client_admin.get("/usuarios/perfil").json()
    assert perfil_admin["ciudad"] != "Solo Mío"


# ── PUT /usuarios/perfil/password ───────────────────────────────────────


def test_cambiar_password_actual_incorrecta_da_400(client_ciudadano):
    res = client_ciudadano.put(
        "/usuarios/perfil/password",
        json={"password_actual": "no-es-esta", "password_nueva": "nuevaClave123"},
    )
    assert res.status_code == 400


def test_cambiar_password_correcta_permite_login_con_la_nueva(client_ciudadano, client_anon):
    res = client_ciudadano.put(
        "/usuarios/perfil/password",
        json={"password_actual": "demo2025", "password_nueva": "nuevaClave123"},
    )
    assert res.status_code == 200

    login_nueva = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": "nuevaClave123"}
    )
    assert login_nueva.status_code == 200
    login_vieja = client_anon.post(
        "/auth/login", json={"correo": "juan@test.com", "password": "demo2025"}
    )
    assert login_vieja.status_code == 401


# ── GET /usuarios/ -- solo ADMIN (RBAC) ─────────────────────────────────


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_anon", 401),
    ("client_ciudadano", 403),
    ("client_entidad", 403),
    ("client_moderador", 403),
    ("client_admin", 200),
])
def test_listar_usuarios_rbac(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    assert client.get("/usuarios/").status_code == esperado


def test_listar_usuarios_shape_y_total(client_admin):
    res = client_admin.get("/usuarios/")
    assert res.status_code == 200
    filas = res.json()
    assert len(filas) == 5
    assert set(filas[0].keys()) == LIST_ITEM_SHAPE


# ── GET /usuarios/pendientes -- solo ADMIN ──────────────────────────────


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_anon", 401),
    ("client_ciudadano", 403),
    ("client_admin", 200),
])
def test_listar_pendientes_rbac(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    assert client.get("/usuarios/pendientes").status_code == esperado


def test_listar_pendientes_vacio_sin_cuentas_pendientes_en_el_seed(client_admin):
    res = client_admin.get("/usuarios/pendientes")
    assert res.status_code == 200
    assert res.json() == {"total_pendientes": 0, "usuarios": []}


# ── GET /usuarios/{id} -- solo ADMIN ─────────────────────────────────────


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_anon", 401),
    ("client_ciudadano", 403),
    ("client_admin", 200),
])
def test_detalle_usuario_rbac(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    assert client.get("/usuarios/1").status_code == esperado


def test_detalle_usuario_shape(client_admin):
    res = client_admin.get("/usuarios/2")
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == PERFIL_SHAPE | {"id_entidad"}
    assert body["correo"] == "operador.acueducto@demo.com"
    assert body["id_entidad"] == 1


def test_detalle_usuario_inexistente_da_404(client_admin):
    assert client_admin.get("/usuarios/9999").status_code == 404


# ── PUT /usuarios/{id}/estado -- solo ADMIN ─────────────────────────────


@pytest.mark.parametrize("client_fixture,esperado", [
    ("client_anon", 401),
    ("client_ciudadano", 403),
    ("client_admin", 200),
])
def test_cambiar_estado_usuario_rbac(request, client_fixture, esperado):
    client = request.getfixturevalue(client_fixture)
    res = client.put("/usuarios/1/estado", json={"id_estado_cuenta": 3})
    assert res.status_code == esperado


def test_cambiar_estado_suspende_y_bloquea_el_login(client_admin, client_anon):
    res = client_admin.put("/usuarios/1/estado", json={"id_estado_cuenta": 3})
    assert res.status_code == 200
    assert res.json()["nuevo_estado"] == "SUSPENDIDO"

    login = client_anon.post("/auth/login", json={"correo": "juan@test.com", "password": "demo2025"})
    assert login.status_code == 403


def test_cambiar_estado_usuario_inexistente_da_404(client_admin):
    res = client_admin.put("/usuarios/9999/estado", json={"id_estado_cuenta": 1})
    assert res.status_code == 404


def test_cambiar_estado_fuera_de_rango_da_422(client_admin):
    res = client_admin.put("/usuarios/1/estado", json={"id_estado_cuenta": 0})
    assert res.status_code == 422
