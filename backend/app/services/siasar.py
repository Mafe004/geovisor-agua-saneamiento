"""
Servicio de lectura para la capa SIASAR: buscar la comunidad (vereda)
registrada más cercana a un punto. Módulo puro de acceso a datos -- no abre
su propia conexión (recibe un cursor ya abierto por el llamador), así que
el llamador controla la transacción (usado tanto por el importador, dentro
de su propia transacción, como por reportes.crear_reporte, dentro de la
suya).
"""

import math
from typing import Any

_EARTH_METERS_PER_DEGREE_LAT = 111_000


def buscar_comunidad_cercana(
    cursor, lat: float, lon: float, radio_m: int = 2000
) -> tuple[dict[str, Any], int] | None:
    """
    Devuelve (fila de siasar_comunidad, distancia_m redondeada) para la
    comunidad más cercana a (lat, lon) dentro de radio_m, o None si no hay
    ninguna en ese radio (o si la tabla está vacía).

    Prefiltra con un bounding box (rápido, usa los índices
    (latitud, longitud) / municipio) antes de calcular la distancia real con
    ST_Distance_Sphere -- evitar un full scan con trigonometría por fila
    sobre las ~3600 comunidades en cada creación de reporte.
    """
    delta_lat = radio_m / _EARTH_METERS_PER_DEGREE_LAT
    # cos(0) en el ecuador nunca pasa acá (Cundinamarca está lejos), pero
    # se guarda con un piso pequeño de todas formas para nunca dividir por
    # un coseno que redondeó a 0.
    coslat = max(math.cos(math.radians(lat)), 1e-6)
    delta_lon = radio_m / (_EARTH_METERS_PER_DEGREE_LAT * coslat)

    cursor.execute(
        """
        SELECT
            id_siasar, nombre, municipio, localidad, latitud, longitud,
            poblacion, viviendas, poblacion_atipica, cobertura_agua,
            cobertura_saneamiento, n_escuelas, sistemas_texto, prestador,
            calificacion, fecha_encuesta, fecha_importacion,
            ST_Distance_Sphere(
                POINT(longitud, latitud), POINT(%s, %s)
            ) AS distancia_m
        FROM siasar_comunidad
        WHERE latitud  BETWEEN %s AND %s
          AND longitud BETWEEN %s AND %s
        ORDER BY distancia_m ASC
        LIMIT 1;
        """,
        (
            lon, lat,
            lat - delta_lat, lat + delta_lat,
            lon - delta_lon, lon + delta_lon,
        ),
    )
    row = cursor.fetchone()
    if not row or row["distancia_m"] > radio_m:
        return None

    distancia_m = round(row["distancia_m"])
    del row["distancia_m"]
    return row, distancia_m
