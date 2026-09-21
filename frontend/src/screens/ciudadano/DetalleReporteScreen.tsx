import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { reportesAPI } from '../../api/services';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import { SeverityChip, CategoryChip } from '../../components/ciudadano/Chip';
import Timeline from '../../components/ciudadano/Timeline';
import Skeleton from '../../components/ciudadano/Skeleton';
import MapaWebView from '../../components/MapaWebView';
import type { MapMarker } from '../../components/MapaWebView.types';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE, ANDI_MONO, statusMeta } from '../../theme/andi';
import type { Reporte, ReporteComunidad, HistorialEntry, HistorialEntryComunidad } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalleReporte'>;

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DetalleReporteScreen({ route, navigation }: Props) {
  const { reporte: inicial } = route.params;
  // Puede llegar la vista comunitaria (reporte de otro usuario, sin
  // id_usuario/usuario) si se navegó aquí desde el Mapa -- esta pantalla no
  // lee esos dos campos en ningún lado, así que no necesita distinguirlas.
  const [reporte, setReporte] = useState<Reporte | ReporteComunidad>(inicial);
  const [historial, setHistorial] = useState<(HistorialEntry | HistorialEntryComunidad)[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(true);

  const idReporte = inicial.id_reporte;

  useEffect(() => {
    // El pin del mapa/la tarjeta de lista solo trae campos parciales --
    // completa con el detalle real.
    reportesAPI.obtener(idReporte).then((res) => setReporte(res.data)).catch(() => {});
  }, [idReporte]);

  const loadHistorial = useCallback(async () => {
    try {
      const res = await reportesAPI.historial(idReporte);
      setHistorial((res.data || []).slice().reverse());
    } catch (_) {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, [idReporte]);

  useFocusEffect(useCallback(() => { loadHistorial(); }, [loadHistorial]));

  const hasCoords = reporte.latitud != null && reporte.longitud != null
    && !(Number(reporte.latitud) === 0 && Number(reporte.longitud) === 0);
  const lat = hasCoords ? parseFloat(String(reporte.latitud)) : null;
  const lng = hasCoords ? parseFloat(String(reporte.longitud)) : null;
  const meta = statusMeta(reporte.estado);

  const mapaMarkers: MapMarker[] = hasCoords ? [{
    id: reporte.id_reporte, lat: lat!, lng: lng!,
    severidad: reporte.severidad || 'MEDIA', estado: reporte.estado || 'PENDIENTE',
  }] : [];

  const abrirComoLlegar = () => {
    if (!hasCoords) return;
    const fallback = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}`,
      default: fallback,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(fallback);
    });
  };

  const ultimoComentario = historial[0]?.comentario;

  return (
    <View style={styles.container}>
      <LiftHeader>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>#{reporte.id_reporte} · {formatDate(reporte.created_at)}</Text>
            <Text style={styles.screenTitle}>{reporte.tipo_incidente || 'Reporte'}</Text>
          </View>
        </View>
        <View style={styles.chipsRow}>
          <View style={styles.inverseChip}><Text style={styles.inverseChipText}>{meta.icon} {meta.label}</Text></View>
          <SeverityChip severidad={reporte.severidad} />
          {!!reporte.tipo_incidente && <CategoryChip label={reporte.tipo_incidente} />}
        </View>
      </LiftHeader>

      <LiftSurface>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {hasCoords && (
            <View style={styles.mapCard}>
              <MapaWebView style={styles.map} latitude={lat!} longitude={lng!} zoom={15} markers={mapaMarkers} interactive={false} />
              <View style={styles.mapFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapLabel}>{reporte.direccion || 'Ubicación aproximada'}</Text>
                  <Text style={styles.mapCoords}>{lat!.toFixed(5)}, {lng!.toFixed(5)}</Text>
                </View>
                <TouchableOpacity style={styles.mapBtn} onPress={abrirComoLlegar}>
                  <Text style={styles.mapBtnText}>Cómo llegar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.description}>{reporte.descripcion || '—'}</Text>

          <View style={styles.nowCard}>
            <Text style={styles.nowKicker}>Ahora mismo</Text>
            {/* ReporteDetalle no expone un nombre de entidad (solo
                id_entidad) -- se usa la asignación como señal en vez de
                inventar un campo, igual que en ReportCard ciudadano. */}
            <Text style={styles.nowTitle}>
              {reporte.id_entidad ? 'Una entidad lo está atendiendo' : `Estado: ${meta.label}`}
            </Text>
            {!!ultimoComentario && <Text style={styles.nowComment}>&ldquo;{ultimoComentario}&rdquo;</Text>}
          </View>

          <Text style={styles.sectionLabel}>Qué ha pasado</Text>
          {loadingHistorial ? (
            <View style={{ gap: ANDI_SPACING.s3 }}>
              <Skeleton height={40} radius={ANDI_RADIUS.md} />
              <Skeleton height={40} radius={ANDI_RADIUS.md} delay={120} />
            </View>
          ) : historial.length > 0 ? (
            <Timeline items={historial} />
          ) : (
            <Text style={styles.emptyHistorial}>Sin movimientos registrados todavía.</Text>
          )}
        </ScrollView>
      </LiftSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ANDI_SPACING.s6 },
  emptyText: { color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ANDI_COLORS.primary700, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 18 },
  kicker: { fontFamily: ANDI_MONO, fontSize: 11, color: ANDI_COLORS.primary200 },
  screenTitle: { ...ANDI_TYPE.screen, color: '#fff' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  inverseChip: { paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary700 },
  inverseChipText: { color: ANDI_COLORS.primary100, fontSize: 12, fontWeight: '600' },

  scroll: { padding: ANDI_SPACING.s5, paddingBottom: ANDI_SPACING.s10, gap: ANDI_SPACING.s4 },

  mapCard: { borderRadius: ANDI_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant },
  map: { height: 150 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3, padding: ANDI_SPACING.s3, backgroundColor: ANDI_COLORS.surface },
  mapLabel: { ...ANDI_TYPE.label, color: ANDI_COLORS.onSurface },
  mapCoords: { fontFamily: ANDI_MONO, fontSize: 11, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },
  mapBtn: { minHeight: 40, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  mapBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 12 },

  description: { ...ANDI_TYPE.bodyLg, color: ANDI_COLORS.onSurface },

  nowCard: { backgroundColor: ANDI_COLORS.primary900, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4 },
  nowKicker: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary300, marginBottom: ANDI_SPACING.s2 },
  nowTitle: { ...ANDI_TYPE.card, color: '#fff' },
  nowComment: { ...ANDI_TYPE.body, color: ANDI_COLORS.primary100, marginTop: ANDI_SPACING.s2, fontStyle: 'italic' },

  sectionLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.onSurfaceVariant },
  emptyHistorial: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant },
});
