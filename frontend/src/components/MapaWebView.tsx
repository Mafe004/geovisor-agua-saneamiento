import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapHtml, prepareMarkers, resolveMapContainerStyle } from './mapHtml';
import type { MapaWebViewHandle, MapaWebViewProps } from './MapaWebView.types';
import { andiColors } from '../theme/andi';

// Contrato de mensajes que mapHtml.ts postea de vuelta vía postToHost() --
// este archivo es el único consumidor, así que se tipa acá en vez de en el
// archivo de tipos compartido.
interface MapMessage {
  type: 'markerPress' | 'centerChange' | 'ready';
  id?: number | string;
  latitude?: number;
  longitude?: number;
}

/**
 * Componente de mapa usando Google Maps (JavaScript API) via WebView.
 * Compatible con Expo Go sin necesitar build nativa (react-native-maps
 * requiere una build nativa/EAS y no funciona en Expo Go).
 *
 * El documento HTML se construye UNA sola vez por montaje (useMemo con
 * deps vacías, usando el centro/zoom/interactive/showCenterPin que traían
 * las props en el primer render) -- cambiar esas props después NO
 * reconstruye ni recarga el WebView. `markers` sí es reactivo: cada cambio
 * se empuja en caliente con injectJavaScript (window.setMarkers), apenas
 * el mapa avisa que está listo (mensaje 'ready'). Para mover el centro
 * después del montaje (recentrar, resultado de una búsqueda de dirección)
 * usa el ref imperativo (panTo) -- nunca cambiando `latitude`/`longitude`,
 * que ya no tienen efecto tras el primer render.
 *
 * Implementación nativa (iOS/Android) — ver MapaWebView.web.tsx para la
 * versión que corre en navegador (react-native-webview no soporta web).
 *
 * Props:
 *  - latitude, longitude: centro INICIAL del mapa (solo se leen al montar)
 *  - markers: [{ id, lat, lng, color, title, description, estado, severidad }]
 *  - height: altura del mapa (default 300)
 *  - zoom: nivel de zoom inicial (default 14)
 *  - onMarkerPress: callback(marker) al tocar un pin
 *  - interactive: true/false (default true, fijo desde el montaje)
 *  - showCenterPin: mostrar pin fijo en el centro (fijo desde el montaje)
 *  - onCenterChange: callback({latitude, longitude}) cuando el usuario
 *    arrastra el mapa y este queda quieto -- es informativo, el caller
 *    decide qué hacer con ese valor (nunca debe volver a pasarse como
 *    `latitude`/`longitude`: no tendría efecto, y si en el futuro vuelven
 *    a ser reactivas, reintroduciría el bucle que esto corrige).
 */
const MapaWebView = forwardRef<MapaWebViewHandle, MapaWebViewProps>(function MapaWebView({
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
}, ref) {
  // WebView<object>, no WebView (= WebView<undefined>): con el parámetro
  // de tipo default, la resolución de overloads de JSX para esta clase
  // genérica rechaza el ref con un error opaco ("Overload 2 of 2").
  const webviewRef = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);

  // Deps vacías a propósito: el HTML se construye una sola vez, con el
  // centro/zoom/config del primer render (ver comentario de la función
  // arriba).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildMapHtml({ latitude, longitude, zoom, interactive, showCenterPin }), []);
  const containerStyle = resolveMapContainerStyle(style, height, styles.container);

  useEffect(() => {
    if (!ready) return;
    const js = `window.setMarkers(${JSON.stringify(prepareMarkers(markers))}); true;`;
    webviewRef.current?.injectJavaScript(js);
  }, [ready, markers]);

  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      webviewRef.current?.injectJavaScript(`window.panTo(${lat}, ${lng}); true;`);
    },
  }), []);

  return (
    <View style={containerStyle}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        // 'never': el mapa solo carga HTTPS (tiles de Google, la API JS) --
        // 'always' permitía de paso contenido HTTP mixto que este mapa
        // nunca necesita.
        mixedContentMode="never"
        allowsInlineMediaPlayback={true}
        // El WebView en sí no debe scrollear -- solo el mapa de Google Maps
        // adentro (gestureHandling: 'greedy' en mapHtml.ts). Sin esto, el
        // WebView compite por el gesto de arrastre contra el mapa y el
        // paneo se siente trabado/con rebote en vez de seguir al dedo.
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        nestedScrollEnabled={false}
        // Evita que Android componga el WebView con la capa por defecto
        // (más lenta); en mapas con muchos pines, "hardware" renderiza
        // notablemente más fluido durante el arrastre.
        androidLayerType="hardware"
        onMessage={(e: WebViewMessageEvent): void => {
          try {
            const data = JSON.parse(e.nativeEvent.data) as MapMessage;
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
          } catch (_) {
            // ignorado a propósito: un mensaje malformado del WebView no
            // debe tumbar la app, solo se pierde ese evento puntual.
          }
        }}
      />
    </View>
  );
});

export default MapaWebView;

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: andiColors.mapGround },
});
