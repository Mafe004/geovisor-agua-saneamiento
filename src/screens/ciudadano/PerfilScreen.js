import React, { useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../../context/AuthContext';

const ROL_LABEL = { 1: 'Ciudadano', 2: 'Entidad', 3: 'Moderador', 4: 'Administrador' };
const ROL_ICON  = { 1: '👤', 2: '🏢', 3: '🛡️', 4: '👑' };

export default function PerfilScreen() {
  const { user, logout } = useContext(AuthContext);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: logout },
      ],
    );
  };

  if (!user) return null;

  const initial = ((user.nombre || '?')[0] + (user.apellido || '')[0]).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Hero */}
      <LinearGradient colors={['#0D47A1', '#1565C0', '#00ACC1']} style={styles.hero}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>
        <Text style={styles.name}>{user.nombre} {user.apellido}</Text>
        <View style={styles.rolRow}>
          <Text style={styles.rolIcon}>{ROL_ICON[user.id_rol]}</Text>
          <Text style={styles.rolLabel}>{ROL_LABEL[user.id_rol] || 'Usuario'}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Datos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de cuenta</Text>

          <InfoRow icon="✉️" label="Correo" value={user.correo} />
          <InfoRow icon="📱" label="Teléfono" value={user.telefono || 'No registrado'} />
          <InfoRow icon="📅" label="Registrado" value={user.fecha_creacion ? new Date(user.fecha_creacion).toLocaleDateString('es-CO') : '—'} />
          <InfoRow icon="🔘" label="Estado" value={user.activo ? 'Activo' : 'Inactivo'} valueColor={user.activo ? '#10B981' : '#EF4444'} />
        </View>

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre la app</Text>
          <InfoRow icon="💧" label="Aplicación" value="GeoVisor Agua y Saneamiento" />
          <InfoRow icon="🎓" label="Proyecto" value="Tesis de grado · 2025" />
          <InfoRow icon="📍" label="Municipio" value="Zipaquirá, Cundinamarca" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  hero: { paddingTop: 56, paddingBottom: 28, alignItems: 'center' },
  avatarWrap: { marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  rolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rolIcon: { fontSize: 16 },
  rolLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  scroll: { padding: 16, paddingBottom: 32 },
  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 4,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoIcon: { fontSize: 18, marginRight: 12, width: 24, textAlign: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  infoValue: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
});
