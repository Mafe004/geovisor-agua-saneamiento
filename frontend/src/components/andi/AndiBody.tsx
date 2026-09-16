import React, { type ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { andiColors, andiRadius } from '../../theme/andi';

/**
 * The white rounded-top card that sits under <AndiHeader> — its -20
 * marginTop rides up over the header's bottom padding, producing the
 * canvas's signature overlap between the dark header and the light body.
 */
export default function AndiBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.body, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: andiRadius['2xl'],
    borderTopRightRadius: andiRadius['2xl'],
    backgroundColor: andiColors.surface,
    overflow: 'hidden',
  },
});
