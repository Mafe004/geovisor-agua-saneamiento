import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, statusMeta, severityMeta } from '../../theme/andi';

type ChipSize = 'md' | 'lg';

export function StatusChip({ estado, size = 'md' }: { estado?: string | null; size?: ChipSize }) {
  const meta = statusMeta(estado);
  const lg = size === 'lg';
  return (
    <View style={[styles.pill, lg && styles.pillLg, { backgroundColor: meta.bg, borderColor: meta.bd, borderWidth: 1 }]}>
      <Text style={[styles.pillText, lg && styles.pillTextLg, { color: meta.fg }]}>{meta.icon} {meta.label}</Text>
    </View>
  );
}

export function SeverityChip({ severidad, size = 'md' }: { severidad?: string | null; size?: ChipSize }) {
  const meta = severityMeta(severidad);
  const lg = size === 'lg';
  return (
    <View style={[styles.pill, lg && styles.pillLg, styles.severityPill]}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.pillText, lg && styles.pillTextLg, styles.severityText]}>{meta.label}</Text>
    </View>
  );
}

export function CategoryChip({ label }: { label: string }) {
  return (
    <View style={[styles.pill, styles.categoryPill]}>
      <Text style={[styles.pillText, styles.categoryText]}>{label}</Text>
    </View>
  );
}

// Solo "draft" está en uso: Ciudadano_V2_TS no recuperó la cola de reintento
// automático de Ciudadano_V1 (ver mapa de equivalencias), así que no hay
// estados "queued"/"failed"/"synced" que mostrar todavía.
const SYNC_META = {
  draft: { bg: ANDI_COLORS.n100, fg: ANDI_COLORS.n600, icon: '✎', label: 'Borrador', dashed: true },
} as const;

export function SyncChip({ state }: { state: keyof typeof SYNC_META }) {
  const meta = SYNC_META[state];
  return (
    <View style={[styles.pill, styles.overlinePill, { backgroundColor: meta.bg }, meta.dashed && styles.dashedBorder]}>
      <Text style={[styles.overlineText, { color: meta.fg }]}>{meta.icon} {meta.label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    paddingHorizontal: ANDI_SPACING.s3,
    paddingVertical: 4,
    borderRadius: ANDI_RADIUS.full,
    alignSelf: 'flex-start',
    gap: 6,
  },
  pillLg: { minHeight: 36, paddingHorizontal: ANDI_SPACING.s4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillTextLg: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  severityPill: { backgroundColor: ANDI_COLORS.surfaceMid, borderWidth: 1, borderColor: ANDI_COLORS.outline },
  severityText: { color: ANDI_COLORS.onSurface, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.6 },
  categoryPill: { borderWidth: 1, borderColor: ANDI_COLORS.outline, backgroundColor: ANDI_COLORS.surface },
  categoryText: { color: ANDI_COLORS.onSurface },
  overlinePill: { paddingHorizontal: ANDI_SPACING.s3, minHeight: 26 },
  overlineText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  dashedBorder: { borderWidth: 1, borderStyle: 'dashed', borderColor: ANDI_COLORS.outline },
});
