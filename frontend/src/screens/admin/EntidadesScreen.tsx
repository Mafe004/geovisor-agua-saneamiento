import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { entidadesAPI } from '../../api/services';
import type { EntidadDetalle } from '../../types/domain';

export default function EntidadesScreen() {
  const [entidades, setEntidades] = useState<EntidadDetalle[]>([]);
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

  const toggleEstado = (entidad: EntidadDetalle) => {
    const activo = entidad.estado_cuenta === 'ACTIVO';
    Alert.alert(
      activo ? 'Desactivar entidad' : 'Activar entidad',
      `¿Confirmas cambiar el estado de "${entidad.nombre_entidad}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // El body real es { id_estado_cuenta }, no { activo } --
              // se envía el estado contrario al actual (1=ACTIVO,
              // 2=INACTIVO), mismo criterio que UsuariosScreen.
              await entidadesAPI.cambiarEstado(entidad.id_entidad, {
                id_estado_cuenta: activo ? 2 : 1,
              });
              loadEntidades(true);
            } catch (e) {
              const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
              Alert.alert('Error', msg || 'No se pudo actualizar.');
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
          {entidades.filter(e => e.estado_cuenta === 'ACTIVO').length} activas · {entidades.length} total
        </Text>
      </LinearGradient>

      <FlatList
        data={entidades}
        keyExtractor={e => String(e.id_entidad)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntidades(true); }} colors={['#1565C0']} />
        }
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const activo = item.estado_cuenta === 'ACTIVO';
          return (
            <View style={[styles.card, !activo && styles.cardInactive]}>
              <View style={styles.iconWrap}>
                <Text style={styles.entidadIcon}>🏢</Text>
              </View>
              <View style={styles.entidadInfo}>
                <Text style={styles.entidadNombre}>{item.nombre_entidad}</Text>
                <View style={styles.entidadMeta}>
                  {item.telefono && <Text style={styles.metaText}>📱 {item.telefono}</Text>}
                  {item.correo_institucional && (
                    <Text style={styles.metaText} numberOfLines={1}>✉️ {item.correo_institucional}</Text>
                  )}
                </View>
                <View style={[styles.estadoBadge, { backgroundColor: activo ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.estadoText, { color: activo ? '#065F46' : '#991B1B' }]}>
                    {activo ? 'Activa' : 'Inactiva'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleEstado(item)}>
                <Text style={styles.toggleIcon}>{activo ? '🔒' : '🔓'}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>Sin entidades registradas</Text>
            </View>
          ) : null
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
