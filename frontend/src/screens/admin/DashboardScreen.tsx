import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { reportesAPI, siasarAPI } from '../../api/services';
import EstadisticasView from '../../components/EstadisticasView';
import type { EstadisticasResponse, ResumenMunicipio } from '../../types/domain';

export default function DashboardScreen() {
  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [resumenSiasar, setResumenSiasar] = useState<ResumenMunicipio[]>([]);
  const [busquedaMunicipio, setBusquedaMunicipio] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, siasarRes] = await Promise.all([
        reportesAPI.estadisticas(),
        siasarAPI.resumenMunicipios(),
      ]);
      setStats(statsRes.data);
      setResumenSiasar(siasarRes.data || []);
    } catch (_) {
      setStats(null);
      setResumenSiasar([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#1565C0" />
        <Text style={styles.loadingText}>Cargando estadísticas…</Text>
      </View>
    );
  }

  const totalReportes = stats?.total_reportes ?? 0;

  const filasSiasar = busquedaMunicipio.trim()
    ? resumenSiasar.filter(f => f.municipio.toLowerCase().includes(busquedaMunicipio.trim().toLowerCase()))
    : resumenSiasar;

  const fechaMin = resumenSiasar.length
    ? resumenSiasar.reduce<string>((min, f) => f.fecha_encuesta_min < min ? f.fecha_encuesta_min : min, resumenSiasar[0]!.fecha_encuesta_min)
    : null;
  const fechaMax = resumenSiasar.length
    ? resumenSiasar.reduce<string>((max, f) => f.fecha_encuesta_max > max ? f.fecha_encuesta_max : max, resumenSiasar[0]!.fecha_encuesta_max)
    : null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0D47A1', '#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>📊 Panel Administrativo</Text>
        <Text style={styles.headerSub}>GeoVisor · Zipaquirá</Text>
        {/* KPI principal */}
        <View style={styles.kpi}>
          <Text style={styles.kpiNum}>{totalReportes}</Text>
          <Text style={styles.kpiLabel}>Reportes totales</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(true); }} colors={['#1565C0']} />
        }
      >
        {stats && <EstadisticasView stats={stats} title="Estado de reportes" />}

        <Text style={styles.sectionTitle}>SIASAR vs. reportes ciudadanos</Text>
        {fechaMin && fechaMax && (
          <Text style={styles.siasarIntro}>
            Compara el diagnóstico oficial de SIASAR (encuestas {formatFecha(fechaMin)}–{formatFecha(fechaMax)})
            {' '}con los reportes recibidos en la app.
          </Text>
        )}

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar municipio…"
          placeholderTextColor="#9CA3AF"
          value={busquedaMunicipio}
          onChangeText={setBusquedaMunicipio}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.siasarTableHeader}>
              <Text style={[styles.siasarTh, styles.colMunicipio]}>Municipio</Text>
              <Text style={[styles.siasarTh, styles.colNum]}>Veredas</Text>
              <Text style={[styles.siasarTh, styles.colNum]}>En D</Text>
              <Text style={[styles.siasarTh, styles.colNum]}>Sin cloración</Text>
              <Text style={[styles.siasarTh, styles.colNum]}>No pasa coliformes</Text>
              <Text style={[styles.siasarTh, styles.colNum]}>Reportes</Text>
            </View>
            {filasSiasar.map(f => (
              <View key={f.municipio} style={styles.siasarRow}>
                <Text style={[styles.siasarCell, styles.colMunicipio]} numberOfLines={1}>{f.municipio}</Text>
                <Text style={[styles.siasarCell, styles.colNum]}>{f.comunidades}</Text>
                <Text style={[styles.siasarCell, styles.colNum, f.comunidades_d > 0 && styles.siasarCellWarn]}>{f.comunidades_d}</Text>
                <Text style={[styles.siasarCell, styles.colNum]}>{f.sistemas_sin_cloracion}</Text>
                <Text style={[styles.siasarCell, styles.colNum]}>{f.sistemas_no_pasa_coliformes}</Text>
                <Text style={[styles.siasarCell, styles.colNum]}>{f.reportes_total} ({f.reportes_abiertos} abiertos)</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        {resumenSiasar.length > 0 && filasSiasar.length === 0 && (
          <Text style={styles.siasarEmpty}>Sin municipios que coincidan con la búsqueda.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280' },
  header: { paddingTop: 48, paddingBottom: 20, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  kpi: { alignItems: 'center', marginTop: 16 },
  kpiNum: { fontSize: 56, fontWeight: '900', color: '#fff', lineHeight: 64 },
  kpiLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 32 },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, marginTop: 24,
  },
  siasarIntro: { fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 17 },
  searchInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#fff', paddingHorizontal: 12, height: 40,
    fontSize: 13, color: '#1F2937', marginBottom: 10,
  },
  siasarTableHeader: {
    flexDirection: 'row', backgroundColor: '#EEF2F4',
    borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingVertical: 8,
  },
  siasarTh: { fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', paddingHorizontal: 8, textAlign: 'right' },
  siasarRow: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  siasarCell: { fontSize: 12, color: '#374151', paddingHorizontal: 8, textAlign: 'right' },
  siasarCellWarn: { color: '#B91C1C', fontWeight: '700' },
  colMunicipio: { width: 140, textAlign: 'left' },
  colNum: { width: 90 },
  siasarEmpty: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
