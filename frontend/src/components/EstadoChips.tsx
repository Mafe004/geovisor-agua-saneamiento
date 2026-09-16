import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { EstadoReporteItem } from '../types/domain';

interface EstadoChipsProps {
  estados: EstadoReporteItem[];
  selectedId: number | null;
  currentNombre?: string | null;
  onSelect: (id: number) => void;
}

export default function EstadoChips({ estados, selectedId, currentNombre, onSelect }: EstadoChipsProps) {
  return (
    <View style={styles.grid}>
      {estados.map(e => (
        <TouchableOpacity
          key={e.id_estado}
          style={[
            styles.chip,
            selectedId === e.id_estado && styles.chipActive,
            currentNombre === e.nombre && styles.chipCurrent,
          ]}
          onPress={() => onSelect(e.id_estado)}
        >
          <Text style={[
            styles.chipText,
            selectedId === e.id_estado && styles.chipTextActive,
          ]}>
            {e.nombre.replace(/_/g, ' ')}{currentNombre === e.nombre ? ' ✓' : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipCurrent: { borderColor: '#059669', borderWidth: 2 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
});
