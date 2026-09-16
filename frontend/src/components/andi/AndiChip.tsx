import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';

interface AndiChipProps {
  label: string;
  variant?: 'solid' | 'outline' | 'accent';
  onPress?: () => void;
}

/** Filter/segment pill — solid teal when active, accent-tinted for the
 * "needs attention" chip (Sin entidad), outline otherwise. */
export default function AndiChip({ label, variant = 'outline', onPress }: AndiChipProps) {
  const style =
    variant === 'solid' ? styles.solid :
    variant === 'accent' ? styles.accent :
    styles.outline;
  const textStyle =
    variant === 'solid' ? styles.solidText :
    variant === 'accent' ? styles.accentText :
    styles.outlineText;

  return (
    <TouchableOpacity style={[styles.chip, style]} onPress={onPress}>
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: andiSpace[4],
    borderRadius: andiRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  solid: { backgroundColor: andiColors.primary600, borderColor: andiColors.primary600 },
  solidText: { color: andiColors.n0 },
  accent: { backgroundColor: andiColors.accent100, borderColor: andiColors.accent300 },
  accentText: { color: andiColors.accent700 },
  outline: { backgroundColor: 'transparent', borderColor: andiColors.outline },
  outlineText: { color: andiColors.onSurface },
});
