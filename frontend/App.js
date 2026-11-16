import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/components/andi/Toast';
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
          <AppNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
