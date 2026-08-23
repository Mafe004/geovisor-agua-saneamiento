import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { entidadesAPI } from '../../api/services';

export default function EntidadesScreen() {
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadEntidades(); }, []);

  const loadEntidades = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await entidadesAPI.listar();
      setEntidades(res.data || []);
    } catch (_) { setEntidades([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const toggleEstado = (entidad) => {
    Alert.alert(
      entidad.activo ? 'Desactivar entidad' : 'Activar entidad',
      `¿Confirmas cambiar el estado de "${entidad.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await entidadesAPI.cambiarEstado(entidad.id_entidad, !entidad.activo);
              loadEntidades(true);
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.detail || 'No se pudo actualizar.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>🏢 Gestión de Entidades</Text>
        <Text style={styles.headerSub}>
          {entidades.filter(e => e.activo).length} activas · {entidades.length} total
        </Text>
      </LinearGradient>

      <FlatList
        data={entidades}
        keyExtractor={e => String(e.id_entidad)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntidades(true); }} colors={['#1565C0']} />
        }
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.activo && styles.cardInactive]}>
            <View style={styles.iconWrap}>
              <Text style={styles.entidadIcon}>🏢</Text>
            </View>
            <View style={styles.entidadInfo}>
              <Text style={styles.entidadNombre}>{item.nombre}</Text>
              {item.descripcion ? (
                <Text style={styles.entidadDesc} numberOfLines={1}>{item.descripcion}</Text>
              ) : null}
              <View style={styles.entidadMeta}>
                {item.telefono && <Text style={styles.metaText}>📱 {item.telefono}</Text>}
                {item.email && <Text style={styles.metaText} numberOfLines={1}>✉️ {item.email}</Text>}
              </View>
              <View style={[styles.estadoBadge, { backgroundColor: item.activo ? '#D1FAE5' : '#FEE2E2' }]}>
                <Text style={[styles.estadoText, { color: item.activo ? '#065F46' : '#991B1B' }]}>
                  {item.activo ? 'Activa' : 'Inactiva'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleEstado(item)}>
              <Text style={styles.toggleIcon}>{item.activo ? '🔒' : '🔓'}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>Sin entidades registradas</Text>
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
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardInactive: { opacity: 0.6 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF', justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
  },
  entidadIcon: { fontSize: 22 },
  entidadInfo: { flex: 1 },
  entidadNombre: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  entidadDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  entidadMeta: { marginTop: 6, gap: 2 },
  metaText: { fontSize: 11, color: '#9CA3AF' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  estadoText: { fontSize: 11, fontWeight: '600' },
  toggleBtn: { padding: 8 },
  toggleIcon: { fontSize: 22 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
});
