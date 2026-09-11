// ============================================================
// GOOGLE MAPS JAVASCRIPT API KEY
// ============================================================
// MapaWebView loads Google Maps via the JS API inside a WebView
// (not react-native-maps - that needs a native/EAS build and isn't
// compatible with plain Expo Go, which this project uses).
//
// The real key lives in frontend/.env (gitignored, never committed),
// NOT in this file - Expo/Metro inlines any EXPO_PUBLIC_ prefixed env
// var into the JS bundle automatically at start time.
//
// Setup: cp .env.example .env, then paste your key in .env.
// 1. Go to https://console.cloud.google.com/google/maps-apis
// 2. Create/select a project, enable "Maps JavaScript API"
// 3. Create an API key (no Android/iOS app restriction - this is
//    loaded as a webpage inside a WebView, not via the native SDK)
//
// Without a real key the map will show Google's "for development
// purposes only" watermark (or fail to load) but the app won't crash.
// ============================================================
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
