import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI, siasarAPI } from '../../api/services';
import StatusBadge from '../../components/StatusBadge';
import MapaWebView from '../../components/MapaWebView';
import type { MapMarker } from '../../components/MapaWebView.types';
import type {
  ReporteMapaPunto, MunicipioSiasar, ComunidadMapa, SistemaMapa,
  ComunidadDetalle, SistemaDetalle,
} from '../../types/domain';
import type { CiudadanoTabParamList, RootStackParamList } from '../../navigation/types';
import {
  calificacionColor, PRUEBA_COLOR, CLORACION_LABEL,
  fuenteConFecha, formatearPrueba,
} from '../../theme/siasar';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<CiudadanoTabParamList, 'Mapa'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };

const FILTERS = [
  { key: '',            label: 'Todos'     },
  { key: 'PENDIENTE',   label: 'Pendiente' },
  { key: 'EN_REVISION', label: 'Revisión'  },
  { key: 'EN_PROCESO',  label: 'Proceso'   },
  { key: 'RESUELTO',    label: 'Resuelto'  },
];

type SiasarSeleccion =
  | { tipo: 'comunidad'; data: ComunidadDetalle }
  | { tipo: 'sistema'; data: SistemaDetalle };

export default function MapaScreen({ navigation }: Props) {
  const [pines, setPines]           = useState<ReporteMapaPunto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [center, setCenter]         = useState(ZIPAQUIRA);
  const [selectedPin, setSelectedPin] = useState<MapMarker | null>(null);

  // ── Capas SIASAR ──
  const [capaReportes, setCapaReportes] = useState(true);
  const [capaComunidades, setCapaComunidades] = useState(false);
  const [capaSistemas, setCapaSistemas] = useState(false);
  const [municipios, setMunicipios] = useState<MunicipioSiasar[]>([]);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const [comunidadesSiasar, setComunidadesSiasar] = useState<ComunidadMapa[]>([]);
  const [sistemasSiasar, setSistemasSiasar] = useState<SistemaMapa[]>([]);
  const [selectedSiasar, setSelectedSiasar] = useState<SiasarSeleccion | null>(null);
  const [cargandoDetalleSiasar, setCargandoDetalleSiasar] = useState(false);
  const [selectorMunicipioAbierto, setSelectorMunicipioAbierto] = useState(false);

  useEffect(() => { loadPines(); requestLocation(); loadMunicipios(); }, []);

  const loadPines = async () => {
    try {
      const res = await reportesAPI.mapa();
      setPines(res.data || []);
    } catch (_) {
      // Mapa público — si falla, mostrar mapa vacío sin alerta
      setPines([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMunicipios = async () => {
    try {
      const res = await siasarAPI.municipios();
      const lista = res.data || [];
      setMunicipios(lista);
      const zipaquira = lista.find(m => m.municipio === 'ZIPAQUIRÁ');
      setMunicipio(zipaquira?.municipio ?? lista[0]?.municipio ?? null);
    } catch (_) {
      setMunicipios([]);
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

  const cargarComunidadesSiasar = useCallback(async (m: string) => {
    try {
      const res = await siasarAPI.comunidadesMapa(m);
      setComunidadesSiasar(res.data || []);
    } catch (_) {
      setComunidadesSiasar([]);
    }
  }, []);

  const cargarSistemasSiasar = useCallback(async (m: string) => {
    try {
      const res = await siasarAPI.sistemasMapa(m);
      setSistemasSiasar(res.data || []);
    } catch (_) {
      setSistemasSiasar([]);
    }
  }, []);

  useEffect(() => {
    if (capaComunidades && municipio) cargarComunidadesSiasar(municipio);
    else setComunidadesSiasar([]);
  }, [capaComunidades, municipio, cargarComunidadesSiasar]);

  useEffect(() => {
    if (capaSistemas && municipio) cargarSistemasSiasar(municipio);
    else setSistemasSiasar([]);
  }, [capaSistemas, municipio, cargarSistemasSiasar]);

  const verDetalle = async (idReporte: number | undefined) => {
    if (idReporte == null) return;
    try {
      // selectedPin es un MapMarker (id_reporte/lat/lng/severidad/estado),
      // no un Reporte completo -- se busca el reporte real antes de
      // navegar en vez de pasar el marker con un cast, así
      // DetalleReporteScreen recibe todos sus campos (incluida
      // latitud/longitud, así que su mapa sí puede mostrarse).
      const res = await reportesAPI.obtener(idReporte);
      navigation.navigate('DetalleReporte', { reporte: res.data });
      setSelectedPin(null);
    } catch (_) {
      Alert.alert('Error', 'No se pudo cargar el detalle del reporte.');
    }
  };

  const handleMarkerPress = async (marker: MapMarker) => {
    const id = String(marker.id ?? '');
    if (id.startsWith('com-')) {
      setSelectedPin(null);
      setCargandoDetalleSiasar(true);
      try {
        const res = await siasarAPI.comunidad(Number(id.slice(4)));
        setSelectedSiasar({ tipo: 'comunidad', data: res.data });
      } catch (_) {
        Alert.alert('Error', 'No se pudo cargar el diagnóstico de esta vereda.');
      } finally {
        setCargandoDetalleSiasar(false);
      }
      return;
    }
    if (id.startsWith('sis-')) {
      setSelectedPin(null);
      setCargandoDetalleSiasar(true);
      try {
        const res = await siasarAPI.sistema(Number(id.slice(4)));
        setSelectedSiasar({ tipo: 'sistema', data: res.data });
      } catch (_) {
        Alert.alert('Error', 'No se pudo cargar el diagnóstico de este acueducto.');
      } finally {
        setCargandoDetalleSiasar(false);
      }
      return;
    }
    setSelectedSiasar(null);
    setSelectedPin(marker);
  };

  const pinesFiltrados = filter
    ? pines.filter(p => (p.estado || '').toUpperCase() === filter)
    : pines;

  const reporteMarkers: MapMarker[] = capaReportes
    ? pinesFiltrados
        .filter(p => p.latitud && p.longitud && p.latitud !== 0 && p.longitud !== 0)
        .map(p => ({
          id_reporte: p.id_reporte,
          lat: parseFloat(String(p.latitud)),
          lng: parseFloat(String(p.longitud)),
          severidad: (p.severidad || '').toUpperCase(),
          estado:    (p.estado    || '').toUpperCase(),
        }))
    : [];

  const comunidadMarkers: MapMarker[] = capaComunidades
    ? comunidadesSiasar.map(c => ({
        id: `com-${c.id_siasar}`,
        lat: c.latitud,
        lng: c.longitud,
        titulo: c.nombre,
        color: calificacionColor(c.calificacion),
        shape: 'circle',
        scale: 7,
      }))
    : [];

  const sistemaMarkers: MapMarker[] = capaSistemas
    ? sistemasSiasar.map(s => ({
        id: `sis-${s.id_siasar}`,
        lat: s.latitud,
        lng: s.longitud,
        titulo: s.nombre,
        color: PRUEBA_COLOR[s.prueba_coliformes],
        shape: 'circle',
        scale: 7,
      }))
    : [];

  const markers = [...reporteMarkers, ...comunidadMarkers, ...sistemaMarkers];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Mapa de Reportes</Text>
        <Text style={styles.headerSub}>{reporteMarkers.length} reportes en el mapa</Text>
      </LinearGradient>

      {/* Filtros de reportes */}
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

      {/* Capas SIASAR */}
      <View style={styles.layerBar}>
        <TouchableOpacity
          style={[styles.layerChip, capaReportes && styles.layerChipActive]}
          onPress={() => setCapaReportes(v => !v)}
        >
          <Text style={[styles.layerChipText, capaReportes && styles.layerChipTextActive]}>📍 Reportes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerChip, capaComunidades && styles.layerChipActiveSiasar]}
          onPress={() => setCapaComunidades(v => !v)}
        >
          <Text style={[styles.layerChipText, capaComunidades && styles.layerChipTextActive]}>⬤ Veredas SIASAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerChip, capaSistemas && styles.layerChipActiveSiasar]}
          onPress={() => setCapaSistemas(v => !v)}
        >
          <Text style={[styles.layerChipText, capaSistemas && styles.layerChipTextActive]}>⬤ Acueductos SIASAR</Text>
        </TouchableOpacity>
        {(capaComunidades || capaSistemas) && municipio && (
          <TouchableOpacity style={styles.municipioBtn} onPress={() => setSelectorMunicipioAbierto(v => !v)}>
            <Text style={styles.municipioBtnText}>{municipio} ▾</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectorMunicipioAbierto && (
        <ScrollView style={styles.municipioList}>
          {municipios.map(m => (
            <TouchableOpacity
              key={m.municipio}
              style={styles.municipioItem}
              onPress={() => { setMunicipio(m.municipio); setSelectorMunicipioAbierto(false); }}
            >
              <Text style={styles.municipioItemText}>{m.municipio}</Text>
              <Text style={styles.municipioItemMeta}>{m.comunidades} veredas · {m.sistemas} acueductos</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
            onMarkerPress={handleMarkerPress}
            style={styles.map}
          />
          {cargandoDetalleSiasar && (
            <View style={styles.siasarLoadingOverlay}>
              <ActivityIndicator size="small" color="#1565C0" />
            </View>
          )}
        </View>
      )}

      {/* Panel del pin de reporte seleccionado */}
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
            onPress={() => verDetalle(selectedPin.id_reporte)}
          >
            <Text style={styles.pinDetailText}>Ver detalle →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Panel de diagnóstico SIASAR seleccionado */}
      {selectedSiasar && (
        <ScrollView style={styles.siasarPanel} nestedScrollEnabled>
          {selectedSiasar.tipo === 'comunidad' ? (
            <ComunidadPanel data={selectedSiasar.data} onClose={() => setSelectedSiasar(null)} />
          ) : (
            <SistemaPanel data={selectedSiasar.data} onClose={() => setSelectedSiasar(null)} />
          )}
        </ScrollView>
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
      {!selectedSiasar && (
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
          {(capaComunidades || capaSistemas) && (
            <>
              <Text style={styles.legendCaption}>Pines: reportes ciudadanos · Círculos: datos oficiales SIASAR</Text>
              <Text style={styles.legendCaption}>A: mejor condición · D: condición crítica, según el índice de agua y saneamiento de SIASAR</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function ComunidadPanel({ data, onClose }: { data: ComunidadDetalle; onClose: () => void }) {
  const pctAgua = data.cobertura_agua != null ? Math.round(data.cobertura_agua * 100) : null;
  const pctSan = data.cobertura_saneamiento != null ? Math.round(data.cobertura_saneamiento * 100) : null;
  return (
    <View style={styles.siasarCard}>
      <View style={styles.pinPanelRow}>
        <Text style={styles.siasarTitle}>{data.nombre}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.pinClose}>✕</Text></TouchableOpacity>
      </View>
      <Text style={styles.siasarSubtitle}>{data.localidad ? `${data.localidad} · ` : ''}{data.municipio}</Text>

      {data.calificacion && (
        <View style={[styles.calBadge, { backgroundColor: calificacionColor(data.calificacion) }]}>
          <Text style={styles.calBadgeText}>Calificación SIASAR: {data.calificacion}</Text>
        </View>
      )}

      <Text style={styles.siasarRow}>
        Población: {data.poblacion ?? '—'}{data.poblacion_atipica ? ' (dato por verificar)' : ''}
      </Text>
      <Text style={styles.siasarRow}>Viviendas: {data.viviendas ?? '—'}</Text>
      <Text style={styles.siasarRow}>
        Cobertura de agua: {pctAgua != null ? `${pctAgua}%` : 'sin dato'} · saneamiento: {pctSan != null ? `${pctSan}%` : 'sin dato'}
      </Text>
      <Text style={styles.siasarRow}>
        {data.n_escuelas ? `${data.n_escuelas} escuela(s) registrada(s)` : 'Sin escuelas registradas'}
      </Text>

      {data.sistemas.length > 0 && (
        <View style={styles.siasarSection}>
          <Text style={styles.siasarSectionTitle}>Sistemas que la abastecen</Text>
          {data.sistemas.map(s => (
            <View key={s.id_siasar} style={styles.siasarSubItem}>
              <Text style={styles.siasarSubItemTitle}>{s.nombre}</Text>
              <Text style={styles.siasarSubItemMeta}>Cloración: {CLORACION_LABEL[s.cloracion]}</Text>
              <Text style={styles.siasarSubItemMeta}>{formatearPrueba('coliformes', s.prueba_coliformes)}</Text>
            </View>
          ))}
        </View>
      )}

      {data.prestador && <Text style={styles.siasarRow}>Prestador: {data.prestador}</Text>}
      <Text style={styles.siasarFuente}>{fuenteConFecha(data.fecha_encuesta)}</Text>
    </View>
  );
}

function SistemaPanel({ data, onClose }: { data: SistemaDetalle; onClose: () => void }) {
  return (
    <View style={styles.siasarCard}>
      <View style={styles.pinPanelRow}>
        <Text style={styles.siasarTitle}>{data.nombre}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.pinClose}>✕</Text></TouchableOpacity>
      </View>
      <Text style={styles.siasarSubtitle}>{data.municipio}</Text>

      <Text style={styles.siasarRow}>
        Abastece a {data.poblacion_servida ?? '—'} personas
        {data.poblacion_atipica ? ' (dato por verificar)' : ''}
      </Text>
      <Text style={styles.siasarRow}>
        {data.horas_servicio != null ? `Servicio de ${data.horas_servicio} h al día` : 'Sin dato de horas de servicio'}
      </Text>
      <Text style={styles.siasarRow}>Cloración: {CLORACION_LABEL[data.cloracion]}</Text>
      <Text style={styles.siasarRow}>{formatearPrueba('coliformes', data.prueba_coliformes)}</Text>
      <Text style={styles.siasarRow}>{formatearPrueba('fisicoquimico', data.prueba_fisicoquimica)}</Text>
      {data.prestador && <Text style={styles.siasarRow}>Prestador: {data.prestador}</Text>}

      {data.comunidades.length > 0 && (
        <View style={styles.siasarSection}>
          <Text style={styles.siasarSectionTitle}>Comunidades servidas</Text>
          {data.comunidades.map(c => (
            <Text key={c.id_siasar} style={styles.siasarSubItemMeta}>
              • {c.nombre}{c.calificacion ? ` (${c.calificacion})` : ''}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.siasarFuente}>{fuenteConFecha(data.fecha_encuesta)}</Text>
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

  layerBar: { backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  layerChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  layerChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  layerChipActiveSiasar: { backgroundColor: '#065F46', borderColor: '#065F46' },
  layerChipText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  layerChipTextActive: { color: '#fff' },
  municipioBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#EFF6FF' },
  municipioBtnText: { fontSize: 11, color: '#1565C0', fontWeight: '700' },

  municipioList: { maxHeight: 220, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  municipioItem: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  municipioItemText: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  municipioItemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  loadingWrap:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:       { marginTop: 12, color: '#6B7280' },
  mapWrap:           { flex: 1 },
  map:               { flex: 1, borderRadius: 0 },
  siasarLoadingOverlay: {
    position: 'absolute', top: 12, right: 12, backgroundColor: '#fff',
    borderRadius: 20, padding: 8, elevation: 4,
  },

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

  siasarPanel: {
    position: 'absolute', bottom: 80, left: 16, right: 16, maxHeight: '55%',
  },
  siasarCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8,
  },
  siasarTitle: { fontWeight: '700', color: '#1F2937', fontSize: 15, flex: 1 },
  siasarSubtitle: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  siasarRow: { fontSize: 12, color: '#374151', marginBottom: 4 },
  calBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  calBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  siasarSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  siasarSectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  siasarSubItem: { marginBottom: 6 },
  siasarSubItemTitle: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  siasarSubItemMeta: { fontSize: 11, color: '#6B7280' },
  siasarFuente: { fontSize: 10, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' },

  fab: {
    position: 'absolute', bottom: 24, right: 16,
    borderRadius: 28, overflow: 'hidden', elevation: 6,
    shadowColor: '#1565C0', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  fabGrad:  { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  fabIcon:  { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  legend: {
    position: 'absolute', bottom: 24, left: 16, maxWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 8, gap: 4,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 10, color: '#374151', fontWeight: '600' },
  legendCaption: { fontSize: 9, color: '#6B7280', marginTop: 4 },
});
