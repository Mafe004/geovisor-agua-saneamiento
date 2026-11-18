"""
Pruebas de caja negra (S1-S10): 10 escenarios end-to-end sobre la API
pública, pensados como una sola historia de usuario cada uno -- se
ejercitan solo a través de requests HTTP (igual que un cliente real),
sin ninguna suposición sobre la implementación interna.

Varios de los 10 ya estaban cubiertos, como flujo completo o como parte
de otro test, en archivos existentes -- no se duplican aquí, solo se
referencian. Este archivo agrega los que no tenían ninguna prueba
end-to-end todavía (S1, S5, S6).

  S1  Registro público de un ciudadano + login inmediato con esas
      credenciales.                                    -> NUEVO (abajo)
  S2  Login con contraseña incorrecta y con correo inexistente se
      comportan igual (no revelan cuál cuenta existe).
      -> ya cubierto: test_auth.py::
         test_password_incorrecta_y_correo_inexistente_dan_la_misma_respuesta
  S3  Un ciudadano crea un reporte y lo ve de inmediato en su propio
      listado.
      -> ya cubierto: test_reportes.py::test_ciclo_de_vida_completo
  S4  Un ciudadano no ve los reportes de otro ciudadano en su listado
      (aislamiento de datos).
      -> ya cubierto: test_authz.py::
         test_ciudadano_no_ve_reportes_de_otro_ciudadano_en_su_listado
  S5  El moderador asigna un reporte a una entidad, y esa entidad (como
      titular) lo ve de inmediato en su propio pool.    -> NUEVO (abajo)
  S6  El titular de una entidad reparte un reporte a un trabajador; el
      trabajador NO puede marcarlo RESUELTO sin evidencia, y SÍ puede con
      al menos una foto.                                -> NUEVO (abajo)
  S7  Cualquier endpoint protegido rechaza una petición sin token (401).
      -> ya cubierto: test_401_sin_token_* en prácticamente todos los
         archivos de la suite (p.ej. test_infraestructura.py,
         test_entidades.py, test_usuarios.py).
  S8  Una cuenta suspendida no puede iniciar sesión aunque la contraseña
      sea correcta.
      -> ya cubierto: test_auth.py::
         test_cuenta_suspendida_con_credenciales_correctas_da_403 y
         test_usuarios.py::test_cambiar_estado_suspende_y_bloquea_el_login
  S9  Un usuario autenticado de cualquier rol puede consultar las capas de
      solo lectura (infraestructura hídrica, SIASAR).
      -> ya cubierto: test_infraestructura.py::
         test_200_listar_cualquier_rol_activo y test_siasar_api.py
  S10 Flujo completo de invitación: un admin genera un código, se valida
      públicamente, se canjea, y la cuenta nueva queda operativa con el
      rol correcto.
      -> ya cubierto: test_invitaciones.py::
         test_canjear_invitacion_crea_la_cuenta_con_el_rol_y_entidad_del_token
"""

import pytest

pytestmark = pytest.mark.integration

IMAGEN_EVIDENCIA = "/uploads/reportes/" + "a" * 32 + ".jpg"


# ── S1 ────────────────────────────────────────────────────────────────────


def test_s1_registro_publico_y_login_inmediato(client_anon):
    res_registro = client_anon.post(
        "/usuarios/registro",
        json={
            "nombre_completo": "Caja Negra Uno", "correo": "caja.negra.s1@demo.com",
            "password": "claveSegura123",
        },
    )
    assert res_registro.status_code == 201
    assert res_registro.json()["estado"] == "ACTIVO"

    res_login = client_anon.post(
        "/auth/login", json={"correo": "caja.negra.s1@demo.com", "password": "claveSegura123"}
    )
    assert res_login.status_code == 200

    perfil = client_anon.get(
        "/usuarios/perfil",
        headers={"Authorization": f"Bearer {res_login.json()['access_token']}"},
    ).json()
    assert perfil["correo"] == "caja.negra.s1@demo.com"
    assert perfil["rol"] == "CIUDADANO"


# ── S5 ────────────────────────────────────────────────────────────────────


def test_s5_moderador_asigna_entidad_y_el_titular_lo_ve_en_su_pool(client_ciudadano, client_moderador, client_entidad):
    id_reporte = client_ciudadano.post(
        "/reportes/", json={
            "id_tipo_incidente": 1, "id_severidad": 1,
            "descripcion": "caja negra S5: fuga reportada", "latitud": 5.02, "longitud": -74.0,
        },
    ).json()["reporte"]["id_reporte"]

    res_asignar = client_moderador.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 1})
    assert res_asignar.status_code == 200
    assert res_asignar.json()["reporte"]["id_entidad"] == 1

    pool_titular = client_entidad.get("/reportes/").json()
    assert any(r["id_reporte"] == id_reporte for r in pool_titular)


# ── S6 ────────────────────────────────────────────────────────────────────


def test_s6_trabajador_resuelve_solo_con_evidencia_fotografica(client_ciudadano, client_moderador, client_entidad, client_admin):
    # 1. Ciudadano reporta, moderador lo asigna a la entidad 1.
    id_reporte = client_ciudadano.post(
        "/reportes/", json={
            "id_tipo_incidente": 1, "id_severidad": 1,
            "descripcion": "caja negra S6: tubería rota", "latitud": 5.02, "longitud": -74.0,
        },
    ).json()["reporte"]["id_reporte"]
    client_moderador.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 1})

    # 2. Se crea un trabajador de la entidad 1 (el seed solo trae al
    # titular) y el titular le reparte el reporte.
    token = client_admin.post("/invitaciones/", json={"id_rol": 2, "id_entidad": 1}).json()["token"]
    client_admin.post(
        "/usuarios/registro-invitacion",
        json={
            "token": token, "nombre_completo": "Trabajador S6",
            "correo": "trabajador.s6@demo.com", "password": "demo2025",
        },
    )
    id_trabajador = next(
        u["id_usuario"] for u in client_admin.get("/usuarios/").json()
        if u["correo"] == "trabajador.s6@demo.com"
    )
    res_reparto = client_entidad.put(
        f"/reportes/{id_reporte}/asignar-usuario", json={"id_usuario_asignado": id_trabajador}
    )
    assert res_reparto.status_code == 200

    login_trabajador = client_admin.post(
        "/auth/login", json={"correo": "trabajador.s6@demo.com", "password": "demo2025"}
    ).json()
    headers_trabajador = {"Authorization": f"Bearer {login_trabajador['access_token']}"}

    # 3. El trabajador no puede marcarlo RESUELTO sin ninguna foto.
    res_sin_evidencia = client_admin.put(
        f"/reportes/{id_reporte}/estado", json={"id_estado_nuevo": 4}, headers=headers_trabajador,
    )
    assert res_sin_evidencia.status_code == 400
    assert "evidencia" in res_sin_evidencia.json()["detail"]

    # 4. Con al menos una foto, sí puede.
    res_con_evidencia = client_admin.put(
        f"/reportes/{id_reporte}/estado",
        json={"id_estado_nuevo": 4, "imagen_url": IMAGEN_EVIDENCIA},
        headers=headers_trabajador,
    )
    assert res_con_evidencia.status_code == 200
    assert res_con_evidencia.json()["reporte"]["estado"] == "RESUELTO"
