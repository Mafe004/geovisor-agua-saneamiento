import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, SEVERITY_META } from '../../theme/andi';

const OPTIONS = ['BAJA', 'MEDIA', 'ALTA'] as const;
export type SeveridadKey = (typeof OPTIONS)[number];

interface SeverityPickerProps {
  value: SeveridadKey | null;
  onChange: (value: SeveridadKey) => void;
}

export default function SeverityPicker({ value, onChange }: SeverityPickerProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((key) => {
        const meta = SEVERITY_META[key]!;
        const selected = value === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(key)}
            activeOpacity={0.8}
          >
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {meta.label}{selected ? ' ✓' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ANDI_SPACING.s2 },
  option: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    borderRadius: ANDI_RADIUS.lg,
    borderWidth: 1,
    borderColor: ANDI_COLORS.outline,
    backgroundColor: ANDI_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: ANDI_COLORS.primary600,
    backgroundColor: ANDI_COLORS.primary50,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 12, fontWeight: '600', color: ANDI_COLORS.onSurface },
  labelSelected: { color: ANDI_COLORS.primary900 },
});
