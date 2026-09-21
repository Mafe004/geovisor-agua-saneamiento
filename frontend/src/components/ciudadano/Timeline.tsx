import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ANDI_COLORS, ANDI_SPACING, statusMeta } from '../../theme/andi';
import type { HistorialEntry, HistorialEntryComunidad } from '../../types/domain';

function formatDateTime(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface TimelineProps {
  /**
   * Filas de reportesAPI.historial(id). El caller decide el orden a mostrar.
   * En la vista comunitaria (historial de un reporte de otro usuario) las
   * filas son HistorialEntryComunidad -- sin usuario_accion, ver el `in`
   * guard más abajo.
   */
  items: (HistorialEntry | HistorialEntryComunidad)[];
}

export default function Timeline({ items }: TimelineProps) {
  return (
    <View>
      {items.map((item, index) => {
        const meta = statusMeta(item.estado_nuevo);
        const isLast = index === items.length - 1;
        // HistorialEntryComunidad (vista comunitaria) no trae usuario_accion
        // -- 'Sistema' cubre tanto ese caso como el dato vacío de siempre.
        const actor = 'usuario_accion' in item ? item.usuario_accion : undefined;
        return (
          <View key={item.id_historial ?? index} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.node, { backgroundColor: meta.bd }]} />
              {!isLast && <View style={styles.line} />}
            </View>
            <View style={[styles.content, !isLast && styles.contentSpacing]}>
              <Text style={styles.title}>{meta.label}</Text>
              <Text style={styles.subtitle}>
                {actor || 'Sistema'} · {formatDateTime(item.fecha_cambio)}
              </Text>
              {!!item.comentario && <Text style={styles.comment}>{item.comentario}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ANDI_SPACING.s3 },
  rail: { alignItems: 'center', width: 14 },
  node: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2, backgroundColor: ANDI_COLORS.outlineVariant, marginTop: 2 },
  content: { flex: 1 },
  contentSpacing: { paddingBottom: ANDI_SPACING.s4 },
  title: { fontSize: 13, fontWeight: '600', color: ANDI_COLORS.onSurface },
  subtitle: { fontSize: 11.5, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },
  comment: { fontSize: 12.5, color: ANDI_COLORS.n600, marginTop: 6 },
});
