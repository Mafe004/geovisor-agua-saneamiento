import React, { useMemo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useResponsive, type Responsive } from '../theme/responsive';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  children?: ReactNode;
}

export default function GradientHeader({ title, subtitle, onBack, rightAction, children }: GradientHeaderProps) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
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
      {children && <View style={styles.childrenSlot}>{children}</View>}
    </LinearGradient>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { paddingTop: 48, paddingBottom: 16 },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  left: { width: 40 },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 40, alignItems: 'flex-end' },
  title: { color: '#fff', fontSize: r.scaleFont(20), fontWeight: '700', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: r.scaleFont(13), marginTop: 2 },
  backBtn: { padding: 4 },
  backIcon: { color: '#fff', fontSize: r.scaleFont(22), fontWeight: '600' },
  childrenSlot: { paddingHorizontal: 16, marginTop: 12 },
});
