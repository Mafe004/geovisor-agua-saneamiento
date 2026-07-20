import React, { useContext, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../../context/AuthContext';
import { usuariosAPI } from '../../api/services';

const ROL_LABEL = { 1: 'Ciudadano', 2: 'Entidad', 3: 'Moderador', 4: 'Administrador' };
const ROL_COLOR = {
  1: ['#1565C0', '#00ACC1'],
  2: ['#0E7490', '#06B6D4'],
  3: ['#7C3AED', '#A78BFA'],
  4: ['#B45309', '#F59E0B'],
};

export default function PerfilScreen() {
  const { user, logout, updateUser } = useContext(AuthContext);

  // ── Editar datos ──
  const [editMode, setEditMode]     = useState(false);
  const [nombre, setNombre]         = useState(user?.nombre_completo || '');
  const [telefono, setTelefono]     = useState(user?.telefono || '');
  const [saving, setSaving]         = useState(false);

  // ── Cambiar contraseña ──
  const [passModal, setPassModal]   = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva]   = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva]   = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  if (!user) return null;

  const nombreCompleto = user.nombre_completo || '';
  const partes   = nombreCompleto.trim().split(' ');
  const initials = ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?';
  const gradColors = ROL_COLOR[user.id_rol] || ROL_COLOR[1];

  // ── Guardar datos de perfil ──
  const handleSave = async () => {
    if (!nombre.trim()) {
      Alert.alert('Requerido', 'El nombre no puede estar vacío.');
      return;
    }
    try {
      setSaving(true);
      const res = await usuariosAPI.actualizarPerfil({
        nombre_completo: nombre.trim(),
        telefono: telefono.trim() || null,
      });
      updateUser({ ...user, nombre_completo: nombre.trim(), telefono: telefono.trim() || null });
      setEditMode(false);
      Alert.alert('✅ Actualizado', 'Tu perfil fue guardado correctamente.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNombre(user.nombre_completo || '');
    setTelefono(user.telefono || '');
    setEditMode(false);
  };

  // ── Cambiar contraseña ──
  const handleChangePass = async () => {
    if (!passActual || !passNueva || !passConfirm) {
      Alert.alert('Requerido', 'Completa todos los campos.');
      return;
    }
    if (passNueva.length < 6) {
      Alert.alert('Contraseña débil', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (passNueva !== passConfirm) {
      Alert.alert('No coinciden', 'La nueva contraseña y su confirmación no son iguales.');
      return;
    }
    try {
      setSavingPass(true);
      await usuariosAPI.cambiarPassword({
        password_actual: passActual,
        password_nueva:  passNueva,
      });
      setPassModal(false);
      setPassActual(''); setPassNueva(''); setPassConfirm('');
      Alert.alert('✅ Contraseña cambiada', 'Tu contraseña fue actualizada correctamente.');
    } catch (e) {
      const msg = e?.response?.data?.detail || 'No se pudo cambiar la contraseña.';
      Alert.alert('Error', msg);
    } finally {
      setSavingPass(false);
    }
  };

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO ── */}
        <LinearGradient colors={gradColors} style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{user.nombre_completo || '—'}</Text>
          <View style={styles.rolPill}>
            <Text style={styles.rolPillText}>{ROL_LABEL[user.id_rol] || 'Usuario'}</Text>
          </View>
          <Text style={styles.heroEmail}>{user.correo}</Text>
        </LinearGradient>

        {/* ── ACCIONES RÁPIDAS ── */}
        <View style={styles.quickRow}>
          <QuickAction
            icon="✏️"
            label={editMode ? 'Cancelar' : 'Editar perfil'}
            color={editMode ? '#6B7280' : '#1565C0'}
            onPress={editMode ? handleCancelEdit : () => setEditMode(true)}
          />
          <QuickAction
            icon="🔑"
            label="Contraseña"
            color="#7C3AED"
            onPress={() => setPassModal(true)}
          />
          <QuickAction
            icon="🚪"
            label="Salir"
            color="#DC2626"
            onPress={handleLogout}
          />
        </View>

        {/* ── EDITAR DATOS ── */}
        {editMode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✏️ Editar información</Text>

            <Text style={styles.fieldLabel}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Tu nombre completo"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.fieldLabel}>Teléfono (opcional)</Text>
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Ej: 3001234567"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.saveBtnGrad}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Guardar cambios</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── INFO DE CUENTA ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Información de cuenta</Text>
          <InfoRow icon="✉️" label="Correo" value={user.correo} />
          <InfoRow icon="📱" label="Teléfono" value={user.telefono || 'No registrado'} />
          <InfoRow icon="🎭" label="Rol" value={ROL_LABEL[user.id_rol] || '—'} />
          <InfoRow
            icon="🟢"
            label="Estado"
            value={user.id_estado_cuenta === 1 ? 'Activo' : 'Inactivo'}
            valueColor={user.id_estado_cuenta === 1 ? '#10B981' : '#EF4444'}
          />
        </View>

        {/* ── APP INFO ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💧 Sobre la app</Text>
          <InfoRow icon="🏗️" label="Aplicación" value="GeoVisor Agua y Saneamiento" />
          <InfoRow icon="🎓" label="Proyecto" value="Tesis de grado · 2025" />
          <InfoRow icon="📍" label="Municipio" value="Zipaquirá, Cundinamarca" />
        </View>

        {/* ── CERRAR SESIÓN ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <View style={styles.logoutInner}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.version}>v1.0.0 · GeoVisor 2025</Text>
      </ScrollView>

      {/* ── MODAL CAMBIAR CONTRASEÑA ── */}
      <Modal visible={passModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🔑 Cambiar contraseña</Text>
                <TouchableOpacity onPress={() => { setPassModal(false); setPassActual(''); setPassNueva(''); setPassConfirm(''); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Contraseña actual</Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={styles.passInput}
                  value={passActual}
                  onChangeText={setPassActual}
                  secureTextEntry={!showActual}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowActual(p => !p)} style={styles.eyeBtn}>
                  <Text>{showActual ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Nueva contraseña</Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={styles.passInput}
                  value={passNueva}
                  onChangeText={setPassNueva}
                  secureTextEntry={!showNueva}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNueva(p => !p)} style={styles.eyeBtn}>
                  <Text>{showNueva ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirmar nueva contraseña</Text>
              <TextInput
                style={[styles.input, passConfirm && passNueva !== passConfirm && styles.inputError]}
                value={passConfirm}
                onChangeText={setPassConfirm}
                secureTextEntry
                placeholder="Repite la nueva contraseña"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
              {passConfirm && passNueva !== passConfirm && (
                <Text style={styles.errorText}>Las contraseñas no coinciden</Text>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 20 }, savingPass && { opacity: 0.6 }]}
                onPress={handleChangePass}
                disabled={savingPass}
              >
                <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.saveBtnGrad}>
                  {savingPass
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>Cambiar contraseña</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ── Subcomponentes ── */

function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.quickIconWrap, { backgroundColor: color + '18' }]}>
        <Text style={styles.quickIcon}>{icon}</Text>
      </View>
      <Text style={[styles.quickLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
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

/* ── Estilos ── */
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F0F4F8' },
  scroll:      { paddingBottom: 40 },

  // Hero
  hero: {
    paddingTop: 56, paddingBottom: 32,
    alignItems: 'center', paddingHorizontal: 24,
  },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:  { color: '#fff', fontSize: 32, fontWeight: '800' },
  heroName:    { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  rolPill: {
    marginTop: 8, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  rolPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  heroEmail:   { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  // Acciones rápidas
  quickRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#fff', marginHorizontal: 16,
    marginTop: -20, borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 8,
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12,
  },
  quickAction: { alignItems: 'center', flex: 1 },
  quickIconWrap: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  quickIcon:   { fontSize: 22 },
  quickLabel:  { fontSize: 11, fontWeight: '700' },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    marginHorizontal: 16, marginTop: 16,
    paddingBottom: 8,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  infoIcon:    { fontSize: 18, width: 28, textAlign: 'center', marginRight: 10 },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 11, color: '#9CA3AF', marginBottom: 2, fontWeight: '500' },
  infoValue:   { fontSize: 14, color: '#1F2937', fontWeight: '600' },

  // Editar campos
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#374151',
    marginBottom: 6, marginTop: 14,
    paddingHorizontal: 16,
  },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: '#1F2937',
    marginHorizontal: 16,
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorText:  { color: '#EF4444', fontSize: 11, marginTop: 4, paddingHorizontal: 16 },

  // Pass wrap
  passWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', marginHorizontal: 16,
    paddingRight: 8,
  },
  passInput:  { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937' },
  eyeBtn:     { padding: 6 },

  // Botón guardar
  saveBtn:     { marginHorizontal: 16, marginTop: 16, borderRadius: 14, overflow: 'hidden' },
  saveBtnGrad: { height: 50, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Logout
  logoutBtn: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#FEF2F2', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  logoutInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  logoutIcon:  { fontSize: 20 },
  logoutText:  { color: '#DC2626', fontSize: 15, fontWeight: '700' },

  version: {
    textAlign: 'center', color: '#9CA3AF',
    fontSize: 11, marginTop: 24, marginBottom: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: 24,
    paddingBottom: 36, width: '100%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  modalClose:  { fontSize: 20, color: '#9CA3AF', padding: 4 },
});
