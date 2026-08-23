import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TextInput, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { reportesAPI } from '../../api/services';
import ReportCard from '../../components/ReportCard';

const FILTROS = [
  { key: '',            label: 'Todos'      },
  { key: 'PENDIENTE',   label: 'Pendiente'  },
  { key: 'EN_REVISION', label: 'Revisión'   },
  { key: 'EN_PROCESO',  label: 'Proceso'    },
  { key: 'RESUELTO',    label: 'Resuelto'   },
];

export default function TodosReportesScreen({ navigation }) {
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const loadReportes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      const res = await reportesAPI.listar(params);
      setReportes(res.data || []);
    } catch (_) {
      setReportes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadReportes(); }, [filtroEstado]));

  const reportesFiltrados = busqueda.trim()
    ? reportes.filter(r =>
        r.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
        String(r.id_reporte).includes(busqueda)
      )
    : reportes;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>📋 Todos los Reportes</Text>
        <Text style={styles.headerSub}>{reportesFiltrados.length} resultados</Text>
        {/* Buscador */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por ID o descripción…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda ? (
            <TouchableOpacity onPress={() => setBusqueda('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {/* Filtros de estado */}
      <View style={styles.filterScroll}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filtroEstado === f.key && styles.filterChipActive]}
            onPress={() => setFiltroEstado(f.key)}
          >
            <Text style={[styles.filterText, filtroEstado === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={reportesFiltrados}
        keyExtractor={r => String(r.id_reporte)}
        renderItem={({ item }) => (
          <ReportCard
            reporte={item}
            onPress={r => navigation.navigate('DetalleReporte', { reporte: r })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadReportes(true); }}
            colors={['#1565C0']}
          />
        }
        contentContainerStyle={reportesFiltrados.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>No hay reportes con el filtro seleccionado.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 12, height: 40,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  clearIcon: { color: 'rgba(255,255,255,0.7)', fontSize: 16, padding: 4 },
  filterScroll: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  filterText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
