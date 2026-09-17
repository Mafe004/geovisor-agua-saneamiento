import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usuariosAPI, auditoriaAPI } from '../../api/services';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiElevation, andiSpace } from '../../theme/andi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPerfil'>;

function initials(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

export default function AdminPerfilScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [isOnlyAdmin, setIsOnlyAdmin] = useState<boolean | null>(null);
  const [misAcciones, setMisAcciones] = useState<number | null>(null);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  // "2 INVITACIONES VIVAS" y "Invitar a un segundo admin" no tienen backend
  // real: no existe /auth/invitaciones ni ninguna tabla/endpoint de
  // invitaciones en este proyecto (a diferencia de "mis acciones", que sí
  // se resuelve con el auditoriaAPI.listar real de abajo). Mockeado acá.
  const invitacionesVivas = 2; // TODO: connect endpoint — no invitaciones system exists yet

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    if (!user) return;
    const [usuariosR, accionesR] = await Promise.allSettled([
      usuariosAPI.listar(),
      auditoriaAPI.listar({ id_usuario: user.id_usuario, limite: 1 }),
    ]);

    if (usuariosR.status === 'fulfilled') {
      const admins = usuariosR.value.data.filter(u => u.rol === 'ADMINISTRADOR' && u.estado_cuenta === 'ACTIVO');
      setIsOnlyAdmin(admins.length === 1);
    } else {
      setIsOnlyAdmin(null);
    }
    setMisAcciones(accionesR.status === 'fulfilled' ? accionesR.value.data.total : null);
  };

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

        <View style={styles.body}>
          {isOnlyAdmin && (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={18} color={andiColors.error600} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningText}>Eres el único administrador activo.</Text>
                <TouchableOpacity
                  style={styles.inviteBtn}
                  activeOpacity={0.85}
                  onPress={() => { /* TODO: connect endpoint — POST /auth/invitaciones doesn't exist yet; would show the generated code in a modal */ }}
                >
                  <Text style={styles.inviteBtnText}>Invitar a un segundo admin</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <Feather name="activity" size={20} color={andiColors.primary600} />
              {misAcciones === null
                ? <ActivityIndicator size="small" color={andiColors.primary600} style={styles.statLoading} />
                : <Text style={styles.statNum}>{misAcciones} ACCIONES TUYAS</Text>}
            </View>
            <View style={styles.statTile}>
              <Feather name="mail" size={20} color={andiColors.primary600} />
              <Text style={styles.statNum}>{invitacionesVivas} INVITACIONES VIVAS</Text>
            </View>
          </View>

          <View style={styles.sectionList}>
            <TouchableOpacity style={styles.sectionRow} activeOpacity={0.8} onPress={() => { /* TODO: InvitacionesScreen */ }}>
              <Feather name="mail" size={18} color={andiColors.onSurface} />
              <Text style={styles.sectionRowLabel}>Mis invitaciones</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>Nuevo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sectionRow} activeOpacity={0.8} onPress={() => { /* TODO: MisAccionesScreen */ }}>
              <Feather name="activity" size={18} color={andiColors.onSurface} />
              <Text style={styles.sectionRowLabel}>Mis acciones</Text>
              <View style={{ flex: 1 }} />
              <Feather name="chevron-right" size={18} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sectionRow} activeOpacity={0.8} onPress={() => { /* TODO: DatosPersonalesScreen */ }}>
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
          <View style={styles.modalCard}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  inviteBtn: {
    alignSelf: 'flex-start', marginTop: andiSpace[3], borderWidth: 1.5, borderColor: andiColors.error600,
    borderRadius: andiRadius.full, paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[1],
  },
  inviteBtnText: { ...andiType.labelSm, color: andiColors.error600 },

  statRow: { flexDirection: 'row', gap: andiSpace[3] },
  statTile: {
    flex: 1, backgroundColor: andiColors.surface, borderRadius: andiRadius.lg,
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
});
