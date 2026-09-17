import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { auditoriaAPI } from '../../api/services';
import type { LogAuditoriaItem } from '../../types/domain';
import { andiColors, andiType, andiRadius, andiElevation, andiSpace } from '../../theme/andi';

type ModuloFilter = 'TODOS' | 'REPORTES' | 'AUTH' | 'USUARIOS';
const FILTERS: { key: ModuloFilter; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'REPORTES', label: 'Reportes' },
  { key: 'AUTH', label: 'Auth' },
  { key: 'USUARIOS', label: 'Usuarios' },
];

// El backend audita módulos concretos afectados por una acción (ver
// app/core/audit.py Modulo), no la clase de operación CRUD que asume el
// spec (CREATE/UPDATE/DELETE/LOGIN/LOGOUT) -- no existe DELETE ni LOGOUT
// en ningún log real. El color de cada badge se elige por la intención
// semántica más cercana de cada Accion real, no por esos nombres literales.
const ACCION_BADGE_DEFAULT = { bg: andiColors.neutral100, fg: andiColors.neutral600 };
const ACCION_BADGE: Record<string, { bg: string; fg: string }> = {
  LOGIN: { bg: andiColors.secondary100, fg: andiColors.secondary700 },
  CREAR: { bg: andiColors.success100, fg: andiColors.success700 },
  CREAR_REPORTE: { bg: andiColors.success100, fg: andiColors.success700 },
  REGISTRO: { bg: andiColors.success100, fg: andiColors.success700 },
  ACTUALIZAR: { bg: andiColors.primary100, fg: andiColors.primary700 },
  CAMBIAR_ESTADO: { bg: andiColors.primary100, fg: andiColors.primary700 },
  CAMBIAR_ESTADO_CUENTA: { bg: andiColors.primary100, fg: andiColors.primary700 },
  ASIGNAR_USUARIO: { bg: andiColors.primary100, fg: andiColors.primary700 },
  ASIGNAR_ENTIDAD: { bg: andiColors.primary100, fg: andiColors.primary700 },
};

// Descripción legible de la acción -- reemplaza el "target/entity" del
// spec: LogAuditoriaItem no trae un campo de entidad/objeto afectado
// aparte, solo actor + accion + modulo, así que esta línea describe qué
// pasó en vez de mostrar un objetivo que la API no expone.
const ACCION_LABEL: Record<string, string> = {
  LOGIN: 'Inició sesión',
  CREAR: 'Creó un registro',
  CREAR_REPORTE: 'Creó un reporte',
  REGISTRO: 'Se registró',
  ACTUALIZAR: 'Actualizó un registro',
  CAMBIAR_ESTADO: 'Cambió el estado',
  CAMBIAR_ESTADO_CUENTA: 'Cambió el estado de una cuenta',
  ASIGNAR_USUARIO: 'Asignó un usuario',
  ASIGNAR_ENTIDAD: 'Asignó una entidad',
  IMPORTACION: 'Importó datos',
  LISTAR_USUARIOS: 'Listó usuarios',
};

function formatFecha(iso: string) {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fecha} ${hora}`;
}

export default function AuditoriaScreen() {
  const [logs, setLogs] = useState<LogAuditoriaItem[]>([]);
  const [filter, setFilter] = useState<ModuloFilter>('TODOS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Un solo efecto por [filter] cubre tanto el mount inicial (primera
  // ejecución) como cada cambio de filtro después -- evita el doble
  // fetch que resultaría de un efecto de mount aparte más uno por filtro.
  useEffect(() => { loadLogs(); }, [filter]);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await auditoriaAPI.listar({
        modulo: filter === 'TODOS' ? undefined : filter,
        limite: 100,
      });
      setLogs(res.data.logs || []);
    } catch (_) {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#042F34', '#0A6F78']} style={styles.header}>
        <Text style={styles.headerTitle}>Auditoría</Text>
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
          data={logs}
          keyExtractor={l => String(l.id_log)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLogs(true); }} colors={[andiColors.primary600]} />
          }
          renderItem={({ item }) => {
            const badge = ACCION_BADGE[item.accion] ?? ACCION_BADGE_DEFAULT;
            const sobrePersonas = item.modulo === 'USUARIOS' || item.modulo === 'AUTH';
            return (
              <View style={styles.row}>
                <View style={[styles.bar, { backgroundColor: sobrePersonas ? andiColors.error400 : andiColors.primary600 }]} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTopLine}>
                    <Text style={styles.actorName} numberOfLines={1}>{item.usuario ?? 'Usuario eliminado'}</Text>
                    <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.actionBadgeText, { color: badge.fg }]}>{item.accion}</Text>
                    </View>
                  </View>
                  <Text style={styles.targetLine} numberOfLines={1}>{ACCION_LABEL[item.accion] ?? item.accion}</Text>
                  <Text style={styles.moduleLabel}>{item.modulo}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.timestamp}>{formatFecha(item.fecha_accion)}</Text>
                  <Text style={styles.ip}>{item.ip_origen ?? '—'}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="shield" size={48} color={andiColors.onSurfaceVariant} />
              <Text style={styles.emptyStateText}>Sin registros de auditoría</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceMid },
  header: { paddingTop: andiSpace[10], paddingHorizontal: andiSpace[4], paddingBottom: andiSpace[4] },
  headerTitle: { ...andiType.headingLg, color: andiColors.surface },

  filterRow: {
    flexDirection: 'row', gap: andiSpace[2], backgroundColor: andiColors.surface,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[3],
  },
  chip: { borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[3], paddingVertical: andiSpace[1] },
  chipActive: { backgroundColor: andiColors.primary600, borderColor: andiColors.primary600 },
  chipText: { ...andiType.labelSm, color: andiColors.onSurface },
  chipTextActive: { color: andiColors.surface },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: andiSpace[4] },

  row: {
    flexDirection: 'row', backgroundColor: andiColors.surface, borderRadius: andiRadius.md,
    ...andiElevation[1], marginBottom: andiSpace[2], overflow: 'hidden',
  },
  bar: { width: 4 },
  rowBody: { flex: 1, minWidth: 0, padding: andiSpace[3], gap: 2 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[2] },
  actorName: { ...andiType.labelMd, fontWeight: '700', color: andiColors.onSurface, flexShrink: 1 },
  actionBadge: { borderRadius: andiRadius.xs, paddingHorizontal: andiSpace[2], paddingVertical: 2 },
  actionBadgeText: { ...andiType.labelSm, textTransform: 'uppercase', fontWeight: '700' },
  targetLine: { ...andiType.bodySm, color: andiColors.onSurfaceVariant },
  moduleLabel: { ...andiType.caption, textTransform: 'uppercase', letterSpacing: 0.6, color: andiColors.onSurfaceVariant },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: andiSpace[3], gap: 2 },
  timestamp: { ...andiType.caption, color: andiColors.onSurface },
  ip: { ...andiType.caption, color: andiColors.onSurfaceVariant },

  emptyState: { alignItems: 'center', paddingVertical: andiSpace[10] },
  emptyStateText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3] },
});
