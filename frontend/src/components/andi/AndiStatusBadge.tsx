import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { andiColors, andiRadius, andiSpace, andiStatusPill } from '../../theme/andi';

interface AndiStatusBadgeProps {
  status?: string;
  /** Dark-card variant (Triage/Asignados anchor cards) uses tinted-on-dark colors instead of the tag's own bg/border. */
  onDark?: boolean;
}

export default function AndiStatusBadge({ status, onDark }: AndiStatusBadgeProps) {
  const cfg = andiStatusPill[(status ?? '').toUpperCase()] ?? andiStatusPill.PENDIENTE!;

  const bg = onDark ? andiColors.primary700 : cfg.bg;
  const fg = onDark ? andiColors.primary100 : cfg.fg;
  const bd = onDark ? andiColors.primary600 : cfg.bd;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: bd }]}>
      {cfg.icon === 'circle' ? (
        <View style={[styles.dot, { backgroundColor: fg }]} />
      ) : (
        <Feather name={cfg.icon} size={11} color={fg} />
      )}
      <Text style={[styles.label, { color: fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: andiSpace[4], height: 20,
    borderRadius: andiRadius.full, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
