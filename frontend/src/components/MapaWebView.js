import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Componente de mapa usando OpenStreetMap + Leaflet via WebView.
 * Compatible con Expo Go sin necesitar build nativa.
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

  const markersJs = markers.map(m => {
    const color = m.color
      || SEVERITY_COLOR[m.severidad]
      || STATUS_COLOR[m.estado]
      || '#1565C0';
    const title = m.title || m.descripcion || `#${m.id || m.id_reporte}`;
    const desc = m.description || m.estado || '';
    return `
      L.circleMarker([${m.lat ?? m.latitud}, ${m.lng ?? m.longitud}], {
        radius: 10, color: '${color}', fillColor: '${color}',
        fillOpacity: 0.9, weight: 2
      })
      .bindPopup('<b>${title.replace(/'/g, "\\'")}</b><br>${desc.replace(/'/g, "\\'")}')
      .on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'markerPress', id: ${m.id || m.id_reporte || 0}}));
      })
      .addTo(map);
    `;
  }).join('\n');

  const centerPinJs = showCenterPin ? `
    var centerMarker = L.marker([${latitude}, ${longitude}], {
      icon: L.divIcon({
        html: '<div style="font-size:28px;line-height:1;margin-top:-28px;margin-left:-12px;">📍</div>',
        iconSize: [24, 28], className: ''
      }),
      draggable: false
    }).addTo(map);

    map.on('moveend', function() {
      var c = map.getCenter();
      centerMarker.setLatLng(c);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'centerChange', latitude: c.lat, longitude: c.lng
      }));
    });
  ` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100vh; }
  .leaflet-control-zoom { display: ${interactive ? 'block' : 'none'}; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    zoomControl: ${interactive},
    dragging: ${interactive},
    scrollWheelZoom: false
  }).setView([${latitude}, ${longitude}], ${zoom});

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(map);

  ${markersJs}
  ${centerPinJs}
</script>
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
