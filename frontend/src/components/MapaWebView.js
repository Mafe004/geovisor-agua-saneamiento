import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { GOOGLE_MAPS_API_KEY } from '../config/maps';

/**
 * Componente de mapa usando Google Maps (JavaScript API) via WebView.
 * Compatible con Expo Go sin necesitar build nativa (react-native-maps
 * requiere una build nativa/EAS y no funciona en Expo Go).
 *
 * Props:
 *  - latitude, longitude: centro del mapa
 *  - markers: [{ id, lat, lng, color, title, description, estado, severidad }]
 *  - height: altura del mapa (default 300)
 *  - zoom: nivel de zoom (default 14)
 *  - onMarkerPress: callback(marker) al tocar un pin
 *  - interactive: true/false (default true)
 *  - showCenterPin: mostrar pin fijo en el centro (para selección)
 *  - onCenterChange: callback({latitude, longitude}) cuando cambia centro
 */
export default function MapaWebView({
  latitude = 5.0231,
  longitude = -74.0041,
  markers = [],
  height = 300,           // Sólo acepta NUMBER — no '100%' ni strings
  zoom = 14,
  onMarkerPress,
  interactive = true,
  showCenterPin = false,
  onCenterChange,
  style,                  // Cuando se pasa style con flex:1, height se ignora
}) {
  const SEVERITY_COLOR = {
    ALTA: '#EF4444', CRITICA: '#7C3AED',
    MEDIA: '#F59E0B', BAJA: '#10B981',
  };
  const STATUS_COLOR = {
    PENDIENTE: '#F59E0B', EN_REVISION: '#3B82F6',
    EN_PROCESO: '#8B5CF6', RESUELTO: '#10B981',
    RECHAZADO: '#EF4444', CERRADO: '#6B7280',
  };

  // Datos de los marcadores serializados como JSON (evita bugs de
  // escapado manual de comillas que tenía la versión Leaflet).
  // < evita que un "</script>" dentro de una descripción rompa el HTML.
  const markersData = JSON.stringify(markers.map(m => ({
    id: m.id ?? m.id_reporte ?? 0,
    lat: m.lat ?? m.latitud,
    lng: m.lng ?? m.longitud,
    color: m.color || SEVERITY_COLOR[m.severidad] || STATUS_COLOR[m.estado] || '#1565C0',
    title: m.title || m.descripcion || `#${m.id || m.id_reporte}`,
    description: m.description || m.estado || '',
  }))).replace(/</g, '\\u003c');

  const html = `<!DOCTYPE html>
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
      var marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: m.color,
          fillOpacity: 0.9,
          strokeColor: m.color,
          strokeWeight: 2,
        },
      });
      marker.addListener('click', function () {
        infoWindow.setContent('<b>' + m.title + '</b><br>' + m.description);
        infoWindow.open(map, marker);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
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
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'centerChange', latitude: c.lat(), longitude: c.lng(),
        }));
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

  // Si style contiene flex:1 usamos solo style (sin height fijo),
  // de lo contrario aplicamos height numérico.
  const hasFlexStyle = style && (style.flex != null);
  const containerStyle = hasFlexStyle
    ? [styles.container, style]
    : [styles.container, { height: typeof height === 'number' ? height : 300 }, style];

  return (
    <View style={containerStyle}>
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'markerPress' && onMarkerPress) {
              const found = markers.find(m => (m.id || m.id_reporte) === data.id);
              if (found) onMarkerPress(found);
            }
            if (data.type === 'centerChange' && onCenterChange) {
              onCenterChange({ latitude: data.latitude, longitude: data.longitude });
            }
          } catch (_) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#E8F4FD' },
});
