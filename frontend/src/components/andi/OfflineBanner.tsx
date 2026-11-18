/**
 * Persistent "sin conexión" strip, mounted once in App.js above
 * <AppNavigator> so it covers every screen regardless of role. Unlike
 * Toast.tsx (transient, auto-dismiss), this is a *state* indicator: it
 * stays up for as long as the device is actually offline and disappears
 * the instant connectivity comes back, with no auto-dismiss timer.
 *
 * Takes real layout space (not position: absolute) instead of floating
 * over content -- this avoids ever overlapping the Toast host, and means
 * it can never cover a submit button or any other control. Nothing below
 * it remounts when it appears/disappears, so in-progress form input is
 * never touched (Ley 4's "no intrusive banner should wipe what the user
 * typed").
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { andiColors, andiSpace, andiType } from '../../theme/andi';

export default function OfflineBanner() {
  // null = "todavía no se sabe" (primer tick de NetInfo) -- se trata como
  // online para no parpadear el banner apenas abre la app, antes de que
  // NetInfo entregue su primer estado real.
  const [isOffline, setIsOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + andiSpace[2] }]}>
      <Feather name="wifi-off" size={14} color={andiColors.n0} />
      <Text style={[andiType.labelSm, styles.text]} numberOfLines={1}>
        Sin conexión — mostrando lo último guardado
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: andiSpace[2],
    backgroundColor: andiColors.n800,
    paddingBottom: andiSpace[2],
    paddingHorizontal: andiSpace[4],
  },
  text: { color: andiColors.n0 },
});
