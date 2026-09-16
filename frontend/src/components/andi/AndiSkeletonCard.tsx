import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';

/**
 * Loading placeholder shaped like an AndiReportCard row. The canvas
 * ("lo que falta") animates these with a CSS shimmer gradient sweep
 * (`andiShimmer`); RN has no equivalent to a moving background-position
 * sweep without an extra gradient/masking library, so this approximates
 * it with a plain opacity pulse via the native driver — same "this is
 * loading" read, no new dependency.
 */
function Bar({ width, height = 12, style }: { width: number | `${number}%`; height?: number; style?: object }) {
  return <View style={[styles.bar, { width, height, borderRadius: height / 2 }, style]} />;
}

export default function AndiSkeletonCard() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.topRow}>
        <Bar width={70} height={10} />
        <Bar width={60} height={18} style={styles.pill} />
      </View>
      <Bar width="85%" height={14} style={styles.spaced} />
      <Bar width="55%" height={11} style={styles.spaced} />
    </Animated.View>
  );
}

export function AndiSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={i > 0 ? styles.gap : undefined}>
          <AndiSkeletonCard />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: andiColors.surfaceMid,
    borderRadius: andiRadius.lg,
    padding: andiSpace[4],
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { borderRadius: andiRadius.full },
  bar: { backgroundColor: andiColors.n200 },
  spaced: { marginTop: andiSpace[3] },
  gap: { marginTop: andiSpace[2] },
});
