import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';

export default function GradientHeader({ title, subtitle, onBack, rightAction }) {
  return (
    <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.left}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.right}>
          {rightAction && rightAction}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 48, paddingBottom: 16 },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  left: { width: 40 },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 40, alignItems: 'flex-end' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  backBtn: { padding: 4 },
  backIcon: { color: '#fff', fontSize: 22, fontWeight: '600' },
});
