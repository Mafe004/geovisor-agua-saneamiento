import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI, siasarAPI } from '../../api/services';
import MapaWebView from '../../components/MapaWebView';
import type { MapMarker } from '../../components/MapaWebView.types';
import SiasarComunidadInfo from '../../components/SiasarComunidadInfo';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import { StatusChip, SeverityChip } from '../../components/ciudadano/Chip';
import Skeleton from '../../components/ciudadano/Skeleton';
import MascotAndi from '../../components/ciudadano/MascotAndi';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';
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
  { key: '', label: 'Todos' },
  { key: 'PENDIENTE', label: 'Pendiente' },
  { key: 'EN_REVISION', label: 'Revisión' },
  { key: 'EN_PROCESO', label: 'Proceso' },
  { key: 'RESUELTO', label: 'Resuelto' },
];

type SiasarSeleccion =
  | { tipo: 'comunidad'; data: ComunidadDetalle }
  | { tipo: 'sistema'; data: SistemaDetalle };

export default function MapaScreen({ navigation }: Props) {
  const [pines, setPines] = useState<ReporteMapaPunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [center, setCenter] = useState(ZIPAQUIRA);
  const [self, setSelf] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
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

  const loadPines = useCallback(async () => {
    try {
      const res = await reportesAPI.mapa();
      setPines(res.data || []);
    } catch (_) {
      // Mapa público -- si falla, mostrar mapa vacío sin alerta.
      setPines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPines(); }, [loadPines]));

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocStatus('denied'); return; }
      setLocStatus('granted');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCenter(point);
      setSelf(point);
    } catch (_) {
      setLocStatus('denied');
    }
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  const loadMunicipios = useCallback(async () => {
    try {
      const res = await siasarAPI.municipios();
      const lista = res.data || [];
      setMunicipios(lista);
      const zipaquira = lista.find((m) => m.municipio === 'ZIPAQUIRÁ');
      setMunicipio(zipaquira?.municipio ?? lista[0]?.municipio ?? null);
    } catch (_) {
      setMunicipios([]);
    }
  }, []);

  useEffect(() => { loadMunicipios(); }, [loadMunicipios]);

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
      // selectedPin es un MapMarker parcial -- se busca el reporte real
      // antes de navegar para que DetalleReporteScreen reciba todos sus
      // campos (incluida latitud/longitud, para que su mapa se muestre).
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

  const pinesFiltrados = pines
    .filter((p) => !filter || (p.estado || '').toUpperCase() === filter)
    .filter((p) => !query.trim() || `${p.direccion || ''} ${p.tipo_incidente || ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  const reporteMarkers: MapMarker[] = capaReportes
    ? pinesFiltrados
        .filter((p) => p.latitud && p.longitud && p.latitud !== 0 && p.longitud !== 0)
        .map((p) => ({
          id_reporte: p.id_reporte,
          lat: parseFloat(String(p.latitud)),
          lng: parseFloat(String(p.longitud)),
          severidad: (p.severidad || '').toUpperCase(),
          estado: (p.estado || '').toUpperCase(),
          title: p.tipo_incidente,
        }))
    : [];

  const comunidadMarkers: MapMarker[] = capaComunidades
    ? comunidadesSiasar.map((c) => ({
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
    ? sistemasSiasar.map((s) => ({
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

  const hoy = new Date().toDateString();
  const criticosHoy = pines.filter((p) =>
    (p.severidad || '').toUpperCase() === 'ALTA' && !!p.fecha_reporte && new Date(p.fecha_reporte).toDateString() === hoy,
  ).length;

  const recentrar = () => setCenter(self || ZIPAQUIRA);

  return (
    <View style={styles.container}>
      <LiftHeader>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Cundinamarca</Text>
            <Text style={styles.title}>Cerca de ti</Text>
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={() => setSearching((s) => !s)}>
            <Text style={styles.searchIcon}>⌕</Text>
          </TouchableOpacity>
        </View>
        {searching ? (
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por dirección o tipo…"
            placeholderTextColor={ANDI_COLORS.primary200}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        ) : (
          <View style={styles.countRow}>
            <Text style={styles.countNum}>{reporteMarkers.length}</Text>
            <Text style={styles.countLabel}>
              reporte{reporteMarkers.length === 1 ? '' : 's'}{criticosHoy > 0 ? ` · ${criticosHoy} crítico${criticosHoy === 1 ? '' : 's'} hoy` : ''}
            </Text>
          </View>
        )}
      </LiftHeader>

      <LiftSurface>
        <View style={styles.filterBar}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Capas SIASAR (datos oficiales, capa de solo lectura) */}
        <View style={styles.layerBar}>
          <TouchableOpacity
            style={[styles.layerChip, capaReportes && styles.layerChipActive]}
            onPress={() => setCapaReportes((v) => !v)}
          >
            <Text style={[styles.layerChipText, capaReportes && styles.layerChipTextActive]}>Reportes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerChip, capaComunidades && styles.layerChipActiveSiasar]}
            onPress={() => setCapaComunidades((v) => !v)}
          >
            <Text style={[styles.layerChipText, capaComunidades && styles.layerChipTextActive]}>⬤ Veredas SIASAR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerChip, capaSistemas && styles.layerChipActiveSiasar]}
            onPress={() => setCapaSistemas((v) => !v)}
          >
            <Text style={[styles.layerChipText, capaSistemas && styles.layerChipTextActive]}>⬤ Acueductos SIASAR</Text>
          </TouchableOpacity>
          {(capaComunidades || capaSistemas) && municipio && (
            <TouchableOpacity style={styles.municipioBtn} onPress={() => setSelectorMunicipioAbierto((v) => !v)}>
              <Text style={styles.municipioBtnText}>{municipio} ▾</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectorMunicipioAbierto && (
          <ScrollView style={styles.municipioList}>
            {municipios.map((m) => (
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

        <View style={styles.mapWrap}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <Skeleton width={140} height={16} style={{ marginBottom: ANDI_SPACING.s3 }} />
              <Skeleton width="100%" height="60%" radius={ANDI_RADIUS.xl} />
            </View>
          ) : locStatus === 'denied' && !self ? (
            <View style={styles.noLocationWrap}>
              <View style={styles.noLocationCard}>
                <View style={styles.noLocationIcon}><Text style={{ fontSize: 22 }}>◎</Text></View>
                <Text style={styles.noLocationTitle}>No sé dónde estás</Text>
                <Text style={styles.noLocationText}>
                  Sin ubicación puedo mostrarte Cundinamarca completo, pero no lo que tienes al lado.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={requestLocation}>
                  <Text style={styles.primaryBtnText}>Permitir ubicación</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setCenter(ZIPAQUIRA)}>
                  <Text style={styles.outlineBtnText}>Ver todo Cundinamarca</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <MapaWebView
                latitude={center.latitude}
                longitude={center.longitude}
                markers={markers}
                zoom={14}
                onMarkerPress={handleMarkerPress}
                style={styles.map}
              />
              <TouchableOpacity style={styles.recenterBtn} onPress={recentrar}>
                <Text style={styles.recenterIcon}>◎</Text>
              </TouchableOpacity>

              {cargandoDetalleSiasar && (
                <View style={styles.siasarLoadingOverlay}>
                  <ActivityIndicator size="small" color={ANDI_COLORS.primary600} />
                </View>
              )}

              {markers.length === 0 && (
                <View pointerEvents="none" style={styles.emptyOverlay}>
                  <MascotAndi size={90} />
                  <Text style={styles.emptyText}>Nada por aquí todavía</Text>
                </View>
              )}

              {!selectedPin && !selectedSiasar && (capaComunidades || capaSistemas) && (
                <View style={styles.legend}>
                  <Text style={styles.legendCaption}>Pines: reportes ciudadanos · Círculos: datos oficiales SIASAR</Text>
                  <Text style={styles.legendCaption}>A: mejor condición · D: condición crítica</Text>
                </View>
              )}
            </>
          )}
        </View>

        {selectedPin && (
          <View style={styles.anchorCard}>
            <View style={styles.anchorTop}>
              <Text style={styles.anchorId}>Reporte #{selectedPin.id_reporte}</Text>
              <TouchableOpacity onPress={() => setSelectedPin(null)}><Text style={styles.anchorClose}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.anchorTitle} numberOfLines={2}>
              {selectedPin.title || 'Reporte'}
            </Text>
            <View style={styles.anchorChips}>
              <StatusChip estado={selectedPin.estado} />
              <SeverityChip severidad={selectedPin.severidad} />
            </View>
            <TouchableOpacity
              style={styles.anchorBtn}
              onPress={() => verDetalle(selectedPin.id_reporte)}
            >
              <Text style={styles.anchorBtnText}>Ver detalle</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedSiasar && (
          <ScrollView style={styles.siasarPanel} nestedScrollEnabled>
            {selectedSiasar.tipo === 'comunidad' ? (
              <ComunidadPanel data={selectedSiasar.data} onClose={() => setSelectedSiasar(null)} />
            ) : (
              <SistemaPanel data={selectedSiasar.data} onClose={() => setSelectedSiasar(null)} />
            )}
          </ScrollView>
        )}
      </LiftSurface>
    </View>
  );
}

function ComunidadPanel({ data, onClose }: { data: ComunidadDetalle; onClose: () => void }) {
  return (
    <View style={styles.siasarCard}>
      <View style={styles.anchorTop}>
        <Text style={styles.siasarTitle}>{data.nombre}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.anchorClose}>✕</Text></TouchableOpacity>
      </View>
      <SiasarComunidadInfo data={data} />
    </View>
  );
}

function SistemaPanel({ data, onClose }: { data: SistemaDetalle; onClose: () => void }) {
  return (
    <View style={styles.siasarCard}>
      <View style={styles.anchorTop}>
        <Text style={styles.siasarTitle}>{data.nombre}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.anchorClose}>✕</Text></TouchableOpacity>
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
          {data.comunidades.map((c) => (
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
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ANDI_SPACING.s4 },
  kicker: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary200 },
  title: { ...ANDI_TYPE.display, color: '#fff', marginTop: 2 },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: ANDI_COLORS.primary700, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { color: '#fff', fontSize: 17 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  countNum: { ...ANDI_TYPE.displayLg, fontSize: 30, color: '#fff' },
  countLabel: { ...ANDI_TYPE.body, color: ANDI_COLORS.primary200 },
  searchInput: {
    marginTop: ANDI_SPACING.s4, backgroundColor: ANDI_COLORS.primary700, borderRadius: ANDI_RADIUS.md,
    paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 10, color: '#fff', fontSize: 14,
  },

  filterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: ANDI_SPACING.s2, padding: ANDI_SPACING.s4, paddingBottom: ANDI_SPACING.s2 },
  filterChip: { minHeight: 36, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  filterText: { fontSize: 12, fontWeight: '600', color: ANDI_COLORS.onSurface },
  filterTextActive: { color: '#fff' },

  layerBar: { flexDirection: 'row', flexWrap: 'wrap', gap: ANDI_SPACING.s2, paddingHorizontal: ANDI_SPACING.s4, paddingBottom: ANDI_SPACING.s3 },
  layerChip: { minHeight: 32, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surfaceMid, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  layerChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  layerChipActiveSiasar: { backgroundColor: ANDI_COLORS.success, borderColor: ANDI_COLORS.success },
  layerChipText: { fontSize: 11, fontWeight: '600', color: ANDI_COLORS.onSurfaceVariant },
  layerChipTextActive: { color: '#fff' },
  municipioBtn: { minHeight: 32, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  municipioBtnText: { fontSize: 11, fontWeight: '700', color: ANDI_COLORS.primary700 },

  municipioList: { maxHeight: 220, backgroundColor: ANDI_COLORS.surface, borderTopWidth: 1, borderTopColor: ANDI_COLORS.outlineVariant },
  municipioItem: { paddingHorizontal: ANDI_SPACING.s4, paddingVertical: ANDI_SPACING.s3, borderBottomWidth: 1, borderBottomColor: ANDI_COLORS.surfaceMid },
  municipioItemText: { fontSize: 13, fontWeight: '600', color: ANDI_COLORS.onSurface },
  municipioItemMeta: { fontSize: 11, color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },

  mapWrap: { flex: 1, minHeight: 0 },
  map: { flex: 1 },
  loadingWrap: { flex: 1, padding: ANDI_SPACING.s4 },

  noLocationWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ANDI_SPACING.s5, backgroundColor: ANDI_COLORS.mapGround },
  noLocationCard: { width: '100%', backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.xxl, padding: ANDI_SPACING.s5, alignItems: 'center' },
  noLocationIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: ANDI_COLORS.warningContainer, alignItems: 'center', justifyContent: 'center', marginBottom: ANDI_SPACING.s4 },
  noLocationTitle: { ...ANDI_TYPE.section, color: ANDI_COLORS.onSurface, marginBottom: ANDI_SPACING.s2 },
  noLocationText: { ...ANDI_TYPE.body, color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center', marginBottom: ANDI_SPACING.s5 },
  primaryBtn: { width: '100%', minHeight: 48, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center', marginBottom: ANDI_SPACING.s2 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  outlineBtn: { width: '100%', minHeight: 48, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { color: ANDI_COLORS.onSurface, fontWeight: '700' },

  recenterBtn: {
    position: 'absolute', right: ANDI_SPACING.s4, top: ANDI_SPACING.s4,
    width: 44, height: 44, borderRadius: 22, backgroundColor: ANDI_COLORS.surface,
    borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, alignItems: 'center', justifyContent: 'center',
  },
  recenterIcon: { color: ANDI_COLORS.primary600, fontSize: 17 },

  siasarLoadingOverlay: {
    position: 'absolute', top: ANDI_SPACING.s4, left: ANDI_SPACING.s4,
    backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.full, padding: ANDI_SPACING.s2,
  },

  emptyOverlay: { position: 'absolute', top: '30%', left: 0, right: 0, alignItems: 'center', gap: ANDI_SPACING.s2 },
  emptyText: { ...ANDI_TYPE.body, color: ANDI_COLORS.onSurfaceVariant },

  legend: {
    position: 'absolute', bottom: ANDI_SPACING.s4, left: ANDI_SPACING.s4, maxWidth: 240,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: ANDI_RADIUS.md, padding: ANDI_SPACING.s2, gap: 2,
  },
  legendCaption: { fontSize: 9, color: ANDI_COLORS.onSurfaceVariant },

  anchorCard: {
    position: 'absolute', left: ANDI_SPACING.s4, right: ANDI_SPACING.s4, bottom: ANDI_SPACING.s4,
    backgroundColor: ANDI_COLORS.primary900, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4,
  },
  anchorTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: ANDI_SPACING.s2 },
  anchorId: { fontSize: 12, color: ANDI_COLORS.primary200, fontWeight: '600' },
  anchorClose: { color: ANDI_COLORS.primary200, fontSize: 16 },
  anchorTitle: { ...ANDI_TYPE.card, color: '#fff' },
  anchorChips: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s3, marginBottom: ANDI_SPACING.s3 },
  anchorBtn: { minHeight: 48, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary100, alignItems: 'center', justifyContent: 'center' },
  anchorBtnText: { color: ANDI_COLORS.primary900, fontWeight: '700', fontSize: 14 },

  siasarPanel: {
    position: 'absolute', left: ANDI_SPACING.s4, right: ANDI_SPACING.s4, bottom: ANDI_SPACING.s4, maxHeight: '55%',
  },
  siasarCard: {
    backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4,
    borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant,
  },
  siasarTitle: { fontWeight: '700', color: ANDI_COLORS.onSurface, fontSize: 15, flex: 1 },
  siasarSubtitle: { fontSize: 12, color: ANDI_COLORS.onSurfaceVariant, marginBottom: 8 },
  siasarRow: { fontSize: 12, color: ANDI_COLORS.onSurface, marginBottom: 4 },
  siasarSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: ANDI_COLORS.outlineVariant },
  siasarSectionTitle: { fontSize: 12, fontWeight: '700', color: ANDI_COLORS.onSurface, marginBottom: 4 },
  siasarSubItemMeta: { fontSize: 11, color: ANDI_COLORS.onSurfaceVariant },
  siasarFuente: { fontSize: 10, color: ANDI_COLORS.n400, marginTop: 8, fontStyle: 'italic' },
});
