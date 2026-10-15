import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI, catalogosAPI } from '../../api/services';
import ReportCard from '../../components/ReportCard';
import type { Reporte, EstadoReporteItem } from '../../types/domain';
import type { operations } from '../../types/api';
import type { RootStackParamList } from '../../navigation/types';
import { useResponsive, type Responsive } from '../../theme/responsive';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

type ReportesQuery = operations['listar_reportes_reportes__get']['parameters']['query'];

const PAGE_SIZE = 200; // máximo que acepta GET /reportes/ (limite le=200)

export default function TodosReportesScreen({ navigation }: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estadosDisponibles, setEstadosDisponibles] = useState<EstadoReporteItem[]>([]);
  const [idEstado, setIdEstado] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    catalogosAPI.estadosReporte()
      .then(res => { if (mounted) setEstadosDisponibles(res.data || []); })
      .catch(() => { if (mounted) setEstadosDisponibles([]); });
    return () => { mounted = false; };
  }, []);

  const loadReportes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // GET /reportes/ pagina (limite máx. 200, default 50) mientras que
      // /reportes/estadisticas cuenta todo -- se recorren todas las páginas
      // para que este listado y el total del Panel siempre coincidan.
      const todos: Reporte[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const params: ReportesQuery = { limite: PAGE_SIZE, offset };
        if (idEstado != null) params.id_estado = idEstado;
        const res = await reportesAPI.listar(params);
        const page = res.data || [];
        todos.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setReportes(todos);
      setError(false);
    } catch (_) {
      // No vaciar la lista en silencio: un 500 se veía igual que "0 reportes".
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idEstado]);

  useFocusEffect(useCallback(() => { loadReportes(); }, [loadReportes]));

  const reportesFiltrados = busqueda.trim()
    ? reportes.filter(r =>
        r.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
        String(r.id_reporte).includes(busqueda)
      )
    : reportes;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
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
          <TouchableOpacity
            style={[styles.filterChip, idEstado === null && styles.filterChipActive]}
            onPress={() => setIdEstado(null)}
          >
            <Text style={[styles.filterText, idEstado === null && styles.filterTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {estadosDisponibles.map(e => (
            <TouchableOpacity
              key={e.id_estado}
              style={[styles.filterChip, idEstado === e.id_estado && styles.filterChipActive]}
              onPress={() => setIdEstado(e.id_estado)}
            >
              <Text style={[styles.filterText, idEstado === e.id_estado && styles.filterTextActive]}>
                {e.nombre.replace(/_/g, ' ')}
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
          contentContainerStyle={[styles.listContent, reportesFiltrados.length === 0 && styles.emptyContainer]}
          ListEmptyComponent={
            loading ? null : error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>⚠️</Text>
                <Text style={styles.emptyTitle}>No se pudieron cargar los reportes</Text>
                <Text style={styles.emptyText}>Desliza hacia abajo para reintentar.</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>Sin resultados</Text>
                <Text style={styles.emptyText}>No hay reportes con el filtro seleccionado.</Text>
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  // Fondo = color del header: la franja bajo la Dynamic Island/notch queda del mismo tono.
  safeArea: { flex: 1, backgroundColor: '#1565C0' },
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: r.scaleFont(20), fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: r.scaleFont(12), marginTop: 2, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 12, height: 40,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: r.scaleFont(14) },
  clearIcon: { color: 'rgba(255,255,255,0.7)', fontSize: 16, padding: 4 },
  filterScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  filterText: { fontSize: r.scaleFont(12), color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  listContent: { width: '100%', maxWidth: r.maxContentWidth(700), alignSelf: 'center' },
  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: r.scaleFont(18), fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: r.scaleFont(14), color: '#6B7280', textAlign: 'center' },
});
