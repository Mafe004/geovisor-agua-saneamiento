import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function StatCard({ title, value, subtitle, icon, gradient, style }) {
  const colors = gradient || ['#1565C0', '#1976D2'];

  return (
    <LinearGradient colors={colors} style={[styles.card, style]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.topRow}>
        <Text style={styles.icon}>{icon || '📊'}</Text>
        <Text style={styles.value}>{value ?? '—'}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    flex: 1,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
});
