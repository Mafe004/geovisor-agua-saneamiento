import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StatCard from './StatCard';
import type { EstadisticasResponse } from '../types/domain';

interface EstadisticasViewProps {
  stats: EstadisticasResponse;
  title?: string;
}

export default function EstadisticasView({ stats, title }: EstadisticasViewProps) {
  // El backend agrupa con GROUP BY: cada arreglo solo trae las filas con
  // conteo > 0. Una clave ausente significa cero, no dato faltante.
  const byEstado = Object.fromEntries(
    (stats.por_estado ?? []).map(r => [r.estado, r.total])
  );
  const bySeveridad = Object.fromEntries(
    (stats.por_severidad ?? []).map(r => [r.severidad, r.total])
  );

  const totalReportes = stats.total_reportes ?? 0;
  const pendientes    = byEstado.PENDIENTE ?? 0;
  const enProceso     = byEstado.EN_PROCESO ?? 0;
  const resueltos     = byEstado.RESUELTO ?? 0;
  const tasaResolucion = totalReportes
    ? Math.round((resueltos / totalReportes) * 100)
    : 0;

  return (
    <View>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}

      <View style={styles.cardRow}>
        <StatCard title="Pendientes" value={pendientes} icon="⏳" gradient={['#F59E0B', '#FBBF24']} style={styles.cardFlex} />
        <StatCard title="En Proceso" value={enProceso} icon="⚙️" gradient={['#8B5CF6', '#A78BFA']} style={styles.cardFlex} />
      </View>

      <View style={styles.cardRow}>
        <StatCard title="Resueltos" value={resueltos} icon="✅" gradient={['#10B981', '#34D399']} style={styles.cardFlex} />
        <StatCard title="Tasa resolución" value={`${tasaResolucion}%`} icon="📈" gradient={['#1565C0', '#00ACC1']} style={styles.cardFlex} />
      </View>

      {stats.por_severidad && (
        <>
          <Text style={styles.sectionTitle}>Por severidad</Text>
          <View style={styles.cardRow}>
            <StatCard title="Alta" value={bySeveridad.ALTA ?? 0} icon="🔴" gradient={['#EF4444', '#F87171']} style={styles.cardFlex} />
            <StatCard title="Media" value={bySeveridad.MEDIA ?? 0} icon="🟡" gradient={['#F59E0B', '#FBBF24']} style={styles.cardFlex} />
            <StatCard title="Baja" value={bySeveridad.BAJA ?? 0} icon="🟢" gradient={['#10B981', '#34D399']} style={styles.cardFlex} />
          </View>
        </>
      )}

      {stats.por_tipo_incidente && stats.por_tipo_incidente.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Por tipo de incidente</Text>
          <View style={styles.tipoList}>
            {stats.por_tipo_incidente.slice(0, 6).map((t, i) => (
              <View key={i} style={styles.tipoRow}>
                <Text style={styles.tipoName}>{t.tipo_incidente || 'Sin tipo'}</Text>
                <View style={styles.tipoBarWrap}>
                  <View
                    style={[
                      styles.tipoBar,
                      { width: `${totalReportes ? Math.round((t.total / totalReportes) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.tipoCount}>{t.total}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginTop: 16,
  },
  cardRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardFlex: { flex: 1 },
  tipoList: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  tipoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  tipoName: { fontSize: 12, color: '#374151', width: 120 },
  tipoBarWrap: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  tipoBar: { height: 8, backgroundColor: '#1565C0', borderRadius: 4, minWidth: 4 },
  tipoCount: { fontSize: 12, fontWeight: '700', color: '#1565C0', width: 28, textAlign: 'right' },
});
