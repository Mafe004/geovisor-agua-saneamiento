import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect, type CompositeNavigationProp, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { construirFormFoto, uriImagenServidor } from '../../utils/fotoEvidencia';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE, ANDI_MONO } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';
import type {
  TipoIncidenteItem, SeveridadItem, ReporteCreateRequest, ReporteUpdateRequest, CercanaResponse, Reporte,
} from '../../types/domain';
import type { CiudadanoTabParamList, RootStackParamList } from '../../navigation/types';

// Pestaña Crear (creación, flujo de siempre).
type CrearProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<CiudadanoTabParamList, 'Crear'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
  route: RouteProp<CiudadanoTabParamList, 'Crear'>;
};
// Pantalla de stack EditarReporte (solo Ciudadano): mismo formulario,
// precargado con un reporte propio.
type EditarProps = NativeStackScreenProps<RootStackParamList, 'EditarReporte'>;
type Props = CrearProps | EditarProps;

const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };

// Mismas claves que SeverityPicker: una severidad de catálogo fuera de
// estas queda sin preselección y el ciudadano debe elegir una.
const SEVERIDADES_PICKER: readonly string[] = ['BAJA', 'MEDIA', 'ALTA'];

function severidadInicial(reporte: Reporte | null): SeveridadKey | null {
  if (!reporte) return 'MEDIA';
  const s = (reporte.severidad || '').toUpperCase();
  return SEVERIDADES_PICKER.includes(s) ? (s as SeveridadKey) : null;
}


// Edición: el mapa informa su centro al cargar y cada vez que queda quieto.
// Dentro de esta tolerancia (~0,1 m) se considera el mismo punto guardado y
// se conservan las coordenadas originales, para que el backend no lo tome
// como un cambio de ubicación (y no recalcule el vínculo SIASAR).
const TOLERANCIA_UBICACION = 1e-6;

// Texto legible de una dirección devuelta por reverseGeocodeAsync
// (formattedAddress solo existe en Android).
function textoDireccion(a: Location.LocationGeocodedAddress): string {
  if (a.formattedAddress) return a.formattedAddress;
  const calle = [a.street, a.streetNumber].filter(Boolean).join(' ');
  return [calle || a.name, a.city || a.subregion].filter(Boolean).join(', ');
}

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

export default function CrearReporteScreen(props: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  // Modo edición solo cuando se abre como EditarReporte; en la pestaña Crear
  // reporteEditar es null y todo el flujo de creación queda como siempre.
  const reporteEditar: Reporte | null =
    props.route.name === 'EditarReporte' ? (props as EditarProps).route.params.reporte : null;
  const esEdicion = reporteEditar != null;
  // Las navegaciones a pestañas hermanas (Mapa/Reportes) solo ocurren en
  // modo creación; la edición siempre vuelve con props.navigation.goBack().
  const navigation = props.navigation as CrearProps['navigation'];
  const draftId = esEdicion ? null : (props as CrearProps).route.params?.draftId ?? null;

  // Punto guardado del reporte que se edita (null al crear). Estado sin
  // setter: misma referencia durante toda la pantalla.
  const [ubicacionOriginal] = useState<{ latitude: number; longitude: number } | null>(() => (
    reporteEditar
      ? { latitude: Number(reporteEditar.latitud), longitude: Number(reporteEditar.longitud) }
      : null
  ));

  const [descripcion, setDescripcion] = useState(reporteEditar?.descripcion ?? '');
  const [direccion, setDireccion] = useState(reporteEditar?.direccion ?? '');
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(ubicacionOriginal);
  const [idTipo, setIdTipo] = useState<number | null>(reporteEditar?.id_tipo_incidente ?? null);
  const [severidad, setSeveridad] = useState<SeveridadKey | null>(() => severidadInicial(reporteEditar));
  const [tipos, setTipos] = useState<TipoIncidenteItem[]>([]);
  const [severidades, setSeveridades] = useState<SeveridadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  // En edición la descripción ya es del ciudadano: elegir otro tipo no la
  // reemplaza por el texto prellenado.
  const [descTouched, setDescTouched] = useState(esEdicion);
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
  // Solo edición: foto que el reporte ya tiene en el servidor. Si sigue
  // igual y no hay foto nueva, se conserva (imagen_url no se envía); si se
  // quita, se envía null; una foto nueva (foto) la reemplaza.
  const imagenOriginal = reporteEditar?.imagen_url?.trim() || null;
  const [imagenActual, setImagenActual] = useState<string | null>(imagenOriginal);
  const imagenActualUri = uriImagenServidor(imagenActual);
  const { showDialog, dialog } = useAndiDialog();

  useEffect(() => {
    catalogosAPI.tiposIncidente().then((r) => setTipos(r.data || [])).catch(() => {});
    catalogosAPI.severidades().then((r) => setSeveridades(r.data || [])).catch(() => {});
  }, []);

  // Solo informativo -- nunca bloquea el envío ni se manda en el payload
  // (el backend ya calcula el vínculo real, en el servidor, al crear el
  // reporte -- ver crear_reporte en reportes.py). Debounce de ~600ms para
  // no llamar a /siasar/cercana en cada pixel que se arrastra el mapa.
  // En modo edición no se consulta SIASAR (la edición es independiente de
  // SIASAR) y la pista no se muestra; en creación todo sigue igual.
  useEffect(() => {
    // Reset síncrono a propósito: sin ubicación (o en edición) no hay nada
    // que mostrar, no tiene sentido esperar un debounce para vaciarlo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!coordenadas || esEdicion) { setProximidadSiasar(null); return; }
    const id = setTimeout(() => {
      siasarAPI.cercana(coordenadas.latitude, coordenadas.longitude, 2000)
        .then((res) => setProximidadSiasar(res.data))
        .catch(() => setProximidadSiasar(null));
    }, 600);
    return () => clearTimeout(id);
  }, [coordenadas, esEdicion]);

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

  // expo-location, igual que MapaScreen: navigator.geolocation no existe en
  // React Native (solo en web), por eso "Mi ubicación" no funcionaba en el
  // teléfono.
  const getMyLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showDialog('Permiso denegado', 'Activa la ubicación o marca el punto arrastrando el mapa.', { tone: 'warning' });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const punto = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCoordenadas(punto);
      // Si todavía no escribió dirección, se sugiere la de ese punto (solo
      // móvil: la geocodificación no existe en web). Nunca pisa lo escrito.
      if (!direccion.trim() && Platform.OS !== 'web') {
        Location.reverseGeocodeAsync(punto)
          .then(([a]) => {
            const texto = a ? textoDireccion(a) : '';
            if (texto) setDireccion((actual) => (actual.trim() ? actual : texto));
          })
          .catch(() => {});
      }
    } catch (_) {
      showDialog('No disponible', 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido o marca el punto en el mapa.', { tone: 'warning' });
    } finally {
      setLocLoading(false);
    }
  };

  // Mueve el punto del mapa a la dirección escrita. Solo cuando el ciudadano
  // lo pide (botón o tecla Buscar), nunca al escribir: así no se pierde un
  // punto que ya ajustó a mano en el mapa.
  const ubicarDireccion = async () => {
    const texto = direccion.trim();
    if (!texto) return;
    if (Platform.OS === 'web') {
      showDialog('No disponible', 'En la versión web no se puede buscar una dirección. Marca el punto arrastrando el mapa.', { tone: 'warning' });
      return;
    }
    setGeoLoading(true);
    try {
      // En Android la geocodificación exige el permiso de ubicación.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showDialog('Permiso denegado', 'Para buscar la dirección activa el permiso de ubicación, o marca el punto arrastrando el mapa.', { tone: 'warning' });
        return;
      }
      const consulta = /colombia/i.test(texto) ? texto : `${texto}, Cundinamarca, Colombia`;
      const [resultado] = await Location.geocodeAsync(consulta);
      if (!resultado) {
        showDialog('Dirección no encontrada', 'No pudimos ubicar esa dirección. Revísala o marca el punto arrastrando el mapa.', { tone: 'warning' });
        return;
      }
      setCoordenadas({ latitude: resultado.latitude, longitude: resultado.longitude });
    } catch (_) {
      showDialog('No se pudo buscar', 'No pudimos buscar la dirección en este momento. Marca el punto arrastrando el mapa.', { tone: 'warning' });
    } finally {
      setGeoLoading(false);
    }
  };

  const handleCenterChange = ({ latitude, longitude }: MapCenterChange) => {
    // Solo edición (ubicacionOriginal es null al crear): ver TOLERANCIA_UBICACION.
    if (
      ubicacionOriginal
      && Math.abs(latitude - ubicacionOriginal.latitude) < TOLERANCIA_UBICACION
      && Math.abs(longitude - ubicacionOriginal.longitude) < TOLERANCIA_UBICACION
    ) {
      setCoordenadas(ubicacionOriginal);
      return;
    }
    setCoordenadas({ latitude, longitude });
  };

  const elegirFoto = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length) return;
    setFoto(result.assets[0] ?? null);
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

  // imagenActual siempre es null al crear, así que en creación esto sigue
  // siendo lo mismo de antes.
  const quitarFoto = () => { setFoto(null); setFotoSubida(null); setImagenActual(null); };

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

    if (reporteEditar) { await guardarEdicion(reporteEditar.id_reporte, idTipo, idSeveridad, coordenadas); return; }

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

  // Solo edición. A diferencia de crearReporte(), un fallo nunca guarda un
  // borrador (sería un borrador de creación duplicado): los cambios siguen
  // en el formulario y el ciudadano puede reintentar.
  const guardarEdicion = async (
    idReporte: number,
    idTipoIncidente: number,
    idSeveridad: number,
    ubicacion: { latitude: number; longitude: number },
  ) => {
    // Sin fuente_reporte ni ningún otro campo: el backend rechaza campos
    // extra (422) y nunca deja cambiar dueño, entidad ni estado.
    const payload: ReporteUpdateRequest = {
      id_tipo_incidente: idTipoIncidente,
      id_severidad: idSeveridad,
      descripcion: descripcion.trim(),
      direccion: direccion.trim() || null,
      latitud: ubicacion.latitude,
      longitud: ubicacion.longitude,
    };

    if (foto) {
      // Reemplazar: sube la foto nueva (o reutiliza la ya subida en un
      // intento anterior) y envía su ruta.
      let imagenUrl = fotoSubida;
      if (!imagenUrl) {
        try {
          setLoading(true);
          imagenUrl = (await reportesAPI.subirImagen(await construirFormFoto(foto))).data.imagen_url;
          setFotoSubida(imagenUrl);
        } catch (_) {
          setLoading(false);
          showDialog('No se pudo subir la foto.', 'Tus cambios todavía no se guardaron. ¿Quieres reintentar?', { tone: 'error', buttons: [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Reintentar', onPress: () => { handleSubmit(); } },
          ] });
          return;
        }
      }
      payload.imagen_url = imagenUrl;
    } else if (imagenOriginal && !imagenActual) {
      // Quitar: la foto que tenía el reporte se eliminó del formulario.
      payload.imagen_url = null;
    }
    // Conservar: sin la clave imagen_url, el backend deja la foto actual.

    try {
      setLoading(true);
      await reportesAPI.actualizar(idReporte, payload);
      showDialog('Cambios guardados', 'Tu reporte quedó actualizado.', { tone: 'success', buttons: [
        { text: 'OK', onPress: () => props.navigation.goBack() },
      ] });
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const detail = axios.isAxiosError<{ detail?: unknown }>(e) ? e.response?.data?.detail : undefined;
      const msg = typeof detail === 'string' ? detail : undefined;
      if (status === 403 || status === 404 || status === 409) {
        // Ya no es editable (asignado, cambió de estado, ya no existe…):
        // vuelve al detalle, que se recarga y oculta las acciones.
        showDialog('No se puede editar', msg || 'Este reporte ya no se puede modificar.', { tone: 'warning', buttons: [
          { text: 'OK', onPress: () => props.navigation.goBack() },
        ] });
        return;
      }
      if (status === 400 || status === 422) {
        showDialog('Revisa los datos', msg || 'No se pudieron guardar los cambios.', { tone: 'warning' });
        return;
      }
      showDialog('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo. Tus cambios siguen en el formulario.', { tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'success') {
    return (
      <View style={styles.container}>
        <LiftHeader>
          <View style={styles.topRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.closeBtn} onPress={() => navigation.navigate('Mapa')}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Nuevo reporte</Text>
          </View>
        </LiftHeader>
        <LiftSurface style={{ padding: ANDI_SPACING.s5, width: '100%', maxWidth: r.maxContentWidth(600), alignSelf: 'center' }}>
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
          <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => navigation.navigate('Reportes')}>
            <Text style={styles.primaryBtnText}>Ver mis reportes</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.textBtn} onPress={() => setMode('form')}>
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
            <TouchableOpacity accessibilityRole="button" style={styles.closeBtn} onPress={() => setMode('form')}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Nuevo reporte</Text>
          </View>
        </LiftHeader>
        <LiftSurface style={{ padding: ANDI_SPACING.s5, width: '100%', maxWidth: r.maxContentWidth(600), alignSelf: 'center' }}>
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
          <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => navigation.navigate('Reportes')}>
            <Text style={styles.primaryBtnText}>Ver mis reportes</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.textBtn} onPress={() => setMode('form')}>
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
          <TouchableOpacity accessibilityRole="button"
            style={styles.closeBtn}
            onPress={esEdicion ? () => props.navigation.goBack() : () => navigation.navigate('Mapa')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{esEdicion ? 'Editar reporte' : 'Nuevo reporte'}</Text>
        </View>
        <View style={styles.progressRow}>
          <ProgressStep styles={styles} label="Tipo" done={!!idTipo} />
          <ProgressStep styles={styles} label="Gravedad" done={!!severidad} />
          <ProgressStep styles={styles} label="Sitio" done={!!coordenadas} />
        </View>
      </LiftHeader>

      <LiftSurface>
        <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center' }]} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          <View style={{ width: '100%', maxWidth: r.maxContentWidth(600), gap: ANDI_SPACING.s4 }}>

          <Section styles={styles} n="01" title="Qué está pasando">
            <View style={styles.chipWrap}>
              {tipos.length === 0 && <Text style={styles.mutedText}>Cargando tipos…</Text>}
              {tipos.map((t) => (
                <TouchableOpacity accessibilityRole="button"
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

          <Section styles={styles} n="02" title="Qué tan grave">
            <SeverityPicker value={severidad} onChange={setSeveridad} />
          </Section>

          <Section styles={styles} n="03" title="Dónde">
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
                    returnKeyType="search"
                    onSubmitEditing={ubicarDireccion}
                  />
                  {coordenadas ? (
                    <Text style={styles.coordText}>{coordenadas.latitude.toFixed(5)}, {coordenadas.longitude.toFixed(5)}</Text>
                  ) : (
                    <Text style={styles.coordPending}>Arrastra el mapa para marcar el punto</Text>
                  )}
                  {!!direccion.trim() && Platform.OS !== 'web' && (
                    <TouchableOpacity accessibilityRole="button" onPress={ubicarDireccion} disabled={geoLoading} hitSlop={8} style={styles.geoLink}>
                      {geoLoading
                        ? <ActivityIndicator size="small" color={ANDI_COLORS.primary700} />
                        : <Text style={styles.geoLinkText}>Ubicar esta dirección en el mapa</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity accessibilityRole="button" style={styles.adjustBtn} onPress={getMyLocation} disabled={locLoading}>
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

          <Section styles={styles} n="04" title={descTouched ? 'Cuéntanos qué ves' : 'Cuéntanos · ya lo llenamos'}>
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

          <Section styles={styles} n="05" title="Foto (opcional)">
            {foto ? (
              <View style={styles.fotoCard}>
                <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="cover" />
                <View style={[styles.fotoActions, styles.fotoActionsCard]}>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={elegirDeGaleria} disabled={loading}>
                    <Text style={styles.fotoBtnText}>Cambiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={tomarFoto} disabled={loading}>
                    <Text style={styles.fotoBtnText}>Tomar otra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={quitarFoto} disabled={loading}>
                    <Text style={styles.fotoBtnRemoveText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : imagenActualUri ? (
              // Solo edición: la foto que el reporte ya tiene en el servidor.
              <View style={styles.fotoCard}>
                <Image
                  source={{ uri: imagenActualUri }}
                  style={styles.fotoPreview}
                  resizeMode="cover"
                  accessibilityLabel="Fotografía actual del reporte"
                />
                <View style={[styles.fotoActions, styles.fotoActionsCard]}>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={elegirDeGaleria} disabled={loading}>
                    <Text style={styles.fotoBtnText}>Cambiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={tomarFoto} disabled={loading}>
                    <Text style={styles.fotoBtnText}>Tomar otra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={quitarFoto} disabled={loading}>
                    <Text style={styles.fotoBtnRemoveText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.fotoActions}>
                <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={tomarFoto}>
                  <Text style={styles.fotoBtnText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={elegirDeGaleria}>
                  <Text style={styles.fotoBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}
          </Section>

          {/* Los borradores locales son solo para reportes nuevos. */}
          {!esEdicion && (
            <TouchableOpacity accessibilityRole="button" style={styles.draftLink} onPress={handleSaveDraft}>
              <Text style={styles.draftLinkText}>Guardar como borrador para terminar después</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity accessibilityRole="button" style={[styles.submitBtn, loading && styles.disabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{esEdicion ? 'Guardar cambios' : 'Enviar reporte'}</Text>}
          </TouchableOpacity>
          </View>
        </ScrollView>
      </LiftSurface>
      {dialog}
    </View>
  );
}

type CrearReporteStyles = ReturnType<typeof makeStyles>;

function Section({ n, title, children, styles }: { n: string; title: string; children: React.ReactNode; styles: CrearReporteStyles }) {
  return (
    <View>
      <Text style={styles.sectionLabel}>{n} · {title}</Text>
      {children}
    </View>
  );
}

function ProgressStep({ label, done, styles }: { label: string; done: boolean; styles: CrearReporteStyles }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.progressBar, done && styles.progressBarDone]} />
      <Text style={[styles.progressLabel, done && styles.progressLabelDone]}>{label}{done ? ' ✓' : ''}</Text>
    </View>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ANDI_COLORS.primary700, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: '#fff', fontSize: 20 },
  screenTitle: { ...r.scaleType(ANDI_TYPE.screen), color: '#fff' },
  progressRow: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  progressBar: { height: 4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary700 },
  progressBarDone: { backgroundColor: ANDI_COLORS.primary300 },
  progressLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary300, marginTop: 6 },
  progressLabelDone: { color: ANDI_COLORS.primary100 },

  scroll: { padding: ANDI_SPACING.s5, paddingBottom: ANDI_SPACING.s10 },
  sectionLabel: { ...ANDI_TYPE.overline, color: ANDI_COLORS.onSurfaceVariant, marginBottom: ANDI_SPACING.s2 },
  mutedText: { fontSize: r.scaleFont(12), color: ANDI_COLORS.n400, fontStyle: 'italic' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { minHeight: 44, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  typeChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  typeChipText: { fontSize: r.scaleFont(12), fontWeight: '600', color: ANDI_COLORS.onSurface },
  typeChipTextActive: { color: '#fff' },

  mapCard: { borderRadius: ANDI_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant },
  map: { height: 180 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3, padding: ANDI_SPACING.s3, backgroundColor: ANDI_COLORS.surface },
  direccionInput: { fontSize: r.scaleFont(16), color: ANDI_COLORS.onSurface, padding: 0 },
  coordText: { fontFamily: ANDI_MONO, fontSize: r.scaleFont(11), color: ANDI_COLORS.onSurfaceVariant, marginTop: 4 },
  coordPending: { fontSize: r.scaleFont(11), color: ANDI_COLORS.warning, marginTop: 4, fontWeight: '600' },
  adjustBtn: { minHeight: 40, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  adjustBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 11 },
  geoLink: { marginTop: 6, alignSelf: 'flex-start' },
  geoLinkText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 11, textDecorationLine: 'underline' },
  siasarHint: { fontSize: 11, color: ANDI_COLORS.onInfoContainer, backgroundColor: ANDI_COLORS.infoContainer, paddingHorizontal: ANDI_SPACING.s3, paddingVertical: ANDI_SPACING.s2 },

  textarea: { backgroundColor: ANDI_COLORS.surfaceMid, borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, borderRadius: ANDI_RADIUS.md, padding: ANDI_SPACING.s3, fontSize: 16, color: ANDI_COLORS.onSurface, minHeight: 90 },

  fotoCard: { borderRadius: ANDI_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, backgroundColor: ANDI_COLORS.surface },
  fotoPreview: { width: '100%', height: 180 },
  fotoActions: { flexDirection: 'row', gap: ANDI_SPACING.s2 },
  fotoActionsCard: { padding: ANDI_SPACING.s3 },
  fotoBtn: { flex: 1, minHeight: 44, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  fotoBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 12 },
  fotoBtnRemoveText: { color: ANDI_COLORS.error, fontWeight: '600', fontSize: 12 },

  draftLink: { alignItems: 'center', paddingVertical: ANDI_SPACING.s2 },
  draftLinkText: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: r.scaleFont(12) },

  submitBtn: { minHeight: 56, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: r.scaleFont(15), fontWeight: '700' },
  disabled: { opacity: 0.6 },

  mascotWrap: { alignItems: 'center', paddingVertical: ANDI_SPACING.s5, gap: ANDI_SPACING.s2 },
  queuedHeadline: { ...r.scaleType(ANDI_TYPE.display), color: ANDI_COLORS.onSurface, marginTop: ANDI_SPACING.s3 },
  queuedSub: { ...r.scaleType(ANDI_TYPE.bodyLg), color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center' },
  queuedCard: { backgroundColor: ANDI_COLORS.surfaceMid, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4, marginBottom: ANDI_SPACING.s4 },
  queuedCardTitle: { ...r.scaleType(ANDI_TYPE.card), color: ANDI_COLORS.onSurface },
  queuedCardMeta: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant, marginTop: 4 },
  primaryBtn: { minHeight: 56, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: r.scaleFont(15), fontWeight: '700' },
  textBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textBtnText: { color: ANDI_COLORS.primary700, fontWeight: '600' },
});
