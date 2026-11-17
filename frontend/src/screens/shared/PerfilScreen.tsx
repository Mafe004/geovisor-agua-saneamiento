import React, { useContext, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { usuariosAPI, invitacionesAPI } from '../../api/services';
import type { UserPublic } from '../../types/domain';
import { Rol } from '../../types/models';
import { useResponsive, useScaledType } from '../../theme/responsive';
import { useToast } from '../../components/andi/Toast';
import InvitacionTokenModal from '../../components/andi/InvitacionTokenModal';
import { andiColors, andiType as andiTypeBase, andiRadius, andiSpace } from '../../theme/andi';

// user (AuthContext) es UserPublic -- nunca trae `telefono` (ver
// MIGRATION_FINDINGS.md). Se preserva el acceso con este tipo local en vez
// de arreglarlo.
type UserLegacy = UserPublic & { telefono?: string | null };

// Pantalla compartida por Entidad y Moderador (ver AppNavigator.tsx) --
// Ciudadano y Admin tienen cada uno su propia PerfilScreen ya en Andi.
const ROL_LABEL: Record<number, string> = { 1: 'Ciudadano', 2: 'Entidad', 3: 'Moderador', 4: 'Administrador' };

function initials(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

// Pantalla compartida: Moderador la usa como tab ("Perfil" en ModeradorTabs)
// y Entidad la usa empujada en el stack raíz ("EntidadPerfil", abierta
// desde la bolita de avatar del header -- ver AppNavigator.tsx). Tipado
// estructural mínimo (no el ParamList exacto de ninguno de los dos) porque
// React Navigation igual inyecta `navigation` con estos métodos sin
// importar si el screen es un tab o un stack -- solo cambia lo que
// devuelven: canGoBack() da false en un tab (sin historial propio), por
// eso el botón de volver de abajo no se muestra en el caso de Moderador.
interface Props {
  navigation: { canGoBack: () => boolean; goBack: () => void };
}

export default function PerfilScreen({ navigation }: Props) {
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const andiType = useScaledType(andiTypeBase);
  const styles = useMemo(() => makeStyles(andiType), [andiType]);
  const toast = useToast();
  const { user: userReal, logout, updateUser } = useContext(AuthContext);
  const user = userReal as UserLegacy | null;

  // ── Editar datos personales ──
  const [datosModalVisible, setDatosModalVisible] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [telefonoEdit, setTelefonoEdit] = useState('');
  const [savingDatos, setSavingDatos] = useState(false);

  // ── Cambiar contraseña ──
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  // ── Invitar a un compañero (solo ENTIDAD, de su propia entidad) ──
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);

  if (!user) return null;

  const handleInvitar = async () => {
    if (!user.id_entidad) return;
    try {
      setInvitando(true);
      const res = await invitacionesAPI.crear({ id_rol: Rol.ENTIDAD, id_entidad: user.id_entidad });
      setInviteToken(res.data.token);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo generar el código de invitación.');
    } finally {
      setInvitando(false);
    }
  };

  const abrirDatosModal = () => {
    setNombreEdit(user.nombre_completo || '');
    setTelefonoEdit(user.telefono || '');
    setDatosModalVisible(true);
  };

  const cerrarPassModal = () => {
    setPassModalVisible(false);
    setPassActual(''); setPassNueva(''); setPassConfirm('');
  };

  const handleGuardarDatos = async () => {
    if (!nombreEdit.trim()) { toast.warning('Requerido', 'El nombre no puede estar vacío.'); return; }
    try {
      setSavingDatos(true);
      await usuariosAPI.actualizarPerfil({
        nombre_completo: nombreEdit.trim(),
        telefono: telefonoEdit.trim() || null,
      });
      // updateUser espera UserPublic (AuthContextValue) -- telefono no es
      // un campo real ahí (ver UserLegacy arriba). Se arma el objeto con
      // ese tipo ampliado localmente para no tocar el contrato de
      // AuthContext ni el valor que efectivamente se guarda en memoria.
      const actualizado: UserLegacy = { ...user, nombre_completo: nombreEdit.trim(), telefono: telefonoEdit.trim() || null };
      updateUser(actualizado);
      setDatosModalVisible(false);
      toast.success('Actualizado', 'Tu perfil fue guardado correctamente.');
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo actualizar el perfil.');
    } finally {
      setSavingDatos(false);
    }
  };

  const handleChangePass = async () => {
    if (!passActual || !passNueva || !passConfirm) {
      toast.warning('Requerido', 'Completa todos los campos.');
      return;
    }
    if (passNueva.length < 6) {
      toast.warning('Contraseña débil', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (passNueva !== passConfirm) {
      toast.warning('No coinciden', 'La nueva contraseña y su confirmación no son iguales.');
      return;
    }
    try {
      setSavingPass(true);
      await usuariosAPI.cambiarPassword({ password_actual: passActual, password_nueva: passNueva });
      cerrarPassModal();
      toast.success('Contraseña cambiada', 'Tu contraseña fue actualizada correctamente.');
    } catch (e) {
      const msg = (axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail)
        || 'No se pudo cambiar la contraseña.';
      toast.error('Error', msg);
    } finally {
      setSavingPass(false);
    }
  };

  const handleLogout = async () => {
    setLogoutConfirmVisible(false);
    await logout();
    // AppNavigator cambia a la pila de Login solo cuando user pasa a null
    // (ver AuthContext) -- no hace falta navegar manualmente acá.
    toast.success('Sesión cerrada', 'Vuelve cuando quieras.');
  };

  const passMismatch = passConfirm.length > 0 && passNueva !== passConfirm;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['#042F34', '#0A6F78']} style={[styles.header, { paddingTop: insets.top + andiSpace[6] }]}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Volver"
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={22} color={andiColors.surface} />
            </TouchableOpacity>
          )}
          <View style={styles.heroCenter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.nombre_completo || '?')}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>{user.nombre_completo || '—'}</Text>
            <Text style={styles.roleLabel}>{(ROL_LABEL[user.id_rol] || 'Usuario').toUpperCase()}</Text>
          </View>
        </LinearGradient>

        <View style={[styles.body, { width: '100%', maxWidth: r.maxContentWidth(600), alignSelf: 'center' }]}>
          <View style={styles.sectionList}>
            <TouchableOpacity accessibilityRole="button" style={styles.sectionRow} activeOpacity={0.8} onPress={abrirDatosModal}>
              <Feather name="user" size={18} color={andiColors.onSurface} />
              <Text style={styles.sectionRowLabel}>Datos personales</Text>
              <View style={{ flex: 1 }} />
              <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button" style={styles.sectionRow} activeOpacity={0.8} onPress={() => setPassModalVisible(true)}>
              <Feather name="lock" size={18} color={andiColors.onSurface} />
              <Text style={styles.sectionRowLabel}>Cambiar contraseña</Text>
              <View style={{ flex: 1 }} />
              <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>

            {user.id_rol === Rol.ENTIDAD && (
              <TouchableOpacity accessibilityRole="button" style={styles.sectionRow} activeOpacity={0.8} onPress={handleInvitar} disabled={invitando}>
                <Feather name="user-plus" size={18} color={andiColors.onSurface} />
                <Text style={styles.sectionRowLabel}>Invitar a un compañero</Text>
                <View style={{ flex: 1 }} />
                {invitando
                  ? <ActivityIndicator size="small" color={andiColors.primary600} />
                  : <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />}
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.groupLabel}>Información de cuenta</Text>
          <View style={styles.sectionList}>
            <InfoRow styles={styles} icon="mail" label="Correo" value={user.correo} />
            <InfoRow styles={styles} icon="phone" label="Teléfono" value={user.telefono || 'No registrado'} />
            <InfoRow
              styles={styles}
              icon="check-circle"
              label="Estado"
              value={user.id_estado_cuenta === 1 ? 'Activo' : 'Inactivo'}
              valueColor={user.id_estado_cuenta === 1 ? andiColors.success : andiColors.error}
            />
          </View>

          <Text style={styles.groupLabel}>Sobre la app</Text>
          <View style={styles.sectionList}>
            <InfoRow styles={styles} icon="droplet" label="Aplicación" value="GeoVisor Agua y Saneamiento" />
            <InfoRow styles={styles} icon="map-pin" label="Municipio" value="Zipaquirá, Cundinamarca" />
          </View>

          <TouchableOpacity accessibilityRole="button" style={styles.logoutBtn} activeOpacity={0.85} onPress={() => setLogoutConfirmVisible(true)}>
            <Feather name="log-out" size={18} color={andiColors.error600} />
            <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
          </TouchableOpacity>

          <Text style={styles.version}>v1.0.0 · GeoVisor 2025</Text>
        </View>
      </ScrollView>

      {/* ── Confirmar cierre de sesión ── */}
      <Modal visible={logoutConfirmVisible} transparent animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { width: '100%', maxWidth: r.maxContentWidth(480), alignSelf: 'center' }]}>
            <Text style={styles.modalTitle}>¿Cerrar sesión?</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity accessibilityRole="button" style={styles.modalCancelBtn} onPress={() => setLogoutConfirmVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.modalSalirBtn} onPress={handleLogout}>
                <Text style={styles.modalSalirBtnText}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Datos personales ── */}
      <Modal visible={datosModalVisible} animationType="slide" transparent onRequestClose={() => setDatosModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: r.maxContentWidth(560), alignSelf: 'center' }}
          >
            <View style={styles.sheetCard}>
              <View style={styles.sheetHeader}>
                <Text style={styles.modalTitle}>Datos personales</Text>
                <TouchableOpacity onPress={() => setDatosModalVisible(false)} accessibilityLabel="Cerrar" accessibilityRole="button" hitSlop={8}>
                  <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={nombreEdit}
                onChangeText={setNombreEdit}
                placeholder="Tu nombre completo"
                placeholderTextColor={andiColors.n400}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Teléfono (opcional)</Text>
              <TextInput
                style={styles.input}
                value={telefonoEdit}
                onChangeText={setTelefonoEdit}
                placeholder="Ej: 3001234567"
                placeholderTextColor={andiColors.n400}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.sheetPrimaryBtn, { marginTop: andiSpace[5] }]}
                onPress={handleGuardarDatos}
                disabled={savingDatos}
                accessibilityRole="button"
                accessibilityLabel="Guardar datos personales"
              >
                {savingDatos
                  ? <ActivityIndicator size="small" color={andiColors.surface} />
                  : <Text style={styles.sheetPrimaryBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Cambiar contraseña ── */}
      <Modal visible={passModalVisible} animationType="slide" transparent onRequestClose={cerrarPassModal}>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: r.maxContentWidth(560), alignSelf: 'center' }}
          >
            <View style={styles.sheetCard}>
              <View style={styles.sheetHeader}>
                <Text style={styles.modalTitle}>Cambiar contraseña</Text>
                <TouchableOpacity onPress={cerrarPassModal} accessibilityLabel="Cerrar" accessibilityRole="button" hitSlop={8}>
                  <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
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
                  placeholderTextColor={andiColors.n400}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowActual(p => !p)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showActual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
                  hitSlop={8}
                >
                  <Feather name={showActual ? 'eye-off' : 'eye'} size={18} color={andiColors.onSurfaceVariant} />
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
                  placeholderTextColor={andiColors.n400}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowNueva(p => !p)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showNueva ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                  hitSlop={8}
                >
                  <Feather name={showNueva ? 'eye-off' : 'eye'} size={18} color={andiColors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirmar nueva contraseña</Text>
              <TextInput
                style={[styles.input, passMismatch && styles.inputError]}
                value={passConfirm}
                onChangeText={setPassConfirm}
                secureTextEntry
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={andiColors.n400}
                autoCapitalize="none"
              />
              {passMismatch && (
                <Text style={styles.errorText}>Las contraseñas no coinciden</Text>
              )}

              <TouchableOpacity
                style={[styles.sheetPrimaryBtn, { marginTop: andiSpace[5] }]}
                onPress={handleChangePass}
                disabled={savingPass}
                accessibilityRole="button"
                accessibilityLabel="Cambiar contraseña"
              >
                {savingPass
                  ? <ActivityIndicator size="small" color={andiColors.surface} />
                  : <Text style={styles.sheetPrimaryBtnText}>Cambiar contraseña</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <InvitacionTokenModal
        visible={!!inviteToken}
        onClose={() => setInviteToken(null)}
        token={inviteToken}
        mensaje="Tu nuevo compañero lo usa al registrarse para unirse a tu entidad con rol Entidad."
      />
    </View>
  );
}

/* ── Subcomponentes ── */

type PerfilStyles = ReturnType<typeof makeStyles>;

/** Fila de solo lectura -- sin chevron ni TouchableOpacity: no es tappable,
 * así que tampoco debe parecerlo (Ley 3). */
function InfoRow({
  icon, label, value, valueColor, styles,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  styles: PerfilStyles;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={18} color={andiColors.onSurfaceVariant} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}

/* ── Estilos ── */
const makeStyles = (andiType: typeof andiTypeBase) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.surfaceMid },
  scroll: { flexGrow: 1 },
  header: { paddingHorizontal: andiSpace[4], paddingBottom: andiSpace[6] },
  backBtn: { alignSelf: 'flex-start', padding: andiSpace[1], marginBottom: andiSpace[1] },
  heroCenter: { alignItems: 'center' },
  avatar: {
    width: 72, height: 72, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary400, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { ...andiType.headingLg, color: andiColors.surface },
  name: { ...andiType.headingMd, color: andiColors.surface, marginTop: andiSpace[3], textAlign: 'center' },
  roleLabel: { ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 1.5, color: andiColors.primary200, marginTop: 2 },

  body: { padding: andiSpace[4] },

  groupLabel: {
    ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 0.6,
    color: andiColors.onSurfaceVariant, marginTop: andiSpace[6], marginBottom: andiSpace[2],
  },

  sectionList: { gap: andiSpace[2] },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    backgroundColor: andiColors.surface, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[3],
  },
  sectionRowLabel: { ...andiType.bodyLg, color: andiColors.onSurface },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    backgroundColor: andiColors.surface, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[3],
  },
  infoLabel: { ...andiType.caption, color: andiColors.onSurfaceVariant },
  infoValue: { ...andiType.bodyLg, color: andiColors.onSurface, marginTop: 1 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: andiSpace[2],
    marginTop: andiSpace[8], height: 52, borderRadius: andiRadius.full,
    borderWidth: 1.5, borderColor: andiColors.error400,
  },
  logoutBtnText: { ...andiType.label, color: andiColors.error600 },

  version: { ...andiType.caption, color: andiColors.onSurfaceVariant, textAlign: 'center', marginTop: andiSpace[5] },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'center', padding: andiSpace[6] },
  modalCard: { backgroundColor: andiColors.surface, borderRadius: andiRadius.lg, padding: andiSpace[5] },
  modalTitle: { ...andiType.headingMd, color: andiColors.onSurface },
  modalBtnRow: { flexDirection: 'row', gap: andiSpace[3], marginTop: andiSpace[5] },
  modalCancelBtn: {
    flex: 1, height: 44, borderRadius: andiRadius.full, borderWidth: 1.5, borderColor: andiColors.outline,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelBtnText: { ...andiType.label, color: andiColors.onSurface },
  modalSalirBtn: { flex: 1, height: 44, borderRadius: andiRadius.full, backgroundColor: andiColors.error600, justifyContent: 'center', alignItems: 'center' },
  modalSalirBtnText: { ...andiType.label, color: andiColors.surface },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: andiColors.surface, borderTopLeftRadius: andiRadius.xl, borderTopRightRadius: andiRadius.xl,
    padding: andiSpace[5], paddingBottom: andiSpace[8],
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: andiSpace[4] },
  fieldLabel: { ...andiType.labelSm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3], marginBottom: andiSpace[1] },
  input: {
    minHeight: 48, borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[3], fontSize: 16, color: andiColors.onSurface,
  },
  inputError: { borderColor: andiColors.error },
  errorText: { ...andiType.caption, color: andiColors.error, marginTop: andiSpace[1] },

  passWrap: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48,
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    paddingRight: andiSpace[2],
  },
  passInput: { flex: 1, minHeight: 48, paddingHorizontal: andiSpace[3], fontSize: 16, color: andiColors.onSurface },
  eyeBtn: { padding: andiSpace[2] },

  sheetPrimaryBtn: {
    minHeight: 48, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetPrimaryBtnText: { ...andiType.label, color: andiColors.surface },
});
