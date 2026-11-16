import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { entidadesAPI, usuariosAPI } from '../../api/services';
import type { EntidadDetalle, UsuarioDeEntidadItem, UsuarioListItem } from '../../types/domain';
import { useToast } from '../../components/andi/Toast';
import { andiColors, andiType as andiTypeBase, andiRadius, andiElevation, andiSpace } from '../../theme/andi';
import { useResponsive, useScaledType } from '../../theme/responsive';

// id_estado_cuenta: 1=ACTIVO, 2=INACTIVO, 3=SUSPENDIDO, 4=PENDIENTE (mismo
// catálogo que usuarios -- ver backend/CLAUDE.md "Account states").
const ESTADO_ID = { ACTIVO: 1, INACTIVO: 2, SUSPENDIDO: 3, PENDIENTE: 4 } as const;

const ESTADO_CHIP_DEFAULT = { bg: andiColors.neutral100, fg: andiColors.neutral600, label: 'Inactivo' };
const ESTADO_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVO: { bg: andiColors.success100, fg: andiColors.success700, label: 'Activo' },
  PENDIENTE: { bg: andiColors.warning100, fg: andiColors.warning700, label: 'Pendiente' },
  SUSPENDIDO: { bg: andiColors.error100, fg: andiColors.error700, label: 'Suspendido' },
  INACTIVO: ESTADO_CHIP_DEFAULT,
};

const MAX_CHIPS = 3;

export default function EntidadesScreen() {
  const r = useResponsive();
  const andiType = useScaledType(andiTypeBase);
  const styles = useMemo(() => makeStyles(andiType), [andiType]);
  const toast = useToast();
  const [entidades, setEntidades] = useState<EntidadDetalle[]>([]);
  const [operadores, setOperadores] = useState<Record<number, UsuarioDeEntidadItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // ── Crear entidad ──
  const [nuevaModalVisible, setNuevaModalVisible] = useState(false);
  const [nombreEntidad, setNombreEntidad] = useState('');
  const [nitRut, setNitRut] = useState('');
  const [correoInstitucional, setCorreoInstitucional] = useState('');
  const [telefonoEntidad, setTelefonoEntidad] = useState('');
  const [creandoEntidad, setCreandoEntidad] = useState(false);

  // ── Vincular usuario ──
  const [linkTarget, setLinkTarget] = useState<EntidadDetalle | null>(null);
  const [usuariosEntidad, setUsuariosEntidad] = useState<UsuarioListItem[]>([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [vinculandoId, setVinculandoId] = useState<number | null>(null);

  useEffect(() => { loadEntidades(); }, []);

  const loadEntidades = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await entidadesAPI.listar();
      const lista = res.data || [];
      setEntidades(lista);

      // Los operadores vinculados no vienen en el listado -- un GET aparte
      // por entidad (/entidades/{id}/usuarios). allSettled para que una
      // falla puntual no tumbe el resto de las tarjetas.
      const results = await Promise.allSettled(lista.map(e => entidadesAPI.usuarios(e.id_entidad)));
      const next: Record<number, UsuarioDeEntidadItem[]> = {};
      results.forEach((r, i) => {
        const entidad = lista[i];
        if (entidad) next[entidad.id_entidad] = r.status === 'fulfilled' ? r.value.data.usuarios : [];
      });
      setOperadores(next);
    } catch (_) {
      setEntidades([]);
      setOperadores({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggle = async (entidad: EntidadDetalle) => {
    const activo = entidad.estado_cuenta === 'ACTIVO';
    setTogglingId(entidad.id_entidad);
    try {
      await entidadesAPI.cambiarEstado(entidad.id_entidad, {
        id_estado_cuenta: activo ? ESTADO_ID.INACTIVO : ESTADO_ID.ACTIVO,
      });
      await loadEntidades(true);
    } finally {
      setTogglingId(null);
    }
  };

  const resetNuevaEntidad = () => {
    setNombreEntidad(''); setNitRut(''); setCorreoInstitucional(''); setTelefonoEntidad('');
  };

  const handleCrearEntidad = async () => {
    if (!nombreEntidad.trim()) { toast.warning('Requerido', 'Ingresa el nombre de la entidad.'); return; }
    if (!nitRut.trim()) { toast.warning('Requerido', 'Ingresa el NIT o RUT.'); return; }
    if (!correoInstitucional.trim()) { toast.warning('Requerido', 'Ingresa el correo institucional.'); return; }
    try {
      setCreandoEntidad(true);
      await entidadesAPI.crear({
        nombre_entidad: nombreEntidad.trim(),
        nit_rut: nitRut.trim(),
        correo_institucional: correoInstitucional.trim(),
        telefono: telefonoEntidad.trim() || null,
      });
      setNuevaModalVisible(false);
      resetNuevaEntidad();
      toast.success('Entidad creada', `${nombreEntidad.trim()} fue registrada correctamente.`);
      await loadEntidades(true);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo crear la entidad.');
    } finally {
      setCreandoEntidad(false);
    }
  };

  // Usuarios con rol ENTIDAD que todavía no están vinculados a esta
  // entidad -- el backend no filtra por rol en GET /usuarios/, se filtra
  // acá (mismo patrón que AdminPerfilScreen con el rol ADMINISTRADOR).
  const abrirVincularModal = async (entidad: EntidadDetalle) => {
    setLinkTarget(entidad);
    setCargandoUsuarios(true);
    try {
      const res = await usuariosAPI.listar();
      const yaVinculados = new Set((operadores[entidad.id_entidad] ?? []).map(o => o.id_usuario));
      setUsuariosEntidad((res.data || []).filter(u => u.rol === 'ENTIDAD' && !yaVinculados.has(u.id_usuario)));
    } catch (_) {
      setUsuariosEntidad([]);
    } finally {
      setCargandoUsuarios(false);
    }
  };

  const handleVincular = async (usuario: UsuarioListItem) => {
    if (!linkTarget) return;
    setVinculandoId(usuario.id_usuario);
    try {
      await entidadesAPI.asignarUsuario(linkTarget.id_entidad, usuario.id_usuario);
      toast.success('Usuario vinculado', `${usuario.nombre_completo} ahora gestiona ${linkTarget.nombre_entidad}.`);
      setLinkTarget(null);
      await loadEntidades(true);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo vincular el usuario.');
    } finally {
      setVinculandoId(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#042F34', '#0A6F78']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Entidades</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.newBtn} activeOpacity={0.85} onPress={() => setNuevaModalVisible(true)}>
            <Feather name="plus" size={16} color={andiColors.surface} />
            <Text style={styles.newBtnText}>Nueva entidad</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={andiColors.primary600} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { alignItems: 'center' }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntidades(true); }} colors={[andiColors.primary600]} />
          }
        >
        <View style={{ width: '100%', maxWidth: r.maxContentWidth(700) }}>
          {entidades.length === 1 && (
            <View style={styles.infoNote}>
              <Feather name="info" size={16} color={andiColors.warning700} />
              <Text style={styles.infoNoteText}>Solo hay una entidad registrada. Considera añadir más.</Text>
            </View>
          )}

          {entidades.map(entidad => {
            const chip = ESTADO_CHIP[entidad.estado_cuenta] ?? ESTADO_CHIP_DEFAULT;
            const ops = operadores[entidad.id_entidad] ?? [];
            const shown = ops.slice(0, MAX_CHIPS);
            const extra = ops.length - shown.length;
            const activo = entidad.estado_cuenta === 'ACTIVO';

            return (
              <View key={entidad.id_entidad} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.avatar}>
                    <Feather name="briefcase" size={24} color={andiColors.primary600} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.entidadName} numberOfLines={1}>{entidad.nombre_entidad}</Text>
                    <Text style={styles.entidadType} numberOfLines={1}>{entidad.correo_institucional}</Text>
                    <View style={styles.opsRow}>
                      {shown.map(op => (
                        <View key={op.id_usuario} style={styles.opChip}>
                          <Text style={styles.opChipText} numberOfLines={1}>{op.nombre_completo}</Text>
                        </View>
                      ))}
                      {extra > 0 && (
                        <View style={styles.opChip}>
                          <Text style={styles.opChipText}>+{extra} más</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.stateChip, { backgroundColor: chip.bg }]}>
                      <Text style={[styles.stateChipText, { color: chip.fg }]}>{chip.label}</Text>
                    </View>
                    {togglingId === entidad.id_entidad ? (
                      <ActivityIndicator size="small" color={andiColors.primary600} style={styles.switchLoading} />
                    ) : (
                      <Switch
                        value={activo}
                        onValueChange={() => handleToggle(entidad)}
                        trackColor={{ false: andiColors.outline, true: andiColors.primary300 }}
                        thumbColor={activo ? andiColors.primary600 : andiColors.n0}
                      />
                    )}
                  </View>
                </View>

                <TouchableOpacity accessibilityRole="button" style={styles.linkBtn} activeOpacity={0.85} onPress={() => abrirVincularModal(entidad)}>
                  <Text style={styles.linkBtnText}>Vincular usuario</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {entidades.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="briefcase" size={48} color={andiColors.onSurfaceVariant} />
              <Text style={styles.emptyStateText}>No hay entidades registradas</Text>
            </View>
          )}
        </View>
        </ScrollView>
      )}

      <Modal visible={nuevaModalVisible} animationType="slide" transparent onRequestClose={() => setNuevaModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: r.maxContentWidth(560), alignSelf: 'center' }}
          >
            <View style={styles.sheetCard}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Nueva entidad</Text>
                <TouchableOpacity onPress={() => setNuevaModalVisible(false)} accessibilityLabel="Cerrar" hitSlop={8}>
                  <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Nombre de la entidad</Text>
              <TextInput
                style={styles.input}
                value={nombreEntidad}
                onChangeText={setNombreEntidad}
                placeholder="Ej: Empresa de Acueducto de Zipaquirá"
                placeholderTextColor={andiColors.n400}
              />

              <Text style={styles.fieldLabel}>NIT / RUT</Text>
              <TextInput
                style={styles.input}
                value={nitRut}
                onChangeText={setNitRut}
                placeholder="Ej: 900123456-7"
                placeholderTextColor={andiColors.n400}
              />

              <Text style={styles.fieldLabel}>Correo institucional</Text>
              <TextInput
                style={styles.input}
                value={correoInstitucional}
                onChangeText={setCorreoInstitucional}
                placeholder="contacto@entidad.gov.co"
                placeholderTextColor={andiColors.n400}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Teléfono (opcional)</Text>
              <TextInput
                style={styles.input}
                value={telefonoEntidad}
                onChangeText={setTelefonoEntidad}
                placeholder="Ej: 6018520000"
                placeholderTextColor={andiColors.n400}
                keyboardType="phone-pad"
              />

              <TouchableOpacity accessibilityRole="button"
                style={[styles.sheetPrimaryBtn, { marginTop: andiSpace[5] }]}
                onPress={handleCrearEntidad}
                disabled={creandoEntidad}
              >
                {creandoEntidad
                  ? <ActivityIndicator size="small" color={andiColors.surface} />
                  : <Text style={styles.sheetPrimaryBtnText}>Crear entidad</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={linkTarget !== null} animationType="slide" transparent onRequestClose={() => setLinkTarget(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheetCard, { width: '100%', maxWidth: r.maxContentWidth(560), alignSelf: 'center', maxHeight: '75%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>Vincular usuario · {linkTarget?.nombre_entidad}</Text>
              <TouchableOpacity onPress={() => setLinkTarget(null)} accessibilityLabel="Cerrar" hitSlop={8}>
                <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {cargandoUsuarios ? (
              <ActivityIndicator size="small" color={andiColors.primary600} style={{ marginVertical: andiSpace[5] }} />
            ) : usuariosEntidad.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: andiSpace[6] }}>
                <Feather name="user-x" size={32} color={andiColors.onSurfaceVariant} />
                <Text style={[styles.emptyStateText, { marginTop: andiSpace[2] }]}>
                  No hay usuarios con rol Entidad disponibles para vincular.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {usuariosEntidad.map(u => (
                  <TouchableOpacity accessibilityRole="button"
                    key={u.id_usuario}
                    style={styles.userRow}
                    activeOpacity={0.8}
                    onPress={() => handleVincular(u)}
                    disabled={vinculandoId !== null}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.userRowName} numberOfLines={1}>{u.nombre_completo}</Text>
                      <Text style={styles.userRowEmail} numberOfLines={1}>{u.correo}</Text>
                    </View>
                    {vinculandoId === u.id_usuario
                      ? <ActivityIndicator size="small" color={andiColors.primary600} />
                      : <Feather name="link" size={18} color={andiColors.primary600} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (andiType: typeof andiTypeBase) => StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceMid },
  header: { paddingTop: andiSpace[10], paddingHorizontal: andiSpace[4], paddingBottom: andiSpace[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...andiType.headingLg, color: andiColors.surface },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[1],
    backgroundColor: andiColors.success600, borderRadius: andiRadius.full,
    height: 36, paddingHorizontal: andiSpace[4],
  },
  newBtnText: { ...andiType.labelSm, color: andiColors.surface },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: andiSpace[4], paddingBottom: andiSpace[10] },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    backgroundColor: andiColors.warning100, borderRadius: andiRadius.md,
    padding: andiSpace[3], marginBottom: andiSpace[3],
  },
  infoNoteText: { ...andiType.bodySm, color: andiColors.warning700, flex: 1 },

  card: {
    backgroundColor: andiColors.surface, borderRadius: andiRadius.lg,
    ...andiElevation[1], padding: andiSpace[4], marginVertical: andiSpace[2],
  },
  cardTopRow: { flexDirection: 'row', gap: andiSpace[3] },
  avatar: {
    width: 48, height: 48, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary50, justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, minWidth: 0 },
  entidadName: { ...andiType.labelMd, fontWeight: '700', color: andiColors.onSurface },
  entidadType: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: 1 },
  opsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[1], marginTop: andiSpace[2] },
  opChip: { backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[2], paddingVertical: 2, maxWidth: 120 },
  opChipText: { ...andiType.caption, color: andiColors.onSurfaceVariant },
  cardRight: { alignItems: 'flex-end', gap: andiSpace[2] },
  stateChip: { borderRadius: andiRadius.full, paddingHorizontal: andiSpace[2], paddingVertical: 3 },
  stateChipText: { ...andiType.caption, fontWeight: '700' },
  switchLoading: { minHeight: 31, justifyContent: 'center' },

  linkBtn: {
    alignSelf: 'flex-start', marginTop: andiSpace[3], borderWidth: 1.5, borderColor: andiColors.primary600,
    borderRadius: andiRadius.full, paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[1],
  },
  linkBtnText: { ...andiType.labelSm, color: andiColors.primary600 },

  emptyState: { alignItems: 'center', paddingVertical: andiSpace[10] },
  emptyStateText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3] },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: andiColors.surface, borderTopLeftRadius: andiRadius.xl, borderTopRightRadius: andiRadius.xl,
    padding: andiSpace[5], paddingBottom: andiSpace[8],
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: andiSpace[4], gap: andiSpace[3] },
  sheetTitle: { ...andiType.headingMd, color: andiColors.onSurface, flex: 1 },
  fieldLabel: { ...andiType.labelSm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3], marginBottom: andiSpace[1] },
  input: {
    minHeight: 48, borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[3], fontSize: 16, color: andiColors.onSurface,
  },
  sheetPrimaryBtn: {
    minHeight: 48, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetPrimaryBtnText: { ...andiType.label, color: andiColors.surface },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    paddingVertical: andiSpace[3], borderBottomWidth: 1, borderBottomColor: andiColors.outlineVariant,
  },
  userRowName: { ...andiType.bodyLg, color: andiColors.onSurface },
  userRowEmail: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: 1 },
});
