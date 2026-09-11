"""Modelos de respuesta para app/routers/siasar.py.

Capa de solo lectura: no hay modelos de request (ver constraint 2 — SIASAR
entra únicamente por scripts/importar_siasar.py, nunca por la API).
"""

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class Calificacion(StrEnum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class Cloracion(StrEnum):
    FUNCIONA = "FUNCIONA"
    NO_FUNCIONA = "NO_FUNCIONA"
    NO_SE_REALIZA = "NO_SE_REALIZA"
    SIN_DATO = "SIN_DATO"


class PruebaLaboratorio(StrEnum):
    PASA = "PASA"
    NO_PASA = "NO_PASA"
    SIN_PRUEBA = "SIN_PRUEBA"


class MunicipioSiasar(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    municipio: str
    comunidades: int
    sistemas: int


class ComunidadMapa(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    latitud: float
    longitud: float
    calificacion: Calificacion | None


class SistemaMapa(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    latitud: float
    longitud: float
    cloracion: Cloracion
    prueba_coliformes: PruebaLaboratorio


class SistemaResumen(BaseModel):
    """Sistema tal como aparece dentro de ComunidadDetalle.sistemas."""

    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    cloracion: Cloracion
    prueba_coliformes: PruebaLaboratorio
    prueba_fisicoquimica: PruebaLaboratorio
    horas_servicio: float | None
    fecha_encuesta: date


class ComunidadResumen(BaseModel):
    """Comunidad tal como aparece dentro de SistemaDetalle.comunidades."""

    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    calificacion: Calificacion | None


class ComunidadDetalle(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    municipio: str
    localidad: str | None
    latitud: float
    longitud: float
    poblacion: int | None
    viviendas: int | None
    poblacion_atipica: bool
    cobertura_agua: float | None
    cobertura_saneamiento: float | None
    n_escuelas: int | None
    sistemas_texto: str | None
    prestador: str | None
    calificacion: Calificacion | None
    fecha_encuesta: date
    fecha_importacion: datetime
    sistemas: list[SistemaResumen]
    fuente: str


class SistemaDetalle(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    municipio: str
    localidad: str | None
    latitud: float
    longitud: float
    comunidades_texto: str | None
    prestador: str | None
    poblacion_servida: int | None
    viviendas_servidas: int | None
    poblacion_atipica: bool
    horas_servicio: float | None
    cloracion: Cloracion
    prueba_coliformes: PruebaLaboratorio
    prueba_fisicoquimica: PruebaLaboratorio
    fecha_encuesta: date
    fecha_importacion: datetime
    comunidades: list[ComunidadResumen]
    fuente: str


class CercanaResponse(BaseModel):
    comunidad: ComunidadDetalle | None
    distancia_m: int | None


class ResumenMunicipio(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    municipio: str
    comunidades: int
    comunidades_d: int
    sistemas: int
    sistemas_sin_cloracion: int
    sistemas_no_pasa_coliformes: int
    sistemas_sin_prueba_coliformes: int
    reportes_total: int
    reportes_abiertos: int
    fecha_encuesta_min: date
    fecha_encuesta_max: date


# Reporte.vereda_siasar (Fase 4) — vive acá porque describe el mismo tipo de
# dato SIASAR que el resto de este módulo, aunque lo consuma
# schemas/reportes.py.
class VeredaSiasarResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_siasar: int
    nombre: str
    localidad: str | None
    municipio: str
    calificacion: Calificacion | None
    distancia_m: int
    fecha_encuesta: date
