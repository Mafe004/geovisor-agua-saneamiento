import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapaWebView from '../../components/MapaWebView';
import { reportesAPI, catalogosAPI } from '../../api/services';

// Coordenadas centro de Zipaquirá (Colombia)
const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };

export default function CrearReporteScreen({ navigation }) {
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [coordenadas, setCoordenadas] = useState(null);
  const [idTipo, setIdTipo] = useState(null);
  const [idSeveridad, setIdSeveridad] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [severidades, setSeveridades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  useEffect(() => {
    loadCatalogos();
  }, []);

  const loadCatalogos = async () => {
    try {
      const [t, s] = await Promise.all([
        catalogosAPI.tiposIncidente(),
        catalogosAPI.severidades(),
      ]);
      setTipos(t.data || []);
      setSeveridades(s.data || []);
    } catch (_) {}
  };

  // Obtener ubicación del dispositivo usando la API del navegador (funciona en WebView + Expo Go)
  const getMyLocation = () => {
    setLocLoading(true);
    // navigator.geolocation funciona en WebView vía JavaScript
    // En React Native también está disponible como polyfill
    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoordenadas({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setLocLoading(false);
        },
        (_err) => {
          Alert.alert('Permiso denegado', 'Activa la ubicación para usar esta función.');
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      Alert.alert('No disponible', 'La geolocalización no está disponible en este dispositivo.');
      setLocLoading(false);
    }
  };

  // Callback del pin central de MapaWebView
  const handleCenterChange = ({ latitude, longitude }) => {
    setCoordenadas({ latitude, longitude });
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) { Alert.alert('Requerido', 'Ingresa una descripción.'); return; }
    if (!coordenadas) { Alert.alert('Requerido', 'Arrastra el mapa para marcar la ubicación del problema.'); return; }
    if (!idTipo) { Alert.alert('Requerido', 'Selecciona el tipo de incidente.'); return; }
    if (!idSeveridad) { Alert.alert('Requerido', 'Selecciona la severidad.'); return; }

    try {
      setLoading(true);
      await reportesAPI.crear({
        descripcion: descripcion.trim(),
        latitud: coordenadas.latitude,
        longitud: coordenadas.longitude,
        direccion_aproximada: direccion.trim() || null,
        id_tipo_incidente: idTipo,
        id_severidad: idSeveridad,
      });
      Alert.alert(
        '✅ Reporte creado',
        'Tu reporte fue enviado exitosamente. Un moderador lo revisará pronto.',
        [{ text: 'Ver mis reportes', onPress: () => navigation.navigate('Reportes') }],
      );
      setDescripcion('');
      setDireccion('');
      setCoordenadas(null);
      setIdTipo(null);
      setIdSeveridad(null);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo enviar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>➕ Nuevo Reporte</Text>
        <Text style={styles.headerSub}>Reporta un problema de agua o saneamiento</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {/* ── Descripción ── */}
        <Text style={styles.label}>Descripción *</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Describe el problema con detalle: qué observas, desde cuándo, qué tan grave es…"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          value={descripcion}
          onChangeText={setDescripcion}
          textAlignVertical="top"
        />

        {/* ── Dirección ── */}
        <Text style={styles.label}>Dirección aproximada (opcional)</Text>
        <TextInput
          style={styles.inputField}
          placeholder="Ej: Carrera 7 # 3-45, barrio Centro"
          placeholderTextColor="#9CA3AF"
          value={direccion}
          onChangeText={setDireccion}
        />

        {/* ── Tipo incidente ── */}
        <Text style={styles.label}>Tipo de incidente *</Text>
        <View style={styles.chipRow}>
          {tipos.length === 0 && (
            <Text style={styles.emptyChip}>Cargando tipos…</Text>
          )}
          {tipos.map(t => (
            <TouchableOpacity
              key={t.id_tipo}
              style={[styles.chip, idTipo === t.id_tipo && styles.chipActive]}
              onPress={() => setIdTipo(t.id_tipo)}
            >
              <Text style={[styles.chipText, idTipo === t.id_tipo && styles.chipTextActive]}>
                {t.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Severidad ── */}
        <Text style={styles.label}>Severidad *</Text>
        <View style={styles.chipRow}>
          {severidades.length === 0 && (
            <Text style={styles.emptyChip}>Cargando severidades…</Text>
          )}
          {severidades.map(s => (
            <TouchableOpacity
              key={s.id_severidad}
              style={[styles.chip, idSeveridad === s.id_severidad && styles.chipActive]}
              onPress={() => setIdSeveridad(s.id_severidad)}
            >
              <Text style={[styles.chipText, idSeveridad === s.id_severidad && styles.chipTextActive]}>
                {s.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Mapa con pin central ── */}
        <View style={styles.mapSection}>
          <View style={styles.mapHeader}>
            <Text style={styles.label}>Ubicación del problema *</Text>
            <TouchableOpacity style={styles.locBtn} onPress={getMyLocation} disabled={locLoading}>
              {locLoading
                ? <ActivityIndicator size="small" color="#1565C0" />
                : <Text style={styles.locBtnText}>📍 Mi ubicación</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.mapHint}>
            Arrastra el mapa hasta que el pin rojo quede sobre el lugar exacto del problema
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
            <Text style={styles.coordText}>
              📌 Lat {coordenadas.latitude.toFixed(5)}, Lng {coordenadas.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.coordTextPending}>
              ⚠️ Aún no has seleccionado una ubicación
            </Text>
          )}
        </View>

        {/* ── Botón enviar ── */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={['#1565C0', '#00ACC1']}
            style={styles.btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Enviar reporte</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 16 },
  textarea: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#fff', padding: 12, fontSize: 14, color: '#1F2937',
    minHeight: 100,
  },
  inputField: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#fff', padding: 12, fontSize: 14, color: '#1F2937', height: 48,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptyChip: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  mapSection: { marginTop: 8 },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapHint: { fontSize: 12, color: '#6B7280', marginBottom: 8, lineHeight: 16 },
  locBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  locBtnText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
  map: { height: 240, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E5E7EB' },
  coordText: { fontSize: 11, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  coordTextPending: { fontSize: 11, color: '#F59E0B', marginTop: 6, textAlign: 'center', fontWeight: '600' },
  btn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
