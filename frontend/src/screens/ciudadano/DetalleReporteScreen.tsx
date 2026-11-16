import React, { useState, useEffect, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { API_URL } from '../../api/client';
import { reportesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import { useAndiDialog } from '../../components/ciudadano/AndiDialog';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import { SeverityChip, CategoryChip } from '../../components/ciudadano/Chip';
import Timeline from '../../components/ciudadano/Timeline';
import Skeleton from '../../components/ciudadano/Skeleton';
import MapaWebView from '../../components/MapaWebView';
import type { MapMarker } from '../../components/MapaWebView.types';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE, ANDI_MONO, statusMeta } from '../../theme/andi';
import type { Reporte, ReporteComunidad, HistorialEntry, HistorialEntryComunidad, UserPublic } from '../../types/domain';
import { Rol } from '../../types/models';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalleReporte'>;

// id_estado_cuenta ACTIVO (EstadoCuenta.ACTIVO en backend/app/core/roles.py).
const ESTADO_CUENTA_ACTIVO = 1;
// Único estado en que el dueño puede editar/eliminar (ESTADO_EDITABLE en
// backend/app/core/policies.py).
const ESTADO_EDITABLE = 'PENDIENTE';

/**
 * Espejo de puede_editar_reporte() del backend, solo para mostrar u ocultar
 * Editar/Eliminar -- el backend sigue siendo la autoridad (403/409). Las
 * cinco condiciones a la vez; cualquier dato faltante da false.
 */
function puedeEditarReporte(user: UserPublic | null, reporte: Reporte | ReporteComunidad): reporte is Reporte {
  if (!user) return false;
  if (user.id_rol !== Rol.CIUDADANO) return false;
  if (user.id_estado_cuenta !== ESTADO_CUENTA_ACTIVO) return false;
  // La vista comunitaria (reporte de otro usuario) no trae id_usuario:
  // nunca es propio.
  if (!('id_usuario' in reporte) || reporte.id_usuario !== user.id_usuario) return false;
  if (reporte.id_entidad != null) return false;
  return reporte.estado === ESTADO_EDITABLE;
}

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
  const { user } = useContext(AuthContext);
  const { showDialog, dialog } = useAndiDialog();
  // false cuando el reporte ya no existe (404) o se acaba de eliminar:
  // oculta Editar/Eliminar aunque los datos en pantalla sigan visibles.
  const [disponible, setDisponible] = useState(true);
  const [eliminando, setEliminando] = useState(false);

  const cargarReporte = useCallback(() => {
    // El pin del mapa/la tarjeta de lista solo trae campos parciales --
    // completa con el detalle real.
    reportesAPI.obtener(idReporte)
      .then((res) => { setReporte(res.data); setDisponible(true); })
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.status === 404) setDisponible(false);
      });
  }, [idReporte]);

  // En foco (no solo al montar): al volver de EditarReporte se muestra la
  // versión guardada, y si el reporte dejó de ser editable se ocultan las
  // acciones.
  useFocusEffect(cargarReporte);

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

  // imagen_url llega relativa al mount /uploads del backend
  // (/uploads/reportes/<uuid>.jpg) -- se antepone el mismo API_URL que usa
  // axios. Una URL absoluta (filas antiguas) se usa tal cual.
  const imagenPath = reporte.imagen_url?.trim();
  const imagenUri = imagenPath
    ? /^https?:\/\//i.test(imagenPath)
      ? imagenPath
      : `${API_URL}${imagenPath.startsWith('/') ? '' : '/'}${imagenPath}`
    : null;
  const [fotoRatio, setFotoRatio] = useState<number | null>(null);
  const [fotoError, setFotoError] = useState(false);

  useEffect(() => {
    setFotoRatio(null);
    setFotoError(false);
    if (!imagenUri) return;
    // Proporción real de la foto para que ocupe el ancho disponible sin
    // deformarse (vertical u horizontal).
    let cancelado = false;
    Image.getSize(
      imagenUri,
      (w, h) => { if (!cancelado) setFotoRatio(w > 0 && h > 0 ? w / h : 4 / 3); },
      () => { if (!cancelado) setFotoError(true); },
    );
    return () => { cancelado = true; };
  }, [imagenUri]);

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

  // Reporte (completo) cuando el ciudadano puede editarlo/eliminarlo; null
  // en cualquier otro caso, y entonces no se muestran las acciones.
  const reporteEditable = disponible && puedeEditarReporte(user, reporte) ? reporte : null;

  const eliminarReporte = async () => {
    setEliminando(true);
    try {
      await reportesAPI.eliminar(idReporte);
      setDisponible(false);
      showDialog('Reporte eliminado', 'Tu reporte se eliminó definitivamente.', { tone: 'success', buttons: [
        { text: 'OK', onPress: () => navigation.goBack() },
      ] });
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const detail = axios.isAxiosError<{ detail?: unknown }>(e) ? e.response?.data?.detail : undefined;
      const msg = typeof detail === 'string' ? detail : undefined;
      if (status === 404) {
        setDisponible(false);
        showDialog('Reporte no encontrado', 'Este reporte ya no existe.', { tone: 'warning', buttons: [
          { text: 'OK', onPress: () => navigation.goBack() },
        ] });
        return;
      }
      if (status === 403 || status === 409) {
        // Ya no es editable (p. ej. lo asignaron mientras tanto): se
        // recarga para que las acciones desaparezcan.
        showDialog('No se puede eliminar', msg || 'Este reporte ya no se puede eliminar.', { tone: 'warning' });
        cargarReporte();
        return;
      }
      showDialog('No se pudo eliminar', 'Revisa tu conexión e inténtalo de nuevo.', { tone: 'error' });
    } finally {
      setEliminando(false);
    }
  };

  const confirmarEliminar = () => {
    showDialog('¿Eliminar este reporte?', 'Se borrará de forma definitiva y no se puede deshacer.', { tone: 'warning', buttons: [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { eliminarReporte(); } },
    ] });
  };

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

          {!!imagenUri && (
            <View style={{ gap: ANDI_SPACING.s2 }}>
              <Text style={styles.sectionLabel}>Evidencia fotográfica</Text>
              {fotoError ? (
                <Text style={styles.emptyHistorial}>No se pudo cargar la fotografía.</Text>
              ) : fotoRatio == null ? (
                <Skeleton height={200} radius={ANDI_RADIUS.xl} />
              ) : (
                <Image
                  source={{ uri: imagenUri }}
                  style={[styles.foto, { aspectRatio: fotoRatio }]}
                  resizeMode="contain"
                  accessibilityLabel="Fotografía adjunta al reporte"
                  onError={() => setFotoError(true)}
                />
              )}
            </View>
          )}

          {reporteEditable && (
            <View style={styles.accionesRow}>
              <TouchableOpacity
                style={[styles.accionBtn, eliminando && styles.disabled]}
                onPress={() => navigation.navigate('EditarReporte', { reporte: reporteEditable })}
                disabled={eliminando}
                accessibilityRole="button"
              >
                <Text style={styles.accionBtnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.accionBtn, styles.eliminarBtn, eliminando && styles.disabled]}
                onPress={confirmarEliminar}
                disabled={eliminando}
                accessibilityRole="button"
              >
                <Text style={styles.eliminarBtnText}>{eliminando ? 'Eliminando…' : 'Eliminar'}</Text>
              </TouchableOpacity>
            </View>
          )}

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
      {dialog}
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

  foto: { width: '100%', borderRadius: ANDI_RADIUS.xl, borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, backgroundColor: ANDI_COLORS.surface },

  accionesRow: { flexDirection: 'row', gap: ANDI_SPACING.s2 },
  accionBtn: { flex: 1, minHeight: 44, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  accionBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 13 },
  eliminarBtn: { backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.error },
  eliminarBtnText: { color: ANDI_COLORS.error, fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.6 },

  nowCard: { backgroundColor: ANDI_COLORS.primary900, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4 },
  nowKicker: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary300, marginBottom: ANDI_SPACING.s2 },
  nowTitle: { ...ANDI_TYPE.card, color: '#fff' },
  nowComment: { ...ANDI_TYPE.body, color: ANDI_COLORS.primary100, marginTop: ANDI_SPACING.s2, fontStyle: 'italic' },

  sectionLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.onSurfaceVariant },
  emptyHistorial: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant },
});
