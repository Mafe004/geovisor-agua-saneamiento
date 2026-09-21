"""
tests/test_authz.py — el módulo más importante de la suite.

Primera mitad: matriz (endpoint, método, rol) -> status esperado, para que
un hueco en la política de autorización sea visible de un vistazo. Segunda
mitad: aislamiento a nivel de fila, que la matriz no puede expresar (un
200 en la matriz no dice nada sobre SI ese 200 filtra correctamente los
datos de otros usuarios).
"""

import pytest

pytestmark = pytest.mark.integration

ROLE_FIXTURES = [
    "client_anon",
    "client_ciudadano",
    "client_entidad",
    "client_moderador",
    "client_admin",
]


def _assert_matrix(request, method, path, expected, **kwargs):
    assert len(expected) == len(ROLE_FIXTURES)
    for fixture_name, expected_status in zip(ROLE_FIXTURES, expected, strict=True):
        client = request.getfixturevalue(fixture_name)
        res = client.request(method, path, **kwargs)
        assert res.status_code == expected_status, (
            f"{method} {path} como {fixture_name}: se esperaba "
            f"{expected_status}, fue {res.status_code} ({res.text[:200]})"
        )


# ── Matriz de autorización ──────────────────────────────────────────────
# Orden de columnas: anon, ciudadano, entidad, moderador, admin


def test_matrix_listar_reportes(request):
    _assert_matrix(request, "GET", "/reportes/", (401, 200, 200, 200, 200))


def test_matrix_estadisticas_reportes(request):
    _assert_matrix(request, "GET", "/reportes/estadisticas", (401, 403, 200, 200, 200))


def test_matrix_cambiar_estado_reporte(request):
    # Reporte semilla #1 pertenece a la entidad 1 (la de client_entidad) —
    # este es el caso "200*" de la tabla: solo pasa para SUS propios reportes.
    _assert_matrix(
        request,
        "PUT",
        "/reportes/1/estado",
        (401, 403, 200, 200, 200),
        json={"id_estado_nuevo": 1},
    )


def test_matrix_historial_global(request):
    # ENTIDAD ahora ve su propio historial (mismo scope_reportes que
    # estadisticas_reportes arriba) -- antes este endpoint no dejaba pasar
    # a ENTIDAD en absoluto, ver test_historial.py para el detalle del scope.
    _assert_matrix(request, "GET", "/historial/", (401, 403, 200, 200, 200))


def test_matrix_auditoria(request):
    _assert_matrix(request, "GET", "/auditoria/", (401, 403, 403, 403, 200))


def test_matrix_listar_usuarios(request):
    _assert_matrix(request, "GET", "/usuarios/", (401, 403, 403, 403, 200))


def test_matrix_crear_entidad(request):
    _assert_matrix(
        request,
        "POST",
        "/entidades/",
        (401, 403, 403, 403, 201),
        json={
            "nombre_entidad": "Matrix Test Entidad",
            "nit_rut": "MATRIX-TEST-001",
            "correo_institucional": "matrix.test@example.com",
        },
    )


def test_matrix_crear_infraestructura(request):
    _assert_matrix(
        request,
        "POST",
        "/infraestructura/",
        (401, 403, 403, 201, 201),
        json={"nombre": "Matrix Test Pozo", "tipo": "POZO", "latitud": 5.0, "longitud": -74.0},
    )


# ── Aislamiento a nivel de fila ─────────────────────────────────────────


def test_ciudadano_no_ve_reportes_de_otro_ciudadano_en_su_listado(client_ciudadano):
    # juan@test.com (id_usuario=1) — los reportes semilla #3 y #4 son de
    # otro ciudadano (id_usuario=4, Maria Test).
    res = client_ciudadano.get("/reportes/")
    assert res.status_code == 200
    ids_devueltos = {r["id_reporte"] for r in res.json()}
    assert 3 not in ids_devueltos
    assert 4 not in ids_devueltos
    assert all(r["id_usuario"] == 1 for r in res.json())


def test_ciudadano_ve_reportes_de_otros_ciudadanos_en_el_mapa(client_ciudadano):
    # A diferencia de /reportes/ (test anterior), /reportes/mapa es la vista
    # comunitaria: los reportes semilla #3 y #4 (de Maria, id_usuario=4)
    # SÍ deben aparecer aquí para juan (id_usuario=1).
    res = client_ciudadano.get("/reportes/mapa")
    assert res.status_code == 200
    ids_devueltos = {p["id_reporte"] for p in res.json()}
    assert {3, 4}.issubset(ids_devueltos)


def test_reportes_mapa_no_expone_datos_personales_del_creador(client_ciudadano):
    res = client_ciudadano.get("/reportes/mapa")
    assert res.status_code == 200
    puntos = res.json()
    assert puntos, "la semilla debe traer al menos un reporte"
    for punto in puntos:
        assert "id_usuario" not in punto
        assert "usuario" not in punto
        assert "nombre_completo" not in punto


def test_ciudadano_ve_su_propio_reporte_por_id_como_antes(client_ciudadano):
    # Reporte semilla #1 pertenece a juan (id_usuario=1) -- dueño, sin cambios.
    res = client_ciudadano.get("/reportes/1")
    assert res.status_code == 200
    body = res.json()
    assert body["id_usuario"] == 1
    assert body["usuario"]


def test_ciudadano_ve_detalle_comunitario_de_reporte_de_otro(client_ciudadano):
    # Reporte semilla #3 pertenece a id_usuario=4 (Maria), no a juan --
    # antes daba 403; ahora es la vista comunitaria (200, schema reducido).
    res = client_ciudadano.get("/reportes/3")
    assert res.status_code == 200


def test_detalle_comunitario_trae_informacion_publica_util(client_ciudadano):
    res = client_ciudadano.get("/reportes/3")
    assert res.status_code == 200
    body = res.json()
    assert body["descripcion"] == "Taponamiento del alcantarillado frente al parque central"
    assert body["estado"]
    assert body["severidad"]
    assert body["latitud"] and body["longitud"]
    assert body["created_at"]


def test_detalle_comunitario_no_expone_id_usuario(client_ciudadano):
    res = client_ciudadano.get("/reportes/3")
    assert res.status_code == 200
    assert "id_usuario" not in res.json()


def test_detalle_comunitario_no_expone_usuario(client_ciudadano):
    res = client_ciudadano.get("/reportes/3")
    assert res.status_code == 200
    assert "usuario" not in res.json()


def test_ciudadano_puede_ver_historial_de_reporte_comunitario(client_ciudadano):
    # Historial semilla del reporte #3: una sola fila (id_historial=6).
    res = client_ciudadano.get("/reportes/3/historial")
    assert res.status_code == 200
    entradas = res.json()
    assert len(entradas) == 1
    assert entradas[0]["estado_anterior"] == "NINGUNO"
    assert entradas[0]["estado_nuevo"] == "PENDIENTE"


def test_historial_comunitario_no_expone_datos_personales_de_quien_actuo(client_ciudadano):
    res = client_ciudadano.get("/reportes/3/historial")
    assert res.status_code == 200
    for entrada in res.json():
        assert "id_usuario_accion" not in entrada
        assert "usuario_accion" not in entrada


def test_ciudadano_ve_su_propio_historial_completo_como_antes(client_ciudadano):
    # Reporte semilla #1 (dueño): el historial completo sigue incluyendo
    # quién hizo cada cambio, sin cambios de comportamiento.
    res = client_ciudadano.get("/reportes/1/historial")
    assert res.status_code == 200
    entradas = res.json()
    assert entradas
    assert all("usuario_accion" in e for e in entradas)


def test_entidad_ve_reporte_propio_con_schema_completo_sin_cambios(client_entidad):
    # Reporte semilla #1 es de la entidad 1 (la de client_entidad) -- ENTIDAD
    # nunca pasa por la vista comunitaria, solo CIUDADANO la tiene.
    res = client_entidad.get("/reportes/1")
    assert res.status_code == 200
    assert "id_usuario" in res.json()
    assert "usuario" in res.json()


def test_moderador_ve_cualquier_reporte_con_schema_completo_sin_cambios(client_moderador):
    # Reporte semilla #3 (de otro ciudadano): MODERADOR ya podía verlo antes
    # y sigue recibiendo el schema completo, nunca la vista reducida.
    res = client_moderador.get("/reportes/3")
    assert res.status_code == 200
    assert "id_usuario" in res.json()
    assert "usuario" in res.json()


def test_admin_ve_cualquier_reporte_con_schema_completo_sin_cambios(client_admin):
    res = client_admin.get("/reportes/3")
    assert res.status_code == 200
    assert "id_usuario" in res.json()
    assert "usuario" in res.json()


def test_entidad_no_puede_ver_ni_modificar_reporte_sin_asignar(client_entidad):
    """
    Los datos semilla solo tienen una entidad (id_entidad=1); no hay una
    segunda entidad con la que probar "otra entidad" directamente. El
    reporte semilla #3 no tiene entidad asignada (id_entidad=NULL) — es el
    caso equivalente: la entidad 1 no puede tocar un reporte que no es
    suyo, sea porque es de otra entidad o porque no tiene ninguna.
    """
    res_get = client_entidad.get("/reportes/3")
    assert res_get.status_code == 403

    res_put = client_entidad.put("/reportes/3/estado", json={"id_estado_nuevo": 2})
    assert res_put.status_code == 403


def test_filtro_id_estado_no_amplia_el_alcance_del_ciudadano(client_ciudadano):
    """
    Guardia de regresión para la tarea de filtros por query param: un
    filtro nunca debe ENSANCHAR el alcance por rol, solo reducirlo dentro
    de lo que el rol ya podía ver.
    """
    res = client_ciudadano.get("/reportes/", params={"id_estado": 1})
    assert res.status_code == 200
    assert all(r["id_usuario"] == 1 for r in res.json())


def test_entidad_sin_id_entidad_asignado_da_403_no_500_ni_lista_vacia(
    client_admin, client_anon
):
    # Desasignar al usuario ENTIDAD semilla (id_usuario=2) de su entidad.
    res = client_admin.delete("/entidades/1/desasignar-usuario/2")
    assert res.status_code == 200

    login = client_anon.post(
        "/auth/login",
        json={"correo": "operador.acueducto@demo.com", "password": "demo2025"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["id_entidad"] is None
    token = login.json()["access_token"]
    client_anon.headers.update({"Authorization": f"Bearer {token}"})

    res_listar = client_anon.get("/reportes/")
    assert res_listar.status_code == 403
    assert res_listar.json()["detail"] == "Usuario ENTIDAD sin id_entidad asignado"

    res_mapa = client_anon.get("/reportes/mapa")
    assert res_mapa.status_code == 403
