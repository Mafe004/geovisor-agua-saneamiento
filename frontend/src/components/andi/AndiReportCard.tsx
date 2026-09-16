import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { andiColors, andiRadius, andiSpace, andiSeverityColor } from '../../theme/andi';

interface AndiReportCardProps {
  variant?: 'anchor' | 'normal';
  idLabel: string;
  /** Top-right badge — an <AndiStatusBadge> or the "⚑ Sin entidad" flag pill. */
  badge: ReactNode;
  title: string;
  meta: string;
  onPress?: () => void;

  // anchor variant — the "this one needs you now" highlighted card.
  severidad?: string;
  note?: string;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;

  // normal variant — footer's right side (a caption or a "Tomar" action).
  footerRight?: ReactNode;
}

export default function AndiReportCard({
  variant = 'normal', idLabel, badge, title, meta, onPress,
  severidad, note, primaryLabel, onPrimaryPress, onSecondaryPress, footerRight,
}: AndiReportCardProps) {
  if (variant === 'anchor') {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.anchorCard}>
        <View style={styles.headerRow}>
          <Text style={styles.anchorId}>{idLabel}</Text>
          {badge}
        </View>
        <Text style={styles.anchorTitle}>{title}</Text>
        <Text style={styles.anchorMeta}>{meta}</Text>
        {(severidad || note) && (
          <View style={styles.anchorNoteRow}>
            {severidad && (
              <View style={styles.severityInline}>
                <View style={[styles.dot10, { backgroundColor: andiSeverityColor[severidad.toUpperCase()] ?? andiSeverityColor.BAJA }]} />
                <Text style={styles.anchorNoteText}>{cap(severidad)}</Text>
              </View>
            )}
            {severidad && note && <View style={styles.dotSep} />}
            {note && <Text style={styles.anchorNoteText}>{note}</Text>}
          </View>
        )}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryPill} onPress={onPrimaryPress}>
            <Text style={styles.primaryPillText}>{primaryLabel}</Text>
          </TouchableOpacity>
          {onSecondaryPress && (
            <TouchableOpacity style={styles.secondaryCircle} onPress={onSecondaryPress}>
              <Feather name="map-pin" size={17} color={andiColors.primary100} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.normalCard}>
      <View style={styles.headerRow}>
        <Text style={styles.normalId}>{idLabel}</Text>
        {badge}
      </View>
      <Text style={styles.normalTitle}>{title}</Text>
      <Text style={styles.normalMeta}>{meta}</Text>
      <View style={styles.footerRow}>
        <View style={styles.severityChip}>
          <View style={[styles.dot8, { backgroundColor: andiSeverityColor[(severidad ?? '').toUpperCase()] ?? andiSeverityColor.BAJA }]} />
          <Text style={styles.severityChipText}>{cap(severidad ?? '')}</Text>
        </View>
        {footerRight}
      </View>
    </TouchableOpacity>
  );
}

function cap(s: string) {
  return s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: andiSpace[2] },

  // Anchor
  anchorCard: { backgroundColor: andiColors.primary900, borderRadius: andiRadius.xl, padding: andiSpace[4] },
  anchorId: { fontFamily: 'monospace', fontSize: 12, lineHeight: 16, fontWeight: '500', color: andiColors.primary200 },
  anchorTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: andiColors.n0 },
  anchorMeta: { fontSize: 12, lineHeight: 16, color: andiColors.primary200, marginTop: andiSpace[1] },
  anchorNoteRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[2], marginVertical: andiSpace[3] },
  severityInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot10: { width: 10, height: 10, borderRadius: 5 },
  dotSep: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: andiColors.primary300 },
  anchorNoteText: { fontSize: 12, lineHeight: 16, color: andiColors.primary100 },
  actionRow: { flexDirection: 'row', gap: andiSpace[2] },
  primaryPill: {
    flex: 1, minHeight: 48, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary100, alignItems: 'center', justifyContent: 'center',
  },
  primaryPillText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: andiColors.primary900 },
  secondaryCircle: {
    width: 48, minHeight: 48, borderRadius: andiRadius.full,
    borderWidth: 1, borderColor: andiColors.primary600,
    alignItems: 'center', justifyContent: 'center',
  },

  // Normal
  normalCard: {
    backgroundColor: andiColors.surface, borderWidth: 1, borderColor: andiColors.outlineVariant,
    borderRadius: andiRadius.xl, padding: andiSpace[4],
  },
  normalId: { fontFamily: 'monospace', fontSize: 12, lineHeight: 16, fontWeight: '500', color: andiColors.onSurfaceVariant },
  normalTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: andiColors.onSurface },
  normalMeta: { fontSize: 12, lineHeight: 16, color: andiColors.onSurfaceVariant, marginTop: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: andiSpace[3] },
  severityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 22, borderRadius: andiRadius.full,
    backgroundColor: andiColors.surfaceMid, borderWidth: 1, borderColor: andiColors.outline,
  },
  dot8: { width: 8, height: 8, borderRadius: 4 },
  severityChipText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: andiColors.onSurface, textTransform: 'uppercase' },
});
