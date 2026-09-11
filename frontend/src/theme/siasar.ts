/**
 * Constantes de presentación para la capa SIASAR — único lugar donde viven
 * las etiquetas y colores de esta capa (mapa Ciudadano con tema azul,
 * tarjeta de diagnóstico Entidad/Moderador con tema Andi, ambos la
 * importan de acá en vez de redeclarar sus propios colores/etiquetas).
 *
 * Nunca uses las palabras "potable" / "no potable" en ningún texto que
 * consuma estas constantes — SIASAR reporta respuestas de encuesta, no
 * certifica potabilidad (ver SIASAR_INTEGRATION_NOTES.md, "Data caveats").
 */
import type { Calificacion, Cloracion, PruebaLaboratorio } from '../types/domain';

export const SIASAR_FUENTE = 'SIASAR – Ministerio de Vivienda, Ciudad y Territorio';

export const CALIFICACION_COLOR: Record<Calificacion, string> = {
  A: '#15803D',
  B: '#65A30D',
  C: '#EA580C',
  D: '#B91C1C',
};
export const CALIFICACION_COLOR_NULO = '#9CA3AF';

export function calificacionColor(c: Calificacion | null | undefined): string {
  return c ? CALIFICACION_COLOR[c] : CALIFICACION_COLOR_NULO;
}

export const PRUEBA_LABEL: Record<PruebaLaboratorio, string> = {
  PASA: 'Pasa',
  NO_PASA: 'No pasa',
  SIN_PRUEBA: 'Sin prueba registrada',
};
export const PRUEBA_COLOR: Record<PruebaLaboratorio, string> = {
  PASA: '#15803D',
  NO_PASA: '#B91C1C',
  SIN_PRUEBA: '#9CA3AF',
};

export const CLORACION_LABEL: Record<Cloracion, string> = {
  FUNCIONA: 'Funciona',
  NO_FUNCIONA: 'Existe, pero no funciona',
  NO_SE_REALIZA: 'No se realiza',
  SIN_DATO: 'Sin dato',
};

/** "Fuente: SIASAR – Ministerio de Vivienda · encuesta DD/MM/AAAA" */
export function fuenteConFecha(fechaEncuestaISO: string): string {
  const [y, m, d] = fechaEncuestaISO.split('-');
  return `Fuente: SIASAR – Ministerio de Vivienda · encuesta ${d}/${m}/${y}`;
}

export function formatearPrueba(campo: 'coliformes' | 'fisicoquimico', valor: PruebaLaboratorio): string {
  const nombre = campo === 'coliformes' ? 'de coliformes' : 'fisicoquímica';
  return `Última prueba ${nombre} registrada: ${PRUEBA_LABEL[valor]}`;
}
