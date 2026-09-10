import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { usuariosAPI } from '../../api/services';
import type { UsuarioListItem } from '../../types/domain';

// Valores reales de los catálogos roles.nombre / estado_cuenta.nombre
// (ver backend/geovisor_backup_limpio.sql) -- rol es el NOMBRE del rol,
// no un id numérico, y estado_cuenta es un string de catálogo, no boolean.
const ROL_COLOR: Record<string, string> = {
  CIUDADANO: '#10B981', ENTIDAD: '#3B82F6', MODERADOR: '#8B5CF6', ADMINISTRADOR: '#EF4444',
};
const ROL_LABEL: Record<string, string> = {
  CIUDADANO: 'Ciudadano', ENTIDAD: 'Entidad', MODERADOR: 'Moderador', ADMINISTRADOR: 'Admin',
};

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => { loadUsuarios(); }, []);

  const loadUsuarios = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await usuariosAPI.listar();
      setUsuarios(res.data || []);
    } catch (_) { setUsuarios([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const toggleEstado = (usuario: UsuarioListItem) => {
    const activo = usuario.estado_cuenta === 'ACTIVO';
    Alert.alert(
      activo ? 'Desactivar usuario' : 'Activar usuario',
      `¿Confirmas ${activo ? 'desactivar' : 'activar'} la cuenta de ${usuario.nombre_completo}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              // No existe un endpoint de "toggle" -- se usa el real
              // (PUT /usuarios/{id}/estado) pasando el estado contrario
              // al actual (1=ACTIVO, 2=INACTIVO).
              await usuariosAPI.cambiarEstado(usuario.id_usuario, {
                id_estado_cuenta: activo ? 2 : 1,
              });
              loadUsuarios(true);
            } catch (e) {
              const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
              Alert.alert('Error', msg || 'No se pudo actualizar.');
            }
          },
        },
      ],
    );
  };

  const usuariosFiltrados = busqueda.trim()
    ? usuarios.filter(u =>
        `${u.nombre_completo} ${u.correo}`.toLowerCase().includes(busqueda.toLowerCase())
      )
    : usuarios;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>👥 Gestión de Usuarios</Text>
        <Text style={styles.headerSub}>{usuarios.length} usuarios registrados</Text>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuario…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      </LinearGradient>

      <FlatList
        data={usuariosFiltrados}
        keyExtractor={u => String(u.id_usuario)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsuarios(true); }} colors={['#1565C0']} />
        }
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const activo = item.estado_cuenta === 'ACTIVO';
          const partes = item.nombre_completo.split(' ');
          const initial = (String((partes[0] || '?')[0]) + String((partes[1] || '')[0])).toUpperCase();
          const rolColor = ROL_COLOR[item.rol] || '#6B7280';
          return (
            <View style={[styles.card, !activo && styles.cardInactive]}>
              <View style={[styles.avatar, { backgroundColor: rolColor + '25' }]}>
                <Text style={[styles.avatarText, { color: rolColor }]}>{initial}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.nombre_completo}</Text>
                <Text style={styles.userEmail}>{item.correo}</Text>
                <View style={styles.userMeta}>
                  <View style={[styles.rolBadge, { backgroundColor: rolColor + '20' }]}>
                    <Text style={[styles.rolText, { color: rolColor }]}>
                      {ROL_LABEL[item.rol] || item.rol}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: activo ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={[styles.estadoText, { color: activo ? '#065F46' : '#991B1B' }]}>
                      {activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
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
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Sin usuarios</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 12, height: 40,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardInactive: { opacity: 0.6 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  userEmail: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  userMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  rolBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  rolText: { fontSize: 11, fontWeight: '600' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  estadoText: { fontSize: 11, fontWeight: '600' },
  toggleBtn: { padding: 8 },
  toggleIcon: { fontSize: 22 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
});
