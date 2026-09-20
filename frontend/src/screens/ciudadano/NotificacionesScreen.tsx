import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { notificacionesAPI } from '../../api/services';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import Skeleton from '../../components/ciudadano/Skeleton';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';
import type { NotificacionItem } from '../../types/domain';

const TIPO_META: Record<string, { icon: string; title: string }> = {
  REPORTE_CREADO: { icon: '✓', title: 'Reporte recibido' },
  CAMBIO_ESTADO: { icon: '↻', title: 'Actualización de tu reporte' },
};
const DEFAULT_TIPO_META = { icon: 'i', title: 'Notificación' };

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hoy ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  if (diff < 172800) return `ayer ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

type SectionRow = { __section: string };
type ListRow = SectionRow | NotificacionItem;

function isSection(row: ListRow): row is SectionRow {
  return '__section' in row;
}

export default function NotificacionesScreen() {
  const [notis, setNotis] = useState<NotificacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotis = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await notificacionesAPI.listar();
      setNotis(res.data || []);
    } catch (_) {
      setNotis([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadNotis(); }, [loadNotis]));

  const markRead = async (id: number) => {
    try {
      await notificacionesAPI.marcarLeida(id);
      setNotis((prev) => prev.map((n) => (n.id_notificacion === id ? { ...n, leida: true } : n)));
    } catch (_) {
      // ignorado a propósito: si falla, el punto de "no leída" simplemente
      // se queda visible para que el usuario pueda reintentar.
    }
  };

  const markAllRead = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas();
      setNotis((prev) => prev.map((n) => ({ ...n, leida: true })));
    } catch (_) {
      // ignorado a propósito, mismo criterio que markRead.
    }
  };

  const unreadCount = notis.filter((n) => !n.leida).length;
  const hoy = notis.filter((n) => isToday(n.fecha_envio));
  const antes = notis.filter((n) => !isToday(n.fecha_envio));

  const rows: ListRow[] = [
    ...(hoy.length ? [{ __section: 'Hoy' } as SectionRow, ...hoy] : []),
    ...(antes.length ? [{ __section: 'Antes' } as SectionRow, ...antes] : []),
  ];

  return (
    <View style={styles.container}>
      <LiftHeader>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Avisos</Text>
            <View style={styles.unreadRow}>
              <Text style={styles.unreadNum}>{unreadCount}</Text>
              <Text style={styles.unreadLabel}>sin leer</Text>
            </View>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
              <Text style={styles.markAllText}>Marcar todo</Text>
            </TouchableOpacity>
          )}
        </View>
      </LiftHeader>

      <LiftSurface>
        {loading ? (
          <View style={styles.skeletonWrap}>
            <Skeleton height={70} radius={ANDI_RADIUS.xl} />
            <Skeleton height={70} radius={ANDI_RADIUS.xl} delay={120} />
            <Skeleton height={70} radius={ANDI_RADIUS.xl} delay={240} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => (isSection(item) ? `section-${item.__section}` : String(item.id_notificacion))}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotis(true); }} colors={[ANDI_COLORS.primary600]} />}
            renderItem={({ item }) => {
              if (isSection(item)) return <Text style={styles.sectionLabel}>{item.__section}</Text>;
              const meta = TIPO_META[item.tipo_notificacion] || DEFAULT_TIPO_META;
              const unread = !item.leida;
              return (
                <TouchableOpacity
                  style={[styles.card, unread ? styles.cardUnread : styles.cardRead]}
                  onPress={() => unread && markRead(item.id_notificacion)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.iconWrap, unread ? styles.iconWrapUnread : styles.iconWrapRead]}>
                    <Text style={styles.icon}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, !unread && styles.cardTitleRead]}>{meta.title}</Text>
                    <Text style={styles.cardMeta} numberOfLines={2}>{item.mensaje}</Text>
                    <Text style={styles.cardTime}>
                      {item.id_reporte ? `#${item.id_reporte} · ` : ''}{timeAgo(item.fecha_envio)}
                    </Text>
                  </View>
                  {unread && <View style={styles.dot} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Sin avisos por ahora</Text>
                <Text style={styles.emptyText}>Aquí verás los cambios en tus reportes.</Text>
              </View>
            }
            ListFooterComponent={
              notis.length > 0 ? (
                <View style={styles.footerNote}>
                  <Text style={styles.footerTitle}>Solo llegan avisos de tus propios reportes</Text>
                  <Text style={styles.footerText}>Te avisamos automáticamente cada vez que cambie el estado.</Text>
                </View>
              ) : null
            }
          />
        )}
      </LiftSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { ...ANDI_TYPE.display, color: '#fff' },
  unreadRow: { flexDirection: 'row', alignItems: 'baseline', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s2 },
  unreadNum: { ...ANDI_TYPE.displayLg, fontSize: 30, color: '#fff' },
  unreadLabel: { ...ANDI_TYPE.body, color: ANDI_COLORS.primary200 },
  markAllBtn: { minHeight: 40, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  markAllText: { color: ANDI_COLORS.primary100, fontWeight: '600', fontSize: 12 },

  skeletonWrap: { padding: ANDI_SPACING.s5, gap: ANDI_SPACING.s3 },
  list: { padding: ANDI_SPACING.s5, gap: ANDI_SPACING.s2, flexGrow: 1 },
  sectionLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.onSurfaceVariant, marginTop: ANDI_SPACING.s2, marginBottom: 2 },

  card: { flexDirection: 'row', gap: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4, borderWidth: 1 },
  cardUnread: { backgroundColor: ANDI_COLORS.primary50, borderColor: ANDI_COLORS.primary200 },
  cardRead: { backgroundColor: ANDI_COLORS.surface, borderColor: ANDI_COLORS.outlineVariant },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconWrapUnread: { backgroundColor: ANDI_COLORS.stProBg },
  iconWrapRead: { backgroundColor: ANDI_COLORS.surfaceMid },
  icon: { fontSize: 16 },
  cardTitle: { ...ANDI_TYPE.label, color: ANDI_COLORS.onSurface },
  cardTitleRead: { fontWeight: '400', color: ANDI_COLORS.n600 },
  cardMeta: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },
  cardTime: { ...ANDI_TYPE.caption, color: ANDI_COLORS.n400, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ANDI_COLORS.primary600, marginTop: 4 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: ANDI_SPACING.s16, gap: ANDI_SPACING.s2 },
  emptyTitle: { ...ANDI_TYPE.section, color: ANDI_COLORS.onSurface },
  emptyText: { ...ANDI_TYPE.body, color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center' },

  footerNote: { marginTop: ANDI_SPACING.s4, padding: ANDI_SPACING.s5, borderWidth: 1, borderStyle: 'dashed', borderColor: ANDI_COLORS.outline, borderRadius: ANDI_RADIUS.xl, alignItems: 'center' },
  footerTitle: { ...ANDI_TYPE.label, color: ANDI_COLORS.n600, textAlign: 'center' },
  footerText: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center', marginTop: 4 },
});
