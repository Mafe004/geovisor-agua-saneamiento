import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, type DimensionValue, type ViewStyle } from 'react-native';
import { ANDI_COLORS, ANDI_RADIUS } from '../../theme/andi';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
  delay?: number;
}

export default function Skeleton({
  width = '100%',
  height = 16,
  radius = ANDI_RADIUS.full,
  style,
  delay = 0,
}: SkeletonProps) {
  // useState con inicializador perezoso en vez de useRef(...).current --
  // mismo valor estable entre renders, pero sin el lint del React Compiler
  // "Cannot access refs during render" (ver components/andi/Toast.tsx).
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius: radius, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: ANDI_COLORS.skeleton },
});
