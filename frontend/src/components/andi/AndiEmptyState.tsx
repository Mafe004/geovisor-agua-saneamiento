import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { andiColors, andiRadius, andiSpace, andiType } from '../../theme/andi';

interface AndiEmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  ctaVariant?: 'solid' | 'outline';
  /** The circle behind the icon — success green by default ("good news" empties). */
  iconBg?: string;
  iconFg?: string;
}

/** The "nothing to do here" state — celebrated, not apologized for, per the
 * canvas ("para este rol el vacío es una buena noticia"). */
export default function AndiEmptyState({
  icon = 'check', title, body, ctaLabel, onPressCta,
  ctaVariant = 'outline', iconBg = andiColors.successContainer, iconFg = andiColors.onSuccessContainer,
}: AndiEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.circle, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={46} color={iconFg} />
      </View>
      <Text style={[andiType.section, styles.title]}>{title}</Text>
      <Text style={[andiType.bodyLg, styles.body]}>{body}</Text>
      {ctaLabel && (
        <TouchableOpacity
          onPress={onPressCta}
          style={[styles.cta, ctaVariant === 'solid' ? styles.ctaSolid : styles.ctaOutline]}
        >
          <Text style={[styles.ctaText, ctaVariant === 'solid' && styles.ctaTextSolid]}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: andiSpace[6] },
  circle: {
    width: 120, height: 120, borderRadius: andiRadius.full,
    alignItems: 'center', justifyContent: 'center', marginBottom: andiSpace[5],
  },
  title: { color: andiColors.onSurface, marginBottom: andiSpace[2], textAlign: 'center' },
  body: { color: andiColors.onSurfaceVariant, textAlign: 'center', maxWidth: 290, marginBottom: andiSpace[6] },
  cta: { minHeight: 48, paddingHorizontal: andiSpace[6], borderRadius: andiRadius.full, alignItems: 'center', justifyContent: 'center' },
  ctaOutline: { borderWidth: 1, borderColor: andiColors.outline },
  ctaSolid: { backgroundColor: andiColors.accent500 },
  ctaText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: andiColors.onSurface },
  ctaTextSolid: { color: andiColors.n0 },
});
