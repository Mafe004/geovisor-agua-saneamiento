import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { entidadesAPI } from '../../api/services';
import type { EntidadDetalle, UsuarioDeEntidadItem } from '../../types/domain';
import { andiColors, andiType, andiRadius, andiElevation, andiSpace } from '../../theme/andi';

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
  const [entidades, setEntidades] = useState<EntidadDetalle[]>([]);
  const [operadores, setOperadores] = useState<Record<number, UsuarioDeEntidadItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#042F34', '#0A6F78']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Entidades</Text>
          <TouchableOpacity style={styles.newBtn} activeOpacity={0.85} onPress={() => { /* TODO: navigate to CreateEntidadScreen */ }}>
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
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntidades(true); }} colors={[andiColors.primary600]} />
          }
        >
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

                <TouchableOpacity style={styles.linkBtn} activeOpacity={0.85} onPress={() => { /* TODO: open modal LinkUserModal */ }}>
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
