import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI, siasarAPI, catalogosAPI } from '../../api/services';
import MapaWebView from '../../components/MapaWebView';
import type { MapaWebViewHandle, MapMarker } from '../../components/MapaWebView.types';
import SiasarComunidadInfo from '../../components/SiasarComunidadInfo';
import { LiftHeader, LiftSurface } from '../../components/ciudadano/LiftHeader';
import { StatusChip, SeverityChip } from '../../components/ciudadano/Chip';
import Skeleton from '../../components/ciudadano/Skeleton';
import MascotAndi from '../../components/ciudadano/MascotAndi';
import { useAndiDialog } from '../../components/ciudadano/AndiDialog';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';
import type {
  ReporteMapaPunto, MunicipioSiasar, ComunidadMapa, SistemaMapa,
  ComunidadDetalle, SistemaDetalle, TipoIncidenteItem,
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

type FiltroFecha = '' | 'HOY' | '7D' | '30D' | 'RANGO';
const FECHA_OPCIONES: { key: FiltroFecha; label: string }[] = [
  { key: '', label: 'Todas las fechas' },
  { key: 'HOY', label: 'Hoy' },
  { key: '7D', label: 'Últimos 7 días' },
  { key: '30D', label: 'Últimos 30 días' },
  { key: 'RANGO', label: 'Rango personalizado' },
];

type SelectorReporte = 'tipo' | 'fecha';

// Las fechas se comparan como claves 'AAAA-MM-DD' (orden de texto = orden
// cronológico). fecha_reporte es un DATETIME de MySQL sin zona horaria: se
// toma su parte de fecha tal cual en vez de pasarla por Date, que la
// reinterpretaría en UTC o en la zona del teléfono según el formato.
const diaDeReporte = (fecha?: string | null): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const haceDias = (n: number) => {
  const hoy = new Date();
  return diaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n));
};

// null si el texto no es una fecha AAAA-MM-DD real (p. ej. 2025-02-30).
const parsearDia = (texto: string): string | null => {
  const t = texto.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  return diaLocal(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) === t ? t : null;
};

type SiasarSeleccion =
  | { tipo: 'comunidad'; data: ComunidadDetalle }
  | { tipo: 'sistema'; data: SistemaDetalle };

export default function MapaScreen({ navigation }: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const [pines, setPines] = useState<ReporteMapaPunto[]>([]);
  const { showDialog, dialog } = useAndiDialog();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [center, setCenter] = useState(ZIPAQUIRA);
  // El mapa solo lee `center` para su centro INICIAL (ver MapaWebView.tsx) --
  // moverlo después de montado (GPS listo, "Recentrar") se pide con
  // mapRef.current.panTo(...), nunca cambiando esta prop.
  const mapRef = useRef<MapaWebViewHandle>(null);
  const [self, setSelf] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [selectedPin, setSelectedPin] = useState<MapMarker | null>(null);

  // ── Filtros de reportes comunitarios (independientes de las capas SIASAR) ──
  const [tiposIncidente, setTiposIncidente] = useState<TipoIncidenteItem[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState<FiltroFecha>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selectorReporte, setSelectorReporte] = useState<SelectorReporte | null>(null);

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

  useEffect(() => {
    catalogosAPI.tiposIncidente()
      .then((res) => setTiposIncidente(res.data || []))
      // Sin catálogo el selector solo ofrece "Todos los tipos".
      .catch(() => setTiposIncidente([]));
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocStatus('denied'); return; }
      setLocStatus('granted');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCenter(point);
      // setCenter alcanza si el mapa todavía no montó (centro inicial);
      // panTo cubre el caso en que el GPS resuelve después de que ya montó.
      mapRef.current?.panTo(point.latitude, point.longitude);
      setSelf(point);
    } catch (_) {
      setLocStatus('denied');
    }
  }, []);

  // requestLocation también es el botón "reintentar ubicación" de más abajo
  // -- no se puede inlinear como IIFE en este efecto sin duplicar esa lógica.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { requestLocation(); }, [requestLocation]);

  // Posición en tiempo real: requestLocation solo toma una foto puntual al
  // entrar (para centrar el mapa una vez); este watch mantiene `self`
  // actualizado mientras la pantalla esté montada, sin volver a mover el
  // centro del mapa (si no, cada tick de GPS le quitaría al usuario el
  // control de panear libremente).
  useEffect(() => {
    if (locStatus !== 'granted') return undefined;
    let subscription: Location.LocationSubscription | null = null;
    let cancelado = false;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
      (loc) => setSelf({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
    ).then((sub) => { if (cancelado) sub.remove(); else subscription = sub; });
    return () => { cancelado = true; subscription?.remove(); };
  }, [locStatus]);

  useEffect(() => {
    // Inline (no un useCallback aparte, que no se reusa en ningún otro
    // lado) -- así el linter puede ver que todo setState ocurre después de
    // un await, en vez de tratar la llamada como si pudiera setState de
    // forma síncrona dentro del efecto.
    (async () => {
      try {
        const res = await siasarAPI.municipios();
        const lista = res.data || [];
        setMunicipios(lista);
        const zipaquira = lista.find((m) => m.municipio === 'ZIPAQUIRÁ');
        setMunicipio(zipaquira?.municipio ?? lista[0]?.municipio ?? null);
      } catch (_) {
        setMunicipios([]);
      }
    })();
  }, []);

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

  // cargarComunidadesSiasar es un useCallback, no un inline IIFE, así que
  // el linter la trata como caja negra y asume que podría hacer setState
  // síncrono -- en realidad todo su setState ocurre tras el await (ver su
  // definición arriba). El reset de la rama `else` sí es síncrono a
  // propósito: apagar el switch de la capa vacía sus marcadores de inmediato.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (capaComunidades && municipio) cargarComunidadesSiasar(municipio);
    else setComunidadesSiasar([]);
  }, [capaComunidades, municipio, cargarComunidadesSiasar]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      showDialog('Error', 'No se pudo cargar el detalle del reporte.', { tone: 'error' });
    }
  };

  const handleMarkerPress = async (marker: MapMarker) => {
    const id = String(marker.id ?? '');
    if (id === 'self') return;
    if (id.startsWith('com-')) {
      setSelectedPin(null);
      setCargandoDetalleSiasar(true);
      try {
        const res = await siasarAPI.comunidad(Number(id.slice(4)));
        setSelectedSiasar({ tipo: 'comunidad', data: res.data });
      } catch (_) {
        showDialog('Error', 'No se pudo cargar el diagnóstico de esta vereda.', { tone: 'error' });
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
        showDialog('Error', 'No se pudo cargar el diagnóstico de este acueducto.', { tone: 'error' });
      } finally {
        setCargandoDetalleSiasar(false);
      }
      return;
    }
    setSelectedSiasar(null);
    setSelectedPin(marker);
  };

  // Límites inclusivos del filtro de fecha; null = sin límite por ese lado.
  const rangoFecha = (): { desde: string | null; hasta: string | null } => {
    const hoy = diaLocal(new Date());
    switch (fechaFiltro) {
      case 'HOY': return { desde: hoy, hasta: hoy };
      case '7D': return { desde: haceDias(6), hasta: hoy };
      case '30D': return { desde: haceDias(29), hasta: hoy };
      case 'RANGO': return { desde: parsearDia(fechaDesde), hasta: parsearDia(fechaHasta) };
      default: return { desde: null, hasta: null };
    }
  };
  const { desde, hasta } = rangoFecha();

  const errorRango = fechaFiltro !== 'RANGO' ? null
    : (fechaDesde.trim() && !desde) || (fechaHasta.trim() && !hasta)
      ? 'Usa el formato AAAA-MM-DD con una fecha válida.'
      : desde && hasta && desde > hasta
        ? 'La fecha inicial es posterior a la final.'
        : null;

  // Con un rango inválido no se filtra por fecha (solo se muestra el aviso).
  const filtraFecha = !errorRango && (desde !== null || hasta !== null);

  // useMemo: referencia estable mientras pines/filter/query/tipoFiltro/
  // desde/hasta/filtraFecha no cambien -- si no, un array nuevo en cada
  // render (p.ej. al escribir en un campo que no toca el mapa) encadenaría
  // en `markers` de abajo y dispararía un window.setMarkers(...) de más.
  const pinesFiltrados = useMemo(() => pines
    .filter((p) => !filter || (p.estado || '').toUpperCase() === filter)
    .filter((p) => !query.trim() || `${p.direccion || ''} ${p.tipo_incidente || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((p) => !tipoFiltro || p.tipo_incidente === tipoFiltro)
    .filter((p) => {
      if (!filtraFecha) return true;
      const dia = diaDeReporte(p.fecha_reporte);
      return !!dia && (!desde || dia >= desde) && (!hasta || dia <= hasta);
    }), [pines, filter, query, tipoFiltro, desde, hasta, filtraFecha]);

  const hayFiltrosActivos = !!(filter || query.trim() || tipoFiltro || fechaFiltro);

  const limpiarFiltros = () => {
    setFilter('');
    setQuery('');
    setTipoFiltro('');
    setFechaFiltro('');
    setFechaDesde('');
    setFechaHasta('');
    setSelectorReporte(null);
  };

  const toggleSelector = (s: SelectorReporte) => setSelectorReporte((cur) => (cur === s ? null : s));

  const opcionesSelector: { key: string; label: string }[] =
    selectorReporte === 'tipo'
      ? [{ key: '', label: 'Todos los tipos' }, ...tiposIncidente.map((t) => ({ key: t.nombre, label: t.nombre }))]
      : selectorReporte === 'fecha'
        ? FECHA_OPCIONES
        : [];

  const valorSelector = selectorReporte === 'tipo' ? tipoFiltro : fechaFiltro;

  const elegirOpcion = (key: string) => {
    if (selectorReporte === 'tipo') setTipoFiltro(key);
    else if (selectorReporte === 'fecha') setFechaFiltro(key as FiltroFecha);
    setSelectorReporte(null);
  };

  const etiquetaFecha = FECHA_OPCIONES.find((o) => o.key === fechaFiltro)?.label;

  // Cada capa se memoiza por separado con sus dependencias reales --
  // reporteMarkers además se reusa suelta más abajo (el contador del
  // encabezado), así que no puede vivir solo dentro del useMemo de
  // `markers`. Sin esto, un array nuevo en cada render (aunque nada de
  // esto haya cambiado) encadenaría en `markers` y dispararía un
  // window.setMarkers(...) de más en MapaWebView por simple cambio de
  // identidad.
  const reporteMarkers: MapMarker[] = useMemo(() => (
    capaReportes
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
      : []
  ), [capaReportes, pinesFiltrados]);

  const comunidadMarkers: MapMarker[] = useMemo(() => (
    capaComunidades
      ? comunidadesSiasar.map((c) => ({
          id: `com-${c.id_siasar}`,
          lat: c.latitud,
          lng: c.longitud,
          titulo: c.nombre,
          color: calificacionColor(c.calificacion),
          shape: 'circle' as const,
          scale: 7,
        }))
      : []
  ), [capaComunidades, comunidadesSiasar]);

  const sistemaMarkers: MapMarker[] = useMemo(() => (
    capaSistemas
      ? sistemasSiasar.map((s) => ({
          id: `sis-${s.id_siasar}`,
          lat: s.latitud,
          lng: s.longitud,
          titulo: s.nombre,
          color: PRUEBA_COLOR[s.prueba_coliformes],
          shape: 'circle' as const,
          scale: 7,
        }))
      : []
  ), [capaSistemas, sistemasSiasar]);

  const selfMarker: MapMarker[] = useMemo(() => (
    self ? [{ id: 'self', lat: self.latitude, lng: self.longitude, titulo: 'Tú', color: ANDI_COLORS.info, shape: 'circle' as const, scale: 8 }] : []
  ), [self]);

  const markers: MapMarker[] = useMemo(() => (
    [...reporteMarkers, ...comunidadMarkers, ...sistemaMarkers, ...selfMarker]
  ), [reporteMarkers, comunidadMarkers, sistemaMarkers, selfMarker]);

  const hoy = new Date().toDateString();
  const criticosHoy = pines.filter((p) =>
    (p.severidad || '').toUpperCase() === 'ALTA' && !!p.fecha_reporte && new Date(p.fecha_reporte).toDateString() === hoy,
  ).length;

  // El mapa ya está montado cada vez que este botón es visible -- mover el
  // centro con panTo (nunca con setCenter, que ya no tiene efecto después
  // del montaje y antes recargaba todo el WebView).
  const recentrar = () => {
    const destino = self || ZIPAQUIRA;
    mapRef.current?.panTo(destino.latitude, destino.longitude);
  };

  return (
    <View style={styles.container}>
      <LiftHeader>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Cundinamarca</Text>
            <Text style={styles.title}>Cerca de ti</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" style={styles.searchBtn} onPress={() => setSearching((s) => !s)}>
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
            <TouchableOpacity accessibilityRole="button"
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtros de reportes comunitarios: se combinan (AND) con estado y texto */}
        <View style={styles.reportFilterBar}>
          <TouchableOpacity
            style={[styles.reportFilterChip, !!tipoFiltro && styles.reportFilterChipActive]}
            onPress={() => toggleSelector('tipo')}
          >
            <Text style={[styles.reportFilterText, !!tipoFiltro && styles.filterTextActive]} numberOfLines={1}>
              {tipoFiltro || 'Tipo'} ▾
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reportFilterChip, !!fechaFiltro && styles.reportFilterChipActive]}
            onPress={() => toggleSelector('fecha')}
          >
            <Text style={[styles.reportFilterText, !!fechaFiltro && styles.filterTextActive]} numberOfLines={1}>
              {fechaFiltro ? etiquetaFecha : 'Fecha'} ▾
            </Text>
          </TouchableOpacity>
          {hayFiltrosActivos && (
            <TouchableOpacity style={styles.clearChip} onPress={limpiarFiltros}>
              <Text style={styles.clearChipText}>✕ Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>

        {fechaFiltro === 'RANGO' && (
          <View style={styles.rangoWrap}>
            <View style={styles.rangoRow}>
              <TextInput
                style={styles.rangoInput}
                placeholder="Desde AAAA-MM-DD"
                placeholderTextColor={ANDI_COLORS.n400}
                value={fechaDesde}
                onChangeText={setFechaDesde}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={styles.rangoInput}
                placeholder="Hasta AAAA-MM-DD"
                placeholderTextColor={ANDI_COLORS.n400}
                value={fechaHasta}
                onChangeText={setFechaHasta}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            {errorRango && <Text style={styles.rangoError}>{errorRango}</Text>}
          </View>
        )}

        {selectorReporte && (
          <ScrollView style={styles.selectorList} nestedScrollEnabled>
            {opcionesSelector.map((o) => (
              <TouchableOpacity key={o.key || '__todos'} style={styles.selectorItem} onPress={() => elegirOpcion(o.key)}>
                <Text style={[styles.selectorItemText, o.key === valorSelector && styles.selectorItemActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Capas SIASAR (datos oficiales, capa de solo lectura) */}
        <View style={styles.layerBar}>
          <TouchableOpacity accessibilityRole="button"
            style={[styles.layerChip, capaReportes && styles.layerChipActive]}
            onPress={() => setCapaReportes((v) => !v)}
          >
            <Text style={[styles.layerChipText, capaReportes && styles.layerChipTextActive]}>Reportes</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            style={[styles.layerChip, capaComunidades && styles.layerChipActiveSiasar]}
            onPress={() => setCapaComunidades((v) => !v)}
          >
            <Text style={[styles.layerChipText, capaComunidades && styles.layerChipTextActive]}>⬤ Veredas SIASAR</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            style={[styles.layerChip, capaSistemas && styles.layerChipActiveSiasar]}
            onPress={() => setCapaSistemas((v) => !v)}
          >
            <Text style={[styles.layerChipText, capaSistemas && styles.layerChipTextActive]}>⬤ Acueductos SIASAR</Text>
          </TouchableOpacity>
          {(capaComunidades || capaSistemas) && municipio && (
            <TouchableOpacity accessibilityRole="button" style={styles.municipioBtn} onPress={() => setSelectorMunicipioAbierto((v) => !v)}>
              <Text style={styles.municipioBtnText}>{municipio} ▾</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectorMunicipioAbierto && (
          <ScrollView style={styles.municipioList}>
            {municipios.map((m) => (
              <TouchableOpacity accessibilityRole="button"
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
                <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={requestLocation}>
                  <Text style={styles.primaryBtnText}>Permitir ubicación</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.outlineBtn} onPress={() => setCenter(ZIPAQUIRA)}>
                  <Text style={styles.outlineBtnText}>Ver todo Cundinamarca</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <MapaWebView
                ref={mapRef}
                latitude={center.latitude}
                longitude={center.longitude}
                markers={markers}
                zoom={14}
                onMarkerPress={handleMarkerPress}
                style={styles.map}
              />
              <TouchableOpacity accessibilityRole="button" style={styles.recenterBtn} onPress={recentrar}>
                <Text style={styles.recenterIcon}>◎</Text>
              </TouchableOpacity>

              {cargandoDetalleSiasar && (
                <View style={styles.siasarLoadingOverlay}>
                  <ActivityIndicator size="small" color={ANDI_COLORS.primary600} />
                </View>
              )}

              {markers.length - selfMarker.length === 0 && (
                <View pointerEvents="none" style={styles.emptyOverlay}>
                  {/* Mascota oculta temporalmente (este estado también aparece cuando falla la carga). */}
                  {/* <MascotAndi size={90} /> */}
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
              <TouchableOpacity accessibilityRole="button" onPress={() => setSelectedPin(null)}><Text style={styles.anchorClose}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.anchorTitle} numberOfLines={2}>
              {selectedPin.title || 'Reporte'}
            </Text>
            <View style={styles.anchorChips}>
              <StatusChip estado={selectedPin.estado} />
              <SeverityChip severidad={selectedPin.severidad} />
            </View>
            <TouchableOpacity accessibilityRole="button"
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
              <ComunidadPanel styles={styles} data={selectedSiasar.data} onClose={() => setSelectedSiasar(null)} />
            ) : (
              <SistemaPanel styles={styles} data={selectedSiasar.data} onClose={() => setSelectedSiasar(null)} />
            )}
          </ScrollView>
        )}
      </LiftSurface>
      {dialog}
    </View>
  );
}

type MapaStyles = ReturnType<typeof makeStyles>;

function ComunidadPanel({ data, onClose, styles }: { data: ComunidadDetalle; onClose: () => void; styles: MapaStyles }) {
  return (
    <View style={styles.siasarCard}>
      <View style={styles.anchorTop}>
        <Text style={styles.siasarTitle}>{data.nombre}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onClose}><Text style={styles.anchorClose}>✕</Text></TouchableOpacity>
      </View>
      <SiasarComunidadInfo data={data} />
    </View>
  );
}

function SistemaPanel({ data, onClose, styles }: { data: SistemaDetalle; onClose: () => void; styles: MapaStyles }) {
  return (
    <View style={styles.siasarCard}>
      <View style={styles.anchorTop}>
        <Text style={styles.siasarTitle}>{data.nombre}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onClose}><Text style={styles.anchorClose}>✕</Text></TouchableOpacity>
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

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: ANDI_COLORS.background },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ANDI_SPACING.s4 },
  kicker: { ...ANDI_TYPE.overline, color: ANDI_COLORS.primary200 },
  title: { ...r.scaleType(ANDI_TYPE.display), color: '#fff', marginTop: 2 },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: ANDI_COLORS.primary700, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { color: '#fff', fontSize: 22 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s4 },
  countNum: { ...ANDI_TYPE.displayLg, fontSize: r.scaleFont(30), color: '#fff' },
  countLabel: { ...r.scaleType(ANDI_TYPE.body), color: ANDI_COLORS.primary200 },
  searchInput: {
    marginTop: ANDI_SPACING.s4, backgroundColor: ANDI_COLORS.primary700, borderRadius: ANDI_RADIUS.md,
    paddingHorizontal: ANDI_SPACING.s3, paddingVertical: 10, color: '#fff', fontSize: r.scaleFont(16),
  },

  filterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: ANDI_SPACING.s2, padding: ANDI_SPACING.s4, paddingBottom: ANDI_SPACING.s2 },
  filterChip: { minHeight: 36, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  filterText: { fontSize: r.scaleFont(12), fontWeight: '600', color: ANDI_COLORS.onSurface },
  filterTextActive: { color: '#fff' },

  reportFilterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: ANDI_SPACING.s2, paddingHorizontal: ANDI_SPACING.s4, paddingBottom: ANDI_SPACING.s2 },
  reportFilterChip: { minHeight: 36, maxWidth: 200, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surface, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  reportFilterChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  reportFilterText: { fontSize: 12, fontWeight: '600', color: ANDI_COLORS.onSurface },
  clearChip: { minHeight: 36, paddingHorizontal: ANDI_SPACING.s4, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  clearChipText: { fontSize: 12, fontWeight: '700', color: ANDI_COLORS.primary700 },

  rangoWrap: { paddingHorizontal: ANDI_SPACING.s4, paddingBottom: ANDI_SPACING.s2 },
  rangoRow: { flexDirection: 'row', gap: ANDI_SPACING.s2 },
  rangoInput: {
    flex: 1, minHeight: 40, borderRadius: ANDI_RADIUS.md, borderWidth: 1, borderColor: ANDI_COLORS.outline,
    backgroundColor: ANDI_COLORS.surface, paddingHorizontal: ANDI_SPACING.s3, fontSize: 13, color: ANDI_COLORS.onSurface,
  },
  rangoError: { ...ANDI_TYPE.caption, color: ANDI_COLORS.error, marginTop: ANDI_SPACING.s1 },

  selectorList: { maxHeight: 220, backgroundColor: ANDI_COLORS.surface, borderTopWidth: 1, borderTopColor: ANDI_COLORS.outlineVariant },
  selectorItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ANDI_SPACING.s4, borderBottomWidth: 1, borderBottomColor: ANDI_COLORS.surfaceMid },
  selectorItemText: { fontSize: 13, fontWeight: '600', color: ANDI_COLORS.onSurface },
  selectorItemActive: { color: ANDI_COLORS.primary600, fontWeight: '700' },

  layerBar: { flexDirection: 'row', flexWrap: 'wrap', gap: ANDI_SPACING.s2, paddingHorizontal: ANDI_SPACING.s4, paddingBottom: ANDI_SPACING.s3 },
  layerChip: { minHeight: 32, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.surfaceMid, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  layerChipActive: { backgroundColor: ANDI_COLORS.primary600, borderColor: ANDI_COLORS.primary600 },
  layerChipActiveSiasar: { backgroundColor: ANDI_COLORS.success, borderColor: ANDI_COLORS.success },
  layerChipText: { fontSize: r.scaleFont(11), fontWeight: '600', color: ANDI_COLORS.onSurfaceVariant },
  layerChipTextActive: { color: '#fff' },
  municipioBtn: { minHeight: 32, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary50, alignItems: 'center', justifyContent: 'center' },
  municipioBtnText: { fontSize: r.scaleFont(11), fontWeight: '700', color: ANDI_COLORS.primary700 },

  municipioList: { maxHeight: 220, backgroundColor: ANDI_COLORS.surface, borderTopWidth: 1, borderTopColor: ANDI_COLORS.outlineVariant },
  municipioItem: { paddingHorizontal: ANDI_SPACING.s4, paddingVertical: ANDI_SPACING.s3, borderBottomWidth: 1, borderBottomColor: ANDI_COLORS.surfaceMid },
  municipioItemText: { fontSize: r.scaleFont(13), fontWeight: '600', color: ANDI_COLORS.onSurface },
  municipioItemMeta: { fontSize: r.scaleFont(11), color: ANDI_COLORS.onSurfaceVariant, marginTop: 2 },

  mapWrap: { flex: 1, minHeight: 0 },
  map: { flex: 1 },
  loadingWrap: { flex: 1, padding: ANDI_SPACING.s4 },

  noLocationWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ANDI_SPACING.s5, backgroundColor: ANDI_COLORS.mapGround },
  noLocationCard: { width: '100%', maxWidth: r.maxContentWidth(420), backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.xxl, padding: ANDI_SPACING.s5, alignItems: 'center' },
  noLocationIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: ANDI_COLORS.warningContainer, alignItems: 'center', justifyContent: 'center', marginBottom: ANDI_SPACING.s4 },
  noLocationTitle: { ...r.scaleType(ANDI_TYPE.section), color: ANDI_COLORS.onSurface, marginBottom: ANDI_SPACING.s2 },
  noLocationText: { ...r.scaleType(ANDI_TYPE.body), color: ANDI_COLORS.onSurfaceVariant, textAlign: 'center', marginBottom: ANDI_SPACING.s5 },
  primaryBtn: { width: '100%', minHeight: 48, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary600, alignItems: 'center', justifyContent: 'center', marginBottom: ANDI_SPACING.s2 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  outlineBtn: { width: '100%', minHeight: 48, borderRadius: ANDI_RADIUS.full, borderWidth: 1, borderColor: ANDI_COLORS.outline, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { color: ANDI_COLORS.onSurface, fontWeight: '700' },

  recenterBtn: {
    position: 'absolute', right: ANDI_SPACING.s4, top: ANDI_SPACING.s4,
    width: 44, height: 44, borderRadius: 22, backgroundColor: ANDI_COLORS.surface,
    borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, alignItems: 'center', justifyContent: 'center',
  },
  recenterIcon: { color: ANDI_COLORS.primary600, fontSize: 22 },

  siasarLoadingOverlay: {
    position: 'absolute', top: ANDI_SPACING.s4, left: ANDI_SPACING.s4,
    backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.full, padding: ANDI_SPACING.s2,
  },

  emptyOverlay: { position: 'absolute', top: '30%', left: 0, right: 0, alignItems: 'center', gap: ANDI_SPACING.s2 },
  emptyText: { ...r.scaleType(ANDI_TYPE.body), color: ANDI_COLORS.onSurfaceVariant },

  legend: {
    position: 'absolute', bottom: ANDI_SPACING.s4, left: ANDI_SPACING.s4, maxWidth: r.isTablet ? 320 : '65%',
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: ANDI_RADIUS.md, padding: ANDI_SPACING.s2, gap: 2,
  },
  legendCaption: { fontSize: r.scaleFont(9), color: ANDI_COLORS.onSurfaceVariant },

  anchorCard: {
    position: 'absolute', left: ANDI_SPACING.s4, right: ANDI_SPACING.s4, bottom: ANDI_SPACING.s4,
    alignSelf: r.isTablet ? 'center' : undefined, width: r.isTablet ? r.maxContentWidth(480) : undefined,
    backgroundColor: ANDI_COLORS.primary900, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4,
  },
  anchorTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: ANDI_SPACING.s2 },
  anchorId: { fontSize: r.scaleFont(12), color: ANDI_COLORS.primary200, fontWeight: '600' },
  anchorClose: { color: ANDI_COLORS.primary200, fontSize: 20 },
  anchorTitle: { ...r.scaleType(ANDI_TYPE.card), color: '#fff' },
  anchorChips: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s3, marginBottom: ANDI_SPACING.s3 },
  anchorBtn: { minHeight: 48, borderRadius: ANDI_RADIUS.full, backgroundColor: ANDI_COLORS.primary100, alignItems: 'center', justifyContent: 'center' },
  anchorBtnText: { color: ANDI_COLORS.primary900, fontWeight: '700', fontSize: r.scaleFont(14) },

  siasarPanel: {
    position: 'absolute', left: ANDI_SPACING.s4, right: ANDI_SPACING.s4, bottom: ANDI_SPACING.s4, maxHeight: '55%',
    alignSelf: r.isTablet ? 'center' : undefined, width: r.isTablet ? r.maxContentWidth(480) : undefined,
  },
  siasarCard: {
    backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.xl, padding: ANDI_SPACING.s4,
    borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant,
  },
  siasarTitle: { fontWeight: '700', color: ANDI_COLORS.onSurface, fontSize: r.scaleFont(15), flex: 1 },
  siasarSubtitle: { fontSize: r.scaleFont(12), color: ANDI_COLORS.onSurfaceVariant, marginBottom: 8 },
  siasarRow: { fontSize: r.scaleFont(12), color: ANDI_COLORS.onSurface, marginBottom: 4 },
  siasarSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: ANDI_COLORS.outlineVariant },
  siasarSectionTitle: { fontSize: r.scaleFont(12), fontWeight: '700', color: ANDI_COLORS.onSurface, marginBottom: 4 },
  siasarSubItemMeta: { fontSize: r.scaleFont(11), color: ANDI_COLORS.onSurfaceVariant },
  siasarFuente: { fontSize: r.scaleFont(10), color: ANDI_COLORS.n400, marginTop: 8, fontStyle: 'italic' },
});
