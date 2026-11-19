import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ComunidadDetalle } from '../types/domain';
import { calificacionColor, CLORACION_LABEL, fuenteConFecha, formatearPrueba } from '../theme/siasar';
import { andiColors, andiRadius } from '../theme/andi';
import { useResponsive, type Responsive } from '../theme/responsive';

/**
 * Contenido del diagnóstico SIASAR de una comunidad — sin encabezado ni
 * botón de cerrar, para que cada consumidor (MapaScreen's overlay panel,
 * DetalleReporteScreen's "Diagnóstico oficial de la zona" card) lo envuelva
 * con su propio título/estilo sin duplicar los campos ni las etiquetas.
 */
export default function SiasarComunidadInfo({ data }: { data: ComunidadDetalle }) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const pctAgua = data.cobertura_agua != null ? Math.round(data.cobertura_agua * 100) : null;
  const pctSan = data.cobertura_saneamiento != null ? Math.round(data.cobertura_saneamiento * 100) : null;

  return (
    <View>
      <Text style={styles.subtitle}>{data.localidad ? `${data.localidad} · ` : ''}{data.municipio}</Text>

      {data.calificacion && (
        <View style={[styles.calBadge, { backgroundColor: calificacionColor(data.calificacion) }]}>
          <Text style={styles.calBadgeText}>Calificación SIASAR: {data.calificacion}</Text>
        </View>
      )}

      <Text style={styles.row}>
        Población: {data.poblacion ?? '—'}{data.poblacion_atipica ? ' (dato por verificar)' : ''}
      </Text>
      <Text style={styles.row}>Viviendas: {data.viviendas ?? '—'}</Text>
      <Text style={styles.row}>
        Cobertura de agua: {pctAgua != null ? `${pctAgua}%` : 'sin dato'} · saneamiento: {pctSan != null ? `${pctSan}%` : 'sin dato'}
      </Text>
      <Text style={styles.row}>
        {data.n_escuelas ? `${data.n_escuelas} escuela(s) registrada(s)` : 'Sin escuelas registradas'}
      </Text>

      {data.sistemas.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sistemas que la abastecen</Text>
          {data.sistemas.map(s => (
            <View key={s.id_siasar} style={styles.subItem}>
              <Text style={styles.subItemTitle}>{s.nombre}</Text>
              <Text style={styles.subItemMeta}>Cloración: {CLORACION_LABEL[s.cloracion]}</Text>
              <Text style={styles.subItemMeta}>{formatearPrueba('coliformes', s.prueba_coliformes)}</Text>
            </View>
          ))}
        </View>
      )}

      {data.prestador && <Text style={styles.row}>Prestador: {data.prestador}</Text>}
      <Text style={styles.fuente}>{fuenteConFecha(data.fecha_encuesta)}</Text>
    </View>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  subtitle: { fontSize: r.scaleFont(12), color: andiColors.onSurfaceVariant, marginBottom: 8 },
  row: { fontSize: r.scaleFont(12), color: andiColors.n700, marginBottom: 4 },
  calBadge: { alignSelf: 'flex-start', borderRadius: andiRadius.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  calBadgeText: { color: andiColors.surface, fontSize: r.scaleFont(11), fontWeight: '700' },
  section: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: andiColors.outlineVariant },
  sectionTitle: { fontSize: r.scaleFont(12), fontWeight: '700', color: andiColors.n700, marginBottom: 4 },
  subItem: { marginBottom: 6 },
  subItemTitle: { fontSize: r.scaleFont(12), fontWeight: '600', color: andiColors.onSurface },
  subItemMeta: { fontSize: r.scaleFont(11), color: andiColors.onSurfaceVariant },
  fuente: { fontSize: r.scaleFont(10), color: andiColors.n400, marginTop: 8, fontStyle: 'italic' },
});
