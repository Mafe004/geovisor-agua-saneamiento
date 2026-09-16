import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { andiColors, andiSpace, andiType, andiOverlineDecor, andiStatLabelDecor } from '../../theme/andi';

interface Stat {
  value: number | string;
  label: string;
  color?: string;
}

interface AndiHeaderProps {
  onBack?: () => void;
  /** Mono caption over the title, used together with onBack (e.g. "#12"). */
  kicker?: string;
  /** Overline over the title, used on top-level tabs (e.g. "Bandeja · Zipaquirá"). */
  overline?: string;
  title: string;
  /** Caption under the title (Infra/Cifras-style headers). */
  subtitle?: string;
  stats?: Stat[];
  rightElement?: ReactNode;
  /** One-off row below the title that isn't the multi-column stat grid —
   * e.g. Historial's single "9 cambios esta semana" baseline row. */
  headerExtra?: ReactNode;
}

/**
 * The dark header block from the canvas — always paired with <AndiBody>
 * right below it, whose -20px marginTop creates the rounded-overlap effect
 * over this header's bottom padding.
 */
export default function AndiHeader({
  onBack, kicker, overline, title, subtitle, stats, rightElement, headerExtra,
}: AndiHeaderProps) {
  return (
    <View style={[styles.header, { paddingBottom: (stats && stats.length > 0) ? andiSpace[8] : andiSpace[6] }]}>
      <View style={styles.topRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.circleBtn} accessibilityLabel="Volver">
            <Feather name="arrow-left" size={20} color={andiColors.n0} />
          </TouchableOpacity>
        )}
        <View style={styles.titleBlock}>
          {kicker && <Text style={[andiType.body, styles.kicker]}>{kicker}</Text>}
          {overline && <Text style={[andiType.overline, andiOverlineDecor, styles.overline]}>{overline}</Text>}
          <Text style={[onBack ? andiType.screen : andiType.display, styles.title]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle && <Text style={[andiType.caption, styles.subtitle]}>{subtitle}</Text>}
        </View>
        {rightElement}
      </View>

      {headerExtra}

      {stats && stats.length > 0 && (
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <View key={i}>
              <Text style={[andiType.displayLg, { color: s.color || andiColors.n0 }]}>{s.value}</Text>
              <Text style={[andiType.overline, andiStatLabelDecor, styles.statLabel]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Small circular icon button used in the header (search, back, +). */
export function AndiHeaderIconButton({
  icon, onPress, background = andiColors.primary700,
}: { icon: keyof typeof Feather.glyphMap; onPress?: () => void; background?: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.circleBtn, { backgroundColor: background }]}>
      <Feather name={icon} size={18} color={andiColors.n0} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flex: 0,
    backgroundColor: andiColors.primary800,
    paddingHorizontal: andiSpace[5],
    paddingTop: andiSpace[6],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: andiSpace[3],
  },
  circleBtn: {
    width: 48, height: 48, borderRadius: 999,
    backgroundColor: andiColors.primary700,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: { flex: 1 },
  kicker: { fontFamily: 'monospace', color: andiColors.primary200, marginBottom: 2 },
  overline: { color: andiColors.primary200, marginBottom: andiSpace[1] },
  title: { color: andiColors.n0 },
  subtitle: { color: andiColors.primary200, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    gap: andiSpace[6],
    marginTop: andiSpace[5],
  },
  statLabel: { color: andiColors.primary200, marginTop: 2 },
});
