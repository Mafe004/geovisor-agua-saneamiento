import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { reportesAPI } from '../../api/services';
import StatusBadge from '../../components/StatusBadge';
import MapaWebView from '../../components/MapaWebView';

const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };

const FILTERS = [
  { key: '',            label: 'Todos'     },
  { key: 'PENDIENTE',   label: 'Pendiente' },
  { key: 'EN_REVISION', label: 'Revisión'  },
  { key: 'EN_PROCESO',  label: 'Proceso'   },
  { key: 'RESUELTO',    label: 'Resuelto'  },
];

export default function MapaScreen({ navigation }) {
  const [pines, setPines]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [center, setCenter]         = useState(ZIPAQUIRA);
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => { loadPines(); requestLocation(); }, []);

  const loadPines = async () => {
    try {
      const res = await reportesAPI.mapa();
      const puntos = res.data?.puntos || res.data || [];
      setPines(puntos);
    } catch (e) {
      // Mapa público — si falla, mostrar mapa vacío sin alerta
      setPines([]);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCenter({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (_) {}
  };

  const pinesFiltrados = filter
    ? pines.filter(p => (p.estado || '').toUpperCase() === filter)
    : pines;

  const markers = pinesFiltrados
    .filter(p => p.latitud && p.longitud && p.latitud !== 0 && p.longitud !== 0)
    .map(p => ({
      id_reporte: p.id_reporte,
      lat: parseFloat(p.latitud),
      lng: parseFloat(p.longitud),
      severidad: (p.severidad || '').toUpperCase(),
      estado:    (p.estado    || '').toUpperCase(),
      descripcion: p.descripcion,
    }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Mapa de Reportes</Text>
        <Text style={styles.headerSub}>{markers.length} reportes en el mapa</Text>
      </LinearGradient>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mapa */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>Cargando reportes…</Text>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          <MapaWebView
            latitude={center.latitude}
            longitude={center.longitude}
            markers={markers}
            zoom={14}
            onMarkerPress={(pin) => setSelectedPin(pin)}
            style={styles.map}
          />
        </View>
      )}

      {/* Panel del pin seleccionado */}
      {selectedPin && (
        <View style={styles.pinPanel}>
          <View style={styles.pinPanelRow}>
            <Text style={styles.pinId}>Reporte #{selectedPin.id_reporte}</Text>
            <TouchableOpacity onPress={() => setSelectedPin(null)}>
              <Text style={styles.pinClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.pinDesc} numberOfLines={2}>{selectedPin.descripcion || '—'}</Text>
          <View style={styles.pinBadges}>
            <StatusBadge status={selectedPin.estado} type="status" />
            <StatusBadge status={selectedPin.severidad} type="severity" />
          </View>
          <TouchableOpacity
            style={styles.pinDetailBtn}
            onPress={() => {
              navigation.navigate('DetalleReporte', { reporte: selectedPin });
              setSelectedPin(null);
            }}
          >
            <Text style={styles.pinDetailText}>Ver detalle →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB Nuevo reporte */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Crear')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.fabGrad}>
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Leyenda */}
      <View style={styles.legend}>
        {[
          { label: 'Alta',  color: '#EF4444' },
          { label: 'Media', color: '#F59E0B' },
          { label: 'Baja',  color: '#10B981' },
        ].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F3F4F6' },
  header:            { paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16 },
  headerTitle:       { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub:         { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  filterBar:         { backgroundColor: '#fff', maxHeight: 48 },
  filterBarContent:  { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  filterChip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive:  { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  filterText:        { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  filterTextActive:  { color: '#fff' },
  loadingWrap:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:       { marginTop: 12, color: '#6B7280' },
  mapWrap:           { flex: 1 },
  map:               { flex: 1, borderRadius: 0 },
  pinPanel: {
    position: 'absolute', bottom: 80, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8,
  },
  pinPanelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  pinId:         { fontWeight: '700', color: '#1565C0', fontSize: 13 },
  pinClose:      { color: '#9CA3AF', fontSize: 18, padding: 2 },
  pinDesc:       { fontSize: 13, color: '#374151', marginBottom: 8 },
  pinBadges:     { flexDirection: 'row', gap: 6, marginBottom: 10 },
  pinDetailBtn:  { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 8, alignItems: 'center' },
  pinDetailText: { color: '#1565C0', fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute', bottom: 24, right: 16,
    borderRadius: 28, overflow: 'hidden', elevation: 6,
    shadowColor: '#1565C0', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  fabGrad:  { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  fabIcon:  { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  legend: {
    position: 'absolute', bottom: 24, left: 16,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 8, gap: 4,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 10, color: '#374151', fontWeight: '600' },
});
