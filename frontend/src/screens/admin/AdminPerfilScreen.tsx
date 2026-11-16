import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usuariosAPI, auditoriaAPI } from '../../api/services';
import type { RootStackParamList } from '../../navigation/types';
import type { UserPublic } from '../../types/domain';
import { useToast } from '../../components/andi/Toast';
import { andiColors, andiType as andiTypeBase, andiRadius, andiElevation, andiSpace } from '../../theme/andi';
import { useResponsive, useScaledType } from '../../theme/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPerfil'>;

// UserPublic (AuthContextValue) nunca trae `telefono` -- mismo caso que
// UserLegacy en shared/PerfilScreen.tsx y ciudadano/PerfilScreen.tsx.
type UserLegacy = UserPublic & { telefono?: string | null };

function initials(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

export default function AdminPerfilScreen({ navigation }: Props) {
  const r = useResponsive();
  const andiType = useScaledType(andiTypeBase);
  const styles = useMemo(() => makeStyles(andiType), [andiType]);
  const toast = useToast();
  const { user: userReal, logout, updateUser } = useAuth();
  const user = userReal as UserLegacy | null;
  const [isOnlyAdmin, setIsOnlyAdmin] = useState<boolean | null>(null);
  const [misAcciones, setMisAcciones] = useState<number | null>(null);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  // ── Editar datos personales ──
  const [datosModalVisible, setDatosModalVisible] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [telefonoEdit, setTelefonoEdit] = useState('');
  const [savingDatos, setSavingDatos] = useState(false);

  const abrirDatosModal = () => {
    setNombreEdit(user?.nombre_completo ?? '');
    setTelefonoEdit(user?.telefono ?? '');
    setDatosModalVisible(true);
  };

  const handleGuardarDatos = async () => {
    if (!nombreEdit.trim()) { toast.warning('Requerido', 'El nombre no puede estar vacío.'); return; }
    try {
      setSavingDatos(true);
      await usuariosAPI.actualizarPerfil({
        nombre_completo: nombreEdit.trim(),
        telefono: telefonoEdit.trim() || null,
      });
      updateUser({ ...user, nombre_completo: nombreEdit.trim(), telefono: telefonoEdit.trim() || null } as UserPublic);
      setDatosModalVisible(false);
      toast.success('Actualizado', 'Tus datos fueron guardados correctamente.');
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudieron guardar los datos.');
    } finally {
      setSavingDatos(false);
    }
  };

  // Cargador inline (no una función nombrada aparte) para que el propio
  // efecto sea el único llamador -- así el linter puede ver que el
  // setState solo ocurre después del await, en vez de tratar la llamada
  // como si pudiera setState de forma síncrona dentro del efecto.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      if (!user) return;
      const [usuariosR, accionesR] = await Promise.allSettled([
        usuariosAPI.listar(),
        auditoriaAPI.listar({ id_usuario: user.id_usuario, limite: 1 }),
      ]);
      if (cancelado) return;

      if (usuariosR.status === 'fulfilled') {
        const admins = usuariosR.value.data.filter(u => u.rol === 'ADMINISTRADOR' && u.estado_cuenta === 'ACTIVO');
        setIsOnlyAdmin(admins.length === 1);
      } else {
        setIsOnlyAdmin(null);
      }
      setMisAcciones(accionesR.status === 'fulfilled' ? accionesR.value.data.total : null);
    })();

    return () => { cancelado = true; };
    // deps [] a propósito -- debe correr solo al montar (mismo
    // comportamiento que antes de este fix, con loadStats declarada
    // aparte). Listar `user` acá haría refetch en cada cambio de
    // referencia de user (ej. tras updateUser() en PerfilScreen.tsx), no
    // solo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    setLogoutConfirmVisible(false);
    await logout();
    // AppNavigator cambia a la pila de Login solo cuando user pasa a null
    // (ver AuthContext) -- no hace falta navegar manualmente acá.
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['#042F34', '#0A6F78']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={22} color={andiColors.surface} />
          </TouchableOpacity>
          <View style={styles.heroCenter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user?.nombre_completo ?? 'A')}</Text>
            </View>
            <Text style={styles.name}>{user?.nombre_completo ?? 'Administrador'}</Text>
            <Text style={styles.roleLabel}>ADMINISTRADOR</Text>
          </View>
        </LinearGradient>

        <View style={[styles.body, { width: '100%', maxWidth: r.maxContentWidth(600), alignSelf: 'center' }]}>
          {isOnlyAdmin && (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={18} color={andiColors.error600} />
              <Text style={[styles.warningText, { flex: 1 }]}>Eres el único administrador activo.</Text>
            </View>
          )}

          <View style={styles.statTile}>
            <Feather name="activity" size={20} color={andiColors.primary600} />
            {misAcciones === null
              ? <ActivityIndicator size="small" color={andiColors.primary600} style={styles.statLoading} />
              : <Text style={styles.statNum}>{misAcciones} ACCIONES TUYAS</Text>}
          </View>

          <View style={styles.sectionList}>
            <TouchableOpacity
              style={styles.sectionRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SolicitudesAcceso')}
            >
              <Feather name="inbox" size={18} color={andiColors.onSurface} />
              <Text style={styles.sectionRowLabel}>Solicitudes de acceso</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>Nuevo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sectionRow} activeOpacity={0.8} onPress={abrirDatosModal}>
              <Feather name="user" size={18} color={andiColors.onSurface} />
              <Text style={styles.sectionRowLabel}>Datos personales</Text>
              <View style={{ flex: 1 }} />
              <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={() => setLogoutConfirmVisible(true)}>
            <Feather name="log-out" size={18} color={andiColors.error600} />
            <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={logoutConfirmVisible} transparent animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { width: '100%', maxWidth: r.maxContentWidth(480), alignSelf: 'center' }]}>
            <Text style={styles.modalTitle}>¿Cerrar sesión?</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLogoutConfirmVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSalirBtn} onPress={handleLogout}>
                <Text style={styles.modalSalirBtnText}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={datosModalVisible} animationType="slide" transparent onRequestClose={() => setDatosModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: r.maxContentWidth(560), alignSelf: 'center' }}
          >
            <View style={styles.sheetCard}>
              <View style={styles.sheetHeader}>
                <Text style={styles.modalTitle}>Datos personales</Text>
                <TouchableOpacity onPress={() => setDatosModalVisible(false)} accessibilityLabel="Cerrar" hitSlop={8}>
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

              <Text style={styles.fieldLabel}>Teléfono</Text>
              <TextInput
                style={styles.input}
                value={telefonoEdit}
                onChangeText={setTelefonoEdit}
                placeholder="Ej: 3001234567"
                placeholderTextColor={andiColors.n400}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.modalSalirBtn, { backgroundColor: andiColors.primary600, marginTop: andiSpace[5] }]}
                onPress={handleGuardarDatos}
                disabled={savingDatos}
              >
                {savingDatos
                  ? <ActivityIndicator size="small" color={andiColors.surface} />
                  : <Text style={styles.modalSalirBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (andiType: typeof andiTypeBase) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.surfaceMid },
  scroll: { flexGrow: 1 },
  header: { height: 200, paddingTop: andiSpace[10], paddingHorizontal: andiSpace[4] },
  backBtn: { alignSelf: 'flex-start', padding: andiSpace[1] },
  heroCenter: { alignItems: 'center', marginTop: andiSpace[1] },
  avatar: {
    width: 64, height: 64, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary400, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { ...andiType.headingMd, color: andiColors.surface },
  name: { ...andiType.headingMd, color: andiColors.surface, marginTop: andiSpace[2] },
  roleLabel: { ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 1.5, color: andiColors.primary200, marginTop: 2 },

  body: { padding: andiSpace[4] },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    backgroundColor: andiColors.error50, borderWidth: 1, borderColor: andiColors.error200,
    borderRadius: andiRadius.md, padding: andiSpace[3], marginBottom: andiSpace[4],
  },
  warningText: { ...andiType.bodySm, color: andiColors.error700 },

  statTile: {
    backgroundColor: andiColors.surface, borderRadius: andiRadius.lg,
    ...andiElevation[1], alignItems: 'center', paddingVertical: andiSpace[4], gap: andiSpace[2],
  },
  statNum: { ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 0.6, color: andiColors.onSurfaceVariant, textAlign: 'center' },
  statLoading: { minHeight: 16, justifyContent: 'center' },

  sectionList: { marginTop: andiSpace[6], gap: andiSpace[2] },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    backgroundColor: andiColors.surface, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[3],
  },
  sectionRowLabel: { ...andiType.bodyLg, color: andiColors.onSurface },
  newBadge: { backgroundColor: andiColors.primary600, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[2], paddingVertical: 2 },
  newBadgeText: { ...andiType.caption, color: andiColors.surface, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: andiSpace[2],
    marginTop: andiSpace[8], height: 52, borderRadius: andiRadius.full,
    borderWidth: 1.5, borderColor: andiColors.error400,
  },
  logoutBtnText: { ...andiType.label, color: andiColors.error600 },

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
});
