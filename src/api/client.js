import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// CONFIGURACIÓN DE LA URL DEL BACKEND
// ============================================================
//
// OPCIONES — descomenta la que corresponda:
//
// 1. Desarrollo local (PC y teléfono en la misma red WiFi):
//    Cambia la IP por la de tu PC. Para verla:
//      Windows: ejecuta `ipconfig` → busca "Dirección IPv4"
//      Mac/Linux: ejecuta `ip a` o `ifconfig`
//    Ejemplo: si tu PC tiene 192.168.1.105 → pon esa IP.
//
// 2. Producción (backend desplegado en la nube):
//    Usa la URL pública del servidor.
//
// IMPORTANTE: NO uses 'localhost' ni '127.0.0.1' desde el
// teléfono físico — esas apuntan al propio teléfono, no a tu PC.
//
// ⚠️ Si ves ERR_CONNECTION_TIMED_OUT en el teléfono:
//    → Tu PC y teléfono no están en la misma WiFi, O
//    → La IP de tu PC cambió (el router asigna IPs dinámicas), O
//    → El firewall de Windows está bloqueando el puerto 8000.
//      Solución firewall: Panel de control → Firewall →
//      "Permitir una aplicación" → agregar python.exe
// ============================================================

// ── CAMBIA ESTA IP POR LA DE TU PC ──────────────────────────
// Para verla en Windows: abre cmd → escribe `ipconfig`
//                        busca "Dirección IPv4" (ej: 192.168.1.X)
const DEV_IP = '192.168.1.100'; // <-- REEMPLAZA CON TU IP REAL
const DEV_PORT = '8000';

export const API_URL = `http://${DEV_IP}:${DEV_PORT}`;

// ────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: API_URL,
  timeout: 12000,  // 12 segundos — más tiempo para WiFi lenta
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor REQUEST: agrega JWT automáticamente
client.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});

// Interceptor RESPONSE: manejo global de errores
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token expirado → limpiar sesión
    if (error.response?.status === 401) {
      AsyncStorage.removeItem('token').catch(() => {});
      AsyncStorage.removeItem('user').catch(() => {});
    }

    // Mejorar mensaje de error de red para el usuario
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED';
      const friendlyMsg = isTimeout
        ? 'El servidor tardó demasiado en responder. Verifica que el backend esté corriendo.'
        : `No se pudo conectar al servidor (${DEV_IP}:${DEV_PORT}).\n\n` +
          '• Verifica que el backend esté encendido\n' +
          '• Confirma que tu teléfono y PC están en la misma WiFi\n' +
          '• Revisa que la IP en client.js sea correcta';
      error.friendlyMessage = friendlyMsg;
    }

    return Promise.reject(error);
  }
);

export default client;
