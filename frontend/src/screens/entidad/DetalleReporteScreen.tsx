import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, TextInput, Modal, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { reportesAPI, catalogosAPI, siasarAPI, historialAPI, entidadesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import MapaWebView from '../../components/MapaWebView';
import { useToast } from '../../components/andi/Toast';
import { construirFormFoto, uriImagenServidor } from '../../utils/fotoEvidencia';
import AndiHeader from '../../components/andi/AndiHeader';
import AndiChip from '../../components/andi/AndiChip';
import AndiStatusBadge from '../../components/andi/AndiStatusBadge';
import AsignarTrabajadorModal from '../../components/andi/AsignarTrabajadorModal';
import SiasarComunidadInfo from '../../components/SiasarComunidadInfo';
import { andiColors, andiRadius, andiSpace, andiType as andiTypeBase, andiElevation, andiStatusPill, andiSeverityColor } from '../../theme/andi';
import { useResponsive, useScaledType, type Responsive } from '../../theme/responsive';
import type { MapMarker } from '../../components/MapaWebView.types';
import type { Reporte, EstadoReporteItem, ComunidadDetalle, HistorialEntry, EntidadDetalle } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalleReporte'>;

/**
 * Trae el detalle completo de la comunidad SIASAR enlazada (reporte.vereda_siasar
 * solo trae el resumen -- este pide el endpoint 4 para tener población,
 * cobertura, sistemas, etc.). null mientras carga o si no hay vínculo; el
 * caller decide cómo envolverlo (sección propia en cada vista).
 */
function useSiasarDiagnostico(idSiasar: number | undefined): ComunidadDetalle | null {
  const [detalle, setDetalle] = useState<ComunidadDetalle | null>(null);
  useEffect(() => {
    // Reset síncrono a propósito: sin vínculo SIASAR no hay nada que mostrar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Sin setCargando(true) acá -- `cargando` ya arranca en `true` (ver
    // useState arriba) y en la práctica este efecto solo corre una vez
    // (idReporte no cambia durante la vida de esta pantalla), así que
    // volver a ponerlo sería un no-op redundante.
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
  // RootStackParamList['DetalleReporte'] acepta Reporte | ReporteComunidad
  // porque el Mapa de Ciudadano puede navegar aquí con la vista comunitaria
  // reducida (ver navigation/types.ts) -- pero esta pantalla (Entidad/
  // Moderador/Administrador) nunca recibe esa vista: puede_ver_detalle_
  // comunitario() en el backend solo aplica a CIUDADANO, así que aquí
  // siempre llega un Reporte completo.
  const [reporte, setReporte] = useState<Reporte>(inicial as Reporte);
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center' }}>No se encontró información del reporte.</Text>
      </View>
    );
  }

  // Entidad tiene su propio flujo "cerrar el reporte" (EntidadCierreView,
  // ported del canvas "Andi - Moderador.dc.html"); Admin/Moderador ven la
  // vista de solo-lectura + cambio de estado (EstandarDetalleView, Andi
  // también, pero sin el flujo de cierre). Moderador hoy no navega aquí en
  // la práctica (su cambio de estado real es TriageSheet), pero el
  // registro de ruta se deja igual para ambos roles.
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
    <EstandarDetalleView
      reporte={reporte}
      estadosDisponibles={estadosDisponibles}
      canChangeStatus={isModerador || isAdmin}
      isAdmin={isAdmin}
      onBack={() => navigation.goBack()}
      onUpdated={setReporte}
    />
  );
}

/* ── Vista de solo-lectura + cambio de estado (Admin / Moderador) ──
 * Comparte makeAndiStyles con EntidadCierreView -- antes tenía su propio
 * sistema clásico (GradientHeader azul, StatusBadge/EstadoChips legacy,
 * emoji como íconos de sección); todo el resto de Admin ya es Andi desde
 * hace rato, así que esta pantalla era la única pieza suelta. */

function EstandarDetalleView({
  reporte, estadosDisponibles, canChangeStatus, isAdmin, onBack, onUpdated,
}: {
  reporte: Reporte;
  estadosDisponibles: EstadoReporteItem[];
  canChangeStatus: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onUpdated: (r: Reporte) => void;
}) {
  const responsive = useResponsive();
  const andiStyles = useMemo(() => makeAndiStyles(responsive), [responsive]);
  const andiType = useScaledType(andiTypeBase);
  const toast = useToast();
  const [idEstadoNuevo, setIdEstadoNuevo] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [updating, setUpdating] = useState(false);
  const [asignarVisible, setAsignarVisible] = useState(false);
  const [asignando, setAsignando] = useState(false);

  // ── Acciones de ADMIN: asignar a otra entidad, eliminar el reporte ──
  const [entidades, setEntidades] = useState<EntidadDetalle[]>([]);
  const [asignarEntidadVisible, setAsignarEntidadVisible] = useState(false);
  const [asignandoEntidad, setAsignandoEntidad] = useState(false);
  const [confirmEliminarVisible, setConfirmEliminarVisible] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const abrirAsignarEntidad = async () => {
    setAsignarEntidadVisible(true);
    try {
      const res = await entidadesAPI.listar();
      setEntidades(res.data || []);
    } catch (_) {
      setEntidades([]);
    }
  };

  const handleAsignarEntidad = async (idEntidad: number) => {
    try {
      setAsignandoEntidad(true);
      const res = await reportesAPI.asignarEntidad(reporte.id_reporte, { id_entidad: idEntidad });
      onUpdated(res.data.reporte);
      toast.success('Entidad asignada', 'El reporte quedó asignado a la nueva entidad.');
      setAsignarEntidadVisible(false);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo asignar la entidad.');
    } finally {
      setAsignandoEntidad(false);
    }
  };

  const handleEliminar = async () => {
    try {
      setEliminando(true);
      await reportesAPI.eliminarAdmin(reporte.id_reporte);
      toast.success('Reporte eliminado', 'El reporte fue eliminado definitivamente.');
      setConfirmEliminarVisible(false);
      onBack();
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo eliminar el reporte.');
      setEliminando(false);
    }
  };
  // "Entity/moderator report detail screen" (canChangeStatus ya excluye a
  // Ciudadano en esta vista compartida) -- Ciudadano nunca ve el
  // diagnóstico oficial de su propia zona en su propia pantalla.
  const siasarDetalle = useSiasarDiagnostico(
    canChangeStatus ? reporte.vereda_siasar?.id_siasar : undefined
  );

  const handleAsignar = async (idUsuarioAsignado: number | null) => {
    try {
      setAsignando(true);
      const res = await reportesAPI.asignarUsuario(reporte.id_reporte, { id_usuario_asignado: idUsuarioAsignado });
      onUpdated(res.data.reporte);
      toast.success(idUsuarioAsignado ? 'Asignado' : 'Desasignado', idUsuarioAsignado ? 'El reporte quedó asignado.' : 'El reporte vuelve al pool de la entidad.');
      setAsignarVisible(false);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo asignar el reporte.');
    } finally {
      setAsignando(false);
    }
  };

  const handleUpdateEstado = async () => {
    const seleccionado = estadosDisponibles.find(e => e.id_estado === idEstadoNuevo);
    if (!seleccionado || seleccionado.nombre === reporte.estado) {
      toast.warning('Sin cambios', 'Selecciona un estado diferente al actual.');
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
      toast.success(
        'Estado actualizado',
        `El reporte ahora está en: ${seleccionado.nombre.replace(/_/g, ' ')}`
      );
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo actualizar el estado.');
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

  const severidad = (reporte.severidad ?? '').toUpperCase();

  return (
    <View style={andiStyles.container}>
      <AndiHeader onBack={onBack} kicker={`#${reporte.id_reporte}`} title={reporte.descripcion || 'Reporte'} />

      <ScrollView contentContainerStyle={[andiStyles.scroll, { alignItems: 'center' }]} nestedScrollEnabled>
        <View style={andiStyles.contentWrap}>
          <View style={andiStyles.badgeRow}>
            <AndiStatusBadge status={reporte.estado} />
            <View style={andiStyles.severityInline}>
              <View style={[andiStyles.severityDot, { backgroundColor: andiSeverityColor[severidad] ?? andiSeverityColor.BAJA }]} />
              <Text style={[andiType.labelSm, andiStyles.severityText]}>{severidad || 'BAJA'}</Text>
            </View>
          </View>

          <View style={andiStyles.section}>
            <Text style={[andiType.overline, andiStyles.sectionLabel, andiStyles.sectionLabelSpaced]}>Descripción</Text>
            <Text style={[andiType.bodyLg, andiStyles.description]}>{reporte.descripcion || '—'}</Text>
          </View>

          {!!uriImagenServidor(reporte.imagen_url) && (
            <View style={andiStyles.section}>
              <Text style={[andiType.overline, andiStyles.sectionLabel, andiStyles.sectionLabelSpaced]}>Foto del reporte</Text>
              <Image source={{ uri: uriImagenServidor(reporte.imagen_url) as string }} style={andiStyles.reporteFoto} resizeMode="cover" />
            </View>
          )}

          <View style={andiStyles.section}>
            <Text style={[andiType.overline, andiStyles.sectionLabel, andiStyles.sectionLabelSpaced]}>Detalles</Text>
            <AndiDetailRow andiType={andiType} styles={andiStyles} label="Tipo de incidente" value={reporte.tipo_incidente || '—'} />
            <AndiDetailRow andiType={andiType} styles={andiStyles} label="Dirección" value={reporte.direccion || 'No especificada'} />
            <AndiDetailRow andiType={andiType} styles={andiStyles} label="Reportado por" value={reporte.usuario || '—'} />
            <AndiDetailRow andiType={andiType} styles={andiStyles} label="Fecha reporte" value={formatDate(reporte.created_at)} last={!canChangeStatus || !reporte.id_entidad} />
          </View>

          {canChangeStatus && reporte.id_entidad != null && (
            <View style={andiStyles.section}>
              <View style={andiStyles.asignadoRow}>
                <View>
                  <Text style={[andiType.overline, andiStyles.sectionLabel]}>Asignado a</Text>
                  <Text style={[andiType.body, andiStyles.asignadoNombre]}>{reporte.usuario_asignado || 'Sin asignar · pool de la entidad'}</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" style={andiStyles.asignarLink} onPress={() => setAsignarVisible(true)}>
                  <Text style={andiStyles.asignarLinkText}>{reporte.usuario_asignado ? 'Cambiar' : 'Asignar'}</Text>
                </TouchableOpacity>
              </View>
              <AsignarTrabajadorModal
                visible={asignarVisible}
                onClose={() => setAsignarVisible(false)}
                idEntidad={reporte.id_entidad}
                idUsuarioActual={reporte.id_usuario_asignado ?? null}
                onElegir={handleAsignar}
                asignando={asignando}
              />
            </View>
          )}

          {hasCoords ? (
            <View style={andiStyles.section}>
              <Text style={[andiType.overline, andiStyles.sectionLabel, andiStyles.sectionLabelSpaced]}>Ubicación</Text>
              <MapaWebView
                style={andiStyles.map}
                latitude={parseFloat(String(reporte.latitud))}
                longitude={parseFloat(String(reporte.longitud))}
                zoom={15}
                markers={mapaMarkers}
                showCenterPin={false}
                interactive={false}
              />
              <Text style={[andiType.caption, andiStyles.caption, { textAlign: 'center' }]}>
                {parseFloat(String(reporte.latitud)).toFixed(5)}, {parseFloat(String(reporte.longitud)).toFixed(5)}
              </Text>
            </View>
          ) : (
            <View style={andiStyles.noCoordsCard}>
              <Feather name="map-pin" size={18} color={andiColors.onSurfaceVariant} />
              <Text style={[andiType.body, andiStyles.noCoordsText]}>Este reporte no tiene coordenadas registradas.</Text>
            </View>
          )}

          {siasarDetalle && (
            <View style={andiStyles.siasarCard}>
              <Text style={[andiType.label, andiStyles.siasarCardTitle]}>Diagnóstico oficial de la zona (SIASAR)</Text>
              <SiasarComunidadInfo data={siasarDetalle} />
            </View>
          )}

          {canChangeStatus && (
            <View style={andiStyles.section}>
              <Text style={[andiType.overline, andiStyles.sectionLabel, andiStyles.sectionLabelSpaced]}>Cambiar estado</Text>
              <View style={andiStyles.chipsGrid}>
                {estadosDisponibles.map(e => (
                  <AndiChip
                    key={e.id_estado}
                    label={`${e.nombre.replace(/_/g, ' ')}${reporte.estado === e.nombre ? ' (actual)' : ''}`}
                    variant={idEstadoNuevo === e.id_estado ? 'solid' : 'outline'}
                    onPress={() => setIdEstadoNuevo(e.id_estado)}
                  />
                ))}
              </View>

              <Text style={[andiType.labelSm, andiStyles.fieldLabel]}>Comentario (opcional)</Text>
              <TextInput
                style={andiStyles.textarea}
                placeholder="Ej: Se verificó el problema en campo…"
                placeholderTextColor={andiColors.onSurfaceVariant}
                multiline
                numberOfLines={3}
                value={comentario}
                onChangeText={setComentario}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[andiStyles.saveBtn, andiElevation[2], updating && andiStyles.saveBtnDisabled, { marginTop: andiSpace[4] }]}
                onPress={handleUpdateEstado}
                disabled={updating}
                accessibilityRole="button"
                accessibilityLabel="Guardar cambio de estado"
              >
                {updating
                  ? <ActivityIndicator color={andiColors.n0} />
                  : <Text style={andiStyles.saveBtnText}>Guardar cambio</Text>}
              </TouchableOpacity>
            </View>
          )}

          {isAdmin && (
            <View style={andiStyles.section}>
              <Text style={[andiType.overline, andiStyles.sectionLabel, andiStyles.sectionLabelSpaced]}>Administración</Text>
              <TouchableOpacity accessibilityRole="button" style={andiStyles.adminActionBtn} onPress={abrirAsignarEntidad}>
                <Feather name="repeat" size={16} color={andiColors.onSurface} />
                <Text style={andiStyles.adminActionBtnText}>Asignar a otra entidad</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[andiStyles.adminActionBtn, andiStyles.adminActionBtnDanger]} onPress={() => setConfirmEliminarVisible(true)}>
                <Feather name="trash-2" size={16} color={andiColors.error600} />
                <Text style={[andiStyles.adminActionBtnText, andiStyles.adminActionBtnDangerText]}>Eliminar reporte</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={asignarEntidadVisible} transparent animationType="slide" onRequestClose={() => setAsignarEntidadVisible(false)}>
        <View style={andiStyles.modalOverlay}>
          <View style={andiStyles.modalCard}>
            <View style={andiStyles.modalHeader}>
              <Text style={andiStyles.modalTitle}>Asignar a otra entidad</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setAsignarEntidadVisible(false)}>
                <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={entidades}
              keyExtractor={e => String(e.id_entidad)}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={<Text style={andiStyles.modalEmptyText}>No hay entidades registradas.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={andiStyles.modalRow}
                  onPress={() => handleAsignarEntidad(item.id_entidad)}
                  disabled={asignandoEntidad}
                >
                  <Text style={andiStyles.modalRowText}>
                    {item.nombre_entidad}{item.id_entidad === reporte.id_entidad ? ' · actual' : ''}
                  </Text>
                  {asignandoEntidad && <ActivityIndicator size="small" color={andiColors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={confirmEliminarVisible} transparent animationType="fade" onRequestClose={() => setConfirmEliminarVisible(false)}>
        <View style={andiStyles.modalOverlay}>
          <View style={andiStyles.modalCard}>
            <Text style={andiStyles.modalTitle}>¿Eliminar este reporte?</Text>
            <Text style={andiStyles.modalEmptyText}>Esta acción no se puede deshacer. El reporte #{reporte.id_reporte} y su historial se borrarán definitivamente.</Text>
            <View style={andiStyles.modalBtnRow}>
              <TouchableOpacity accessibilityRole="button" style={andiStyles.modalCancelBtn} onPress={() => setConfirmEliminarVisible(false)} disabled={eliminando}>
                <Text style={andiStyles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={andiStyles.modalDeleteBtn} onPress={handleEliminar} disabled={eliminando}>
                {eliminando
                  ? <ActivityIndicator size="small" color={andiColors.surface} />
                  : <Text style={andiStyles.modalDeleteBtnText}>Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  const responsive = useResponsive();
  const andiStyles = useMemo(() => makeAndiStyles(responsive), [responsive]);
  const andiType = useScaledType(andiTypeBase);
  const toast = useToast();
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

  // Foto del arreglo, opcional. fotoSubida = ruta ya devuelta por
  // /reportes/imagen para esta misma foto: si Guardar falla después de
  // subir la imagen, un reintento no la vuelve a subir -- mismo patrón que
  // ciudadano/CrearReporteScreen.tsx.
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fotoSubida, setFotoSubida] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const { user } = useContext(AuthContext);
  const [asignarVisible, setAsignarVisible] = useState(false);
  const [asignando, setAsignando] = useState(false);

  const handleAsignar = async (idUsuarioAsignado: number | null) => {
    try {
      setAsignando(true);
      const res = await reportesAPI.asignarUsuario(reporte.id_reporte, { id_usuario_asignado: idUsuarioAsignado });
      onUpdated(res.data.reporte);
      toast.success(idUsuarioAsignado ? 'Asignado' : 'Desasignado', idUsuarioAsignado ? 'El reporte quedó asignado.' : 'El reporte vuelve al pool de la entidad.');
      setAsignarVisible(false);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo asignar el reporte.');
    } finally {
      setAsignando(false);
    }
  };

  const elegirFoto = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    setFoto(result.assets[0] ?? null);
    setFotoSubida(null);
  };

  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.warning('Permiso denegado', 'Activa el permiso de cámara o elige una foto de la galería.');
      return;
    }
    elegirFoto(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }));
  };

  const elegirDeGaleria = async () => {
    elegirFoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 }));
  };

  const quitarFoto = () => { setFoto(null); setFotoSubida(null); };

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
      toast.warning('Comentario requerido', 'Describe qué se hizo antes de marcar como resuelto.');
      return;
    }
    const resuelto = estadosDisponibles.find(e => e.nombre === 'RESUELTO');
    if (!resuelto) return;

    setErrorMsg(null);

    // Si hay foto nueva sin subir todavía, subirla primero -- un fallo acá
    // no debe perder el comentario ya escrito (mismo motivo que el catch
    // de abajo no lo limpia), así que se separa del try de cambiarEstado.
    let imagenUrl = fotoSubida;
    if (foto && !imagenUrl) {
      try {
        setSubiendoFoto(true);
        imagenUrl = (await reportesAPI.subirImagen(await construirFormFoto(foto))).data.imagen_url;
        setFotoSubida(imagenUrl);
      } catch (_) {
        toast.error('No se pudo subir la foto', 'Puedes reintentar o guardar el cambio sin foto.');
        setSubiendoFoto(false);
        return;
      } finally {
        setSubiendoFoto(false);
      }
    }

    try {
      setSaving(true);
      const res = await reportesAPI.cambiarEstado(reporte.id_reporte, {
        id_estado_nuevo: resuelto.id_estado,
        comentario: comentario.trim(),
        imagen_url: imagenUrl || undefined,
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
        <ScrollView contentContainerStyle={[andiStyles.scroll, { alignItems: 'center' }]}>
          <View style={andiStyles.contentWrap}>
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
          <TouchableOpacity accessibilityRole="button" style={[andiStyles.saveBtn, andiElevation[2]]} onPress={onBack}>
            <Text style={andiStyles.saveBtnText}>Listo</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={andiStyles.container}>
      <AndiHeader onBack={onBack} kicker={`#${reporte.id_reporte}`} title={reporte.descripcion || 'Reporte'} />

      <ScrollView contentContainerStyle={[andiStyles.scroll, { alignItems: 'center' }]} nestedScrollEnabled>
        <View style={andiStyles.contentWrap}>
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

        {!!uriImagenServidor(reporte.imagen_url) && (
          <Image source={{ uri: uriImagenServidor(reporte.imagen_url) as string }} style={andiStyles.reporteFoto} resizeMode="cover" />
        )}

        {siasarDetalle && (
          <View style={andiStyles.siasarCard}>
            <Text style={[andiType.label, andiStyles.siasarCardTitle]}>Diagnóstico oficial de la zona (SIASAR)</Text>
            <SiasarComunidadInfo data={siasarDetalle} />
          </View>
        )}

        {reporte.id_entidad != null && (
          <View style={andiStyles.section}>
            <View style={andiStyles.asignadoRow}>
              <View>
                <Text style={[andiType.overline, andiStyles.sectionLabel]}>Asignado a</Text>
                <Text style={[andiType.body, andiStyles.asignadoNombre]}>{reporte.usuario_asignado || 'Sin asignar · pool de la entidad'}</Text>
              </View>
              {!!user?.es_titular_entidad && (
                <TouchableOpacity accessibilityRole="button" style={andiStyles.asignarLink} onPress={() => setAsignarVisible(true)}>
                  <Text style={andiStyles.asignarLinkText}>{reporte.usuario_asignado ? 'Cambiar' : 'Asignar'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {!!user?.es_titular_entidad && (
              <AsignarTrabajadorModal
                visible={asignarVisible}
                onClose={() => setAsignarVisible(false)}
                idEntidad={reporte.id_entidad}
                idUsuarioActual={reporte.id_usuario_asignado ?? null}
                idUsuarioPropio={user?.id_usuario}
                onElegir={handleAsignar}
                asignando={asignando}
              />
            )}
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
                {!!uriImagenServidor(h.imagen_url) && (
                  <Image source={{ uri: uriImagenServidor(h.imagen_url) as string }} style={andiStyles.historialFoto} resizeMode="cover" />
                )}
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
            <TouchableOpacity accessibilityRole="button"
              style={[andiStyles.estadoPill, { backgroundColor: andiColors.stProBg, borderColor: andiColors.stProBd, borderWidth: !resolviendo ? 2 : 1 }]}
              onPress={() => setResolviendo(false)}
            >
              <Feather name="refresh-cw" size={13} color={andiColors.stProFg} />
              <Text style={[andiStyles.estadoPillText, { color: andiColors.stProFg }]}>Sigue en proceso</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
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

        <View style={andiStyles.section}>
          <Text style={[andiType.overline, andiStyles.sectionLabel]}>Foto del arreglo · opcional</Text>
          {foto ? (
            <View style={andiStyles.fotoCard}>
              <Image source={{ uri: foto.uri }} style={andiStyles.fotoPreview} resizeMode="cover" />
              <View style={andiStyles.fotoActions}>
                <TouchableOpacity accessibilityRole="button" style={andiStyles.fotoBtn} onPress={elegirDeGaleria} disabled={saving || subiendoFoto}>
                  <Text style={andiStyles.fotoBtnText}>Cambiar</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={andiStyles.fotoBtn} onPress={tomarFoto} disabled={saving || subiendoFoto}>
                  <Text style={andiStyles.fotoBtnText}>Tomar otra</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={andiStyles.fotoBtn} onPress={quitarFoto} disabled={saving || subiendoFoto}>
                  <Text style={andiStyles.fotoBtnRemoveText}>Quitar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={andiStyles.photoRow}>
              <TouchableOpacity accessibilityRole="button" style={andiStyles.fotoBtn} onPress={tomarFoto}>
                <Feather name="camera" size={14} color={andiColors.primary600} />
                <Text style={andiStyles.fotoBtnText}>Tomar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={andiStyles.fotoBtn} onPress={elegirDeGaleria}>
                <Feather name="image" size={14} color={andiColors.primary600} />
                <Text style={andiStyles.fotoBtnText}>Galería</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {errorMsg && (
          <View style={andiStyles.errorBanner}>
            <Feather name="alert-circle" size={16} color={andiColors.onErrorContainer} />
            <Text style={[andiType.caption, andiStyles.errorBannerText]}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity accessibilityRole="button"
          style={[andiStyles.saveBtn, andiElevation[2], (saving || subiendoFoto) && andiStyles.saveBtnDisabled]}
          onPress={handleGuardar}
          disabled={saving || subiendoFoto}
        >
          {saving || subiendoFoto
            ? <ActivityIndicator color={andiColors.n0} />
            : <Text style={andiStyles.saveBtnText}>{errorMsg ? 'Reintentar' : (resolviendo ? 'Marcar como resuelto' : 'Guardar cambio')}</Text>}
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Componentes auxiliares ── */

type AndiStyles = ReturnType<typeof makeAndiStyles>;
type AndiTypeScale = ReturnType<typeof useScaledType<typeof andiTypeBase>>;

function AndiDetailRow({
  label, value, styles, andiType, last,
}: { label: string; value: string; styles: AndiStyles; andiType: AndiTypeScale; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Text style={[andiType.body, styles.detailLabel]}>{label}</Text>
      <Text style={[andiType.body, styles.detailValue]}>{value}</Text>
    </View>
  );
}

/* ── Estilos: vista Andi (Entidad / Admin / Moderador) ── */

const makeAndiStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  scroll: { padding: andiSpace[5], paddingBottom: andiSpace[8], backgroundColor: andiColors.surface },
  contentWrap: { width: '100%', maxWidth: r.maxContentWidth(600) },
  map: { height: r.scaleHeight(160), borderRadius: andiRadius.lg, overflow: 'hidden', marginBottom: andiSpace[3] },
  description: { color: andiColors.onSurface, marginBottom: andiSpace[4] },
  reporteFoto: { width: '100%', height: 180, borderRadius: andiRadius.lg, marginBottom: andiSpace[4] },

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
  sectionLabelSpaced: { marginBottom: andiSpace[2] },
  requiredTag: { color: andiColors.onSurfaceVariant },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[3], marginBottom: andiSpace[4], flexWrap: 'wrap' },
  severityInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityText: { color: andiColors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: andiSpace[2], borderBottomWidth: 1, borderBottomColor: andiColors.outlineVariant,
  },
  detailLabel: { color: andiColors.onSurfaceVariant, flex: 1 },
  detailValue: { color: andiColors.onSurface, fontWeight: '500', flex: 1.5, textAlign: 'right' },

  asignadoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  asignadoNombre: { color: andiColors.onSurface, marginTop: 2 },
  asignarLink: { minHeight: 36, paddingHorizontal: andiSpace[3], borderRadius: andiRadius.full, borderWidth: 1, borderColor: andiColors.primary600, alignItems: 'center', justifyContent: 'center' },
  asignarLinkText: { fontSize: r.scaleFont(13), fontWeight: '600', color: andiColors.primary600 },

  fieldLabel: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[2] },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[2], marginBottom: andiSpace[4] },

  estadoRow: { flexDirection: 'row', gap: andiSpace[2] },
  estadoPill: {
    flex: 1, minHeight: 52, borderRadius: andiRadius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  estadoPillText: { fontSize: r.scaleFont(13), lineHeight: r.scaleFont(18), fontWeight: '600' },

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
  historialFoto: { width: 120, height: 90, borderRadius: andiRadius.md, marginTop: andiSpace[2] },

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
  reciboEstadoPillText: { fontSize: r.scaleFont(13), fontWeight: '600', color: andiColors.onSurfaceVariant },
  reciboDuracion: { textAlign: 'center', color: andiColors.onSurfaceVariant, marginBottom: andiSpace[5] },
  reciboComentario: { color: andiColors.onSurface },

  textarea: {
    backgroundColor: andiColors.surfaceMid, borderWidth: 1, borderColor: andiColors.outlineVariant,
    borderRadius: andiRadius.lg, padding: andiSpace[3], minHeight: 76,
    fontSize: r.scaleFont(16), lineHeight: r.scaleFont(22), color: andiColors.onSurface,
  },
  helperText: { color: andiColors.onSurfaceVariant, marginTop: andiSpace[2] },

  photoRow: { flexDirection: 'row', gap: andiSpace[2] },
  fotoCard: { borderRadius: andiRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: andiColors.outlineVariant, backgroundColor: andiColors.surface },
  fotoPreview: { width: '100%', height: 180 },
  fotoActions: { flexDirection: 'row', gap: andiSpace[2], padding: andiSpace[3] },
  fotoBtn: {
    flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, paddingHorizontal: andiSpace[3],
    borderRadius: andiRadius.full, backgroundColor: andiColors.primary50, alignItems: 'center', justifyContent: 'center',
  },
  fotoBtnText: { color: andiColors.primary700, fontWeight: '600', fontSize: 12 },
  fotoBtnRemoveText: { color: andiColors.error600, fontWeight: '600', fontSize: 12 },

  saveBtn: { minHeight: 56, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: r.scaleFont(16), lineHeight: r.scaleFont(22), fontWeight: '600', color: andiColors.n0 },

  adminActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[2], minHeight: 48,
    borderRadius: andiRadius.md, borderWidth: 1, borderColor: andiColors.outline,
    paddingHorizontal: andiSpace[3], marginBottom: andiSpace[2],
  },
  adminActionBtnText: { fontSize: r.scaleFont(14), fontWeight: '600', color: andiColors.onSurface },
  adminActionBtnDanger: { borderColor: andiColors.error200 },
  adminActionBtnDangerText: { color: andiColors.error600 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'center', padding: andiSpace[6] },
  modalCard: { backgroundColor: andiColors.surface, borderRadius: andiRadius.lg, padding: andiSpace[5], maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: andiSpace[3] },
  modalTitle: { fontSize: r.scaleFont(16), fontWeight: '700', color: andiColors.onSurface, flex: 1 },
  modalEmptyText: { fontSize: r.scaleFont(13), color: andiColors.onSurfaceVariant, marginTop: andiSpace[2], marginBottom: andiSpace[2] },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: andiSpace[3], borderBottomWidth: 1, borderBottomColor: andiColors.outlineVariant },
  modalRowText: { fontSize: r.scaleFont(14), color: andiColors.onSurface, flex: 1 },
  modalBtnRow: { flexDirection: 'row', gap: andiSpace[3], marginTop: andiSpace[5] },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: andiRadius.full, borderWidth: 1.5, borderColor: andiColors.outline, alignItems: 'center', justifyContent: 'center' },
  modalCancelBtnText: { fontSize: r.scaleFont(14), fontWeight: '600', color: andiColors.onSurface },
  modalDeleteBtn: { flex: 1, height: 44, borderRadius: andiRadius.full, backgroundColor: andiColors.error600, alignItems: 'center', justifyContent: 'center' },
  modalDeleteBtnText: { fontSize: r.scaleFont(14), fontWeight: '600', color: andiColors.surface },
});
