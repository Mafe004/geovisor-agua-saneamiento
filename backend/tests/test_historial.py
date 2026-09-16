"""tests/test_historial.py"""

import pytest

pytestmark = pytest.mark.integration

REPORTE_PAYLOAD = {
    "id_tipo_incidente": 1,
    "id_severidad": 1,
    "descripcion": "test_historial: reporte de prueba",
    "latitud": 4.5,
    "longitud": -74.0,
}


def test_ciudadano_no_puede_ver_historial_global(client_ciudadano):
    res = client_ciudadano.get("/historial/")
    assert res.status_code == 403


def test_moderador_y_admin_ven_todo(client_moderador, client_admin):
    assert client_moderador.get("/historial/").status_code == 200
    assert client_admin.get("/historial/").status_code == 200


def test_entidad_solo_ve_historial_de_sus_propios_reportes(
    client_ciudadano, client_moderador, client_entidad
):
    # client_entidad = operador.acueducto@demo.com, id_entidad=1.
    id_reporte = client_ciudadano.post("/reportes/", json=REPORTE_PAYLOAD).json()["reporte"][
        "id_reporte"
    ]
    # Nace sin entidad -- moderador lo asigna a la entidad 1 y le cambia el
    # estado, generando una fila de historial real para verificar el scope.
    client_moderador.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 1})
    client_moderador.put(
        f"/reportes/{id_reporte}/estado",
        json={"id_estado_nuevo": 2, "comentario": "Visto por moderador"},
    )

    res = client_entidad.get("/historial/", params={"limite": 500})
    assert res.status_code == 200
    ids_reporte = {h["id_reporte"] for h in res.json()}
    assert id_reporte in ids_reporte

    # Ningún registro devuelto pertenece a un reporte de otra entidad --
    # verificado consultando cada id_reporte único contra /reportes/{id}.
    for id_rep in ids_reporte:
        detalle = client_entidad.get(f"/reportes/{id_rep}")
        assert detalle.status_code == 200
        assert detalle.json()["id_entidad"] == 1


def test_entidad_sin_id_entidad_asignado_da_403(client_anon):
    # No hay un usuario ENTIDAD sin id_entidad en la semilla para probar
    # esto end-to-end vía login real -- se cubre a nivel de política en
    # test_policies.py (scope_reportes). Este test solo confirma que la
    # ruta sigue exigiendo un rol permitido para cualquiera sin token.
    res = client_anon.get("/historial/")
    assert res.status_code == 401
