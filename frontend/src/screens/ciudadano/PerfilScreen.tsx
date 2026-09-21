import React, { useContext, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { usuariosAPI, reportesAPI } from '../../api/services';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import SystemBanner from '../../components/ciudadano/SystemBanner';
import { getDrafts, type ReporteDraft } from '../../utils/offlineDrafts';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE, ANDI_MONO } from '../../theme/andi';
import type { UserPublic } from '../../types/domain';
import type { CiudadanoTabParamList, RootStackParamList } from '../../navigation/types';

// user (AuthContext) es UserPublic -- nunca trae `telefono`, `direccion` ni
// `ciudad` (mismo caso que screens/shared/PerfilScreen.tsx). Se preserva el
// acceso con este tipo local en vez de tocar el contrato de AuthContext.
type UserLegacy = UserPublic & { telefono?: string | null; direccion?: string | null; ciudad?: string | null };

const ROL_LABEL: Record<number, string> = { 1: 'Ciudadano', 2: 'Entidad', 3: 'Moderador', 4: 'Administrador' };

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<CiudadanoTabParamList, 'Perfil'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export default function PerfilScreen({ navigation }: Props) {
  const { user: userReal, logout, updateUser } = useContext(AuthContext);
  const user = userReal as UserLegacy | null;

  const [editMode, setEditMode] = useState(false);
  const [nombre, setNombre] = useState(user?.nombre_completo || '');
  const [telefono, setTelefono] = useState(user?.telefono || '');
  const [direccion, setDireccion] = useState(user?.direccion || '');
  const [ciudad, setCiudad] = useState(user?.ciudad || '');
  const [saving, setSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{ title: string; message: string } | null>(null);

  const [passModal, setPassModal] = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [logoutModal, setLogoutModal] = useState(false);

  const [stats, setStats] = useState({ total: 0, resueltos: 0, pendientes: 0 });
  const [drafts, setDrafts] = useState<ReporteDraft[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const res = await reportesAPI.listar();
      const reportes = res.data || [];
      setStats({
        total: reportes.length,
        resueltos: reportes.filter((r) => r.estado === 'RESUELTO').length,
        pendientes: reportes.filter((r) => r.estado === 'PENDIENTE').length,
      });
    } catch (_) {
      // ignorado a propósito: si falla, las tarjetas de stats simplemente
      // se quedan en 0 en vez de tumbar la pantalla de perfil.
    }
    setDrafts(await getDrafts());
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  useEffect(() => {
    if (!successBanner) return;
    const t = setTimeout(() => setSuccessBanner(null), 3500);
    return () => clearTimeout(t);
  }, [successBanner]);

  if (!user) return null;

  const nombreCompleto = user.nombre_completo || '';
  const partes = nombreCompleto.trim().split(' ');
  const initials = ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?';

  const handleSave = async () => {
    if (!nombre.trim()) { Alert.alert('Requerido', 'El nombre no puede estar vacío.'); return; }
    try {
      setSaving(true);
      await usuariosAPI.actualizarPerfil({
        nombre_completo: nombre.trim(),
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        ciudad: ciudad.trim() || null,
      });
      const actualizado: UserLegacy = {
        ...user,
        nombre_completo: nombre.trim(),
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        ciudad: ciudad.trim() || null,
      };
      updateUser(actualizado);
      setEditMode(false);
      setSuccessBanner({ title: 'Perfil actualizado', message: 'Tus datos fueron guardados correctamente.' });
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      Alert.alert('Error', msg || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNombre(user.nombre_completo || '');
    setTelefono(user.telefono || '');
    setDireccion(user.direccion || '');
    setCiudad(user.ciudad || '');
    setEditMode(false);
  };

  const handleChangePass = async () => {
    if (!passActual || !passNueva || !passConfirm) { Alert.alert('Requerido', 'Completa todos los campos.'); return; }
    if (passNueva.length < 6) { Alert.alert('Contraseña débil', 'La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (passNueva !== passConfirm) { Alert.alert('No coinciden', 'La nueva contraseña y su confirmación no son iguales.'); return; }
    try {
      setSavingPass(true);
      await usuariosAPI.cambiarPassword({ password_actual: passActual, password_nueva: passNueva });
      setPassModal(false);
      setPassActual(''); setPassNueva(''); setPassConfirm('');
      setSuccessBanner({ title: 'Contraseña actualizada', message: 'Tu contraseña fue cambiada correctamente.' });
    } catch (e) {
      const msg = (axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail)
        || 'No se pudo cambiar la contraseña.';
      Alert.alert('Error', msg);
    } finally {
      setSavingPass(false);
    }
  };

  const handleLogout = () => setLogoutModal(true);

  const confirmLogout = async () => {
    setLogoutModal(false);
    await logout();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <LiftHeader>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{user.nombre_completo || '—'}</Text>
              <Text style={styles.email}>{user.correo}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.rolPill}><Text style={styles.rolPillText}>{ROL_LABEL[user.id_rol] || 'Usuario'}</Text></View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {user.id_estado_cuenta === 1 ? '✓ Cuenta activa' : 'Cuenta inactiva'}
              </Text>
            </View>
          </View>
        </LiftHeader>

        <LiftSurface>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            <View style={styles.statsRow}>
              <StatBlock value={stats.total} label="Reportados" />
              <StatBlock value={stats.resueltos} label="Resueltos" />
              <StatBlock value={stats.pendientes} label="Pendientes" />
            </View>

            {!editMode && successBanner && (
              <SystemBanner
                tone="success"
                icon="✓"
                title={successBanner.title}
                message={successBanner.message}
              />
            )}

            {editMode ? (
              <View style={styles.editCard}>
                <Text style={styles.fieldLabel}>Nombre completo</Text>
                <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Tu nombre completo" placeholderTextColor={ANDI_COLORS.n400} />
                <Text style={styles.fieldLabel}>Teléfono (opcional)</Text>
                <TextInput style={styles.input} value={telefono || ''} onChangeText={setTelefono} placeholder="Ej: 3001234567" placeholderTextColor={ANDI_COLORS.n400} keyboardType="phone-pad" />
                <Text style={styles.fieldLabel}>Dirección (opcional)</Text>
                <TextInput style={styles.input} value={direccion || ''} onChangeText={setDireccion} placeholder="Ej: Calle 10 # 5-20" placeholderTextColor={ANDI_COLORS.n400} />
                <Text style={styles.fieldLabel}>Ciudad (opcional)</Text>
                <TextInput style={styles.input} value={ciudad || ''} onChangeText={setCiudad} placeholder="Ej: Zipaquirá" placeholderTextColor={ANDI_COLORS.n400} />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.editCancelBtn} onPress={handleCancelEdit}>
                    <Text style={styles.editCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.rowsCard}>
                <MenuRow icon="◍" label="Datos personales" onPress={() => setEditMode(true)} />
                <MenuRow icon="⚿" label="Cambiar contraseña" onPress={() => setPassModal(true)} />
                <MenuRow icon="◔" label="Avisos y seguimiento" value="Activos" onPress={() => navigation.navigate('Notificaciones')} last />
              </View>
            )}

            {drafts.length > 0 && (
              <View style={styles.pendingCard}>
                <View style={styles.pendingIcon}><Text style={{ fontSize: 16, color: ANDI_COLORS.onSurfaceVariant }}>✎</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>Borradores sin enviar</Text>
                  <Text style={styles.pendingMeta}>{drafts.length} borrador{drafts.length === 1 ? '' : 'es'} guardado{drafts.length === 1 ? '' : 's'}</Text>
                </View>
                <TouchableOpacity style={styles.pendingBtn} onPress={() => navigation.navigate('Reportes')}>
                  <Text style={styles.pendingBtnText}>Ver</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Andi · GeoVisor Zipaquirá · v1.0.0</Text>
          </ScrollView>
        </LiftSurface>
      </View>

      <Modal visible={passModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cambiar contraseña</Text>
                <TouchableOpacity onPress={() => { setPassModal(false); setPassActual(''); setPassNueva(''); setPassConfirm(''); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Contraseña actual</Text>
              <View style={styles.passWrap}>
                <TextInput style={styles.passInput} value={passActual} onChangeText={setPassActual} secureTextEntry={!showActual} placeholder="••••••••" placeholderTextColor={ANDI_COLORS.n400} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowActual((p) => !p)} style={styles.eyeBtn}><Text>{showActual ? '🙈' : '👁️'}</Text></TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Nueva contraseña</Text>
              <View style={styles.passWrap}>
                <TextInput style={styles.passInput} value={passNueva} onChangeText={setPassNueva} secureTextEntry={!showNueva} placeholder="Mínimo 6 caracteres" placeholderTextColor={ANDI_COLORS.n400} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowNueva((p) => !p)} style={styles.eyeBtn}><Text>{showNueva ? '🙈' : '👁️'}</Text></TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirmar nueva contraseña</Text>
              <TextInput
                style={[styles.input, !!passConfirm && passNueva !== passConfirm && styles.inputError]}
                value={passConfirm}
                onChangeText={setPassConfirm}
                secureTextEntry
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={ANDI_COLORS.n400}
                autoCapitalize="none"
              />
              {!!passConfirm && passNueva !== passConfirm && <Text style={styles.errorText}>Las contraseñas no coinciden</Text>}

              <TouchableOpacity style={[styles.saveBtn, { marginTop: ANDI_SPACING.s5 }, savingPass && styles.disabled]} onPress={handleChangePass} disabled={savingPass}>
                {savingPass ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Cambiar contraseña</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={logoutModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cerrar sesión</Text>
              <TouchableOpacity onPress={() => setLogoutModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalMessage}>¿Seguro que quieres salir de tu cuenta?</Text>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setLogoutModal(false)}>
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, styles.logoutConfirmBtn]} onPress={confirmLogout}>
                <Text style={styles.saveBtnText}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, value, onPress, last }: { icon: string; label: string; value?: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[styles.menuRow, !last && styles.menuRowBorder]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      {!!value && <Text style={styles.menuValue}>{value}</Text>}
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s4 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, flexShrink: 0,
    backgroundColor: ANDI_COLORS.primary600, borderWidth: 2, borderColor: ANDI_COLORS.primary300,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...ANDI_TYPE.display, fontSize: 24, color: '#fff' },
  identityText: { flex: 1 },
  name: { ...ANDI_TYPE.screen, color: '#fff' },
  email: { fontFamily: ANDI_MONO, fontSize: 12, color: ANDI_COLORS.primary200, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  rolPill: { paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary700 },
  rolPillText: { color: ANDI_COLORS.primary100, fontSize: 12, fontWeight: '600' },
  statusPill: { paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 4, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.primary600 },
  statusPillText: { color: ANDI_COLORS.primary100, fontSize: 12, fontWeight: '600' },

  scroll: { padding: ANDI_SPACING.s5, paddingBottom: ANDI_SPACING.s10, gap: ANDI_SPACING.s4 },

  statsRow: { flexDirection: 'row', gap: ANDI_SPACING.s2 },
  statBlock: { flex: 1, backgroundColor: ANDI_COLORS.surfaceMid, borderRadius: ANDI_RADIUS.lg, padding: ANDI_SPACING.s3 },
  statValue: { ...ANDI_TYPE.display, fontSize: 22, color: ANDI_COLORS.onSurface },
  statLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },

  rowsCard: { borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.xl, overflow: 'hidden' },
  menuRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3, paddingHorizontal: ANDI_SPACING.s4 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: ANDI_COLORS.outlineVariant },
  menuIcon: { fontSize: 17, color: ANDI_COLORS.primary600, width: 20, textAlign: 'center' },
  menuLabel: { flex: 1, ...ANDI_TYPE.label, color: ANDI_COLORS.onSurface },
  menuValue: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant },
  menuChevron: { color: ANDI_COLORS.onSurfaceVariant, fontSize: 16 },

  editCard: { borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4 },
  fieldLabel: { ...ANDI_TYPE.label, fontSize: 12, color: ANDI_COLORS.onSurfaceVariant, marginBottom: 6, marginTop: ANDI_SPACING.s3 },
  input: {
    borderWidth: 1.5, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.md,
    backgroundColor: ANDI_COLORS.surfaceMid, paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 12,
    fontSize: 14, color: ANDI_COLORS.onSurface,
  },
  inputError: { borderColor: ANDI_COLORS.error },
  errorText: { color: ANDI_COLORS.error, fontSize: 11, marginTop: 4 },
  editActions: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  editCancelBtn: { flex: 1, minHeight: 48, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  editCancelText: { color: ANDI_COLORS.onSurface, fontWeight: '600' },
  saveBtn: { flex: 1, minHeight: 48, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },

  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3, backgroundColor: ANDI_COLORS.surfaceMid, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4 },
  pendingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: ANDI_COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { ...ANDI_TYPE.label, color: ANDI_COLORS.onSurface },
  pendingMeta: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },
  pendingBtn: { minHeight: 40, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center', backgroundColor: ANDI_COLORS.surface },
  pendingBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 12 },

  logoutBtn: { minHeight: 52, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.error, backgroundColor: ANDI_COLORS.errorContainer, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: ANDI_COLORS.onErrorContainer, fontWeight: '700', fontSize: 14 },

  version: { textAlign: 'center', color: ANDI_COLORS.onSurfaceVariant, fontSize: 11 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: ANDI_COLORS.surface, borderTopLeftRadius: ANDI_RADIUS.xxl, borderTopRightRadius: ANDI_RADIUS.xxl, padding: ANDI_SPACING.s6, paddingBottom: ANDI_SPACING.s10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...ANDI_TYPE.section, color: ANDI_COLORS.onSurface },
  modalClose: { fontSize: 20, color: ANDI_COLORS.onSurfaceVariant, padding: 4 },
  modalMessage: { ...ANDI_TYPE.body, color: ANDI_COLORS.onSurfaceVariant, marginTop: ANDI_SPACING.s2 },
  logoutConfirmBtn: { backgroundColor: ANDI_COLORS.error },
  passWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.md, backgroundColor: ANDI_COLORS.surfaceMid, paddingRight: 8 },
  passInput: { flex: 1, paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 12, fontSize: 14, color: ANDI_COLORS.onSurface },
  eyeBtn: { padding: 6 },
});
