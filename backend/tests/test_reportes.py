"""tests/test_reportes.py"""

import pytest

pytestmark = pytest.mark.integration

REPORTE_PAYLOAD = {
    "id_tipo_incidente": 1,
    "id_severidad": 1,
    "descripcion": "test_reportes: reporte de prueba",
    "latitud": 4.5,
    "longitud": -74.0,
}


def test_ciclo_de_vida_completo(client_ciudadano, client_moderador):
    # 1. Crear
    res_crear = client_ciudadano.post("/reportes/", json=REPORTE_PAYLOAD)
    assert res_crear.status_code == 201
    id_reporte = res_crear.json()["reporte"]["id_reporte"]
    assert res_crear.json()["reporte"]["estado"] == "PENDIENTE"

    # 2. Aparece en el listado del dueño
    res_listar = client_ciudadano.get("/reportes/")
    assert res_listar.status_code == 200
    assert any(r["id_reporte"] == id_reporte for r in res_listar.json())

    # 3. El moderador cambia el estado
    res_cambiar = client_moderador.put(
        f"/reportes/{id_reporte}/estado",
        json={"id_estado_nuevo": 2, "comentario": "Validado por moderador"},
    )
    assert res_cambiar.status_code == 200
    assert res_cambiar.json()["reporte"]["estado"] == "EN_REVISION"

    # 4. El dueño recibe una notificación del cambio
    res_notis = client_ciudadano.get("/notificaciones/")
    assert res_notis.status_code == 200
    mensajes = [n["mensaje"] for n in res_notis.json() if n["id_reporte"] == id_reporte]
    assert any("EN_REVISION" in m for m in mensajes)

    # 5. El historial muestra ambos eventos (creación + cambio de estado)
    res_hist = client_ciudadano.get(f"/reportes/{id_reporte}/historial")
    assert res_hist.status_code == 200
    eventos = res_hist.json()
    assert len(eventos) == 2
    assert eventos[0]["estado_nuevo"] == "PENDIENTE"  # orden cronológico ASC
    assert eventos[1]["estado_nuevo"] == "EN_REVISION"
    assert eventos[1]["comentario"] == "Validado por moderador"


def test_crear_con_tipo_incidente_inexistente_da_400_sin_nombres_de_tabla_o_columna(
    client_ciudadano,
):
    payload = {**REPORTE_PAYLOAD, "id_tipo_incidente": 999999}
    res = client_ciudadano.post("/reportes/", json=payload)
    assert res.status_code == 400

    detalle = res.json()["detail"].lower()
    for fragmento_prohibido in (
        "tipo_incidente",
        "fk_reportes_tipo",
        "constraint",
        "reportes`",
        "id_tipo_incidente`",
    ):
        assert fragmento_prohibido not in detalle, (
            f"el mensaje de error no debe exponer detalles de esquema: {res.json()}"
        )


def test_ciudadano_no_puede_crear_reporte_a_nombre_de_otro(client_ciudadano):
    # client_ciudadano = juan@test.com, id_usuario=1 — intenta enviar id_usuario=4.
    payload = {**REPORTE_PAYLOAD, "id_usuario": 4}
    res = client_ciudadano.post("/reportes/", json=payload)
    assert res.status_code == 403


def test_paginacion_limite_y_offset(client_moderador):
    res_pagina1 = client_moderador.get("/reportes/", params={"limite": 2, "offset": 0})
    assert res_pagina1.status_code == 200
    pagina1 = res_pagina1.json()
    assert len(pagina1) <= 2

    res_pagina2 = client_moderador.get("/reportes/", params={"limite": 2, "offset": 2})
    assert res_pagina2.status_code == 200
    pagina2 = res_pagina2.json()

    ids_pagina1 = {r["id_reporte"] for r in pagina1}
    ids_pagina2 = {r["id_reporte"] for r in pagina2}
    assert ids_pagina1.isdisjoint(ids_pagina2), "offset no debe repetir filas de la página anterior"


def test_asignar_entidad_moderador_puede_reasignar(client_ciudadano, client_moderador):
    # Reporte de un ciudadano nace con id_entidad NULL (nadie lo ve todavía).
    res_crear = client_ciudadano.post("/reportes/", json=REPORTE_PAYLOAD)
    id_reporte = res_crear.json()["reporte"]["id_reporte"]
    assert res_crear.json()["reporte"]["id_entidad"] is None

    res = client_moderador.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 1})
    assert res.status_code == 200
    reporte = res.json()["reporte"]
    assert reporte["id_entidad"] == 1
    # La sugerencia por tipo_incidente sigue viniendo aparte -- reasignar no
    # la borra, es información de apoyo, no el resultado de la asignación.
    assert "entidad_sugerida" in reporte


def test_asignar_entidad_reporte_trae_sugerencia_por_tipo_incidente(client_ciudadano):
    # REPORTE_PAYLOAD usa id_tipo_incidente=1, sembrado en
    # tipo_incidente_entidad -> id_entidad=1 (ver geovisor_backup_limpio.sql).
    res = client_ciudadano.post("/reportes/", json=REPORTE_PAYLOAD)
    reporte = res.json()["reporte"]
    assert reporte["id_entidad_sugerida"] == 1
    assert reporte["entidad_sugerida"] == "Empresa de Acueducto Municipal"


def test_asignar_entidad_con_entidad_inexistente_da_404(client_moderador, client_ciudadano):
    id_reporte = client_ciudadano.post("/reportes/", json=REPORTE_PAYLOAD).json()["reporte"][
        "id_reporte"
    ]
    res = client_moderador.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 999999})
    assert res.status_code == 404


def test_asignar_entidad_con_reporte_inexistente_da_404(client_moderador):
    res = client_moderador.put("/reportes/999999/entidad", json={"id_entidad": 1})
    assert res.status_code == 404


def test_asignar_entidad_ciudadano_y_entidad_no_pueden(
    client_ciudadano, client_entidad
):
    id_reporte = client_ciudadano.post("/reportes/", json=REPORTE_PAYLOAD).json()["reporte"][
        "id_reporte"
    ]

    res_ciudadano = client_ciudadano.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 1})
    assert res_ciudadano.status_code == 403

    res_entidad = client_entidad.put(f"/reportes/{id_reporte}/entidad", json={"id_entidad": 1})
    assert res_entidad.status_code == 403


def test_orden_de_rutas_mapa_y_estadisticas_no_caen_en_id_reporte(client_moderador):
    """
    Guardia de regresión para el comentario de orden de rutas en
    reportes.py: /mapa y /estadisticas deben resolver a sus propios
    handlers, nunca a /{id_reporte} (que intentaría parsear "mapa" como int
    y daría 422, o simplemente devolvería la forma equivocada).
    """
    res_mapa = client_moderador.get("/reportes/mapa")
    assert res_mapa.status_code == 200
    assert isinstance(res_mapa.json(), list)
    if res_mapa.json():
        assert "id_reporte" in res_mapa.json()[0]
        assert "usuario" not in res_mapa.json()[0]  # forma de /mapa, no de /{id}

    res_stats = client_moderador.get("/reportes/estadisticas")
    assert res_stats.status_code == 200
    assert "total_reportes" in res_stats.json()
