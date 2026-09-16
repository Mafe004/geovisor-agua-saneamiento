import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { buildMapHtml, resolveMapContainerStyle } from './mapHtml';
import type { MapaWebViewProps } from './MapaWebView.types';

// Mismo contrato que postToHost() en mapHtml.ts -- ver la nota equivalente
// en MapaWebView.tsx. HTMLIFrameElement/MessageEvent son tipos DOM: se usan
// solo acá (la versión web), nunca en MapaWebView.types.ts ni en mapHtml.ts,
// para no filtrar dependencia de lib DOM hacia el build nativo.
interface MapMessage {
  type: 'markerPress' | 'centerChange';
  id?: number | string;
  latitude?: number;
  longitude?: number;
}

/**
 * Versión web de MapaWebView: react-native-webview no tiene implementación
 * para "web" (solo iOS/Android/macOS/Windows), así que en el navegador
 * usamos un <iframe> normal con el mismo HTML (ver mapHtml.ts).
 *
 * Metro elige este archivo automáticamente en vez de MapaWebView.tsx
 * cuando el bundle es para "web" (convención de nombre .web.tsx).
 * Mismas props que la versión nativa (MapaWebViewProps).
 */
export default function MapaWebView({
  latitude = 5.0231,
  longitude = -74.0041,
  markers = [],
  height = 300,
  zoom = 14,
  onMarkerPress,
  interactive = true,
  showCenterPin = false,
  onCenterChange,
  style,
}: MapaWebViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildMapHtml({ latitude, longitude, markers, zoom, interactive, showCenterPin });
  const containerStyle = resolveMapContainerStyle(style, height, styles.container);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as MapMessage | null | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'markerPress' && onMarkerPress) {
        const found = markers.find(m => (m.id || m.id_reporte) === data.id);
        if (found) onMarkerPress(found);
      }
      if (data.type === 'centerChange' && onCenterChange) {
        onCenterChange({ latitude: data.latitude as number, longitude: data.longitude as number });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [markers, onMarkerPress, onCenterChange]);

  return (
    <View style={containerStyle}>
      <iframe
        ref={iframeRef}
        title="mapa"
        srcDoc={html}
        style={iframeStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden' },
});

// Elemento DOM crudo (no un componente RN Web) - necesita un objeto CSS
// normal, no StyleSheet.create() (eso solo lo resuelven los componentes
// de react-native-web como View/Text).
const iframeStyle = { flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#E8F4FD' };
