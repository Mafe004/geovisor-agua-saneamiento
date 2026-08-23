import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { reportesAPI } from '../../api/services';
import ReportCard from '../../components/ReportCard';

export default function ReportesAsignadosScreen({ navigation }) {
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReportes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Solo traer los que NO están resueltos para priorizar
      const res = await reportesAPI.listar({ asignados: true });
      setReportes(res.data || []);
    } catch (_) {
      setReportes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadReportes(); }, []));

  const pendientes = reportes.filter(r => r.estado === 'PENDIENTE' || r.estado === 'EN_REVISION').length;
  const enProceso = reportes.filter(r => r.estado === 'EN_PROCESO').length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>📌 Reportes Asignados</Text>
        <View style={styles.headerStats}>
          <View style={styles.statChip}>
            <Text style={styles.statNum}>{pendientes}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={[styles.statNum, { color: '#C084FC' }]}>{enProceso}</Text>
            <Text style={styles.statLabel}>En proceso</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={[styles.statNum, { color: '#6EE7B7' }]}>{reportes.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={reportes}
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
        contentContainerStyle={reportes.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>Sin reportes asignados</Text>
              <Text style={styles.emptyText}>No tienes reportes asignados actualmente.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  headerStats: { flexDirection: 'row', gap: 8 },
  statChip: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, padding: 8, alignItems: 'center',
  },
  statNum: { fontSize: 22, fontWeight: '800', color: '#FCD34D' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
