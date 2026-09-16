import React, { useState, useContext, useEffect, type ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { reportesAPI, catalogosAPI, siasarAPI, historialAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import GradientHeader from '../../components/GradientHeader';
import EstadoChips from '../../components/EstadoChips';
import MapaWebView from '../../components/MapaWebView';
import AndiHeader from '../../components/andi/AndiHeader';
import SiasarComunidadInfo from '../../components/SiasarComunidadInfo';
import { andiColors, andiRadius, andiSpace, andiType, andiElevation, andiStatusPill } from '../../theme/andi';
import type { MapMarker } from '../../components/MapaWebView.types';
import type { Reporte, EstadoReporteItem, ComunidadDetalle, HistorialEntry } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalleReporte'>;

/**
 * Trae el detalle completo de la comunidad SIASAR enlazada (reporte.vereda_siasar
 * solo trae el resumen -- este pide el endpoint 4 para tener población,
 * cobertura, sistemas, etc.). null mientras carga o si no hay vínculo; el
 * caller decide cómo envolverlo (Section clásico vs. sección Andi).
 */
function useSiasarDiagnostico(idSiasar: number | undefined): ComunidadDetalle | null {
  const [detalle, setDetalle] = useState<ComunidadDetalle | null>(null);
  useEffect(() => {
    if (idSiasar == null) { setDetalle(null); return; }
    let mounted = true;
    siasarAPI.comunidad(idSiasar)
      .then(res => { if (mounted) setDetalle(res.data); })
      .catch(() => { if (mounted) setDetalle(null); });
    return () => { mounted = false; };
  }, [idSiasar]);
  return detalle;
}

function formatDate(d: string | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function useHistorialReporte(idReporte: number): { historial: HistorialEntry[]; cargando: boolean } {
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let mounted = true;
    setCargando(true);
    historialAPI.porReporte(idReporte)
      .then(res => { if (mounted) setHistorial(res.data || []); })
      .catch(() => { if (mounted) setHistorial([]); })
      .finally(() => { if (mounted) setCargando(false); });
    return () => { mounted = false; };
  }, [idReporte]);
  return { historial, cargando };
}

function estadoLabel(nombre: string) {
  return andiStatusPill[nombre]?.label ?? nombre.replace(/_/g, ' ');
}

/** Duración legible entre dos fechas ISO -- usado para el "tiempo de
 * atención" del recibo, calculado en el cliente a partir de fechas reales
 * de historial_reportes (el backend no expone una duración ya calculada). */
function duracionDesde(desde: string): string {
  const ms = Date.now() - new Date(desde).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const restoMin = min % 60;
  if (h < 24) return restoMin > 0 ? `${h} h ${restoMin} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} día${d === 1 ? '' : 's'}`;
}

export default function DetalleReporteScreen({ route, navigation }: Props) {
  // route.params.reporte es requerido en RootStackParamList (ver
  // navigation/types.ts), así que `route.params || {}` y el chequeo
  // `if (!reporte)` más abajo quedan como código muerto una vez tipado
  // honestamente -- un objeto nunca es falsy. Se preservan sin tocar (ver
  // MIGRATION_FINDINGS.md): es la inconsistencia que Step 4 pidió anotar,
  // no arreglar.
  const { reporte: inicial } = route.params || {};
  const [reporte, setReporte] = useState<Reporte>(inicial);
  const [estadosDisponibles, setEstadosDisponibles] = useState<EstadoReporteItem[]>([]);
  const { isModerador, isAdmin, isEntidad } = useContext(AuthContext);

  useEffect(() => {
    let mounted = true;
    catalogosAPI.estadosReporte()
      .then(res => { if (mounted) setEstadosDisponibles(res.data || []); })
      .catch(() => { if (mounted) setEstadosDisponibles([]); });
    return () => { mounted = false; };
  }, []);

  if (!reporte) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No se encontró información del reporte.</Text>
      </View>
    );
  }

  // El sistema visual Andi (canvas "Andi - Moderador.dc.html") solo rediseña
  // Moderador/Entidad -- Ciudadano/Admin conservan la pantalla clásica.
  // Moderador hoy no navega aquí (su flujo de cambio de estado es
  // TriageSheet), pero el registro de ruta se deja igual para ambos roles.
  if (isEntidad) {
    return (
      <EntidadCierreView
        reporte={reporte}
        estadosDisponibles={estadosDisponibles}
        onBack={() => navigation.goBack()}
        onUpdated={setReporte}
      />
    );
  }

  return (
    <ClassicDetalleView
      reporte={reporte}
      estadosDisponibles={estadosDisponibles}
      canChangeStatus={isModerador || isAdmin}
      onBack={() => navigation.goBack()}
      onUpdated={setReporte}
    />
  );
}

/* ── Vista clásica (Ciudadano / Admin) — sin cambios visuales ── */

function ClassicDetalleView({
  reporte, estadosDisponibles, canChangeStatus, onBack, onUpdated,
}: {
  reporte: Reporte;
  estadosDisponibles: EstadoReporteItem[];
  canChangeStatus: boolean;
  onBack: () => void;
  onUpdated: (r: Reporte) => void;
}) {
  const [idEstadoNuevo, setIdEstadoNuevo] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [updating, setUpdating] = useState(false);
  // "Entity/moderator report detail screen" (canChangeStatus ya excluye a
  // Ciudadano en esta vista compartida) -- Ciudadano nunca ve el
  // diagnóstico oficial de su propia zona en su propia pantalla.
  const siasarDetalle = useSiasarDiagnostico(
    canChangeStatus ? reporte.vereda_siasar?.id_siasar : undefined
  );

  const handleUpdateEstado = async () => {
    const seleccionado = estadosDisponibles.find(e => e.id_estado === idEstadoNuevo);
    if (!seleccionado || seleccionado.nombre === reporte.estado) {
      Alert.alert('Sin cambios', 'Selecciona un estado diferente al actual.');
      return;
    }
    try {
      setUpdating(true);
      const res = await reportesAPI.cambiarEstado(reporte.id_reporte, {
        id_estado_nuevo: idEstadoNuevo as number,
        comentario: comentario.trim() || undefined,
      });
      onUpdated(res.data.reporte);
      setComentario('');
      setIdEstadoNuevo(null);
      Alert.alert(
        '✅ Estado actualizado',
        `El reporte ahora está en: ${seleccionado.nombre.replace(/_/g, ' ')}`
      );
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      Alert.alert('Error', msg || 'No se pudo actualizar el estado.');
    } finally {
      setUpdating(false);
    }
  };

  const hasCoords =
    reporte.latitud != null &&
    reporte.longitud != null &&
    !(reporte.latitud === 0 && reporte.longitud === 0);

  const mapaMarkers: MapMarker[] = hasCoords
    ? [{
        id: reporte.id_reporte,
        lat: parseFloat(String(reporte.latitud)),
        lng: parseFloat(String(reporte.longitud)),
        titulo: `Reporte #${reporte.id_reporte}`,
        descripcion: reporte.descripcion || '',
        severidad: reporte.severidad || 'MEDIA',
        estado: reporte.estado || 'PENDIENTE',
      }]
    : [];

  return (
    <View style={styles.container}>
      <GradientHeader
        title={`Reporte #${reporte.id_reporte}`}
        subtitle="Detalle del reporte"
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.scroll} nestedScrollEnabled>
        <View style={styles.badgeRow}>
          <StatusBadge status={reporte.estado} type="status" size="lg" />
          <StatusBadge status={reporte.severidad} type="severity" size="lg" />
        </View>

        <Section title="📝 Descripción">
          <Text style={styles.description}>{reporte.descripcion || '—'}</Text>
        </Section>

        <Section title="ℹ️ Detalles">
          <DetailRow label="Tipo de incidente" value={reporte.tipo_incidente || '—'} />
          <DetailRow label="Dirección" value={reporte.direccion || 'No especificada'} />
          <DetailRow label="Reportado por" value={reporte.usuario || '—'} />
          <DetailRow label="Fecha reporte" value={formatDate(reporte.created_at)} />
        </Section>

        {hasCoords && (
          <Section title="📍 Ubicación">
            <MapaWebView
              style={styles.map}
              latitude={parseFloat(String(reporte.latitud))}
              longitude={parseFloat(String(reporte.longitud))}
              zoom={15}
              markers={mapaMarkers}
              showCenterPin={false}
              interactive={false}
            />
            <Text style={styles.coordText}>
              {parseFloat(String(reporte.latitud)).toFixed(5)}, {parseFloat(String(reporte.longitud)).toFixed(5)}
            </Text>
          </Section>
        )}

        {siasarDetalle && (
          <Section title="📊 Diagnóstico oficial de la zona (SIASAR)">
            <SiasarComunidadInfo data={siasarDetalle} />
          </Section>
        )}

        {canChangeStatus && (
          <Section title="🔄 Cambiar Estado">
            <EstadoChips
              estados={estadosDisponibles}
              selectedId={idEstadoNuevo}
              currentNombre={reporte.estado}
              onSelect={setIdEstadoNuevo}
            />

            <Text style={styles.commentLabel}>Comentario (opcional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Ej: Se verificó el problema en campo…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={comentario}
              onChangeText={setComentario}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.updateBtn, updating && styles.updateBtnDisabled]}
              onPress={handleUpdateEstado}
              disabled={updating}
            >
              <LinearGradient
                colors={['#1565C0', '#00ACC1']}
                style={styles.updateBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {updating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.updateBtnText}>Guardar cambio</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Vista Andi (Entidad) — "Cerrar el reporte", ported from the canvas ── */

function EntidadCierreView({
  reporte, estadosDisponibles, onBack, onUpdated,
}: {
  reporte: Reporte;
  estadosDisponibles: EstadoReporteItem[];
  onBack: () => void;
  onUpdated: (r: Reporte) => void;
}) {
  // El backend no soporta una bitácora de avance sin cambio de estado --
  // "Sigue en proceso" es honesto sobre eso: no llama a la API, solo
  // descarta el cierre. "Resuelto" es la única transición real que hace.
  const [resolviendo, setResolviendo] = useState(true);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<{ estadoAnterior: string; comentario: string; duracion: string | null } | null>(null);
  const siasarDetalle = useSiasarDiagnostico(reporte.vereda_siasar?.id_siasar);
  const { historial, cargando: cargandoHistorial } = useHistorialReporte(reporte.id_reporte);

  const hasCoords =
    reporte.latitud != null && reporte.longitud != null &&
    !(reporte.latitud === 0 && reporte.longitud === 0);
  const mapaMarkers: MapMarker[] = hasCoords
    ? [{
        id: reporte.id_reporte,
        lat: parseFloat(String(reporte.latitud)),
        lng: parseFloat(String(reporte.longitud)),
        severidad: reporte.severidad || 'MEDIA',
        estado: reporte.estado || 'PENDIENTE',
      }]
    : [];

  const handleGuardar = async () => {
    if (!resolviendo) { onBack(); return; }
    if (!comentario.trim()) {
      Alert.alert('Comentario requerido', 'Describe qué se hizo antes de marcar como resuelto.');
      return;
    }
    const resuelto = estadosDisponibles.find(e => e.nombre === 'RESUELTO');
    if (!resuelto) return;

    setErrorMsg(null);
    try {
      setSaving(true);
      const res = await reportesAPI.cambiarEstado(reporte.id_reporte, {
        id_estado_nuevo: resuelto.id_estado,
        comentario: comentario.trim(),
      });
      onUpdated(res.data.reporte);
      // Tiempo de atención: se calcula en el cliente desde el último
      // "EN_PROCESO" real en el historial (dato existente), no un campo
      // inventado -- si no hay ese tramo (p.ej. se resolvió sin pasar por
      // EN_PROCESO), el recibo simplemente omite la duración.
      const ultimoEnProceso = [...historial].reverse().find(h => h.estado_nuevo === 'EN_PROCESO');
      setRecibo({
        estadoAnterior: reporte.estado,
        comentario: comentario.trim(),
        duracion: ultimoEnProceso ? duracionDesde(ultimoEnProceso.fecha_cambio) : null,
      });
    } catch (e) {
      // El texto escrito NO se limpia en este catch a propósito: si el
      // guardado falla (p.ej. 500), el ciudadano-moderador no debería
      // tener que volver a escribir el mismo comentario dos veces.
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      setErrorMsg(msg || 'No se pudo guardar el cambio. Tu comentario sigue aquí, puedes intentar de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (recibo) {
    return (
      <View style={andiStyles.container}>
        <AndiHeader kicker={`#${reporte.id_reporte}`} title="Reporte resuelto" />
        <ScrollView contentContainerStyle={andiStyles.scroll}>
          <View style={andiStyles.reciboIconWrap}>
            <Feather name="check-circle" size={56} color={andiColors.success} />
          </View>
          <View style={andiStyles.reciboRow}>
            <View style={andiStyles.reciboEstadoPill}>
              <Text style={andiStyles.reciboEstadoPillText}>{estadoLabel(recibo.estadoAnterior)}</Text>
            </View>
            <Feather name="arrow-right" size={16} color={andiColors.onSurfaceVariant} />
            <View style={[andiStyles.reciboEstadoPill, { backgroundColor: andiColors.stResBg }]}>
              <Text style={[andiStyles.reciboEstadoPillText, { color: andiColors.stResFg }]}>Resuelto</Text>
            </View>
          </View>
          {recibo.duracion && (
            <Text style={[andiType.body, andiStyles.reciboDuracion]}>Tiempo de atención: {recibo.duracion}</Text>
          )}
          <View style={andiStyles.section}>
            <Text style={[andiType.overline, andiStyles.sectionLabel]}>Qué se hizo</Text>
            <Text style={[andiType.body, andiStyles.reciboComentario]}>&quot;{recibo.comentario}&quot;</Text>
          </View>
          <TouchableOpacity style={[andiStyles.saveBtn, andiElevation[2]]} onPress={onBack}>
            <Text style={andiStyles.saveBtnText}>Listo</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={andiStyles.container}>
      <AndiHeader onBack={onBack} kicker={`#${reporte.id_reporte}`} title={reporte.descripcion || 'Reporte'} />

      <ScrollView contentContainerStyle={andiStyles.scroll} nestedScrollEnabled>
        {hasCoords ? (
          <MapaWebView
            style={andiStyles.map}
            latitude={parseFloat(String(reporte.latitud))}
            longitude={parseFloat(String(reporte.longitud))}
            zoom={15}
            markers={mapaMarkers}
            showCenterPin={false}
            interactive={false}
          />
        ) : (
          <View style={andiStyles.noCoordsCard}>
            <Feather name="map-pin" size={18} color={andiColors.onSurfaceVariant} />
            <Text style={[andiType.body, andiStyles.noCoordsText]}>
              Este reporte no tiene coordenadas registradas.
              {reporte.direccion ? ` Dirección informada: ${reporte.direccion}.` : ''}
            </Text>
          </View>
        )}
        <Text style={[andiType.body, andiStyles.description]}>{reporte.descripcion}</Text>

        {siasarDetalle && (
          <View style={andiStyles.siasarCard}>
            <Text style={[andiType.label, andiStyles.siasarCardTitle]}>Diagnóstico oficial de la zona (SIASAR)</Text>
            <SiasarComunidadInfo data={siasarDetalle} />
          </View>
        )}

        <View style={andiStyles.section}>
          <Text style={[andiType.overline, andiStyles.sectionLabel]}>Historial de este reporte</Text>
          {cargandoHistorial ? (
            <ActivityIndicator size="small" color={andiColors.primary} style={andiStyles.historialLoading} />
          ) : historial.length === 0 ? (
            <Text style={[andiType.caption, andiStyles.caption]}>Sin cambios registrados todavía.</Text>
          ) : (
            historial.map(h => (
              <View key={h.id_historial} style={andiStyles.historialRow}>
                <Text style={[andiType.caption, andiStyles.historialTransition]}>
                  {estadoLabel(h.estado_anterior)} → <Text style={andiStyles.historialTransitionStrong}>{estadoLabel(h.estado_nuevo)}</Text>
                  {'  ·  '}{h.usuario_accion} · {formatDate(h.fecha_cambio)}
                </Text>
                {h.comentario && <Text style={[andiType.caption, andiStyles.historialComment]}>&quot;{h.comentario}&quot;</Text>}
              </View>
            ))
          )}
        </View>

        <View style={andiStyles.titleBlock}>
          <Text style={andiType.section}>Cerrar el reporte</Text>
          <Text style={[andiType.caption, andiStyles.caption]}>
            {reporte.usuario ?? 'El ciudadano'} recibe un aviso con lo que escribas.
          </Text>
        </View>

        <View style={andiStyles.section}>
          <Text style={[andiType.overline, andiStyles.sectionLabel]}>Estado</Text>
          <View style={andiStyles.estadoRow}>
            <TouchableOpacity
              style={[andiStyles.estadoPill, { backgroundColor: andiColors.stProBg, borderColor: andiColors.stProBd, borderWidth: !resolviendo ? 2 : 1 }]}
              onPress={() => setResolviendo(false)}
            >
              <Feather name="refresh-cw" size={13} color={andiColors.stProFg} />
              <Text style={[andiStyles.estadoPillText, { color: andiColors.stProFg }]}>Sigue en proceso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[andiStyles.estadoPill, { backgroundColor: andiColors.stResBg, borderColor: andiColors.stResBd, borderWidth: resolviendo ? 2 : 1 }]}
              onPress={() => setResolviendo(true)}
            >
              <Feather name="check" size={13} color={andiColors.stResFg} />
              <Text style={[andiStyles.estadoPillText, { color: andiColors.stResFg }]}>Resuelto</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={andiStyles.section}>
          <View style={andiStyles.sectionLabelRow}>
            <Text style={[andiType.overline, andiStyles.sectionLabel]}>Qué se hizo</Text>
            {resolviendo && <Text style={[andiType.caption, andiStyles.requiredTag]}>Obligatorio al resolver</Text>}
          </View>
          <TextInput
            style={andiStyles.textarea}
            placeholder="Ej: Se tomó muestra y se purgó la red del sector…"
            placeholderTextColor={andiColors.onSurfaceVariant}
            multiline
            numberOfLines={4}
            value={comentario}
            onChangeText={setComentario}
            textAlignVertical="top"
          />
          <Text style={[andiType.caption, andiStyles.helperText]}>
            Sin esta frase el ciudadano solo ve la palabra &quot;Resuelto&quot;, que es exactamente lo que hace que deje de reportar.
          </Text>
        </View>

        <View style={andiStyles.photoRow}>
          <View style={andiStyles.photoIcon}>
            <Feather name="camera" size={16} color={andiColors.onSurfaceVariant} />
          </View>
          <Text style={[andiType.caption, andiStyles.photoText]}>Foto del arreglo · opcional</Text>
        </View>

        {errorMsg && (
          <View style={andiStyles.errorBanner}>
            <Feather name="alert-circle" size={16} color={andiColors.onErrorContainer} />
            <Text style={[andiType.caption, andiStyles.errorBannerText]}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[andiStyles.saveBtn, andiElevation[2], saving && andiStyles.saveBtnDisabled]}
          onPress={handleGuardar}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={andiColors.n0} />
            : <Text style={andiStyles.saveBtnText}>{errorMsg ? 'Reintentar' : (resolviendo ? 'Marcar como resuelto' : 'Guardar cambio')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ── Componentes auxiliares (vista clásica) ── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/* ── Estilos: vista clásica ── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },

  description: { fontSize: 15, color: '#1F2937', lineHeight: 22 },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  detailValue: { fontSize: 13, color: '#1F2937', fontWeight: '500', flex: 1.5, textAlign: 'right' },

  map: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  coordText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  commentLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  commentInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#F9FAFB', padding: 10, fontSize: 13,
    color: '#1F2937', minHeight: 80,
  },
  updateBtn: { marginTop: 14, borderRadius: 12, overflow: 'hidden' },
  updateBtnDisabled: { opacity: 0.6 },
  updateBtnGrad: { height: 48, justifyContent: 'center', alignItems: 'center' },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

/* ── Estilos: vista Andi (Entidad) ── */

const andiStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  scroll: { padding: andiSpace[5], paddingBottom: andiSpace[8], backgroundColor: andiColors.surface },
  map: { height: 160, borderRadius: andiRadius.lg, overflow: 'hidden', marginBottom: andiSpace[3] },
  description: { color: andiColors.onSurface, marginBottom: andiSpace[4] },

  siasarCard: {
    backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg,
    padding: andiSpace[3], marginBottom: andiSpace[4],
  },
  siasarCardTitle: { color: andiColors.onSurface, marginBottom: andiSpace[2] },

  titleBlock: { marginBottom: andiSpace[4] },
  caption: { color: andiColors.onSurfaceVariant, marginTop: 2 },

  section: { marginBottom: andiSpace[4] },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: andiSpace[2] },
  sectionLabel: { color: andiColors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1.5 },
  requiredTag: { color: andiColors.onSurfaceVariant },

  estadoRow: { flexDirection: 'row', gap: andiSpace[2] },
  estadoPill: {
    flex: 1, minHeight: 52, borderRadius: andiRadius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  estadoPillText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },

  noCoordsCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg,
    padding: andiSpace[3], marginBottom: andiSpace[3],
  },
  noCoordsText: { color: andiColors.onSurfaceVariant, flex: 1 },

  historialLoading: { marginTop: andiSpace[2] },
  historialRow: { marginBottom: andiSpace[2] },
  historialTransition: { color: andiColors.onSurfaceVariant },
  historialTransitionStrong: { color: andiColors.onSurface, fontWeight: '700' },
  historialComment: { color: andiColors.onSurface, marginTop: 2 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    backgroundColor: andiColors.errorContainer, borderRadius: andiRadius.lg,
    padding: andiSpace[3], marginBottom: andiSpace[3],
  },
  errorBannerText: { color: andiColors.onErrorContainer, flex: 1 },

  reciboIconWrap: { alignItems: 'center', marginBottom: andiSpace[4], marginTop: andiSpace[4] },
  reciboRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: andiSpace[2], marginBottom: andiSpace[3] },
  reciboEstadoPill: {
    paddingHorizontal: andiSpace[3], paddingVertical: andiSpace[2], borderRadius: andiRadius.full,
    backgroundColor: andiColors.surfaceMid,
  },
  reciboEstadoPillText: { fontSize: 13, fontWeight: '600', color: andiColors.onSurfaceVariant },
  reciboDuracion: { textAlign: 'center', color: andiColors.onSurfaceVariant, marginBottom: andiSpace[5] },
  reciboComentario: { color: andiColors.onSurface },

  textarea: {
    backgroundColor: andiColors.surfaceMid, borderWidth: 1, borderColor: andiColors.outlineVariant,
    borderRadius: andiRadius.lg, padding: andiSpace[3], minHeight: 76,
    fontSize: 14, lineHeight: 20, color: andiColors.onSurface,
  },
  helperText: { color: andiColors.onSurfaceVariant, marginTop: andiSpace[2] },

  photoRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg, padding: andiSpace[3],
    marginBottom: andiSpace[5],
  },
  photoIcon: {
    width: 44, height: 44, borderRadius: andiRadius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: andiColors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  photoText: { color: andiColors.onSurfaceVariant, flex: 1 },

  saveBtn: { minHeight: 56, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: andiColors.n0 },
});
