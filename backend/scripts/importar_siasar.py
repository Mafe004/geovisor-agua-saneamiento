"""
Importa el diagnóstico oficial SIASAR (Cundinamarca) desde
community_main.csv / system_main.csv a las tablas siasar_comunidad /
siasar_sistema / siasar_comunidad_sistema, enlaza comunidad<->sistema por
nombre, y rellena reportes.id_siasar_comunidad / distancia_siasar_m para
los reportes que todavía no tienen vínculo.

Uso (desde backend/, con el venv activado):
    python -m scripts.importar_siasar --dir data/siasar
    python -m scripts.importar_siasar --dir data/siasar --dry-run
    python -m scripts.importar_siasar --dir data/siasar --allow-shrink

Corre siempre dentro de UNA transacción (ver app.db.database.transaccion):
si cualquier paso falla, nada se escribe. --dry-run no abre esa transacción
en absoluto -- solo parsea, valida y calcula enlaces contra los CSV, más una
lectura de solo lectura para el resumen de insertar/actualizar/eliminar y
la guarda de "shrink".
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

from app.core.audit import Accion, Modulo, registrar_auditoria
from app.db.database import get_connection, transaccion
from app.services.siasar import buscar_comunidad_cercana

FUENTE_ATRIBUCION = "SIASAR – Ministerio de Vivienda, Ciudad y Territorio"

LAT_MIN, LAT_MAX = Decimal("3.5"), Decimal("6.2")
LON_MIN, LON_MAX = Decimal("-75.0"), Decimal("-72.8")

COMUNIDAD_COLUMNAS_REQUERIDAS = [
    "ID", "nombre", "departamento", "municipio", "localidad",
    "latitud", "longitud", "poblacion", "viviendas",
    "cobertura_agua", "cobertura_san", "n_escuelas", "sistemas", "PSE",
    "ias_abcd", "fecha_encuesta",
]
SISTEMA_COLUMNAS_REQUERIDAS = [
    "ID", "nombre", "departamento", "municipio", "localidad",
    "latitud", "longitud", "comunidades", "PSE", "pob_servida",
    "viv_servidas", "dist_horas", "cloro", "pasa_coliformes",
    "pasa_fisicoquimico", "fecha_encuesta",
]

class ImportadorError(Exception):
    """Columna requerida faltante u otro error que impide leer el CSV."""


class ImportAbortado(Exception):
    """La guarda de encogimiento (shrink guard) frenó la importación."""


# ── Normalización (únicas transformaciones permitidas, ver sección 5.2) ──


def _norm_texto(v: str | None) -> str | None:
    """Strip, colapsa espacios internos a uno solo, vacío -> None. Conserva
    tildes y mayúsculas/minúsculas tal como vienen publicadas."""
    if v is None:
        return None
    v = re.sub(r"\s+", " ", v.strip())
    return v or None


def _trunc(v: str | None, n: int) -> str | None:
    return v[:n] if v else v


def _clave(s: str | None) -> str:
    """Clave de comparación para nombres/municipios/departamento: NFKD, sin
    marcas combinantes, mayúsculas, sin espacios/puntos/comillas. Nunca se
    usa para lo que se guarda en la base -- solo para decidir si dos
    textos "son el mismo" al filtrar departamento o enlazar comunidad con
    sistema."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.upper()
    return re.sub(r"[\s.'\"]", "", s)


def _clave_categorica(v: str | None) -> str:
    """Clave de comparación para valores categóricos: NFC, strip, casefold
    -- normalización Unicode distinta a `_clave()` a propósito (la pide el
    punto 5.2 "Valores categóricos" del spec, separado de la de nombres)."""
    if v is None:
        return ""
    return unicodedata.normalize("NFC", v).strip().casefold()


CLORO_MAP = {_clave_categorica(k): v for k, v in {
    "Sí, y funciona": "FUNCIONA",
    "Sí, pero no funciona": "NO_FUNCIONA",
    "No se realiza": "NO_SE_REALIZA",
}.items()}
PRUEBA_MAP = {_clave_categorica(k): v for k, v in {
    "Sí pasa": "PASA",
    "No pasa": "NO_PASA",
    "No aplica": "SIN_PRUEBA",
}.items()}


def _mapear_cloro(raw: str | None, otros: dict[str, int]) -> str:
    if raw is None or not raw.strip():
        return "SIN_DATO"
    valor = CLORO_MAP.get(_clave_categorica(raw))
    if valor:
        return valor
    otros[raw] = otros.get(raw, 0) + 1
    return "SIN_DATO"


def _mapear_prueba(raw: str | None, otros: dict[str, int]) -> str:
    if raw is None or not raw.strip():
        return "SIN_PRUEBA"
    valor = PRUEBA_MAP.get(_clave_categorica(raw))
    if valor:
        return valor
    otros[raw] = otros.get(raw, 0) + 1
    return "SIN_PRUEBA"


def _mapear_calificacion(raw: str | None) -> str | None:
    if raw is None:
        return None
    key = unicodedata.normalize("NFC", raw).strip().upper()
    return key if key in ("A", "B", "C", "D") else None


def _parse_decimal(raw: str | None) -> Decimal | None:
    if raw is None or not raw.strip():
        return None
    try:
        return Decimal(raw.strip())
    except InvalidOperation:
        return None


def _redondear_entero(d: Decimal | None) -> int | None:
    if d is None:
        return None
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _redondear_4dec(d: Decimal | None) -> Decimal | None:
    if d is None:
        return None
    return d.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _redondear_1dec(d: Decimal | None) -> Decimal | None:
    if d is None:
        return None
    return d.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _parse_coordenada(raw: str | None, minimo: Decimal, maximo: Decimal) -> Decimal | None:
    d = _parse_decimal(raw)
    if d is None or not (minimo <= d <= maximo):
        return None
    return d


def _parse_fecha(raw: str | None) -> date | None:
    if raw is None or not raw.strip():
        return None
    try:
        return datetime.strptime(raw.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _es_cundinamarca(raw: str | None) -> bool:
    return _clave(raw) == _clave("CUNDINAMARCA")


# ── Filas parseadas ──────────────────────────────────────────────────


@dataclass
class FilaComunidad:
    id_siasar: int
    nombre: str
    municipio: str
    localidad: str | None
    latitud: Decimal
    longitud: Decimal
    poblacion: int | None
    viviendas: int | None
    poblacion_atipica: bool
    cobertura_agua: Decimal | None
    cobertura_saneamiento: Decimal | None
    n_escuelas: int | None
    sistemas_texto: str | None
    prestador: str | None
    calificacion: str | None
    fecha_encuesta: date


@dataclass
class FilaSistema:
    id_siasar: int
    nombre: str
    municipio: str
    localidad: str | None
    latitud: Decimal
    longitud: Decimal
    comunidades_texto: str | None
    prestador: str | None
    poblacion_servida: int | None
    viviendas_servidas: int | None
    poblacion_atipica: bool
    horas_servicio: Decimal | None
    cloracion: str
    prueba_coliformes: str
    prueba_fisicoquimico: str
    fecha_encuesta: date


@dataclass
class ReporteImportacion:
    dry_run: bool
    abortado: str | None = None

    comunidades_leidas: int = 0
    comunidades_descartadas: dict[str, int] = field(default_factory=dict)
    comunidades_insertadas: int = 0
    comunidades_actualizadas: int = 0
    comunidades_eliminadas: int = 0
    comunidades_atipicas: int = 0

    sistemas_leidos: int = 0
    sistemas_descartados: dict[str, int] = field(default_factory=dict)
    sistemas_insertados: int = 0
    sistemas_actualizados: int = 0
    sistemas_eliminados: int = 0
    sistemas_atipicos: int = 0

    enlaces_creados: int = 0
    nombres_sin_enlazar: list[str] = field(default_factory=list)
    nombres_ambiguos: list[str] = field(default_factory=list)

    otros_valores_cloro: dict[str, int] = field(default_factory=dict)
    otros_valores_coliformes: dict[str, int] = field(default_factory=dict)
    otros_valores_fisicoquimico: dict[str, int] = field(default_factory=dict)

    reportes_backfill: int | None = 0  # None cuando --dry-run no lo calculó

    def imprimir(self) -> None:
        print("=" * 70)
        print(f"Importación SIASAR{'  [DRY-RUN, nada se escribió]' if self.dry_run else ''}")
        print("=" * 70)
        if self.abortado:
            print(f"ABORTADA: {self.abortado}")
            return
        print(f"Comunidades leídas: {self.comunidades_leidas}")
        for motivo, n in self.comunidades_descartadas.items():
            print(f"  descartadas ({motivo}): {n}")
        print(f"  insertadas: {self.comunidades_insertadas}  actualizadas: "
              f"{self.comunidades_actualizadas}  eliminadas: {self.comunidades_eliminadas}"
              f"  atípicas: {self.comunidades_atipicas}")
        print(f"Sistemas leídos: {self.sistemas_leidos}")
        for motivo, n in self.sistemas_descartados.items():
            print(f"  descartados ({motivo}): {n}")
        print(f"  insertados: {self.sistemas_insertados}  actualizados: "
              f"{self.sistemas_actualizados}  eliminados: {self.sistemas_eliminados}"
              f"  atípicos: {self.sistemas_atipicos}")
        print(f"Enlaces comunidad<->sistema creados: {self.enlaces_creados}")
        print(f"  nombres sin enlazar: {len(self.nombres_sin_enlazar)}")
        print(f"  nombres ambiguos: {len(self.nombres_ambiguos)}")
        for campo, otros in (
            ("cloro", self.otros_valores_cloro),
            ("pasa_coliformes", self.otros_valores_coliformes),
            ("pasa_fisicoquimico", self.otros_valores_fisicoquimico),
        ):
            if otros:
                print(f"  valores no reconocidos en {campo}: {otros}")
        if self.reportes_backfill is None:
            print("Reportes vinculados de vuelta (backfill): omitido en --dry-run")
        else:
            print(f"Reportes vinculados de vuelta (backfill): {self.reportes_backfill}")


# ── Parseo de archivos ───────────────────────────────────────────────


def _verificar_columnas(path: Path, requeridas: list[str]) -> None:
    with path.open(encoding="utf-8-sig", newline="") as f:
        header = next(csv.reader(f), [])
    faltantes = [c for c in requeridas if c not in header]
    if faltantes:
        raise ImportadorError(
            f"{path.name}: faltan columnas requeridas: {', '.join(faltantes)}"
        )


def _parsear_comunidades(
    path: Path, reporte: ReporteImportacion
) -> list[FilaComunidad]:
    _verificar_columnas(path, COMUNIDAD_COLUMNAS_REQUERIDAS)
    descartes: Counter[str] = Counter()
    filas: list[FilaComunidad] = []

    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            reporte.comunidades_leidas += 1

            if not _es_cundinamarca(row.get("departamento")):
                descartes["departamento_distinto_de_cundinamarca"] += 1
                continue

            id_raw = (row.get("ID") or "").strip()
            if not id_raw.lstrip("-").isdigit():
                descartes["id_invalido"] += 1
                continue
            id_siasar = int(id_raw)

            nombre = _norm_texto(row.get("nombre"))
            municipio = _norm_texto(row.get("municipio"))
            if not nombre or not municipio:
                descartes["nombre_o_municipio_vacio"] += 1
                continue

            lat = _parse_coordenada(row.get("latitud"), LAT_MIN, LAT_MAX)
            lon = _parse_coordenada(row.get("longitud"), LON_MIN, LON_MAX)
            if lat is None or lon is None:
                descartes["coordenadas_invalidas"] += 1
                continue

            fecha = _parse_fecha(row.get("fecha_encuesta"))
            if fecha is None:
                descartes["fecha_invalida"] += 1
                continue

            poblacion = _redondear_entero(_parse_decimal(row.get("poblacion")))
            viviendas = _redondear_entero(_parse_decimal(row.get("viviendas")))
            atipica = bool(viviendas and poblacion and viviendas > 0 and poblacion > viviendas * 15)
            if atipica:
                reporte.comunidades_atipicas += 1

            filas.append(FilaComunidad(
                id_siasar=id_siasar,
                nombre=_trunc(nombre, 120),
                municipio=_trunc(municipio, 60),
                localidad=_trunc(_norm_texto(row.get("localidad")), 120),
                latitud=lat,
                longitud=lon,
                poblacion=poblacion,
                viviendas=viviendas,
                poblacion_atipica=atipica,
                cobertura_agua=_redondear_4dec(_parse_decimal(row.get("cobertura_agua"))),
                cobertura_saneamiento=_redondear_4dec(_parse_decimal(row.get("cobertura_san"))),
                n_escuelas=_redondear_entero(_parse_decimal(row.get("n_escuelas"))),
                sistemas_texto=_trunc(_norm_texto(row.get("sistemas")), 400),
                prestador=_trunc(_norm_texto(row.get("PSE")), 400),
                calificacion=_mapear_calificacion(row.get("ias_abcd")),
                fecha_encuesta=fecha,
            ))

    reporte.comunidades_descartadas = dict(descartes)
    return filas


def _parsear_sistemas(path: Path, reporte: ReporteImportacion) -> list[FilaSistema]:
    _verificar_columnas(path, SISTEMA_COLUMNAS_REQUERIDAS)
    descartes: Counter[str] = Counter()
    filas: list[FilaSistema] = []

    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            reporte.sistemas_leidos += 1

            if not _es_cundinamarca(row.get("departamento")):
                descartes["departamento_distinto_de_cundinamarca"] += 1
                continue

            id_raw = (row.get("ID") or "").strip()
            if not id_raw.lstrip("-").isdigit():
                descartes["id_invalido"] += 1
                continue
            id_siasar = int(id_raw)

            nombre = _norm_texto(row.get("nombre"))
            municipio = _norm_texto(row.get("municipio"))
            if not nombre or not municipio:
                descartes["nombre_o_municipio_vacio"] += 1
                continue

            lat = _parse_coordenada(row.get("latitud"), LAT_MIN, LAT_MAX)
            lon = _parse_coordenada(row.get("longitud"), LON_MIN, LON_MAX)
            if lat is None or lon is None:
                descartes["coordenadas_invalidas"] += 1
                continue

            fecha = _parse_fecha(row.get("fecha_encuesta"))
            if fecha is None:
                descartes["fecha_invalida"] += 1
                continue

            pob_servida = _redondear_entero(_parse_decimal(row.get("pob_servida")))
            viv_servidas = _redondear_entero(_parse_decimal(row.get("viv_servidas")))
            atipica = bool(
                viv_servidas and pob_servida and viv_servidas > 0
                and pob_servida > viv_servidas * 15
            )
            if atipica:
                reporte.sistemas_atipicos += 1

            filas.append(FilaSistema(
                id_siasar=id_siasar,
                nombre=_trunc(nombre, 200),
                municipio=_trunc(municipio, 60),
                localidad=_trunc(_norm_texto(row.get("localidad")), 120),
                latitud=lat,
                longitud=lon,
                comunidades_texto=_trunc(_norm_texto(row.get("comunidades")), 800),
                prestador=_trunc(_norm_texto(row.get("PSE")), 250),
                poblacion_servida=pob_servida,
                viviendas_servidas=viv_servidas,
                poblacion_atipica=atipica,
                horas_servicio=_redondear_1dec(_parse_decimal(row.get("dist_horas"))),
                cloracion=_mapear_cloro(row.get("cloro"), reporte.otros_valores_cloro),
                prueba_coliformes=_mapear_prueba(row.get("pasa_coliformes"), reporte.otros_valores_coliformes),
                prueba_fisicoquimico=_mapear_prueba(row.get("pasa_fisicoquimico"), reporte.otros_valores_fisicoquimico),
                fecha_encuesta=fecha,
            ))

    reporte.sistemas_descartados = dict(descartes)
    return filas


# ── Enlace comunidad <-> sistema por nombre ──────────────────────────


@dataclass
class Enlaces:
    pares: list[tuple[int, int]]  # (id_siasar_comunidad, id_siasar_sistema)
    sin_enlazar: list[str]
    ambiguos: list[str]


def _vincular(
    comunidades: list[FilaComunidad], sistemas: list[FilaSistema]
) -> Enlaces:
    # (clave_municipio, clave_nombre) -> [id_siasar, ...]
    indice: dict[tuple[str, str], list[int]] = {}
    for s in sistemas:
        clave = (_clave(s.municipio), _clave(s.nombre))
        indice.setdefault(clave, []).append(s.id_siasar)

    pares: list[tuple[int, int]] = []
    sin_enlazar: list[str] = []
    ambiguos: list[str] = []

    for c in comunidades:
        if not c.sistemas_texto:
            continue
        municipio_clave = _clave(c.municipio)

        # 1) el texto completo como un solo nombre
        candidatos = indice.get((municipio_clave, _clave(c.sistemas_texto)), [])
        if len(candidatos) == 1:
            pares.append((c.id_siasar, candidatos[0]))
            continue
        if len(candidatos) > 1:
            ambiguos.append(c.sistemas_texto)
            continue

        # 2) partir por coma y probar cada parte
        for parte in (p.strip() for p in c.sistemas_texto.split(",")):
            if not parte:
                continue
            candidatos = indice.get((municipio_clave, _clave(parte)), [])
            if len(candidatos) == 1:
                pares.append((c.id_siasar, candidatos[0]))
            elif len(candidatos) == 0:
                sin_enlazar.append(parte)
            else:
                ambiguos.append(parte)

    return Enlaces(pares=pares, sin_enlazar=sin_enlazar, ambiguos=ambiguos)


# ── SQL ──────────────────────────────────────────────────────────────

_UPSERT_COMUNIDAD_SQL = """
INSERT INTO siasar_comunidad (
    id_siasar, nombre, municipio, localidad, latitud, longitud,
    poblacion, viviendas, poblacion_atipica, cobertura_agua,
    cobertura_saneamiento, n_escuelas, sistemas_texto, prestador,
    calificacion, fecha_encuesta, fecha_importacion
) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON DUPLICATE KEY UPDATE
    nombre=VALUES(nombre), municipio=VALUES(municipio), localidad=VALUES(localidad),
    latitud=VALUES(latitud), longitud=VALUES(longitud), poblacion=VALUES(poblacion),
    viviendas=VALUES(viviendas), poblacion_atipica=VALUES(poblacion_atipica),
    cobertura_agua=VALUES(cobertura_agua), cobertura_saneamiento=VALUES(cobertura_saneamiento),
    n_escuelas=VALUES(n_escuelas), sistemas_texto=VALUES(sistemas_texto),
    prestador=VALUES(prestador), calificacion=VALUES(calificacion),
    fecha_encuesta=VALUES(fecha_encuesta), fecha_importacion=VALUES(fecha_importacion);
"""

_UPSERT_SISTEMA_SQL = """
INSERT INTO siasar_sistema (
    id_siasar, nombre, municipio, localidad, latitud, longitud,
    comunidades_texto, prestador, poblacion_servida, viviendas_servidas,
    poblacion_atipica, horas_servicio, cloracion, prueba_coliformes,
    prueba_fisicoquimica, fecha_encuesta, fecha_importacion
) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON DUPLICATE KEY UPDATE
    nombre=VALUES(nombre), municipio=VALUES(municipio), localidad=VALUES(localidad),
    latitud=VALUES(latitud), longitud=VALUES(longitud),
    comunidades_texto=VALUES(comunidades_texto), prestador=VALUES(prestador),
    poblacion_servida=VALUES(poblacion_servida), viviendas_servidas=VALUES(viviendas_servidas),
    poblacion_atipica=VALUES(poblacion_atipica), horas_servicio=VALUES(horas_servicio),
    cloracion=VALUES(cloracion), prueba_coliformes=VALUES(prueba_coliformes),
    prueba_fisicoquimica=VALUES(prueba_fisicoquimica), fecha_encuesta=VALUES(fecha_encuesta),
    fecha_importacion=VALUES(fecha_importacion);
"""


# ── Orquestación ─────────────────────────────────────────────────────


def ejecutar_importacion(
    directorio: Path, *, dry_run: bool = False, allow_shrink: bool = False
) -> ReporteImportacion:
    comunidad_path = directorio / "community_main.csv"
    sistema_path = directorio / "system_main.csv"
    for p in (comunidad_path, sistema_path):
        if not p.exists():
            raise ImportadorError(
                f"Falta {p.name} en {directorio} -- copia los archivos desde "
                "SIASAR_Cundinamarca_CSV.zip a backend/data/siasar/."
            )

    reporte = ReporteImportacion(dry_run=dry_run)
    comunidades = _parsear_comunidades(comunidad_path, reporte)
    sistemas = _parsear_sistemas(sistema_path, reporte)
    enlaces = _vincular(comunidades, sistemas)
    reporte.nombres_sin_enlazar = enlaces.sin_enlazar
    reporte.nombres_ambiguos = enlaces.ambiguos

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_siasar FROM siasar_comunidad;")
            ids_comunidad_actuales = {r["id_siasar"] for r in cur.fetchall()}
            cur.execute("SELECT id_siasar FROM siasar_sistema;")
            ids_sistema_actuales = {r["id_siasar"] for r in cur.fetchall()}
    finally:
        conn.close()

    ids_comunidad_nuevas = {c.id_siasar for c in comunidades}
    ids_sistema_nuevas = {s.id_siasar for s in sistemas}

    if not allow_shrink:
        for etiqueta, actuales, nuevas in (
            ("community_main.csv", ids_comunidad_actuales, ids_comunidad_nuevas),
            ("system_main.csv", ids_sistema_actuales, ids_sistema_nuevas),
        ):
            if actuales and len(nuevas) < len(actuales) * 0.5:
                mensaje = (
                    f"{etiqueta} trae {len(nuevas)} filas válidas, menos de la "
                    f"mitad de las {len(actuales)} que hay hoy en la base. "
                    "Aborta por seguridad -- pasa --allow-shrink si es intencional."
                )
                reporte.abortado = mensaje
                raise ImportAbortado(mensaje)

    reporte.comunidades_insertadas = len(ids_comunidad_nuevas - ids_comunidad_actuales)
    reporte.comunidades_actualizadas = len(ids_comunidad_nuevas & ids_comunidad_actuales)
    reporte.comunidades_eliminadas = len(ids_comunidad_actuales - ids_comunidad_nuevas)
    reporte.sistemas_insertados = len(ids_sistema_nuevas - ids_sistema_actuales)
    reporte.sistemas_actualizados = len(ids_sistema_nuevas & ids_sistema_actuales)
    reporte.sistemas_eliminados = len(ids_sistema_actuales - ids_sistema_nuevas)
    reporte.enlaces_creados = len(enlaces.pares)

    if dry_run:
        reporte.reportes_backfill = None
        return reporte

    fecha_importacion = datetime.now()

    with transaccion() as cursor:
        cursor.executemany(_UPSERT_COMUNIDAD_SQL, [
            (
                c.id_siasar, c.nombre, c.municipio, c.localidad, c.latitud, c.longitud,
                c.poblacion, c.viviendas, int(c.poblacion_atipica), c.cobertura_agua,
                c.cobertura_saneamiento, c.n_escuelas, c.sistemas_texto, c.prestador,
                c.calificacion, c.fecha_encuesta, fecha_importacion,
            )
            for c in comunidades
        ])
        cursor.executemany(_UPSERT_SISTEMA_SQL, [
            (
                s.id_siasar, s.nombre, s.municipio, s.localidad, s.latitud, s.longitud,
                s.comunidades_texto, s.prestador, s.poblacion_servida, s.viviendas_servidas,
                int(s.poblacion_atipica), s.horas_servicio, s.cloracion, s.prueba_coliformes,
                s.prueba_fisicoquimico, s.fecha_encuesta, fecha_importacion,
            )
            for s in sistemas
        ])

        # Reconstruir enlaces desde cero: más simple y correcto que hacer
        # diff, y ya corre dentro de la transacción de todo el import.
        cursor.execute("DELETE FROM siasar_comunidad_sistema;")
        if enlaces.pares:
            cursor.executemany(
                "INSERT INTO siasar_comunidad_sistema (id_siasar_comunidad, id_siasar_sistema) "
                "VALUES (%s, %s);",
                enlaces.pares,
            )

        eliminar_comunidad = ids_comunidad_actuales - ids_comunidad_nuevas
        if eliminar_comunidad:
            placeholders = ", ".join(["%s"] * len(eliminar_comunidad))
            cursor.execute(
                f"DELETE FROM siasar_comunidad WHERE id_siasar IN ({placeholders});",
                tuple(eliminar_comunidad),
            )
        eliminar_sistema = ids_sistema_actuales - ids_sistema_nuevas
        if eliminar_sistema:
            placeholders = ", ".join(["%s"] * len(eliminar_sistema))
            cursor.execute(
                f"DELETE FROM siasar_sistema WHERE id_siasar IN ({placeholders});",
                tuple(eliminar_sistema),
            )

        # ON DELETE SET NULL de fk_reportes_siasar solo limpia
        # id_siasar_comunidad -- distancia_siasar_m no es parte de esa FK,
        # así que un reporte que acaba de perder su comunidad (por el
        # DELETE de arriba) se queda con una distancia huérfana apuntando a
        # una comunidad que ya no existe. Se limpia antes del backfill para
        # que ambos campos vuelvan a estar sincronizados (o NULL los dos, o
        # un valor real de vuelta si el backfill encuentra una comunidad
        # distinta más abajo).
        cursor.execute(
            "UPDATE reportes SET distancia_siasar_m = NULL "
            "WHERE id_siasar_comunidad IS NULL AND distancia_siasar_m IS NOT NULL;"
        )

        # Backfill: solo reportes que TODAVÍA no tienen vínculo -- uno ya
        # vinculado no se re-evalúa aunque ahora exista una comunidad más
        # cercana (el vínculo se fija en el momento de creación del reporte,
        # ver Fase 4).
        cursor.execute(
            "SELECT id_reporte, latitud, longitud FROM reportes WHERE id_siasar_comunidad IS NULL;"
        )
        pendientes = cursor.fetchall()
        backfill = 0
        for rep in pendientes:
            resultado = buscar_comunidad_cercana(
                cursor, float(rep["latitud"]), float(rep["longitud"]), 2000
            )
            if resultado:
                comunidad_row, distancia_m = resultado
                cursor.execute(
                    "UPDATE reportes SET id_siasar_comunidad = %s, distancia_siasar_m = %s "
                    "WHERE id_reporte = %s;",
                    (comunidad_row["id_siasar"], distancia_m, rep["id_reporte"]),
                )
                backfill += 1
        reporte.reportes_backfill = backfill

        registrar_auditoria(
            cursor,
            id_usuario=None,
            accion=Accion.IMPORTACION,
            modulo=Modulo.SIASAR,
            ip=None,
        )

    return reporte


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, help="Carpeta con community_main.csv y system_main.csv")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--allow-shrink", action="store_true")
    args = parser.parse_args(argv)

    try:
        reporte = ejecutar_importacion(
            Path(args.dir), dry_run=args.dry_run, allow_shrink=args.allow_shrink
        )
    except (ImportadorError, ImportAbortado) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    reporte.imprimir()
    return 0


if __name__ == "__main__":
    sys.exit(main())
