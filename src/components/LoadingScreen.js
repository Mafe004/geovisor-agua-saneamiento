import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoadingScreen({ message = 'Cargando...' }) {
  return (
    <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.container}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.brand}>💧 GeoVisor Agua</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    marginTop: 16,
  },
  brand: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 32,
    letterSpacing: 0.5,
  },
});
