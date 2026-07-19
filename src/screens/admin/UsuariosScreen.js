import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usuariosAPI } from '../../api/services';

const ROL_COLOR = { 1: '#10B981', 2: '#3B82F6', 3: '#8B5CF6', 4: '#EF4444' };
const ROL_LABEL = { 1: 'Ciudadano', 2: 'Entidad', 3: 'Moderador', 4: 'Admin' };

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
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

  const toggleEstado = (usuario) => {
    Alert.alert(
      usuario.activo ? 'Desactivar usuario' : 'Activar usuario',
      `¿Confirmas ${usuario.activo ? 'desactivar' : 'activar'} la cuenta de ${usuario.nombre} ${usuario.apellido}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await usuariosAPI.toggleEstado(usuario.id_usuario);
              loadUsuarios(true);
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.detail || 'No se pudo actualizar.');
            }
          },
        },
      ],
    );
  };

  const usuariosFiltrados = busqueda.trim()
    ? usuarios.filter(u =>
        `${u.nombre} ${u.apellido} ${u.correo}`.toLowerCase().includes(busqueda.toLowerCase())
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
          const nombreCompleto = item.nombre_completo || `${item.nombre || ''} ${item.apellido || ''}`.trim() || '?';
          const partes = nombreCompleto.split(' ');
          const initial = ((partes[0] || '?')[0] + (partes[1] || '')[0]).toUpperCase();
          return (
            <View style={[styles.card, !item.activo && styles.cardInactive]}>
              <View style={[styles.avatar, { backgroundColor: ROL_COLOR[item.id_rol] + '25' }]}>
                <Text style={[styles.avatarText, { color: ROL_COLOR[item.id_rol] }]}>{initial}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.nombre_completo || `${item.nombre || ''} ${item.apellido || ''}`.trim()}</Text>
                <Text style={styles.userEmail}>{item.correo}</Text>
                <View style={styles.userMeta}>
                  <View style={[styles.rolBadge, { backgroundColor: ROL_COLOR[item.id_rol] + '20' }]}>
                    <Text style={[styles.rolText, { color: ROL_COLOR[item.id_rol] }]}>
                      {ROL_LABEL[item.id_rol]}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: item.activo ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={[styles.estadoText, { color: item.activo ? '#065F46' : '#991B1B' }]}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleEstado(item)}>
                <Text style={styles.toggleIcon}>{item.activo ? '🔒' : '🔓'}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Sin usuarios</Text>
            </View>
          )
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
