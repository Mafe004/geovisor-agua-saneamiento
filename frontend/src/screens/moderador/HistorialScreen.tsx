import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { historialAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import AndiHeader from '../../components/andi/AndiHeader';
import AndiBody from '../../components/andi/AndiBody';
import { andiColors, andiRadius, andiSpace, andiType, andiOverlineDecor, andiStatusPill } from '../../theme/andi';
import type { HistorialEntry } from '../../types/domain';

function formatTime(d: string | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(d: string | undefined) {
  if (!d) return 'Anterior';
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function estadoLabel(nombre: string) {
  if (nombre === 'NINGUNO') return 'Ninguno';
  return (andiStatusPill[nombre]?.label) ?? nombre.replace(/_/g, ' ');
}

interface Group { label: string; items: HistorialEntry[] }

export default function HistorialScreen() {
  const { user } = useContext(AuthContext);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { loadHistorial(); }, []);

  const loadHistorial = async () => {
    setLoading(true);
    try {
      const res = await historialAPI.listar({});
      setHistorial(res.data || []);
      setError(false);
    } catch (_) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const cambiosEstaSemana = historial.filter(h => {
    const days = (Date.now() - new Date(h.fecha_cambio).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const groups: Group[] = [];
  for (const item of historial) {
    const label = dayLabel(item.fecha_cambio);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  const flatRows: ({ type: 'day'; label: string } | { type: 'entry'; entry: HistorialEntry; isLastInGroup: boolean })[] = [];
  for (const g of groups) {
    flatRows.push({ type: 'day', label: g.label });
    g.items.forEach((entry, i) => flatRows.push({ type: 'entry', entry, isLastInGroup: i === g.items.length - 1 }));
  }

  return (
    <View style={styles.container}>
      <AndiHeader
        title="Historial"
        headerExtra={
          <View style={styles.weekStatRow}>
            <Text style={[andiType.displayLg, styles.weekNum]}>{cambiosEstaSemana}</Text>
            <Text style={[andiType.body, styles.weekLabel]}>cambios esta semana</Text>
          </View>
        }
      />

      <AndiBody>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={andiColors.primary} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[andiType.section, styles.emptyTitle]}>No se pudo cargar el historial</Text>
            <Text style={[andiType.body, styles.emptyText]}>Verifica tu conexión e intenta de nuevo.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadHistorial}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : historial.length === 0 ? (
          <View style={styles.center}>
            <Text style={[andiType.section, styles.emptyTitle]}>Sin historial</Text>
            <Text style={[andiType.body, styles.emptyText]}>No hay cambios registrados aún.</Text>
          </View>
        ) : (
          <FlatList
            data={flatRows}
            keyExtractor={(row, i) => row.type === 'day' ? `day-${row.label}-${i}` : `entry-${row.entry.id_historial}`}
            contentContainerStyle={styles.list}
            renderItem={({ item: row }) => {
              if (row.type === 'day') {
                return <Text style={[andiType.overline, andiOverlineDecor, styles.dayLabel]}>{row.label}</Text>;
              }
              const { entry, isLastInGroup } = row;
              const dotColor = andiStatusPill[entry.estado_nuevo]?.bd ?? andiColors.outline;
              const esTuyo = entry.id_usuario_accion === user?.id_usuario;
              return (
                <View style={styles.entryRow}>
                  <View style={styles.timelineCol}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                    {!isLastInGroup && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.entryContent}>
                    <View style={styles.entryHeaderRow}>
                      <Text style={styles.entryId}>#{entry.id_reporte}</Text>
                      <Text style={[andiType.caption, styles.entryTransition]}>
                        {estadoLabel(entry.estado_anterior)} → <Text style={styles.entryTransitionStrong}>{estadoLabel(entry.estado_nuevo)}</Text>
                      </Text>
                      {esTuyo && (
                        <View style={styles.tuTag}><Text style={styles.tuTagText}>Tú</Text></View>
                      )}
                    </View>
                    {entry.comentario && (
                      <Text style={[andiType.body, styles.entryComment]}>&quot;{entry.comentario}&quot;</Text>
                    )}
                    <Text style={[andiType.caption, styles.entryMeta]}>
                      {entry.usuario_accion} · {entry.rol_usuario_accion} · {formatTime(entry.fecha_cambio)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </AndiBody>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  weekStatRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: andiSpace[2],
    marginTop: andiSpace[3],
  },
  weekNum: { color: andiColors.n0 },
  weekLabel: { color: andiColors.primary200 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: andiSpace[6] },
  emptyTitle: { color: andiColors.onSurface, marginBottom: andiSpace[2] },
  emptyText: { color: andiColors.onSurfaceVariant, textAlign: 'center' },
  retryBtn: { marginTop: andiSpace[4], backgroundColor: andiColors.primary600, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[5], paddingVertical: andiSpace[3] },
  retryText: { color: andiColors.n0, fontWeight: '700' },

  list: { paddingHorizontal: andiSpace[5], paddingTop: andiSpace[4], paddingBottom: andiSpace[6] },
  dayLabel: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[2], marginTop: andiSpace[2] },

  entryRow: { flexDirection: 'row', gap: andiSpace[3] },
  timelineCol: { alignItems: 'center', width: 14, flexShrink: 0 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: andiColors.outlineVariant, marginTop: 2 },
  entryContent: { flex: 1, paddingBottom: andiSpace[4] },
  entryHeaderRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: andiSpace[2], marginBottom: 4 },
  entryId: { fontFamily: 'monospace', fontSize: 12, lineHeight: 16, fontWeight: '500', color: andiColors.onSurfaceVariant },
  entryTransition: { color: andiColors.onSurfaceVariant },
  entryTransitionStrong: { color: andiColors.onSurface, fontWeight: '700' },
  tuTag: { backgroundColor: andiColors.primary50, borderRadius: andiRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tuTagText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: andiColors.primary700, textTransform: 'uppercase' },
  entryComment: { color: andiColors.onSurface },
  entryMeta: { color: andiColors.onSurfaceVariant, marginTop: 4 },
});
