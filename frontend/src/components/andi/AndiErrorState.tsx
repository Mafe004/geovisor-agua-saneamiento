import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { andiColors, andiRadius, andiSpace, andiType } from '../../theme/andi';

interface AndiErrorStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  /** The literal HTTP status/detail the backend actually returns — shown verbatim, mono. */
  code: string;
  ctaLabel: string;
  onPressCta?: () => void;
  ctaVariant?: 'solid' | 'outline';
  iconBg?: string;
  iconFg?: string;
}

/** A real 403/permission boundary rendered as UI instead of a blank list or
 * a generic alert — the canvas treats these as first-class screens. */
export default function AndiErrorState({
  icon, title, body, code, ctaLabel, onPressCta,
  ctaVariant = 'solid', iconBg = andiColors.surfaceMid, iconFg = andiColors.onSurfaceVariant,
}: AndiErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.circle, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={42} color={iconFg} />
      </View>
      <Text style={[andiType.section, styles.title]}>{title}</Text>
      <Text style={[andiType.bodyLg, styles.body]}>{body}</Text>
      <View style={styles.codeChip}>
        <Text style={styles.codeText}>{code}</Text>
      </View>
      <TouchableOpacity
        onPress={onPressCta}
        style={[styles.cta, ctaVariant === 'solid' ? styles.ctaSolid : styles.ctaOutline]}
      >
        <Text style={[styles.ctaText, ctaVariant === 'solid' && styles.ctaTextSolid]}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: andiSpace[6] },
  circle: {
    width: 112, height: 112, borderRadius: andiRadius.full,
    alignItems: 'center', justifyContent: 'center', marginBottom: andiSpace[5],
  },
  title: { color: andiColors.onSurface, marginBottom: andiSpace[2], textAlign: 'center' },
  body: { color: andiColors.onSurfaceVariant, textAlign: 'center', maxWidth: 300, marginBottom: andiSpace[4] },
  codeChip: { backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg, paddingHorizontal: andiSpace[3], paddingVertical: andiSpace[2], marginBottom: andiSpace[6] },
  codeText: { fontFamily: 'monospace', fontSize: 12, lineHeight: 16, fontWeight: '500', color: andiColors.onSurfaceVariant },
  cta: { minHeight: 48, paddingHorizontal: andiSpace[6], borderRadius: andiRadius.full, alignItems: 'center', justifyContent: 'center' },
  ctaOutline: { borderWidth: 1, borderColor: andiColors.outline },
  ctaSolid: { backgroundColor: andiColors.primary600 },
  ctaText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: andiColors.onSurface },
  ctaTextSolid: { color: andiColors.n0 },
});
