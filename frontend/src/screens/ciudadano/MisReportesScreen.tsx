import React, { useState, useContext, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import ReportCard, { AnchorReportCard, DraftReportCard, type DraftSummary } from '../../components/ciudadano/ReportCard';
import SystemBanner from '../../components/ciudadano/SystemBanner';
import Skeleton from '../../components/ciudadano/Skeleton';
import { getDrafts, type ReporteDraft } from '../../utils/offlineDrafts';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';
import type { Reporte } from '../../types/domain';
import type { operations } from '../../types/api';
import type { CiudadanoTabParamList, RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<CiudadanoTabParamList, 'Reportes'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

type ReportesQuery = operations['listar_reportes_reportes__get']['parameters']['query'];

type Section =
  | { __type: 'error' }
  | { __type: 'draft'; item: ReporteDraft }
  | { __type: 'anchor'; item: Reporte }
  | { __type: 'neutral'; item: Reporte };

export default function MisReportesScreen({ navigation }: Props) {
  const { user } = useContext(AuthContext);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [drafts, setDrafts] = useState<ReporteDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    setDrafts(await getDrafts());
    try {
      // id_usuario no existe en el query de GET /reportes/ (ver
      // MIGRATION_FINDINGS.md) -- el backend ya filtra "mis reportes" por
      // el JWT del lado del servidor para el rol ciudadano, así que este
      // parámetro se ignora en silencio. Se preserva el envío tal cual.
      const params: ReportesQuery & { id_usuario?: number } = { id_usuario: user?.id_usuario };
      const res = await reportesAPI.listar(params);
      setReportes(res.data || []);
    } catch (_) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id_usuario]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = () => { setRefreshing(true); loadAll(true); };

  const counts = reportes.reduce<Record<string, number>>((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    return acc;
  }, {});
  const [anchor, ...rest] = reportes;
  const hasNothing = reportes.length === 0 && drafts.length === 0;

  const sections: Section[] = [
    ...(error ? [{ __type: 'error' } as const] : []),
    ...drafts.map((item): Section => ({ __type: 'draft', item })),
    ...(anchor ? [{ __type: 'anchor', item: anchor } as const] : []),
    ...rest.map((item): Section => ({ __type: 'neutral', item })),
  ];

  const sectionKey = (s: Section, i: number) => {
    if (s.__type === 'error') return `error-${i}`;
    if (s.__type === 'draft') return `draft-${s.item.id}`;
    return `${s.__type}-${s.item.id_reporte}`;
  };

  return (
    <View style={styles.container}>
      <LiftHeader>
        <Text style={styles.title}>Mis reportes</Text>
        <View style={styles.statsRow}>
          <StatBlock value={counts.PENDIENTE || 0} label="Pendientes" />
          <StatBlock value={counts.EN_PROCESO || 0} label="En proceso" />
          <StatBlock value={counts.RESUELTO || 0} label="Resueltos" />
        </View>
      </LiftHeader>

      <LiftSurface>
        {loading ? (
          <View style={styles.skeletonWrap}>
            <Skeleton height={90} radius={ANDI_RADIUS.xl} />
            <Skeleton height={90} radius={ANDI_RADIUS.xl} delay={120} />
            <Skeleton height={90} radius={ANDI_RADIUS.xl} delay={240} />
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={sectionKey}
            contentContainerStyle={hasNothing ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ANDI_COLORS.primary600]} />}
            renderItem={({ item: section }) => {
              if (section.__type === 'error') {
                return (
                  <SystemBanner
                    tone="error"
                    icon="!"
                    title="No pudimos traer tus reportes"
                    message="El servidor no respondió. Tus borradores siguen guardados en el teléfono."
                    actionLabel="Reintentar"
                    onAction={() => loadAll()}
                  />
                );
              }
              if (section.__type === 'draft') {
                const summary: DraftSummary = section.item;
                return (
                  <DraftReportCard
                    item={summary}
                    onResume={(draft) => navigation.navigate('Crear', { draftId: draft.id })}
                  />
                );
              }
              if (section.__type === 'anchor') {
                return (
                  <AnchorReportCard
                    reporte={section.item}
                    onPress={(r) => navigation.navigate('DetalleReporte', { reporte: r })}
                  />
                );
              }
              return (
                <ReportCard
                  reporte={section.item}
                  onPress={(r) => navigation.navigate('DetalleReporte', { reporte: r })}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Todavía no has reportado nada</Text>
                <Text style={styles.emptyText}>
                  Cuando veas una fuga, un rebose o agua turbia, márcalo en el mapa. Toma menos de medio minuto.
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Crear')}>
                  <Text style={styles.emptyBtnText}>Reportar algo</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </LiftSurface>
    </View>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  title: { ...ANDI_TYPE.display, color: '#fff' },
  statsRow: { flexDirection: 'row', gap: ANDI_SPACING.s5, marginTop: ANDI_SPACING.s5 },
  statValue: { ...ANDI_TYPE.displayLg, fontSize: 26, color: '#fff' },
  statLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary200, marginTop: 2 },

  skeletonWrap: { padding: ANDI_SPACING.s5, gap: ANDI_SPACING.s3 },
  list: { padding: ANDI_SPACING.s5, gap: ANDI_SPACING.s3 },
  emptyContainer: { flex: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ANDI_SPACING.s6, gap: ANDI_SPACING.s2 },
  emptyTitle: { ...ANDI_TYPE.section, color: ANDI_COLORS.onSurface, textAlign: 'center' },
  emptyText: { ...ANDI_TYPE.bodyLg, color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center', maxWidth: 280, marginBottom: ANDI_SPACING.s4 },
  emptyBtn: { minHeight: 52, paddingHorizontal: ANDI_SPACING.s8, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.accent500, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
