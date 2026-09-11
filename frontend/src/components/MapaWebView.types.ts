import type { ViewStyle } from 'react-native';

/**
 * Shape of one map pin. Deliberately permissive (every field optional,
 * several accepting either an English or a Spanish key) because
 * mapHtml.ts's buildMapHtml() already reads whichever of these each
 * caller happens to set — MapaScreen, CrearReporteScreen and
 * DetalleReporteScreen each build markers slightly differently. This
 * type documents that existing flexibility, it doesn't add any.
 */
export interface MapMarker {
  /** String ids are used to namespace non-report layers, e.g. SIASAR's
   * "com-<id_siasar>" / "sis-<id_siasar>" so the press handler can tell
   * which layer a marker belongs to without a separate lookup. */
  id?: number | string;
  id_reporte?: number;
  lat?: number;
  lng?: number;
  latitud?: number | string;
  longitud?: number | string;
  color?: string;
  title?: string;
  titulo?: string;
  description?: string;
  descripcion?: string;
  estado?: string;
  severidad?: string;
  /** 'square' for infrastructure points vs the default 'circle' for reports
   * — the two marker layers the app never wants confused on the same map. */
  shape?: 'circle' | 'square';
  /** 1-2 char label drawn on a 'square' marker (e.g. "PT" for a PTAR). */
  label?: string;
  /** Circle radius in px (google.maps.Symbol scale). Reports default to
   * 10 when unset; SIASAR layers pass ~7 to read as visually smaller/
   * secondary next to a report pin. */
  scale?: number;
}

export interface MapCenterChange {
  latitude: number;
  longitude: number;
}

/** Props shared by MapaWebView.tsx (native) and MapaWebView.web.tsx. */
export interface MapaWebViewProps {
  latitude?: number;
  longitude?: number;
  markers?: MapMarker[];
  /** Altura del mapa en px — SOLO number, no '100%' ni otros strings. */
  height?: number;
  zoom?: number;
  onMarkerPress?: (marker: MapMarker) => void;
  interactive?: boolean;
  showCenterPin?: boolean;
  onCenterChange?: (center: MapCenterChange) => void;
  /**
   * Cuando trae flex:1, height se ignora (ver resolveMapContainerStyle).
   * ViewStyle, no StyleProp<ViewStyle> -- resolveMapContainerStyle lee
   * `style.flex` directamente, así que asume un objeto plano; en la
   * práctica todos los callers pasan un solo objeto de
   * StyleSheet.create(), nunca un array.
   */
  style?: ViewStyle;
}
