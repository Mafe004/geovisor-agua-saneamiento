import React, { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING } from '../../theme/andi';

export const SURFACE_OVERLAP = 20;

interface LiftHeaderProps {
  children?: ReactNode;
  style?: ViewStyle;
}

// Cabecera plana oscura repetida en las 6 pantallas de Ciudadano.
// El contenido (kicker, título, numerales, botones) va como children.
export function LiftHeader({ children, style }: LiftHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + ANDI_SPACING.s2 }, style]}>
      {children}
    </View>
  );
}

// Superficie blanca que "monta" sobre la cabecera. Envuelve el resto del
// contenido de la pantalla (lista, mapa, formulario, etc.).
export function LiftSurface({ children, style }: LiftHeaderProps) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: ANDI_COLORS.primary800,
    paddingHorizontal: ANDI_SPACING.s5,
    paddingBottom: ANDI_SPACING.s8,
  },
  surface: {
    flex: 1,
    minHeight: 0,
    marginTop: -SURFACE_OVERLAP,
    borderTopLeftRadius: ANDI_RADIUS.xxl,
    borderTopRightRadius: ANDI_RADIUS.xxl,
    backgroundColor: ANDI_COLORS.surface,
    overflow: 'hidden',
  },
});
