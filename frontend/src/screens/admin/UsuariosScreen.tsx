import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Modal, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { usuariosAPI } from '../../api/services';
import type { UsuarioListItem } from '../../types/domain';
import type { AdminTabParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiElevation, andiSpace } from '../../theme/andi';

type Props = BottomTabScreenProps<AdminTabParamList, 'Usuarios'>;

type FilterKey = 'PENDIENTE' | 'ACTIVO' | 'SUSPENDIDO' | 'TODOS';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'PENDIENTE', label: 'Pendientes' },
  { key: 'ACTIVO', label: 'Activos' },
  { key: 'SUSPENDIDO', label: 'Suspendidos' },
  { key: 'TODOS', label: 'Todos' },
];

// id_estado_cuenta: 1=ACTIVO, 2=INACTIVO, 3=SUSPENDIDO, 4=PENDIENTE (ver
// backend/CLAUDE.md "Account states" y PUT /usuarios/{id}/estado). Objeto
// literal (no Record<string,...>) para que el acceso por punto a una clave
// conocida (ESTADO_ID.ACTIVO) tenga tipo definido bajo
// noUncheckedIndexedAccess; el lookup dinámico por estado_cuenta usa un
// cast a keyof typeof + fallback más abajo.
const ESTADO_ID = { ACTIVO: 1, INACTIVO: 2, SUSPENDIDO: 3, PENDIENTE: 4 } as const;

const ESTADO_CHIP_DEFAULT = { bg: andiColors.neutral100, fg: andiColors.neutral600, label: 'Inactivo' };
const ESTADO_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVO: { bg: andiColors.success100, fg: andiColors.success700, label: 'Activo' },
  PENDIENTE: { bg: andiColors.warning100, fg: andiColors.warning700, label: 'Pendiente' },
  SUSPENDIDO: { bg: andiColors.error100, fg: andiColors.error700, label: 'Suspendido' },
  INACTIVO: ESTADO_CHIP_DEFAULT,
};

function initials(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

export default function UsuariosScreen({ route }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('TODOS');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [applying, setApplying] = useState(false);

  const [undoVisible, setUndoVisible] = useState(false);
  const undoData = useRef<{ prev: { id: number; estado: number }[]; label: string } | null>(null);
  const undoShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La pantalla queda montada al cambiar de tab (no se remonta), así que un
  // filtro nuevo en route.params necesita aplicarse ajustando el estado
  // durante el render -- mismo patrón que el success banner de LoginScreen.
  const [lastParamFilter, setLastParamFilter] = useState<string | undefined>(undefined);
  if (route.params?.filter && route.params.filter !== lastParamFilter) {
    setLastParamFilter(route.params.filter);
    setFilter(route.params.filter as FilterKey);
  }

  useEffect(() => { loadUsuarios(); }, []);
  useEffect(() => () => {
    if (undoShowTimer.current) clearTimeout(undoShowTimer.current);
    if (undoHideTimer.current) clearTimeout(undoHideTimer.current);
  }, []);

  const loadUsuarios = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await usuariosAPI.listar();
      setUsuarios(res.data || []);
    } catch (_) {
      setUsuarios([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const usuariosFiltrados = filter === 'TODOS' ? usuarios : usuarios.filter(u => u.estado_cuenta === filter);
  const selectionMode = selected.size > 0;

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const scheduleUndo = (prev: { id: number; estado: number }[], label: string) => {
    undoData.current = { prev, label };
    if (undoShowTimer.current) clearTimeout(undoShowTimer.current);
    if (undoHideTimer.current) clearTimeout(undoHideTimer.current);
    setUndoVisible(false);
    undoShowTimer.current = setTimeout(() => {
      setUndoVisible(true);
      undoHideTimer.current = setTimeout(() => setUndoVisible(false), 10000);
    }, 3000);
  };

  const applyEstado = async (ids: number[], nuevoEstado: number, label: string) => {
    setApplying(true);
    const prev = ids
      .map(id => {
        const u = usuarios.find(x => x.id_usuario === id);
        return u ? { id, estado: (ESTADO_ID[u.estado_cuenta as keyof typeof ESTADO_ID] ?? 1) as number } : null;
      })
      .filter((x): x is { id: number; estado: number } => x !== null);

    await Promise.allSettled(
      ids.map(id => usuariosAPI.cambiarEstado(id, { id_estado_cuenta: nuevoEstado }))
    );
    await loadUsuarios(true);
    setApplying(false);
    setSelected(new Set());
    scheduleUndo(prev, label);
  };

  const handleActivar = () => {
    applyEstado(Array.from(selected), ESTADO_ID.ACTIVO, 'Cuentas activadas');
  };

  const handleSuspenderConfirmado = () => {
    applyEstado(Array.from(selected), ESTADO_ID.SUSPENDIDO, 'Cuentas suspendidas');
    setConfirmVisible(false);
    setMotivo('');
  };

  const handleDeshacer = async () => {
    const data = undoData.current;
    if (!data) return;
    setUndoVisible(false);
    if (undoHideTimer.current) clearTimeout(undoHideTimer.current);
    await Promise.allSettled(
      data.prev.map(p => usuariosAPI.cambiarEstado(p.id, { id_estado_cuenta: p.estado }))
    );
    undoData.current = null;
    loadUsuarios(true);
  };

  const selectedNames = usuarios.filter(u => selected.has(u.id_usuario)).map(u => u.nombre_completo);
  const confirmMessage = selectedNames.length === 1
    ? `¿Confirmas suspender la cuenta de ${selectedNames[0]}?`
    : `¿Confirmas suspender ${selectedNames.length} cuentas?`;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#042F34', '#0A6F78']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Usuarios</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{usuarios.length}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={andiColors.primary600} />
        </View>
      ) : (
        <FlatList
          data={usuariosFiltrados}
          keyExtractor={u => String(u.id_usuario)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsuarios(true); }} colors={[andiColors.primary600]} />
          }
          renderItem={({ item }) => {
            const chip = ESTADO_CHIP[item.estado_cuenta] ?? ESTADO_CHIP_DEFAULT;
            const isSelected = selected.has(item.id_usuario);
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onLongPress={() => toggleSelect(item.id_usuario)}
                onPress={() => { if (selectionMode) toggleSelect(item.id_usuario); }}
              >
                {selectionMode && (
                  <Feather
                    name={isSelected ? 'check-square' : 'square'}
                    size={20}
                    color={isSelected ? andiColors.primary600 : andiColors.onSurfaceVariant}
                    style={styles.checkbox}
                  />
                )}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.nombre_completo)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.nombre_completo}</Text>
                  <Text style={styles.rowEmail} numberOfLines={1}>{item.correo}</Text>
                </View>
                <View style={[styles.stateChip, { backgroundColor: chip.bg }]}>
                  <Text style={[styles.stateChipText, { color: chip.fg }]}>{chip.label}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={andiColors.onSurfaceVariant} />
              <Text style={styles.emptyStateText}>No hay usuarios en esta categoría</Text>
            </View>
          }
        />
      )}

      {selectionMode && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarText}>{selected.size} seleccionados</Text>
          <View style={styles.batchBarBtns}>
            <TouchableOpacity style={styles.batchBtnPrimary} onPress={handleActivar} disabled={applying}>
              <Text style={styles.batchBtnPrimaryText}>Activar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.batchBtnDestructive} onPress={() => setConfirmVisible(true)} disabled={applying}>
              <Text style={styles.batchBtnDestructiveText}>Suspender</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Suspender cuenta?</Text>
            <Text style={styles.modalMessage}>{confirmMessage}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo (obligatorio)"
              placeholderTextColor={andiColors.onSurfaceVariant}
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setConfirmVisible(false); setMotivo(''); }}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSuspendBtn, !motivo.trim() && styles.btnDisabled]}
                onPress={handleSuspenderConfirmado}
                disabled={!motivo.trim()}
              >
                <Text style={styles.modalSuspendBtnText}>Suspender</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {undoVisible && (
        <TouchableOpacity style={styles.undoToast} onPress={handleDeshacer} activeOpacity={0.85}>
          <Text style={styles.undoText}>Acción aplicada · Deshacer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceMid },
  header: { height: 160, paddingTop: andiSpace[10], paddingHorizontal: andiSpace[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[2] },
  headerTitle: { ...andiType.headingLg, color: andiColors.surface },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: andiRadius.full, paddingHorizontal: andiSpace[3], paddingVertical: 2 },
  headerBadgeText: { ...andiType.labelSm, color: andiColors.surface },

  filterRow: {
    flexDirection: 'row', gap: andiSpace[2], backgroundColor: andiColors.surface,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[3],
  },
  chip: { borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[3], paddingVertical: andiSpace[1] },
  chipActive: { backgroundColor: andiColors.primary600, borderColor: andiColors.primary600 },
  chipText: { ...andiType.labelSm, color: andiColors.onSurface },
  chipTextActive: { color: andiColors.surface },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: andiSpace[4], paddingBottom: andiSpace[10] * 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', height: 68,
    backgroundColor: andiColors.surface, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[3], marginBottom: andiSpace[2], gap: andiSpace[3],
  },
  checkbox: {},
  avatar: { width: 40, height: 40, borderRadius: andiRadius.full, backgroundColor: andiColors.primary100, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...andiType.labelSm, color: andiColors.primary700 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { ...andiType.labelMd, fontWeight: '700', color: andiColors.onSurface },
  rowEmail: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: 1 },
  stateChip: { borderRadius: andiRadius.full, paddingHorizontal: andiSpace[2], paddingVertical: 3 },
  stateChipText: { ...andiType.caption, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: andiSpace[10] },
  emptyStateText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3] },

  batchBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: andiColors.surface, borderTopWidth: 1, borderTopColor: andiColors.outlineVariant,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[3],
    ...andiElevation[2],
  },
  batchBarText: { ...andiType.labelMd, color: andiColors.onSurface },
  batchBarBtns: { flexDirection: 'row', gap: andiSpace[2] },
  batchBtnPrimary: { backgroundColor: andiColors.primary600, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[2] },
  batchBtnPrimaryText: { ...andiType.labelSm, color: andiColors.surface },
  batchBtnDestructive: { backgroundColor: andiColors.error600, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[2] },
  batchBtnDestructiveText: { ...andiType.labelSm, color: andiColors.surface },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'center', padding: andiSpace[6] },
  modalCard: { backgroundColor: andiColors.surface, borderRadius: andiRadius.lg, padding: andiSpace[5] },
  modalTitle: { ...andiType.headingMd, color: andiColors.onSurface },
  modalMessage: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[2] },
  modalInput: {
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    backgroundColor: andiColors.surfaceDim, padding: andiSpace[3], marginTop: andiSpace[4],
    minHeight: 60, textAlignVertical: 'top', color: andiColors.onSurface,
  },
  modalBtnRow: { flexDirection: 'row', gap: andiSpace[3], marginTop: andiSpace[5] },
  modalCancelBtn: {
    flex: 1, height: 44, borderRadius: andiRadius.full, borderWidth: 1.5, borderColor: andiColors.outline,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelBtnText: { ...andiType.label, color: andiColors.onSurface },
  modalSuspendBtn: { flex: 1, height: 44, borderRadius: andiRadius.full, backgroundColor: andiColors.error600, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  modalSuspendBtnText: { ...andiType.label, color: andiColors.surface },

  undoToast: {
    position: 'absolute', bottom: andiSpace[6], alignSelf: 'center',
    backgroundColor: andiColors.n800, borderRadius: andiRadius.full,
    paddingHorizontal: andiSpace[5], paddingVertical: andiSpace[3],
  },
  undoText: { ...andiType.bodySm, color: andiColors.surface },
});
