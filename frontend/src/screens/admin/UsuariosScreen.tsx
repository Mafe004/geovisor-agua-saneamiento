import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { usuariosAPI } from '../../api/services';
import type { UsuarioListItem } from '../../types/domain';

const ROL_COLOR: Record<number, string> = { 1: '#10B981', 2: '#3B82F6', 3: '#8B5CF6', 4: '#EF4444' };
const ROL_LABEL: Record<number, string> = { 1: 'Ciudadano', 2: 'Entidad', 3: 'Moderador', 4: 'Admin' };

// UsuarioListItem (lo que usuariosAPI.listar() realmente devuelve) no tiene
// ninguno de estos cuatro campos -- ver MIGRATION_FINDINGS.md. Los reales
// son nombre_completo (ya combinado), estado_cuenta (string de catálogo,
// no boolean) y rol (nombre de rol, no id numérico). Se preservan los
// accesos tal cual con este tipo local en vez de arreglarlos.
type UsuarioLegacy = UsuarioListItem & {
  activo?: boolean;
  id_rol?: number;
  nombre?: string;
  apellido?: string;
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

  const toggleEstado = (usuarioItem: UsuarioListItem) => {
    const usuario = usuarioItem as unknown as UsuarioLegacy;
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
              const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
              Alert.alert('Error', msg || 'No se pudo actualizar.');
            }
          },
        },
      ],
    );
  };

  const usuariosFiltrados = busqueda.trim()
    ? usuarios.filter(u => {
        // u.nombre/u.apellido no existen (ver UsuarioLegacy arriba) --
        // siempre undefined, así que en la práctica esto busca solo contra
        // "undefined undefined {correo}". Preservado tal cual.
        const uLegacy = u as unknown as UsuarioLegacy;
        return `${uLegacy.nombre} ${uLegacy.apellido} ${u.correo}`
          .toLowerCase()
          .includes(busqueda.toLowerCase());
      })
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
          // Todo este bloque lee campos que UsuarioListItem no tiene --
          // ver MIGRATION_FINDINGS.md para el detalle completo (activo,
          // id_rol, nombre, apellido). Efecto real: TODOS los usuarios se
          // muestran como "Inactivo" (item.activo siempre undefined), el
          // badge de rol siempre sale en blanco (ROL_LABEL[undefined]) con
          // un color de fondo inválido ("undefined25"/"undefined20"), y el
          // botón de toggle siempre muestra el ícono de "desbloquear".
          // nombre_completo SÍ es un campo real, así que ese fallback en
          // particular funciona -- no es parte del bug.
          const item2 = item as unknown as UsuarioLegacy;
          const nombreCompleto = item.nombre_completo || `${item2.nombre || ''} ${item2.apellido || ''}`.trim() || '?';
          const partes = nombreCompleto.split(' ');
          const initial = ((partes[0] || '?')[0] + (partes[1] || '')[0]).toUpperCase();
          return (
            <View style={[styles.card, !item2.activo && styles.cardInactive]}>
              <View style={[styles.avatar, { backgroundColor: ROL_COLOR[item2.id_rol as number] + '25' }]}>
                <Text style={[styles.avatarText, { color: ROL_COLOR[item2.id_rol as number] }]}>{initial}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.nombre_completo || `${item2.nombre || ''} ${item2.apellido || ''}`.trim()}</Text>
                <Text style={styles.userEmail}>{item.correo}</Text>
                <View style={styles.userMeta}>
                  <View style={[styles.rolBadge, { backgroundColor: ROL_COLOR[item2.id_rol as number] + '20' }]}>
                    <Text style={[styles.rolText, { color: ROL_COLOR[item2.id_rol as number] }]}>
                      {ROL_LABEL[item2.id_rol as number]}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: item2.activo ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={[styles.estadoText, { color: item2.activo ? '#065F46' : '#991B1B' }]}>
                      {item2.activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleEstado(item)}>
                <Text style={styles.toggleIcon}>{item2.activo ? '🔒' : '🔓'}</Text>
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
