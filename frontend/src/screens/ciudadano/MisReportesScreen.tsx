import React, { useState, useContext, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import ReportCard from '../../components/ReportCard';
import type { Reporte } from '../../types/domain';
import type { operations } from '../../types/api';
import type { CiudadanoTabParamList, RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<CiudadanoTabParamList, 'Reportes'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

type ReportesQuery = operations['listar_reportes_reportes__get']['parameters']['query'];

export default function MisReportesScreen({ navigation }: Props) {
  const { user } = useContext(AuthContext);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReportes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // id_usuario no existe en el query de GET /reportes/ (ver
      // MIGRATION_FINDINGS.md) -- el backend ya filtra "mis reportes" por
      // el JWT del lado del servidor para el rol ciudadano, así que este
      // parámetro se ignora en silencio. Se preserva el envío tal cual.
      const params: ReportesQuery & { id_usuario?: number } = { id_usuario: user?.id_usuario };
      const res = await reportesAPI.listar(params);
      setReportes(res.data || []);
    } catch (_) {
      Alert.alert('Error', 'No se pudieron cargar tus reportes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id_usuario]);

  useFocusEffect(useCallback(() => { loadReportes(); }, [loadReportes]));

  const onRefresh = () => { setRefreshing(true); loadReportes(true); };

  const counts = reportes.reduce<Record<string, number>>((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Cargando reportes…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>📋 Mis Reportes</Text>
        <Text style={styles.headerSub}>{reportes.length} reportes en total</Text>
        {/* Mini stats */}
        <View style={styles.statsRow}>
          {[
            { key: 'PENDIENTE', label: 'Pendientes', color: '#F59E0B' },
            { key: 'EN_PROCESO', label: 'En proceso', color: '#8B5CF6' },
            { key: 'RESUELTO',  label: 'Resueltos',  color: '#10B981' },
          ].map(s => (
            <View key={s.key} style={styles.statChip}>
              <Text style={[styles.statNum, { color: s.color }]}>{counts[s.key] || 0}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1565C0']} />}
        contentContainerStyle={reportes.length === 0 ? styles.emptyContainer : { paddingVertical: 8 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Sin reportes aún</Text>
            <Text style={styles.emptyText}>Toca el botón + para crear tu primer reporte.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Crear')}
            >
              <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.emptyBtnGrad}>
                <Text style={styles.emptyBtnText}>Crear reporte</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  statChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6B7280' },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { borderRadius: 12, overflow: 'hidden' },
  emptyBtnGrad: { paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
