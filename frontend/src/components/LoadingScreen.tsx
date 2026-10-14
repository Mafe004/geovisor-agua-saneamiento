import React, { useMemo } from 'react';
import { Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useResponsive, type Responsive } from '../theme/responsive';

export default function LoadingScreen({ message = 'Cargando...' }: { message?: string }) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  return (
    <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.container}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.brand}>💧 GeoVisor Agua</Text>
    </LinearGradient>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: r.scaleFont(15),
    marginTop: 16,
  },
  brand: {
    color: '#fff',
    fontSize: r.scaleFont(18),
    fontWeight: '700',
    marginTop: 32,
    letterSpacing: 0.5,
  },
});
