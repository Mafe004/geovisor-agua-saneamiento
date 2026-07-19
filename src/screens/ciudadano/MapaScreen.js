import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { reportesAPI } from '../../api/services';
import StatusBadge from '../../components/StatusBadge';

// Coordenadas centro de Zipaquirá
const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const SEVERITY_COLOR = {
  BAJA: '#10B981', MEDIA: '#F59E0B', ALTA: '#EF4444', CRITICA: '#7C3AED',
};

export default function MapaScreen({ navigation }) {
  const mapRef = useRef(null);
  const [pines, setPines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [filter, setFilter] = useState('TODOS');

  useEffect(() => {
    loadPines();
    requestLocation();
  }, []);

  const loadPines = async () => {
    try {
      const res = await reportesAPI.mapa();
      setPines(res.data || []);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar los reportes del mapa.');
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (_) {}
  };

  const goToMyLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01,
      }, 600);
    }
  };

  const FILTERS = ['TODOS', 'PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO'];
  const pinesFiltrados =
    filter === 'TODOS' ? pines : pines.filter(p => p.estado === filter);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Mapa de Reportes</Text>
        <Text style={styles.headerSub}>{pinesFiltrados.length} reportes visibles</Text>
      </LinearGradient>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'TODOS' ? 'Todos' : f.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mapa */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Cargando reportes…</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={ZIPAQUIRA}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {pinesFiltrados.map(pin => (
            <Marker
              key={pin.id_reporte}
              coordinate={{ latitude: parseFloat(pin.latitud), longitude: parseFloat(pin.longitud) }}
              pinColor={SEVERITY_COLOR[pin.severidad] || '#1565C0'}
              onPress={() => setSelectedPin(pin)}
            >
              <Callout onPress={() => navigation.navigate('DetalleReporte', { reporte: pin })}>
                <View style={styles.callout}>
                  <Text style={styles.calloutId}>#{pin.id_reporte}</Text>
                  <Text style={styles.calloutDesc} numberOfLines={2}>{pin.descripcion}</Text>
                  <StatusBadge status={pin.estado} />
                  <Text style={styles.calloutTap}>Toca para ver detalle →</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Botón mi ubicación */}
      {userLocation && (
        <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation}>
          <Text style={styles.myLocIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* FAB Nuevo reporte */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Crear')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.fabGradient}>
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Leyenda severidad */}
      <View style={styles.legend}>
        {Object.entries(SEVERITY_COLOR).map(([k, v]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: v }]} />
            <Text style={styles.legendText}>{k}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#fff',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  filterText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  map: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280' },
  callout: { width: 200, padding: 8 },
  calloutId: { fontWeight: '700', color: '#1565C0', marginBottom: 4 },
  calloutDesc: { fontSize: 12, color: '#374151', marginBottom: 6 },
  calloutTap: { fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'right' },
  myLocBtn: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 28,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  myLocIcon: { fontSize: 22 },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  legend: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: '#374151', fontWeight: '600' },
});
