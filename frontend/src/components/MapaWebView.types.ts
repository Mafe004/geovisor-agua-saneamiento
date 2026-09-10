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
  id?: number;
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
