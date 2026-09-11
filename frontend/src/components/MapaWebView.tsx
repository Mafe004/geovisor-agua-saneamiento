import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapHtml, resolveMapContainerStyle } from './mapHtml';
import type { MapaWebViewProps } from './MapaWebView.types';

// Contrato de mensajes que mapHtml.ts postea de vuelta vía postToHost() --
// este archivo es el único consumidor, así que se tipa acá en vez de en el
// archivo de tipos compartido.
interface MapMessage {
  type: 'markerPress' | 'centerChange';
  id?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Componente de mapa usando Google Maps (JavaScript API) via WebView.
 * Compatible con Expo Go sin necesitar build nativa (react-native-maps
 * requiere una build nativa/EAS y no funciona en Expo Go).
 *
 * Implementación nativa (iOS/Android) — ver MapaWebView.web.tsx para la
 * versión que corre en navegador (react-native-webview no soporta web).
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
}: MapaWebViewProps) {
  const html = buildMapHtml({ latitude, longitude, markers, zoom, interactive, showCenterPin });
  const containerStyle = resolveMapContainerStyle(style, height, styles.container);

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
        onMessage={(e: WebViewMessageEvent) => {
          try {
            const data = JSON.parse(e.nativeEvent.data) as MapMessage;
            if (data.type === 'markerPress' && onMarkerPress) {
              const found = markers.find(m => (m.id || m.id_reporte) === data.id);
              if (found) onMarkerPress(found);
            }
            if (data.type === 'centerChange' && onCenterChange) {
              onCenterChange({ latitude: data.latitude as number, longitude: data.longitude as number });
            }
          } catch (_) {
            // ignorado a propósito: un mensaje malformado del WebView no
            // debe tumbar la app, solo se pierde ese evento puntual.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#E8F4FD' },
});
