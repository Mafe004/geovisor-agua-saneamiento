import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_MONO, statusMeta } from '../../theme/andi';
import { StatusChip, SeverityChip, SyncChip } from './Chip';
import type { Reporte } from '../../types/domain';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

/** Resumen mínimo de un borrador local (ver utils/offlineDrafts.ts). */
export interface DraftSummary {
  id: string;
  tipoLabel: string;
  faltante?: string;
  guardadoEn: string;
}

// Tarjeta ancla oscura: el reporte "vivo" (más reciente).
export function AnchorReportCard({ reporte, onPress }: { reporte: Reporte; onPress?: (reporte: Reporte) => void }) {
  const meta = statusMeta(reporte.estado);
  return (
    <TouchableOpacity style={styles.anchor} onPress={() => onPress?.(reporte)} activeOpacity={0.85}>
      <View style={styles.anchorTop}>
        <Text style={styles.anchorId}>#{reporte.id_reporte}</Text>
        <View style={[styles.anchorChip, { backgroundColor: ANDI_COLORS.primary700, borderColor: ANDI_COLORS.primary600 }]}>
          <Text style={styles.anchorChipText}>{meta.icon} {meta.label}</Text>
        </View>
      </View>
      <Text style={styles.anchorTitle}>{reporte.tipo_incidente || reporte.descripcion}</Text>
      {!!reporte.descripcion && !!reporte.tipo_incidente && (
        <Text style={styles.anchorDesc} numberOfLines={2}>{reporte.descripcion}</Text>
      )}
      <View style={styles.anchorFooter}>
        {/* ReporteDetalle no expone un nombre de entidad (solo id_entidad) --
            se usa la asignación como señal en vez de inventar un campo. */}
        <Text style={styles.anchorMeta}>
          {(reporte.id_entidad ? 'Asignado a una entidad' : 'Sin asignar')} · {formatDate(reporte.created_at)}
        </Text>
        <SeverityChip severidad={reporte.severidad} />
      </View>
    </TouchableOpacity>
  );
}

// Borrador local sin terminar.
export function DraftReportCard({ item, onResume }: { item: DraftSummary; onResume?: (item: DraftSummary) => void }) {
  return (
    <TouchableOpacity style={styles.draft} onPress={() => onResume?.(item)} activeOpacity={0.85}>
      <View style={styles.draftContent}>
        <SyncChip state="draft" />
        <Text style={styles.draftTitle}>{item.tipoLabel || 'Sin tipo'}</Text>
        <Text style={styles.draftMeta}>{item.faltante || 'Incompleto'} · guardado {formatDate(item.guardadoEn)}</Text>
      </View>
      <Text style={styles.draftAction}>Seguir</Text>
    </TouchableOpacity>
  );
}

// Tarjeta neutra: el resto de reportes sincronizados con el servidor.
export default function ReportCard({ reporte, onPress }: { reporte: Reporte; onPress?: (reporte: Reporte) => void }) {
  return (
    <TouchableOpacity style={styles.neutral} onPress={() => onPress?.(reporte)} activeOpacity={0.85}>
      <View style={styles.neutralTop}>
        <Text style={styles.neutralId}>#{reporte.id_reporte}</Text>
        <StatusChip estado={reporte.estado} />
      </View>
      <Text style={styles.neutralTitle} numberOfLines={2}>{reporte.descripcion || 'Sin descripción'}</Text>
      <View style={styles.neutralFooter}>
        <SeverityChip severidad={reporte.severidad} />
        <Text style={styles.neutralDate}>{formatDate(reporte.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Anchor
  anchor: { backgroundColor: ANDI_COLORS.primary900, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4 },
  anchorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ANDI_SPACING.s2 },
  anchorId: { fontFamily: ANDI_MONO, fontSize: 12, color: ANDI_COLORS.primary200 },
  anchorChip: { flexDirection: 'row', paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 3, borderRadius: ANDI_RADIUS.full, borderWidth: 1 },
  anchorChipText: { color: ANDI_COLORS.primary100, fontSize: 12, fontWeight: '600' },
  anchorTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  anchorDesc: { color: ANDI_COLORS.primary100, fontSize: 12.5, marginTop: 4 },
  anchorFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: ANDI_SPACING.s3 },
  anchorMeta: { color: ANDI_COLORS.primary200, fontSize: 11.5 },

  // Draft
  draft: { backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: ANDI_COLORS.outline, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4, flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3 },
  draftContent: { flex: 1 },
  draftTitle: { fontSize: 13, fontWeight: '600', color: ANDI_COLORS.onSurface, marginTop: 4 },
  draftMeta: { fontSize: 11.5, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },
  draftAction: { fontSize: 12, fontWeight: '600', color: ANDI_COLORS.primary700 },

  // Neutral
  neutral: { backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4, marginBottom: ANDI_SPACING.s3 },
  neutralTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ANDI_SPACING.s2 },
  neutralId: { fontFamily: ANDI_MONO, fontSize: 12, color: ANDI_COLORS.onSurfaceVariant },
  neutralTitle: { fontSize: 14, color: ANDI_COLORS.onSurface, lineHeight: 20 },
  neutralFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: ANDI_SPACING.s3 },
  neutralDate: { fontSize: 11.5, color: ANDI_COLORS.onSurfaceVariant },
});
