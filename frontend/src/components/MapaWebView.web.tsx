import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { buildMapHtml, prepareMarkers, resolveMapContainerStyle } from './mapHtml';
import type { MapaWebViewHandle, MapaWebViewProps } from './MapaWebView.types';
import { andiColors } from '../theme/andi';

// Mismo contrato que postToHost() en mapHtml.ts -- ver la nota equivalente
// en MapaWebView.tsx. HTMLIFrameElement/MessageEvent son tipos DOM: se usan
// solo acá (la versión web), nunca en MapaWebView.types.ts ni en mapHtml.ts,
// para no filtrar dependencia de lib DOM hacia el build nativo.
interface MapMessage {
  type: 'markerPress' | 'centerChange' | 'ready';
  id?: number | string;
  latitude?: number;
  longitude?: number;
}

/**
 * Versión web de MapaWebView: react-native-webview no tiene implementación
 * para "web" (solo iOS/Android/macOS/Windows), así que en el navegador
 * usamos un <iframe> normal con el mismo HTML (ver mapHtml.ts).
 *
 * Mismo contrato que la versión nativa: el HTML se construye una sola vez
 * (useMemo, deps vacías) con el centro/zoom/config del primer render;
 * `markers` se empuja en caliente vía postMessage apenas el iframe avisa
 * 'ready' (injectJavaScript no existe para iframes, por eso el canal es
 * postMessage en vez de evaluar JS directo); recentrar después del montaje
 * usa el ref imperativo (panTo), nunca las props latitude/longitude.
 *
 * Metro elige este archivo automáticamente en vez de MapaWebView.tsx
 * cuando el bundle es para "web" (convención de nombre .web.tsx).
 * Mismas props que la versión nativa (MapaWebViewProps).
 */
const MapaWebView = forwardRef<MapaWebViewHandle, MapaWebViewProps>(function MapaWebView({
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
}, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // Deps vacías a propósito, igual que en MapaWebView.tsx: el HTML se
  // construye una sola vez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildMapHtml({ latitude, longitude, zoom, interactive, showCenterPin }), []);
  const containerStyle = resolveMapContainerStyle(style, height, styles.container);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as MapMessage | null | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ready') {
        setReady(true);
        return;
      }
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

  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'setMarkers', markers: prepareMarkers(markers) }, '*');
  }, [ready, markers]);

  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'panTo', lat, lng }, '*');
    },
  }), []);

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
});

export default MapaWebView;

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden' },
});

// Elemento DOM crudo (no un componente RN Web) - necesita un objeto CSS
// normal, no StyleSheet.create() (eso solo lo resuelven los componentes
// de react-native-web como View/Text).
const iframeStyle = { flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: andiColors.mapGround };
