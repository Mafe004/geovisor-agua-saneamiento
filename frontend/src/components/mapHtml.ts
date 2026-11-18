import type { ViewStyle } from 'react-native';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import { andiColors, andiSeverityColor } from '../theme/andi';
import type { MapaWebViewProps, MapMarker } from './MapaWebView.types';

const SEVERITY_COLOR: Record<string, string> = {
  BAJA: andiSeverityColor.BAJA!, MEDIA: andiSeverityColor.MEDIA!,
  ALTA: andiSeverityColor.ALTA!, CRITICA: andiSeverityColor.CRITICA!,
};
const STATUS_COLOR: Record<string, string> = {
  PENDIENTE: andiColors.stPendBd, EN_REVISION: andiColors.stRevBd,
  EN_PROCESO: andiColors.stProBd, RESUELTO: andiColors.stResBd,
  RECHAZADO: andiColors.error, CERRADO: andiColors.outline,
};
// Fallback cuando un marcador no trae color/severidad/estado reconocible
// (p.ej. una capa nueva que todavía no se mapeó acá) -- antes era un azul
// (#1565C0) sin relación con la paleta; ahora es el primario de la marca.
const DEFAULT_MARKER_COLOR = andiColors.primary;

/**
 * Convierte la lista de MapMarker (forma flexible, con alias en inglés y
 * español) a la forma plana y serializable que consume renderMarkers() del
 * lado del navegador (ver buildMapHtml). Compartida por MapaWebView.tsx
 * (injectJavaScript) y MapaWebView.web.tsx (postMessage) para que ambas
 * mandar exactamente los mismos datos.
 */
export function prepareMarkers(markers: MapMarker[]) {
  return markers.map(m => ({
    id: m.id ?? m.id_reporte ?? 0,
    lat: m.lat ?? m.latitud,
    lng: m.lng ?? m.longitud,
    color: m.color || SEVERITY_COLOR[m.severidad ?? ''] || STATUS_COLOR[m.estado ?? ''] || DEFAULT_MARKER_COLOR,
    title: m.title || m.descripcion || `#${m.id || m.id_reporte}`,
    description: m.description || m.estado || '',
    shape: m.shape || 'circle',
    label: m.label || '',
    scale: m.scale || 10,
  }));
}

type BuildMapHtmlOptions = Pick<
  MapaWebViewProps,
  'latitude' | 'longitude' | 'zoom' | 'interactive' | 'showCenterPin'
>;

/**
 * Construye el documento HTML del mapa (Google Maps JS API). Se llama UNA
 * sola vez por montaje del componente (ver MapaWebView.tsx: useMemo con
 * deps vacías) -- por eso ya no recibe `markers`: la lista inicial y
 * cualquier cambio posterior llegan después, en caliente, vía
 * window.setMarkers() (injectJavaScript en nativo, postMessage en web),
 * nunca reconstruyendo este HTML. Lo mismo para el centro: recentrar usa
 * window.panTo(), el centro de acá es solo el de arranque.
 *
 * Compartido por MapaWebView.tsx (react-native-webview, nativo) y
 * MapaWebView.web.tsx (iframe, navegador) para no duplicar la lógica.
 *
 * El HTML envía mensajes vía postMessage detectando en cuál de los dos
 * contextos corre: window.ReactNativeWebView (nativo) o window.parent
 * (iframe en web) -- así el mismo HTML sirve para ambos. Por el mismo
 * motivo, también ESCUCHA mensajes entrantes (window.addEventListener
 * 'message'): es el único canal que tiene la versión web para recibir
 * setMarkers/panTo desde el host (la nativa no lo necesita -- usa
 * injectJavaScript, que ejecuta JS directo sin pasar por postMessage --
 * pero escucharlo en ambas no hace daño y mantiene el HTML idéntico).
 */
export function buildMapHtml({
  latitude = 5.0231,
  longitude = -74.0041,
  zoom = 14,
  interactive = true,
  showCenterPin = false,
}: BuildMapHtmlOptions) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100vh; background:${andiColors.mapGround}; }
  #error-overlay {
    display:none; position:absolute; inset:0; align-items:center; justify-content:center;
    text-align:center; padding:20px; font-family:sans-serif; font-size:13px; color:${andiColors.onSurfaceVariant};
    background:${andiColors.mapGround};
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="error-overlay">
  No se pudo cargar Google Maps.<br/>Verifica la API key en src/config/maps.ts.
</div>
<script>
  var SHOW_CENTER_PIN = ${showCenterPin};
  var INTERACTIVE = ${interactive};

  // Estado vivo del mapa, poblado una vez por initMap() y nunca reconstruido
  // -- setMarkers/panTo lo mutan directamente, sin recargar nada.
  var map, infoWindow, centerMarker;
  var markerObjs = [];

  // Funciona tanto embebido en un WebView nativo (window.ReactNativeWebView)
  // como en un <iframe> web (window.parent) sin cambiar este HTML.
  function postToHost(data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    } else if (window.parent) {
      window.parent.postMessage(data, '*');
    }
  }

  // El título/descripción de un marcador vienen de datos del usuario
  // (descripción de un reporte, nombre de una comunidad SIASAR...) y se
  // insertan como HTML dentro del InfoWindow (ver renderMarkers) -- sin
  // esto, un reporte con "<img src=x onerror=...>" en su descripción
  // ejecutaría script dentro del WebView.
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showError() {
    document.getElementById('map').style.display = 'none';
    document.getElementById('error-overlay').style.display = 'flex';
  }

  // Google llama esto si la API key es inválida, sin billing, con
  // restricciones de referrer, etc. — mucho más confiable que adivinar
  // por timeout si el mapa "no aparece".
  window.gm_authFailure = showError;

  function clearMarkers() {
    markerObjs.forEach(function (mk) { mk.setMap(null); });
    markerObjs = [];
  }

  // Pinta la lista completa de marcadores, reemplazando los anteriores --
  // nunca acumula: una capa que vuelve a mandar su lista (p.ej. tras un
  // refresh) no debe duplicar pines viejos encima.
  function renderMarkers(list) {
    clearMarkers();
    (list || []).forEach(function (m) {
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
        // El InfoWindow de Google siempre trae su propio marco blanco (eso
        // no se puede quitar sin reemplazarlo por un OverlayView) -- lo que
        // sí se controla es el contenido: una mini-tarjeta con el mismo
        // lenguaje visual que AndiChip (punto de color + chip de
        // estado/severidad con el mismo color del marcador), con el
        // texto del usuario siempre escapado.
        var titulo = escapeHtml(m.title);
        var descripcion = escapeHtml(m.description);
        infoWindow.setContent(
          '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;min-width:160px;max-width:230px;padding:2px 0;">' +
            '<div style="font-size:13.5px;font-weight:700;color:${andiColors.onSurface};line-height:1.3;margin-bottom:' + (descripcion ? '6px' : '0') + ';">' +
              titulo +
            '</div>' +
            (descripcion
              ? '<span style="display:inline-block;background:' + m.color + '1F;color:' + m.color + ';' +
                'font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;">' + descripcion + '</span>'
              : '') +
          '</div>'
        );
        infoWindow.open(map, marker);
        postToHost({ type: 'markerPress', id: m.id });
      });
      markerObjs.push(marker);
    });
  }

  // API que el host llama en caliente -- nunca reconstruyen el mapa.
  window.setMarkers = function (list) { renderMarkers(list); };
  window.panTo = function (lat, lng) {
    map.panTo({ lat: lat, lng: lng });
    if (centerMarker) centerMarker.setPosition({ lat: lat, lng: lng });
  };

  // Único canal que tiene la versión web (iframe) para recibir comandos
  // del host -- la nativa usa injectJavaScript y no pasa por acá, pero
  // escucharlo en ambas deja el HTML idéntico para los dos casos.
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'setMarkers') window.setMarkers(e.data.markers);
    if (e.data.type === 'panTo') window.panTo(e.data.lat, e.data.lng);
  });

  function initMap() {
    var center = { lat: ${latitude}, lng: ${longitude} };
    map = new google.maps.Map(document.getElementById('map'), {
      center: center,
      zoom: ${zoom},
      disableDefaultUI: !INTERACTIVE,
      zoomControl: INTERACTIVE,
      gestureHandling: INTERACTIVE ? 'greedy' : 'none',
      draggable: INTERACTIVE,
      scrollwheel: false,
      clickableIcons: false,
    });

    infoWindow = new google.maps.InfoWindow();

    if (SHOW_CENTER_PIN) {
      centerMarker = new google.maps.Marker({
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

    // Recién acá el mapa existe de verdad -- antes de esto, setMarkers/
    // panTo llamados desde el host fallarían porque la variable map
    // todavía es undefined. El host espera este mensaje antes de mandar nada.
    postToHost({ type: 'ready' });
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
