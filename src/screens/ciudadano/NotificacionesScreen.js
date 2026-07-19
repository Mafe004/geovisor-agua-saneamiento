import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { notificacionesAPI } from '../../api/services';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export default function NotificacionesScreen() {
  const [notis, setNotis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadNotis(); }, []);

  const loadNotis = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await notificacionesAPI.listar();
      setNotis(res.data || []);
    } catch (_) {
      setNotis([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markRead = async (id) => {
    try {
      await notificacionesAPI.marcarLeida(id);
      setNotis(prev => prev.map(n => n.id_notificacion === id ? { ...n, leida: true } : n));
    } catch (_) {}
  };

  const unreadCount = notis.filter(n => !n.leida).length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Notificaciones</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount} nuevas</Text>
          </View>
        )}
      </LinearGradient>

      <FlatList
        data={notis}
        keyExtractor={n => String(n.id_notificacion)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadNotis(true); }}
            colors={['#1565C0']}
          />
        }
        contentContainerStyle={notis.length === 0 && styles.emptyContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notiCard, !item.leida && styles.notiUnread]}
            onPress={() => !item.leida && markRead(item.id_notificacion)}
            activeOpacity={0.85}
          >
            <View style={[styles.notiDot, { opacity: item.leida ? 0 : 1 }]} />
            <View style={styles.notiContent}>
              <Text style={styles.notiTitle}>{item.titulo || 'Actualización de reporte'}</Text>
              <Text style={styles.notiMsg} numberOfLines={2}>{item.mensaje}</Text>
              <Text style={styles.notiTime}>{timeAgo(item.fecha_envio)}</Text>
            </View>
            {!item.leida && <Text style={styles.notiNew}>•</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>Sin notificaciones</Text>
              <Text style={styles.emptyText}>Aquí verás los cambios en tus reportes.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  badge: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  notiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 14,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  notiUnread: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#1565C0',
  },
  notiDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#1565C0',
    marginRight: 10,
  },
  notiContent: { flex: 1 },
  notiTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 3 },
  notiMsg: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  notiTime: { fontSize: 11, color: '#9CA3AF', marginTop: 5 },
  notiNew: { color: '#1565C0', fontSize: 20, marginLeft: 6, fontWeight: '900' },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
