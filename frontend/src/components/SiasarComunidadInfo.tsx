import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ComunidadDetalle } from '../types/domain';
import { calificacionColor, CLORACION_LABEL, fuenteConFecha, formatearPrueba } from '../theme/siasar';

/**
 * Contenido del diagnóstico SIASAR de una comunidad — sin encabezado ni
 * botón de cerrar, para que cada consumidor (MapaScreen's overlay panel,
 * DetalleReporteScreen's "Diagnóstico oficial de la zona" card) lo envuelva
 * con su propio título/estilo sin duplicar los campos ni las etiquetas.
 */
export default function SiasarComunidadInfo({ data }: { data: ComunidadDetalle }) {
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

const styles = StyleSheet.create({
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  row: { fontSize: 12, color: '#374151', marginBottom: 4 },
  calBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  calBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  section: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  subItem: { marginBottom: 6 },
  subItemTitle: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  subItemMeta: { fontSize: 11, color: '#6B7280' },
  fuente: { fontSize: 10, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' },
});
