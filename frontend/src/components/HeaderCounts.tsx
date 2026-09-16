import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface HeaderCountsProps {
  items: { value: number | string; label: string }[];
}

export default function HeaderCounts({ items }: HeaderCountsProps) {
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  item: { alignItems: 'center' },
  value: { color: '#fff', fontSize: 20, fontWeight: '800' },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
});
