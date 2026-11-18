import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import axios from 'axios';
import type { CompositeNavigationProp, ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapaWebView from '../../components/MapaWebView';
import type { MapCenterChange } from '../../components/MapaWebView.types';
import { reportesAPI, catalogosAPI, siasarAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../components/andi/Toast';
import AndiHeader from '../../components/andi/AndiHeader';
import AndiBody from '../../components/andi/AndiBody';
import AndiChip from '../../components/andi/AndiChip';
import ProfileAvatarButton from '../../components/andi/ProfileAvatarButton';
import { andiColors, andiRadius, andiSpace, andiType as andiTypeBase, andiOverlineDecor } from '../../theme/andi';
import { construirFormFoto, subirFotos } from '../../utils/fotoEvidencia';
import MultiFotoPicker from '../../components/andi/MultiFotoPicker';
import type { TipoIncidenteItem, SeveridadItem, ReporteCreateRequest, CercanaResponse } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';
import { useResponsive, useScaledType, type Responsive } from '../../theme/responsive';

// Tab "Crear" de Entidad (-> navega a 'Asignados' tras enviar). Hasta la
// integración del rol Ciudadano de Ciudadano_V2_TS este archivo también
// servía al tab "Crear" de Ciudadano; ahora Ciudadano tiene su propia
// pantalla (ver screens/ciudadano/CrearReporteScreen.tsx). Se deja
// ParamListBase en vez de EntidadTabParamList para no tocar más de lo
// necesario del comportamiento ya validado de Entidad.
type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<ParamListBase>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

// Coordenadas centro de Zipaquirá (Colombia)
const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };

export default function CrearReporteScreen({ navigation }: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const andiType = useScaledType(andiTypeBase);
  const toast = useToast();
  const { user, isCiudadano } = useContext(AuthContext);
  const destinoMisReportes = isCiudadano ? 'Reportes' : 'Asignados';
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(null);
  const [idTipo, setIdTipo] = useState<number | null>(null);
  const [idSeveridad, setIdSeveridad] = useState<number | null>(null);
  const [tipos, setTipos] = useState<TipoIncidenteItem[]>([]);
  const [severidades, setSeveridades] = useState<SeveridadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [proximidadSiasar, setProximidadSiasar] = useState<CercanaResponse | null>(null);

  // Foto del reporte, opcional. fotoSubida = ruta ya devuelta por
  // /reportes/imagen para esta misma foto: si Enviar falla, un reintento
  // no la vuelve a subir -- mismo patrón que ciudadano/CrearReporteScreen.tsx.
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fotoSubida, setFotoSubida] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  // Fotos adicionales del incidente (migración 0008), además de la única
  // de arriba -- se suben todas al enviar, sin cachear entre reintentos
  // (son pocas, reintentar es raro).
  const [fotosExtra, setFotosExtra] = useState<ImagePicker.ImagePickerAsset[]>([]);

  useEffect(() => {
    // Inline (no una función nombrada aparte, que no se reusa en ningún
    // otro lado) -- así el linter puede ver que todo setState ocurre
    // después de un await.
    (async () => {
      try {
        const [t, s] = await Promise.all([
          catalogosAPI.tiposIncidente(),
          catalogosAPI.severidades(),
        ]);
        setTipos(t.data || []);
        setSeveridades(s.data || []);
      } catch (_) {}
    })();
  }, []);

  // Solo informativo -- nunca bloquea el envío ni se manda en el payload
  // (el backend ya calcula el vínculo real, en el servidor, al crear el
  // reporte -- ver crear_reporte en reportes.py). Debounce de ~600ms para
  // no llamar a /siasar/cercana en cada pixel que se arrastra el mapa.
  useEffect(() => {
    // Reset síncrono a propósito: sin ubicación no hay nada que mostrar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!coordenadas) { setProximidadSiasar(null); return; }
    const id = setTimeout(() => {
      siasarAPI.cercana(coordenadas.latitude, coordenadas.longitude, 2000)
        .then(res => setProximidadSiasar(res.data))
        .catch(() => setProximidadSiasar(null));
    }, 600);
    return () => clearTimeout(id);
  }, [coordenadas]);

  // navigator.geolocation (polyfill web) no está disponible de forma
  // confiable en Expo Go/RN moderno -- expo-location es la API real para
  // esto, mismo paquete que ya usa ciudadano/CrearReporteScreen.tsx y
  // ciudadano/MapaScreen.tsx.
  const getMyLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.warning('Permiso denegado', 'Activa la ubicación o marca el punto arrastrando el mapa.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoordenadas({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (_) {
      toast.warning('No disponible', 'No se pudo obtener tu ubicación. Marca el punto en el mapa.');
    } finally {
      setLocLoading(false);
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

  // Callback del pin central de MapaWebView
  const handleCenterChange = ({ latitude, longitude }: MapCenterChange) => {
    setCoordenadas({ latitude, longitude });
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) { toast.warning('Requerido', 'Ingresa una descripción.'); return; }
    if (!coordenadas) { toast.warning('Requerido', 'Arrastra el mapa para marcar la ubicación del problema.'); return; }
    if (!idTipo) { toast.warning('Requerido', 'Selecciona el tipo de incidente.'); return; }
    if (!idSeveridad) { toast.warning('Requerido', 'Selecciona la severidad.'); return; }

    // Si hay foto nueva sin subir todavía, subirla primero -- un fallo acá
    // no debe perder el resto del formulario ya lleno.
    let imagenUrl = fotoSubida;
    if (foto && !imagenUrl) {
      try {
        setSubiendoFoto(true);
        imagenUrl = (await reportesAPI.subirImagen(await construirFormFoto(foto))).data.imagen_url;
        setFotoSubida(imagenUrl);
      } catch (_) {
        toast.error('No se pudo subir la foto', 'Puedes reintentar o enviar el reporte sin foto.');
        setSubiendoFoto(false);
        return;
      } finally {
        setSubiendoFoto(false);
      }
    }

    // Igual que la foto principal: subir las adicionales antes de crear el
    // reporte, sin perder el formulario ya lleno si falla.
    let imagenesUrls: string[] = [];
    if (fotosExtra.length > 0) {
      try {
        setSubiendoFoto(true);
        imagenesUrls = await subirFotos(fotosExtra, reportesAPI.subirImagen);
      } catch (_) {
        toast.error('No se pudieron subir algunas fotos', 'Puedes reintentar o enviar el reporte sin ellas.');
        setSubiendoFoto(false);
        return;
      } finally {
        setSubiendoFoto(false);
      }
    }

    try {
      setLoading(true);
      const payload: ReporteCreateRequest = {
        descripcion: descripcion.trim(),
        latitud: coordenadas.latitude,
        longitud: coordenadas.longitude,
        direccion: direccion.trim() || null,
        id_tipo_incidente: idTipo,
        id_severidad: idSeveridad,
        imagen_url: imagenUrl || null,
        imagenes: imagenesUrls.length > 0 ? imagenesUrls : undefined,
        // El backend ignora este campo y deriva la fuente real del rol del
        // token (ver crear_reporte en reportes.py) -- se envía el valor
        // honesto de todos modos, por documentación, sin cambiar el
        // resultado final.
        fuente_reporte: isCiudadano ? 'CIUDADANO' : 'ENTIDAD',
      };
      await reportesAPI.crear(payload);
      toast.success('Reporte creado', 'Tu reporte fue enviado exitosamente. Un moderador lo revisará pronto.');
      navigation.navigate(destinoMisReportes);
      setDescripcion('');
      setDireccion('');
      setCoordenadas(null);
      setProximidadSiasar(null);
      setIdTipo(null);
      setIdSeveridad(null);
      setFoto(null);
      setFotoSubida(null);
      setFotosExtra([]);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo enviar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AndiHeader
        overline="Reportar un daño"
        title="Nuevo reporte"
        rightElement={<ProfileAvatarButton name={user?.nombre_completo ?? '?'} onPress={() => navigation.navigate('EntidadPerfil')} />}
      />

      <AndiBody>
        <ScrollView
          contentContainerStyle={[styles.scroll, { alignItems: 'center' }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.contentWrap}>
            {/* ── Descripción ── */}
            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Descripción</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Describe el problema con detalle: qué observas, desde cuándo, qué tan grave es…"
              placeholderTextColor={andiColors.onSurfaceVariant}
              multiline
              numberOfLines={4}
              value={descripcion}
              onChangeText={setDescripcion}
              textAlignVertical="top"
            />

            {/* ── Dirección ── */}
            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Dirección (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Carrera 7 # 3-45, barrio Centro"
              placeholderTextColor={andiColors.onSurfaceVariant}
              value={direccion}
              onChangeText={setDireccion}
            />

            {/* ── Tipo incidente ── */}
            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Tipo de incidente</Text>
            <View style={styles.chipRow}>
              {tipos.length === 0 && (
                <Text style={[andiType.caption, styles.emptyChip]}>Cargando tipos…</Text>
              )}
              {tipos.map(t => (
                <AndiChip
                  key={t.id_tipo_incidente}
                  label={t.nombre}
                  variant={idTipo === t.id_tipo_incidente ? 'solid' : 'outline'}
                  onPress={() => setIdTipo(t.id_tipo_incidente)}
                />
              ))}
            </View>

            {/* ── Severidad ── */}
            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Severidad</Text>
            <View style={styles.chipRow}>
              {severidades.length === 0 && (
                <Text style={[andiType.caption, styles.emptyChip]}>Cargando severidades…</Text>
              )}
              {severidades.map(s => (
                <AndiChip
                  key={s.id_severidad}
                  label={s.nombre}
                  variant={idSeveridad === s.id_severidad ? 'solid' : 'outline'}
                  onPress={() => setIdSeveridad(s.id_severidad)}
                />
              ))}
            </View>

            {/* ── Mapa con pin central ── */}
            <View style={styles.mapSection}>
              <View style={styles.mapHeader}>
                <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel, { marginTop: 0 }]}>Ubicación</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.locBtn} onPress={getMyLocation} disabled={locLoading}>
                  {locLoading ? (
                    <ActivityIndicator size="small" color={andiColors.primary600} />
                  ) : (
                    <>
                      <Feather name="crosshair" size={14} color={andiColors.primary600} />
                      <Text style={styles.locBtnText}>Mi ubicación</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[andiType.caption, styles.mapHint]}>
                Arrastra el mapa hasta que el pin quede sobre el lugar exacto del problema
              </Text>

              {/* MapaWebView con showCenterPin — NO necesita react-native-maps */}
              <MapaWebView
                style={styles.map}
                latitude={coordenadas ? coordenadas.latitude : ZIPAQUIRA.latitude}
                longitude={coordenadas ? coordenadas.longitude : ZIPAQUIRA.longitude}
                zoom={15}
                showCenterPin={true}
                onCenterChange={handleCenterChange}
                markers={[]}
              />

              {coordenadas ? (
                <View style={styles.coordRow}>
                  <Feather name="map-pin" size={12} color={andiColors.onSurfaceVariant} />
                  <Text style={[andiType.caption, styles.coordText]}>
                    Lat {coordenadas.latitude.toFixed(5)}, Lng {coordenadas.longitude.toFixed(5)}
                  </Text>
                </View>
              ) : (
                <View style={styles.coordRow}>
                  <Feather name="alert-triangle" size={12} color={andiColors.warning600} />
                  <Text style={[andiType.caption, styles.coordTextPending]}>Aún no has seleccionado una ubicación</Text>
                </View>
              )}

              {coordenadas && proximidadSiasar && (
                <View style={styles.siasarCard}>
                  <Feather name="bar-chart-2" size={14} color={andiColors.primary600} />
                  <Text style={[andiType.caption, styles.siasarHint]}>
                    {proximidadSiasar.comunidad
                      ? `Cerca de la vereda ${proximidadSiasar.comunidad.nombre}, ${proximidadSiasar.comunidad.municipio} (a ${proximidadSiasar.distancia_m} m)`
                      : 'Fuera de las veredas registradas en SIASAR'}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Foto ── */}
            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Foto (opcional)</Text>
            {foto ? (
              <View style={styles.fotoCard}>
                <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="cover" />
                <View style={styles.fotoActions}>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={elegirDeGaleria} disabled={loading || subiendoFoto}>
                    <Text style={styles.fotoBtnText}>Cambiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={tomarFoto} disabled={loading || subiendoFoto}>
                    <Text style={styles.fotoBtnText}>Tomar otra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={quitarFoto} disabled={loading || subiendoFoto}>
                    <Text style={styles.fotoBtnRemoveText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.chipRow}>
                <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={tomarFoto}>
                  <Feather name="camera" size={14} color={andiColors.primary600} />
                  <Text style={styles.fotoBtnText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.fotoBtn} onPress={elegirDeGaleria}>
                  <Feather name="image" size={14} color={andiColors.primary600} />
                  <Text style={styles.fotoBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}

            <MultiFotoPicker
              fotos={fotosExtra}
              onChange={setFotosExtra}
              disabled={loading || subiendoFoto}
              onPermisoCamaraDenegado={() => toast.warning('Permiso denegado', 'Activa el permiso de cámara o elige fotos de la galería.')}
            />

            {/* ── Botón enviar ── */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Enviar reporte"
              style={[styles.saveBtn, (loading || subiendoFoto) && styles.saveBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading || subiendoFoto}
            >
              {loading || subiendoFoto
                ? <ActivityIndicator color={andiColors.n0} />
                : <Text style={styles.saveBtnText}>Enviar reporte</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </AndiBody>
    </View>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  scroll: { padding: andiSpace[5], paddingBottom: andiSpace[8] },
  contentWrap: { width: '100%', maxWidth: r.maxContentWidth(600) },

  sectionLabel: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[2], marginTop: andiSpace[4] },

  textarea: {
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.lg,
    backgroundColor: andiColors.surface, padding: andiSpace[3], fontSize: 16, color: andiColors.onSurface,
    minHeight: 100,
  },
  input: {
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.lg,
    backgroundColor: andiColors.surface, paddingHorizontal: andiSpace[3], fontSize: 16, color: andiColors.onSurface,
    minHeight: 48,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[2] },
  emptyChip: { color: andiColors.onSurfaceVariant, fontStyle: 'italic' },

  fotoCard: { borderRadius: andiRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: andiColors.outlineVariant, backgroundColor: andiColors.surface },
  fotoPreview: { width: '100%', height: 180 },
  fotoActions: { flexDirection: 'row', gap: andiSpace[2], padding: andiSpace[3] },
  fotoBtn: {
    flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, paddingHorizontal: andiSpace[3],
    borderRadius: andiRadius.full, backgroundColor: andiColors.primary50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: andiColors.primary200,
  },
  fotoBtnText: { fontSize: r.scaleFont(13), fontWeight: '600', color: andiColors.primary600 },
  fotoBtnRemoveText: { fontSize: r.scaleFont(13), fontWeight: '600', color: andiColors.error600 },

  mapSection: { marginTop: andiSpace[2] },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapHint: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[2] },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: andiColors.primary50, borderRadius: andiRadius.full,
    paddingHorizontal: andiSpace[3], height: 32,
    borderWidth: 1, borderColor: andiColors.primary200,
  },
  locBtnText: { fontSize: r.scaleFont(13), fontWeight: '600', color: andiColors.primary600 },
  map: { height: r.scaleHeight(240), borderRadius: andiRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: andiColors.outlineVariant },

  coordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: andiSpace[2] },
  coordText: { color: andiColors.onSurfaceVariant },
  coordTextPending: { color: andiColors.warning700, fontWeight: '600' },

  siasarCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[2],
    backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg,
    padding: andiSpace[3], marginTop: andiSpace[3],
  },
  siasarHint: { color: andiColors.onSurface, flex: 1 },

  saveBtn: {
    marginTop: andiSpace[6], minHeight: 56, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary600, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: r.scaleFont(16), lineHeight: r.scaleFont(22), fontWeight: '600', color: andiColors.n0 },
});
