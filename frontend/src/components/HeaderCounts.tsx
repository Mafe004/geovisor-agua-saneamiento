import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useResponsive, type Responsive } from '../theme/responsive';

interface HeaderCountsProps {
  items: { value: number | string; label: string }[];
}

export default function HeaderCounts({ items }: HeaderCountsProps) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  item: { alignItems: 'center' },
  value: { color: '#fff', fontSize: r.scaleFont(20), fontWeight: '800' },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: r.scaleFont(11), marginTop: 2 },
});
