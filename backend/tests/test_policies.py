"""
Tests unitarios de app.core.policies — sin base de datos ni TestClient.
Las funciones de política son Python puro (dicts adentro, dicts afuera),
así que se llaman directamente con fixtures.
"""

import pytest
from fastapi import HTTPException

from app.core.policies import (
    puede_cambiar_estado,
    puede_ver_detalle_comunitario,
    puede_ver_reporte,
    scope_reportes,
    scope_reportes_mapa,
)
from app.core.roles import Rol

CIUDADANO = {"id_rol": Rol.CIUDADANO, "id_usuario": 10}
OTRO_CIUDADANO = {"id_rol": Rol.CIUDADANO, "id_usuario": 99}
ENTIDAD = {"id_rol": Rol.ENTIDAD, "id_usuario": 20, "id_entidad": 5}
ENTIDAD_SIN_ASIGNAR = {"id_rol": Rol.ENTIDAD, "id_usuario": 21, "id_entidad": None}
OTRA_ENTIDAD = {"id_rol": Rol.ENTIDAD, "id_usuario": 22, "id_entidad": 6}
MODERADOR = {"id_rol": Rol.MODERADOR, "id_usuario": 30}
ADMIN = {"id_rol": Rol.ADMIN, "id_usuario": 40}
ROL_DESCONOCIDO = {"id_rol": 99, "id_usuario": 50}


# ── scope_reportes ──────────────────────────────────────────────────────


def test_scope_reportes_ciudadano_escoge_a_sus_propios_reportes():
    conditions, params = scope_reportes(CIUDADANO)
    assert conditions == ["r.id_usuario = %s"]
    assert params == [10]


def test_scope_reportes_entidad_escoge_a_su_propia_entidad():
    conditions, params = scope_reportes(ENTIDAD)
    assert conditions == ["r.id_entidad = %s"]
    assert params == [5]


def test_scope_reportes_entidad_sin_id_entidad_lanza_403():
    with pytest.raises(HTTPException) as exc:
        scope_reportes(ENTIDAD_SIN_ASIGNAR)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Usuario ENTIDAD sin id_entidad asignado"


@pytest.mark.parametrize("user", [MODERADOR, ADMIN])
def test_scope_reportes_moderador_y_admin_ven_todo(user):
    conditions, params = scope_reportes(user)
    assert conditions == []
    assert params == []


def test_scope_reportes_rol_desconocido_falla_cerrado():
    with pytest.raises(HTTPException) as exc:
        scope_reportes(ROL_DESCONOCIDO)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Rol desconocido"


def test_scope_reportes_honra_el_alias():
    conditions, _ = scope_reportes(CIUDADANO, alias="x")
    assert conditions == ["x.id_usuario = %s"]

    conditions, _ = scope_reportes(ENTIDAD, alias="rep")
    assert conditions == ["rep.id_entidad = %s"]


# ── scope_reportes_mapa ──────────────────────────────────────────────────
# Vista comunitaria del mapa: idéntica a scope_reportes() salvo CIUDADANO,
# que aquí no se restringe a sus propios reportes.


def test_scope_reportes_mapa_ciudadano_ve_todo_sin_restriccion():
    conditions, params = scope_reportes_mapa(CIUDADANO)
    assert conditions == []
    assert params == []


def test_scope_reportes_mapa_entidad_escoge_a_su_propia_entidad():
    conditions, params = scope_reportes_mapa(ENTIDAD)
    assert conditions == ["r.id_entidad = %s"]
    assert params == [5]


def test_scope_reportes_mapa_entidad_sin_id_entidad_lanza_403():
    with pytest.raises(HTTPException) as exc:
        scope_reportes_mapa(ENTIDAD_SIN_ASIGNAR)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Usuario ENTIDAD sin id_entidad asignado"


@pytest.mark.parametrize("user", [MODERADOR, ADMIN])
def test_scope_reportes_mapa_moderador_y_admin_ven_todo(user):
    conditions, params = scope_reportes_mapa(user)
    assert conditions == []
    assert params == []


def test_scope_reportes_mapa_rol_desconocido_falla_cerrado():
    with pytest.raises(HTTPException) as exc:
        scope_reportes_mapa(ROL_DESCONOCIDO)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Rol desconocido"


def test_scope_reportes_mapa_honra_el_alias():
    conditions, _ = scope_reportes_mapa(ENTIDAD, alias="rep")
    assert conditions == ["rep.id_entidad = %s"]


# ── puede_ver_reporte ───────────────────────────────────────────────────


def test_puede_ver_reporte_ciudadano_ve_su_propio_reporte():
    reporte = {"id_usuario": 10, "id_entidad": None}
    assert puede_ver_reporte(CIUDADANO, reporte) is True


def test_puede_ver_reporte_ciudadano_no_ve_reporte_de_otro():
    reporte = {"id_usuario": 999, "id_entidad": None}
    assert puede_ver_reporte(OTRO_CIUDADANO, reporte) is False
    assert puede_ver_reporte(CIUDADANO, reporte) is False


def test_puede_ver_reporte_entidad_ve_reporte_de_su_entidad():
    reporte = {"id_usuario": 1, "id_entidad": 5}
    assert puede_ver_reporte(ENTIDAD, reporte) is True


def test_puede_ver_reporte_entidad_no_ve_reporte_de_otra_entidad():
    reporte = {"id_usuario": 1, "id_entidad": 5}
    assert puede_ver_reporte(OTRA_ENTIDAD, reporte) is False


def test_puede_ver_reporte_entidad_sin_id_entidad_no_ve_nada():
    reporte = {"id_usuario": 1, "id_entidad": None}
    assert puede_ver_reporte(ENTIDAD_SIN_ASIGNAR, reporte) is False


@pytest.mark.parametrize("user", [MODERADOR, ADMIN])
def test_puede_ver_reporte_moderador_y_admin_ven_cualquier_reporte(user):
    reporte = {"id_usuario": 1, "id_entidad": 5}
    assert puede_ver_reporte(user, reporte) is True


def test_puede_ver_reporte_rol_desconocido_falla_cerrado():
    reporte = {"id_usuario": 1, "id_entidad": 5}
    assert puede_ver_reporte(ROL_DESCONOCIDO, reporte) is False


# ── puede_ver_detalle_comunitario ───────────────────────────────────────
# Vista comunitaria del detalle/historial de un reporte: solo CIUDADANO la
# tiene. Complementa a puede_ver_reporte() cuando esta da False.


def test_puede_ver_detalle_comunitario_ciudadano_true():
    assert puede_ver_detalle_comunitario(CIUDADANO) is True
    assert puede_ver_detalle_comunitario(OTRO_CIUDADANO) is True


@pytest.mark.parametrize(
    "user", [ENTIDAD, ENTIDAD_SIN_ASIGNAR, OTRA_ENTIDAD, MODERADOR, ADMIN, ROL_DESCONOCIDO]
)
def test_puede_ver_detalle_comunitario_otros_roles_false(user):
    assert puede_ver_detalle_comunitario(user) is False


# ── puede_cambiar_estado ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "reporte",
    [
        {"id_usuario": 10, "id_entidad": None},  # su propio reporte
        {"id_usuario": 999, "id_entidad": None},  # reporte de otro
        {"id_usuario": 1, "id_entidad": 5},  # reporte de una entidad
    ],
)
def test_puede_cambiar_estado_ciudadano_nunca(reporte):
    assert puede_cambiar_estado(CIUDADANO, reporte) is False


def test_puede_cambiar_estado_entidad_solo_los_de_su_entidad():
    reporte_propio = {"id_usuario": 1, "id_entidad": 5}
    reporte_ajeno = {"id_usuario": 1, "id_entidad": 6}
    assert puede_cambiar_estado(ENTIDAD, reporte_propio) is True
    assert puede_cambiar_estado(ENTIDAD, reporte_ajeno) is False


def test_puede_cambiar_estado_entidad_sin_id_entidad_nunca():
    reporte = {"id_usuario": 1, "id_entidad": None}
    assert puede_cambiar_estado(ENTIDAD_SIN_ASIGNAR, reporte) is False


@pytest.mark.parametrize("user", [MODERADOR, ADMIN])
def test_puede_cambiar_estado_moderador_y_admin_siempre(user):
    reporte = {"id_usuario": 1, "id_entidad": 5}
    assert puede_cambiar_estado(user, reporte) is True


def test_puede_cambiar_estado_rol_desconocido_falla_cerrado():
    reporte = {"id_usuario": 1, "id_entidad": 5}
    assert puede_cambiar_estado(ROL_DESCONOCIDO, reporte) is False
