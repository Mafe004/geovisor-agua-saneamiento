import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, type CompositeNavigationProp, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import MapaWebView from '../../components/MapaWebView';
import type { MapCenterChange } from '../../components/MapaWebView.types';
import { reportesAPI, catalogosAPI, siasarAPI } from '../../api/services';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import SeverityPicker, { type SeveridadKey } from '../../components/ciudadano/SeverityPicker';
import SystemBanner from '../../components/ciudadano/SystemBanner';
import { useAndiDialog } from '../../components/ciudadano/AndiDialog';
import MascotAndi from '../../components/ciudadano/MascotAndi';
import { getDrafts, saveDraft, removeDraft } from '../../utils/offlineDrafts';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE, ANDI_MONO } from '../../theme/andi';
import type { TipoIncidenteItem, SeveridadItem, ReporteCreateRequest, CercanaResponse } from '../../types/domain';
import type { CiudadanoTabParamList, RootStackParamList } from '../../navigation/types';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<CiudadanoTabParamList, 'Crear'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
  route: RouteProp<CiudadanoTabParamList, 'Crear'>;
};

const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };

// Pre-rellena la descripción según el tipo elegido -- la API exige
// `descripcion` no vacía, así el ciudadano solo la corrige en vez de
// escribirla desde cero.
const PRELLENADO: Record<string, string> = {
  'fuga de agua': 'Fuga de agua constante sobre el andén; ya llega a la vía.',
  'baja presión': 'El agua sale con muy poca presión desde hace varias horas.',
  taponamiento: 'Alcantarilla taponada, el agua no drena y se está acumulando.',
  'rebose de aguas residuales': 'Aguas residuales rebosando sobre la calle.',
  'agua contaminada': 'El agua que sale del grifo tiene color y/o mal olor.',
  'basuras en cuerpos de agua': 'Hay basuras acumuladas en la quebrada/cuerpo de agua.',
};

type Mode = 'form' | 'draft-saved' | 'success';

// En móvil el FormData de React Native acepta {uri, name, type} y lee el
// archivo él mismo; en web ese objeto no sirve y hay que adjuntar el Blob.
async function construirFormFoto(foto: ImagePicker.ImagePickerAsset): Promise<FormData> {
  const form = new FormData();
  const name = foto.fileName || 'foto.jpg';
  const type = foto.mimeType || 'image/jpeg';
  if (Platform.OS === 'web') {
    const blob = await (await fetch(foto.uri)).blob();
    form.append('archivo', blob, name);
  } else {
    // El tipo TS de FormData es el del DOM y no conoce la forma {uri,name,type}.
    form.append('archivo', { uri: foto.uri, name, type } as unknown as Blob);
  }
  return form;
}

export default function CrearReporteScreen({ navigation, route }: Props) {
  const draftId = route.params?.draftId ?? null;

  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(null);
  const [idTipo, setIdTipo] = useState<number | null>(null);
  const [severidad, setSeveridad] = useState<SeveridadKey | null>('MEDIA');
  const [tipos, setTipos] = useState<TipoIncidenteItem[]>([]);
  const [severidades, setSeveridades] = useState<SeveridadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [descTouched, setDescTouched] = useState(false);
  const [mode, setMode] = useState<Mode>('form');
  const [savedTone, setSavedTone] = useState<'warning' | 'error'>('warning');
  const [savedSummary, setSavedSummary] = useState('');
  const [successSummary, setSuccessSummary] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId);
  const [proximidadSiasar, setProximidadSiasar] = useState<CercanaResponse | null>(null);
  // Evidencia opcional. fotoSubida = ruta ya devuelta por /reportes/imagen
  // para esta misma foto: si luego falla la creación del reporte, el
  // reintento la reutiliza en vez de subirla otra vez.
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fotoSubida, setFotoSubida] = useState<string | null>(null);
  const { showDialog, dialog } = useAndiDialog();

  useEffect(() => {
    catalogosAPI.tiposIncidente().then((r) => setTipos(r.data || [])).catch(() => {});
    catalogosAPI.severidades().then((r) => setSeveridades(r.data || [])).catch(() => {});
  }, []);

  // Solo informativo -- nunca bloquea el envío ni se manda en el payload
  // (el backend ya calcula el vínculo real, en el servidor, al crear el
  // reporte -- ver crear_reporte en reportes.py). Debounce de ~600ms para
  // no llamar a /siasar/cercana en cada pixel que se arrastra el mapa.
  useEffect(() => {
    if (!coordenadas) { setProximidadSiasar(null); return; }
    const id = setTimeout(() => {
      siasarAPI.cercana(coordenadas.latitude, coordenadas.longitude, 2000)
        .then((res) => setProximidadSiasar(res.data))
        .catch(() => setProximidadSiasar(null));
    }, 600);
    return () => clearTimeout(id);
  }, [coordenadas]);

  useEffect(() => {
    if (!draftId) return;
    getDrafts().then((drafts) => {
      const found = drafts.find((d) => d.id === draftId);
      if (!found) return;
      setDescripcion(found.form.descripcion);
      setDireccion(found.form.direccion);
      setCoordenadas(
        found.form.latitud != null && found.form.longitud != null
          ? { latitude: found.form.latitud, longitude: found.form.longitud }
          : null,
      );
      setIdTipo(found.form.id_tipo_incidente);
      setSeveridad((found.form.severidad as SeveridadKey) || 'MEDIA');
      setDescTouched(found.form.descTouched);
      setCurrentDraftId(found.id);
    });
  }, [draftId]);

  // Cada vez que la tab vuelve a estar en foco, limpia el estado de
  // confirmación para que un futuro "Reportar otra cosa" empiece en blanco.
  useFocusEffect(useCallback(() => {
    return () => setMode('form');
  }, []));

  const idSeveridadNumerico = () => severidades.find((s) => (s.nombre || '').toUpperCase() === severidad)?.id_severidad;

  const handleSelectTipo = (tipo: TipoIncidenteItem) => {
    setIdTipo(tipo.id_tipo_incidente);
    if (!descTouched) {
      const key = (tipo.nombre || '').trim().toLowerCase();
      if (PRELLENADO[key]) setDescripcion(PRELLENADO[key]);
    }
  };

  const getMyLocation = () => {
    setLocLoading(true);
    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoordenadas({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setLocLoading(false);
        },
        () => {
          showDialog('Permiso denegado', 'Activa la ubicación o marca el punto arrastrando el mapa.', { tone: 'warning' });
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      showDialog('No disponible', 'No se pudo obtener tu ubicación. Marca el punto en el mapa.', { tone: 'warning' });
      setLocLoading(false);
    }
  };

  const handleCenterChange = ({ latitude, longitude }: MapCenterChange) => setCoordenadas({ latitude, longitude });

  const elegirFoto = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length) return;
    setFoto(result.assets[0]);
    setFotoSubida(null);
  };

  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showDialog('Permiso denegado', 'Activa el permiso de cámara o elige una foto de la galería.', { tone: 'warning' });
      return;
    }
    elegirFoto(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }));
  };

  const elegirDeGaleria = async () => {
    elegirFoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 }));
  };

  const quitarFoto = () => { setFoto(null); setFotoSubida(null); };

  const resetForm = () => {
    setDescripcion(''); setDireccion(''); setCoordenadas(null);
    setIdTipo(null); setSeveridad('MEDIA'); setDescTouched(false);
    setCurrentDraftId(null); setProximidadSiasar(null);
    setFoto(null); setFotoSubida(null);
  };

  const tipoLabel = () => tipos.find((t) => t.id_tipo_incidente === idTipo)?.nombre;

  const persistDraft = async (faltante: string) => {
    const saved = await saveDraft({
      id: currentDraftId || undefined,
      tipoLabel: tipoLabel() || 'Sin tipo',
      faltante,
      form: {
        descripcion, direccion,
        latitud: coordenadas?.latitude ?? null,
        longitud: coordenadas?.longitude ?? null,
        id_tipo_incidente: idTipo,
        severidad,
        descTouched,
      },
    });
    setCurrentDraftId(saved.id);
    return saved;
  };

  const handleSaveDraft = async () => {
    await persistDraft(!coordenadas ? 'Falta el sitio' : !idTipo ? 'Falta el tipo' : 'Incompleto');
    showDialog('Guardado', 'Tu borrador quedó guardado en este teléfono.', { tone: 'success', buttons: [
      { text: 'OK', onPress: () => navigation.navigate('Reportes') },
    ] });
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) { showDialog('Requerido', 'Ingresa una descripción.', { tone: 'warning' }); return; }
    if (!coordenadas) { showDialog('Requerido', 'Marca la ubicación del problema en el mapa.', { tone: 'warning' }); return; }
    if (!idTipo) { showDialog('Requerido', 'Selecciona el tipo de incidente.', { tone: 'warning' }); return; }
    const idSeveridad = idSeveridadNumerico();
    if (!idSeveridad) { showDialog('Requerido', 'Selecciona la severidad.', { tone: 'warning' }); return; }

    const payload: ReporteCreateRequest = {
      descripcion: descripcion.trim(),
      latitud: coordenadas.latitude,
      longitud: coordenadas.longitude,
      direccion: direccion.trim() || null,
      id_tipo_incidente: idTipo,
      id_severidad: idSeveridad,
      fuente_reporte: 'CIUDADANO',
    };

    // Sin foto: payload idéntico al de siempre (sin la clave imagen_url).
    if (!foto) { await crearReporte(payload); return; }

    if (fotoSubida) { await crearReporte({ ...payload, imagen_url: fotoSubida }); return; }

    let imagenUrl: string;
    try {
      setLoading(true);
      imagenUrl = (await reportesAPI.subirImagen(await construirFormFoto(foto))).data.imagen_url;
      setFotoSubida(imagenUrl);
    } catch (_) {
      setLoading(false);
      showDialog('No se pudo subir la foto.', '¿Quieres reintentar o enviar el reporte sin foto?', { tone: 'error', buttons: [
        { text: 'Reintentar', onPress: () => { handleSubmit(); } },
        { text: 'Enviar sin foto', onPress: () => { crearReporte(payload); } },
      ] });
      return;
    }
    await crearReporte({ ...payload, imagen_url: imagenUrl });
  };

  const crearReporte = async (payload: ReporteCreateRequest) => {
    try {
      setLoading(true);
      await reportesAPI.crear(payload);
      if (currentDraftId) await removeDraft(currentDraftId);
      // El formulario solo se limpia una vez que la API confirmó el guardado,
      // de forma incondicional (no depende de que el usuario cierre ningún diálogo).
      setSuccessSummary(`${tipoLabel() || 'Reporte'} · ${direccion.trim() || 'ubicación marcada'}`);
      resetForm();
      setMode('success');
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (status === 400 || status === 422) {
        const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
        showDialog('Revisa los datos', msg || 'No se pudo enviar el reporte.', { tone: 'warning' });
        return;
      }
      // Falla de red o del servidor (no de validación): no hay cola de
      // reintento automático (ver utils/offlineDrafts.ts), así que se
      // guarda como borrador para no perder lo escrito.
      await persistDraft('Falló el envío');
      setSavedSummary(`${tipoLabel() || 'Reporte'} · ${direccion.trim() || 'ubicación marcada'}`);
      setSavedTone(axios.isAxiosError(e) && !e.response ? 'warning' : 'error');
      setMode('draft-saved');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'success') {
    return (
      <View style={styles.container}>
        <LiftHeader>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.navigate('Mapa')}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Nuevo reporte</Text>
          </View>
        </LiftHeader>
        <LiftSurface style={{ padding: ANDI_SPACING.s5 }}>
          <SystemBanner
            tone="success"
            icon="✓"
            title="¡Reporte enviado!"
            message="Un moderador lo revisará pronto."
          />
          <View style={styles.queuedCard}>
            <Text style={styles.queuedCardTitle}>{successSummary}</Text>
            <Text style={styles.queuedCardMeta}>Reporte guardado</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Reportes')}>
            <Text style={styles.primaryBtnText}>Ver mis reportes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textBtn} onPress={() => setMode('form')}>
            <Text style={styles.textBtnText}>Reportar otra cosa</Text>
          </TouchableOpacity>
        </LiftSurface>
      </View>
    );
  }

  if (mode === 'draft-saved') {
    return (
      <View style={styles.container}>
        <LiftHeader>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setMode('form')}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Nuevo reporte</Text>
          </View>
        </LiftHeader>
        <LiftSurface style={{ padding: ANDI_SPACING.s5 }}>
          <SystemBanner
            tone={savedTone}
            icon={savedTone === 'warning' ? '⇅' : '!'}
            title={savedTone === 'warning' ? 'Estás sin conexión' : 'Algo falló de nuestro lado'}
            message="No se perdió lo que escribiste: quedó guardado como borrador en este teléfono."
          />
          <View style={styles.mascotWrap}>
            {/* Mascota oculta temporalmente en estados de error/offline. */}
            {/* <MascotAndi size={170} /> */}
            <Text style={styles.queuedHeadline}>Lo tengo guardado</Text>
            <Text style={styles.queuedSub}>
              Retómalo cuando quieras desde Mis Reportes y vuelve a enviarlo.
            </Text>
          </View>
          <View style={styles.queuedCard}>
            <Text style={styles.queuedCardTitle}>{savedSummary}</Text>
            <Text style={styles.queuedCardMeta}>Guardado como borrador</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Reportes')}>
            <Text style={styles.primaryBtnText}>Ver mis reportes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textBtn} onPress={() => setMode('form')}>
            <Text style={styles.textBtnText}>Seguir editando</Text>
          </TouchableOpacity>
        </LiftSurface>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LiftHeader>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.navigate('Mapa')}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Nuevo reporte</Text>
        </View>
        <View style={styles.progressRow}>
          <ProgressStep label="Tipo" done={!!idTipo} />
          <ProgressStep label="Gravedad" done={!!severidad} />
          <ProgressStep label="Sitio" done={!!coordenadas} />
        </View>
      </LiftHeader>

      <LiftSurface>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>

          <Section n="01" title="Qué está pasando">
            <View style={styles.chipWrap}>
              {tipos.length === 0 && <Text style={styles.mutedText}>Cargando tipos…</Text>}
              {tipos.map((t) => (
                <TouchableOpacity
                  key={t.id_tipo_incidente}
                  style={[styles.typeChip, idTipo === t.id_tipo_incidente && styles.typeChipActive]}
                  onPress={() => handleSelectTipo(t)}
                >
                  <Text style={[styles.typeChipText, idTipo === t.id_tipo_incidente && styles.typeChipTextActive]}>
                    {t.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <Section n="02" title="Qué tan grave">
            <SeverityPicker value={severidad} onChange={setSeveridad} />
          </Section>

          <Section n="03" title="Dónde">
            <View style={styles.mapCard}>
              <MapaWebView
                style={styles.map}
                latitude={coordenadas ? coordenadas.latitude : ZIPAQUIRA.latitude}
                longitude={coordenadas ? coordenadas.longitude : ZIPAQUIRA.longitude}
                zoom={15}
                showCenterPin
                onCenterChange={handleCenterChange}
                markers={[]}
              />
              <View style={styles.mapFooter}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.direccionInput}
                    placeholder="Dirección aproximada (opcional)"
                    placeholderTextColor={ANDI_COLORS.n400}
                    value={direccion}
                    onChangeText={setDireccion}
                  />
                  {coordenadas ? (
                    <Text style={styles.coordText}>{coordenadas.latitude.toFixed(5)}, {coordenadas.longitude.toFixed(5)}</Text>
                  ) : (
                    <Text style={styles.coordPending}>Arrastra el mapa para marcar el punto</Text>
                  )}
                </View>
                <TouchableOpacity style={styles.adjustBtn} onPress={getMyLocation} disabled={locLoading}>
                  {locLoading ? <ActivityIndicator size="small" color={ANDI_COLORS.primary700} /> : <Text style={styles.adjustBtnText}>Mi ubicación</Text>}
                </TouchableOpacity>
              </View>
              {coordenadas && proximidadSiasar && (
                <Text style={styles.siasarHint}>
                  {proximidadSiasar.comunidad
                    ? `Cerca de la vereda ${proximidadSiasar.comunidad.nombre}, ${proximidadSiasar.comunidad.municipio} (a ${proximidadSiasar.distancia_m} m)`
                    : 'Fuera de las veredas registradas en SIASAR'}
                </Text>
              )}
            </View>
          </Section>

          <Section n="04" title={descTouched ? 'Cuéntanos qué ves' : 'Cuéntanos · ya lo llenamos'}>
            <TextInput
              style={styles.textarea}
              placeholder="Describe el problema: qué observas, desde cuándo, qué tan grave es…"
              placeholderTextColor={ANDI_COLORS.n400}
              multiline
              numberOfLines={4}
              value={descripcion}
              onChangeText={(v) => { setDescripcion(v); setDescTouched(true); }}
              textAlignVertical="top"
            />
          </Section>

          <Section n="05" title="Foto (opcional)">
            {foto ? (
              <View style={styles.fotoCard}>
                <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="cover" />
                <View style={[styles.fotoActions, styles.fotoActionsCard]}>
                  <TouchableOpacity style={styles.fotoBtn} onPress={elegirDeGaleria} disabled={loading}>
                    <Text style={styles.fotoBtnText}>Cambiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto} disabled={loading}>
                    <Text style={styles.fotoBtnText}>Tomar otra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fotoBtn} onPress={quitarFoto} disabled={loading}>
                    <Text style={styles.fotoBtnRemoveText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.fotoActions}>
                <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto}>
                  <Text style={styles.fotoBtnText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fotoBtn} onPress={elegirDeGaleria}>
                  <Text style={styles.fotoBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}
          </Section>

          <TouchableOpacity style={styles.draftLink} onPress={handleSaveDraft}>
            <Text style={styles.draftLinkText}>Guardar como borrador para terminar después</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitBtn, loading && styles.disabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Enviar reporte</Text>}
          </TouchableOpacity>
        </ScrollView>
      </LiftSurface>
      {dialog}
    </View>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionLabel}>{n} · {title}</Text>
      {children}
    </View>
  );
}

function ProgressStep({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.progressBar, done && styles.progressBarDone]} />
      <Text style={[styles.progressLabel, done && styles.progressLabelDone]}>{label}{done ? ' ✓' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ANDI_COLORS.primary700, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: '#fff', fontSize: 16 },
  screenTitle: { ...ANDI_TYPE.screen, color: '#fff' },
  progressRow: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  progressBar: { height: 4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary700 },
  progressBarDone: { backgroundColor: ANDI_COLORS.primary300 },
  progressLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary300, marginTop: 6 },
  progressLabelDone: { color: ANDI_COLORS.primary100 },

  scroll: { padding: ANDI_SPACING.s5, paddingBottom: ANDI_SPACING.s10, gap: ANDI_SPACING.s4 },
  sectionLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.onSurfaceVariant, marginBottom: ANDI_SPACING.s2 },
  mutedText: { fontSize: 12, color: ANDI_COLORS.n400, fontStyle: 'italic' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { minHeight: 44, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  typeChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  typeChipText: { fontSize: 12, fontWeight: '600', color: ANDI_COLORS.onSurface },
  typeChipTextActive: { color: '#fff' },

  mapCard: { borderRadius: ANDI_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant },
  map: { height: 180 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3, padding: ANDI_SPACING.s3, backgroundColor: ANDI_COLORS.surface },
  direccionInput: { fontSize: 13, color: ANDI_COLORS.onSurface, padding: 0 },
  coordText: { fontFamily: ANDI_MONO, fontSize: 11, color: ANDI_COLORS.onSurfaceVariant, marginTop: 4 },
  coordPending: { fontSize: 11, color: ANDI_COLORS.warning, marginTop: 4, fontWeight: '600' },
  adjustBtn: { minHeight: 40, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  adjustBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 11 },
  siasarHint: { fontSize: 11, color: ANDI_COLORS.onInfoContainer, backgroundColor: ANDI_COLORS.infoContainer, paddingHorizontal: ANDI_SPACING.s3, paddingVertical: ANDI_SPACING.s2 },

  textarea: { backgroundColor: ANDI_COLORS.surfaceMid, borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.md, padding: ANDI_SPACING.s3, fontSize: 14, color: ANDI_COLORS.onSurface, minHeight: 90 },

  fotoCard: { borderRadius: ANDI_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, backgroundColor: ANDI_COLORS.surface },
  fotoPreview: { width: '100%', height: 180 },
  fotoActions: { flexDirection: 'row', gap: ANDI_SPACING.s2 },
  fotoActionsCard: { padding: ANDI_SPACING.s3 },
  fotoBtn: { flex: 1, minHeight: 44, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  fotoBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 12 },
  fotoBtnRemoveText: { color: ANDI_COLORS.error, fontWeight: '600', fontSize: 12 },

  draftLink: { alignItems: 'center', paddingVertical: ANDI_SPACING.s2 },
  draftLinkText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 12 },

  submitBtn: { minHeight: 56, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },

  mascotWrap: { alignItems: 'center', paddingVertical: ANDI_SPACING.s5, gap: ANDI_SPACING.s2 },
  queuedHeadline: { ...ANDI_TYPE.display, color: ANDI_COLORS.onSurface, marginTop: ANDI_SPACING.s3 },
  queuedSub: { ...ANDI_TYPE.bodyLg, color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center' },
  queuedCard: { backgroundColor: ANDI_COLORS.surfaceMid, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4, marginBottom: ANDI_SPACING.s4 },
  queuedCardTitle: { ...ANDI_TYPE.card, color: ANDI_COLORS.onSurface },
  queuedCardMeta: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant, marginTop: 4 },
  primaryBtn: { minHeight: 56, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  textBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600' },
});
