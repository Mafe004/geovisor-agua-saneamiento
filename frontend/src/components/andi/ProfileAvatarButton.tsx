/**
 * The small circular "go to my profile" button that sits in a header's
 * top-right corner. Ported from DashboardScreen.tsx's original inline
 * avatar (Admin) so Entidad's headers can reuse the exact same visual and
 * behavior instead of each screen hand-rolling its own initials circle --
 * this is also what makes it trivial to keep it showing consistently
 * across every Admin/Entidad screen instead of just one.
 */
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { andiColors, andiRadius, andiType } from '../../theme/andi';

function initials(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

interface ProfileAvatarButtonProps {
  /** Full name used to derive the two-letter initials shown in the circle. */
  name: string;
  onPress: () => void;
  size?: number;
}

export default function ProfileAvatarButton({ name, onPress, size = 44 }: ProfileAvatarButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Ver mi perfil"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: andiColors.primary400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...andiType.label, color: andiColors.surface },
});
