import React, { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/components/andi/Toast';
import OfflineBanner from './src/components/andi/OfflineBanner';
import AppNavigator from './src/navigation/AppNavigator';

// Se retiene la splash (nativa, controlada por app.json) hasta que Inter
// termine de cargar -- sin esto, la app arranca un instante con el
// fallback 'System' y salta visiblemente a Inter apenas carga.
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // onLayout (no un useEffect) -- se dispara cuando el primer frame real ya
  // se pintó con la fuente correcta, así la splash nunca suelta sobre un
  // frame todavía en 'System'. fontError también libera la splash: sin red/
  // con la fuente corrupta, la app sigue con el fallback en vez de quedarse
  // con la splash pegada para siempre.
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    // SafeAreaProvider wraps everything so useSafeAreaInsets() resolves
    // real device insets (notch/home-indicator/status bar) everywhere --
    // AndiHeader, the tab bars and ToastProvider below all depend on it.
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="light" />
          {/* OfflineBanner occupies real layout space above the navigator
              (not an overlay) -- when it's visible, every screen's own
              insets.top padding gets a little extra room under it than it
              strictly needs, which is a one-screen-tall cosmetic trade-off
              accepted in exchange for never overlapping a header, a submit
              button, or the Toast host above. */}
          <OfflineBanner />
          <AppNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
