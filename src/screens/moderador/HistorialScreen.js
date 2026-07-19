import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { historialAPI } from '../../api/services';
import StatusBadge from '../../components/StatusBadge';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function HistorialScreen() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadHistorial(); }, []);

  const loadHistorial = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await historialAPI.listar({});
      setHistorial(res.data || []);
    } catch (_) {
      setHistorial([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>📜 Historial de Cambios</Text>
        <Text style={styles.headerSub}>Registro de actualizaciones de reportes</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1565C0" />
        </View>
      ) : (
        <FlatList
          data={historial}
          keyExtractor={(h, i) => String(h.id_historial || i)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadHistorial(true); }}
              colors={['#1565C0']}
            />
          }
          contentContainerStyle={historial.length === 0 && styles.emptyContainer}
          renderItem={({ item, index }) => (
            <View style={styles.timelineItem}>
              {/* Línea de tiempo */}
              <View style={styles.timelineLeft}>
                <View style={styles.timelineDot} />
                {index < historial.length - 1 && <View style={styles.timelineLine} />}
              </View>
              {/* Contenido */}
              <View style={styles.timelineCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardReporte}>Reporte #{item.id_reporte}</Text>
                  <Text style={styles.cardTime}>{formatDate(item.fecha_cambio)}</Text>
                </View>
                <View style={styles.statusChange}>
                  {item.estado_anterior && (
                    <>
                      <StatusBadge status={item.estado_anterior} type="status" />
                      <Text style={styles.arrow}>→</Text>
                    </>
                  )}
                  <StatusBadge status={item.estado_nuevo} type="status" />
                </View>
                {item.comentario ? (
                  <Text style={styles.comentario}>"{item.comentario}"</Text>
                ) : null}
                {item.usuario_nombre && (
                  <Text style={styles.usuario}>
                    👤 {item.usuario_nombre} {item.usuario_apellido || ''}
                  </Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyTitle}>Sin historial</Text>
              <Text style={styles.emptyText}>No hay cambios registrados aún.</Text>
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
  timelineItem: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 },
  timelineLeft: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#1565C0', borderWidth: 2, borderColor: '#BFDBFE',
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#BFDBFE', marginTop: 4 },
  timelineCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardReporte: { fontSize: 13, fontWeight: '700', color: '#1565C0' },
  cardTime: { fontSize: 11, color: '#9CA3AF' },
  statusChange: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  arrow: { fontSize: 14, color: '#9CA3AF' },
  comentario: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginBottom: 4 },
  usuario: { fontSize: 11, color: '#9CA3AF' },
  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
