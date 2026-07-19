import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auditoriaAPI } from '../../api/services';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACCION_COLOR = {
  CREATE: '#10B981', UPDATE: '#3B82F6', DELETE: '#EF4444',
  LOGIN: '#8B5CF6', LOGOUT: '#6B7280',
};

export default function AuditoriaScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await auditoriaAPI.listar();
      setLogs(res.data || []);
    } catch (_) { setLogs([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>🔍 Auditoría del Sistema</Text>
        <Text style={styles.headerSub}>Registro de todas las acciones</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1565C0" />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l, i) => String(l.id_auditoria || i)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLogs(true); }} colors={['#1565C0']} />
          }
          contentContainerStyle={logs.length === 0 && styles.emptyContainer}
          renderItem={({ item }) => {
            const accion = (item.accion || 'OTHER').toUpperCase();
            const color = ACCION_COLOR[accion] || '#6B7280';
            return (
              <View style={styles.logCard}>
                <View style={[styles.accionDot, { backgroundColor: color }]} />
                <View style={styles.logContent}>
                  <View style={styles.logHeader}>
                    <View style={[styles.accionBadge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.accionText, { color }]}>{accion}</Text>
                    </View>
                    <Text style={styles.logTime}>{formatDate(item.fecha)}</Text>
                  </View>
                  <Text style={styles.logDesc}>{item.descripcion || item.tabla_afectada || '—'}</Text>
                  {item.usuario_nombre && (
                    <Text style={styles.logUser}>
                      👤 {item.usuario_nombre} {item.usuario_apellido || ''}
                    </Text>
                  )}
                  {item.tabla_afectada && (
                    <Text style={styles.logTable}>Tabla: {item.tabla_afectada}</Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Sin registros de auditoría</Text>
              <Text style={styles.emptyText}>Las acciones del sistema aparecerán aquí.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 5,
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  accionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10, marginTop: 5 },
  logContent: { flex: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  accionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  accionText: { fontSize: 11, fontWeight: '700' },
  logTime: { fontSize: 10, color: '#9CA3AF' },
  logDesc: { fontSize: 13, color: '#374151', marginBottom: 4 },
  logUser: { fontSize: 11, color: '#6B7280' },
  logTable: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
