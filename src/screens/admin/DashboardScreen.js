import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { reportesAPI } from '../../api/services';
import StatCard from '../../components/StatCard';

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await reportesAPI.estadisticas();
      setStats(res.data);
    } catch (_) {
      setStats(null);
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
  const pendientes    = stats?.por_estado?.PENDIENTE ?? 0;
  const enProceso     = stats?.por_estado?.EN_PROCESO ?? 0;
  const resueltos     = stats?.por_estado?.RESUELTO ?? 0;
  const tasaResolucion = totalReportes
    ? Math.round((resueltos / totalReportes) * 100)
    : 0;

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
        {/* Fila 1 */}
        <Text style={styles.sectionTitle}>Estado de reportes</Text>
        <View style={styles.cardRow}>
          <StatCard
            title="Pendientes"
            value={pendientes}
            icon="⏳"
            gradient={['#F59E0B', '#FBBF24']}
            style={styles.cardFlex}
          />
          <StatCard
            title="En Proceso"
            value={enProceso}
            icon="⚙️"
            gradient={['#8B5CF6', '#A78BFA']}
            style={styles.cardFlex}
          />
        </View>

        <View style={styles.cardRow}>
          <StatCard
            title="Resueltos"
            value={resueltos}
            icon="✅"
            gradient={['#10B981', '#34D399']}
            style={styles.cardFlex}
          />
          <StatCard
            title="Tasa resolución"
            value={`${tasaResolucion}%`}
            icon="📈"
            gradient={['#1565C0', '#00ACC1']}
            style={styles.cardFlex}
          />
        </View>

        {/* Severidades */}
        {stats?.por_severidad && (
          <>
            <Text style={styles.sectionTitle}>Por severidad</Text>
            <View style={styles.cardRow}>
              <StatCard title="Alta" value={stats.por_severidad.ALTA ?? 0} icon="🔴" gradient={['#EF4444', '#F87171']} style={styles.cardFlex} />
              <StatCard title="Media" value={stats.por_severidad.MEDIA ?? 0} icon="🟡" gradient={['#F59E0B', '#FBBF24']} style={styles.cardFlex} />
              <StatCard title="Baja" value={stats.por_severidad.BAJA ?? 0} icon="🟢" gradient={['#10B981', '#34D399']} style={styles.cardFlex} />
            </View>
          </>
        )}

        {/* Por tipo */}
        {stats?.por_tipo && stats.por_tipo.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Por tipo de incidente</Text>
            <View style={styles.tipoList}>
              {stats.por_tipo.slice(0, 6).map((t, i) => (
                <View key={i} style={styles.tipoRow}>
                  <Text style={styles.tipoName}>{t.tipo || 'Sin tipo'}</Text>
                  <View style={styles.tipoBarWrap}>
                    <View
                      style={[
                        styles.tipoBar,
                        { width: `${Math.round((t.cantidad / totalReportes) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.tipoCount}>{t.cantidad}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
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
    marginBottom: 10, marginTop: 16,
  },
  cardRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardFlex: { flex: 1 },
  tipoList: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  tipoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  tipoName: { fontSize: 12, color: '#374151', width: 120 },
  tipoBarWrap: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  tipoBar: { height: 8, backgroundColor: '#1565C0', borderRadius: 4, minWidth: 4 },
  tipoCount: { fontSize: 12, fontWeight: '700', color: '#1565C0', width: 28, textAlign: 'right' },
});
