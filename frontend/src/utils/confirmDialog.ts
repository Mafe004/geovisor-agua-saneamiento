import { Alert, Platform } from 'react-native';

/**
 * Alert.alert es un no-op en react-native-web (no muestra nada ni llama a
 * los botones), así que en web se usa window.confirm para tener una
 * confirmación real; en nativo se usa Alert.alert normal.
 */
export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(`${title}\n\n${message}`)
      : true;
    return Promise.resolve(confirmed);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Salir', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
