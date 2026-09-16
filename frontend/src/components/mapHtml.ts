import type { ViewStyle } from 'react-native';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import type { MapaWebViewProps } from './MapaWebView.types';

const SEVERITY_COLOR: Record<string, string> = {
  ALTA: '#EF4444', CRITICA: '#7C3AED',
  MEDIA: '#F59E0B', BAJA: '#10B981',
};
const STATUS_COLOR: Record<string, string> = {
  PENDIENTE: '#F59E0B', EN_REVISION: '#3B82F6',
  EN_PROCESO: '#8B5CF6', RESUELTO: '#10B981',
  RECHAZADO: '#EF4444', CERRADO: '#6B7280',
};

type BuildMapHtmlOptions = Pick<
  MapaWebViewProps,
  'latitude' | 'longitude' | 'markers' | 'zoom' | 'interactive' | 'showCenterPin'
>;

/**
 * Construye el documento HTML del mapa (Google Maps JS API).
 * Compartido por MapaWebView.js (react-native-webview, nativo) y
 * MapaWebView.web.js (iframe, navegador) para no duplicar la lógica.
 *
 * El HTML enviado mensajes vía postMessage detecta en cuál de los dos
 * contextos corre: window.ReactNativeWebView (nativo) o window.parent
 * (iframe en web) - así el mismo HTML sirve para ambos.
 */
export function buildMapHtml({
  latitude = 5.0231,
  longitude = -74.0041,
  markers = [],
  zoom = 14,
  interactive = true,
  showCenterPin = false,
}: BuildMapHtmlOptions) {
  // Datos de los marcadores serializados como JSON (evita bugs de
  // escapado manual de comillas que tenía la versión Leaflet).
  // < evita que un "</script>" dentro de una descripción rompa el HTML.
  const markersData = JSON.stringify(markers.map(m => ({
    id: m.id ?? m.id_reporte ?? 0,
    lat: m.lat ?? m.latitud,
    lng: m.lng ?? m.longitud,
    // (m.severidad ?? '') / (m.estado ?? '') en vez de m.severidad/m.estado
    // directo -- solo para el tipo del índice (Record<string, string> no
    // acepta `undefined`), sin normalizar mayúsculas/minúsculas: "" no es
    // una key real de ninguno de los dos mapas, así que cuando el campo
    // falta esto cae en el mismo fallback '#1565C0' que antes.
    color: m.color || SEVERITY_COLOR[m.severidad ?? '']
      || STATUS_COLOR[m.estado ?? ''] || '#1565C0',
    title: m.title || m.descripcion || `#${m.id || m.id_reporte}`,
    description: m.description || m.estado || '',
    shape: m.shape || 'circle',
    label: m.label || '',
    scale: m.scale || 10,
  }))).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100vh; background:#E8F4FD; }
  #error-overlay {
    display:none; position:absolute; inset:0; align-items:center; justify-content:center;
    text-align:center; padding:20px; font-family:sans-serif; font-size:13px; color:#6B7280;
    background:#E8F4FD;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="error-overlay">
  No se pudo cargar Google Maps.<br/>Verifica la API key en src/config/maps.js.
</div>
<script>
  var MARKERS = ${markersData};
  var SHOW_CENTER_PIN = ${showCenterPin};
  var INTERACTIVE = ${interactive};

  // Funciona tanto embebido en un WebView nativo (window.ReactNativeWebView)
  // como en un <iframe> web (window.parent) sin cambiar este HTML.
  function postToHost(data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    } else if (window.parent) {
      window.parent.postMessage(data, '*');
    }
  }

  function showError() {
    document.getElementById('map').style.display = 'none';
    document.getElementById('error-overlay').style.display = 'flex';
  }

  // Google llama esto si la API key es inválida, sin billing, con
  // restricciones de referrer, etc. — mucho más confiable que adivinar
  // por timeout si el mapa "no aparece".
  window.gm_authFailure = showError;

  function initMap() {
    var center = { lat: ${latitude}, lng: ${longitude} };
    var map = new google.maps.Map(document.getElementById('map'), {
      center: center,
      zoom: ${zoom},
      disableDefaultUI: !INTERACTIVE,
      zoomControl: INTERACTIVE,
      gestureHandling: INTERACTIVE ? 'greedy' : 'none',
      draggable: INTERACTIVE,
      scrollwheel: false,
      clickableIcons: false,
    });

    var infoWindow = new google.maps.InfoWindow();

    MARKERS.forEach(function (m) {
      var isSquare = m.shape === 'square';
      var marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: map,
        icon: isSquare ? {
          // Infraestructura: cuadrado -- capa distinta de la gota de
          // reportes, para que nunca se confundan en el mismo mapa.
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">' +
            '<rect x="1" y="1" width="26" height="26" rx="6" fill="' + m.color + '" stroke="#fff" stroke-width="2"/></svg>'
          ),
          anchor: new google.maps.Point(14, 14),
        } : {
          path: google.maps.SymbolPath.CIRCLE,
          scale: m.scale,
          fillColor: m.color,
          fillOpacity: 0.9,
          strokeColor: m.color,
          strokeWeight: 2,
        },
        label: isSquare && m.label ? { text: m.label, color: '#fff', fontSize: '11px', fontWeight: '600' } : undefined,
      });
      marker.addListener('click', function () {
        infoWindow.setContent('<b>' + m.title + '</b><br>' + m.description);
        infoWindow.open(map, marker);
        postToHost({ type: 'markerPress', id: m.id });
      });
    });

    if (SHOW_CENTER_PIN) {
      var centerMarker = new google.maps.Marker({
        position: center,
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" font-size="28"><text y="26">📍</text></svg>'
          ),
          anchor: new google.maps.Point(12, 28),
        },
      });
      map.addListener('idle', function () {
        var c = map.getCenter();
        centerMarker.setPosition(c);
        postToHost({ type: 'centerChange', latitude: c.lat(), longitude: c.lng() });
      });
    }
  }
</script>
<script
  src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&loading=async"
  onerror="showError()"
  async defer
></script>
</body>
</html>`;
}

/** Combina el style del caller (soporta flex:1) con la altura numérica default. */
export function resolveMapContainerStyle(
  style: ViewStyle | undefined,
  height: number | undefined,
  baseStyle: ViewStyle,
) {
  const hasFlexStyle = style && style.flex != null;
  return hasFlexStyle
    ? [baseStyle, style]
    : [baseStyle, { height: typeof height === 'number' ? height : 300 }, style];
}
