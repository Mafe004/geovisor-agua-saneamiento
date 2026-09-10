import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import StatusBadge from './StatusBadge';
import { COLORS } from '../theme/colors';
import type { Reporte } from '../types/domain';

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ReportCardProps {
  reporte: Reporte;
  onPress?: (reporte: Reporte) => void;
}

export default function ReportCard({ reporte, onPress }: ReportCardProps) {
  // El backend no devuelve direccion_aproximada (el campo real es
  // `direccion`) ni fecha_creacion (el campo real es `created_at`) en
  // ReporteDetalle -- ver MIGRATION_FINDINGS.md. Se preserva el acceso tal
  // cual (hoy ambos son `undefined` en runtime, así que siempre caen en el
  // fallback de coordenadas / fecha vacía) en vez de "arreglarlo".
  const reporteLegacy = reporte as unknown as {
    direccion_aproximada?: string;
    fecha_creacion?: string;
  };
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(reporte)}
      activeOpacity={0.85}
    >
      {/* Barra de color lateral según severidad */}
      <View
        style={[
          styles.severityBar,
          {
            backgroundColor:
              reporte.severidad === 'ALTA' || reporte.severidad === 'CRITICA'
                ? '#EF4444'
                : reporte.severidad === 'MEDIA'
                ? '#F59E0B'
                : '#10B981',
          },
        ]}
      />

      <View style={styles.body}>
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.id}>#{reporte.id_reporte}</Text>
          <StatusBadge status={reporte.estado} type="status" />
        </View>

        {/* Descripción */}
        <Text style={styles.description} numberOfLines={2}>
          {reporte.descripcion || 'Sin descripción'}
        </Text>

        {/* Meta */}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {reporteLegacy.direccion_aproximada
                || `${Number(reporte.latitud).toFixed(4)}, ${Number(reporte.longitud).toFixed(4)}`}
            </Text>
          </View>
          {reporte.tipo_incidente && (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>🔧</Text>
              <Text style={styles.metaText}>{reporte.tipo_incidente}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <StatusBadge status={reporte.severidad} type="severity" size="sm" />
          <Text style={styles.date}>{formatDate(reporteLegacy.fecha_creacion)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  severityBar: {
    width: 5,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  id: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    gap: 4,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
