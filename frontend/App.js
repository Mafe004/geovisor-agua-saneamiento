import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/components/andi/Toast';
import OfflineBanner from './src/components/andi/OfflineBanner';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    // SafeAreaProvider wraps everything so useSafeAreaInsets() resolves
    // real device insets (notch/home-indicator/status bar) everywhere --
    // AndiHeader, the tab bars and ToastProvider below all depend on it.
    <SafeAreaProvider>
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
