import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!correo.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }
    try {
      setLoading(true);
      await login(correo.trim().toLowerCase(), password);
    } catch (err) {
      let title = 'Error de acceso';
      let msg;

      if (err?.response?.status === 401) {
        msg = 'Credenciales incorrectas.\n\nVerifica tu correo y contraseña.';
      } else if (err?.response?.status === 403) {
        msg = 'Tu cuenta está inactiva o bloqueada. Contacta al administrador.';
      } else if (err?.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err?.friendlyMessage) {
        // Mensaje mejorado de error de red (generado en client.js)
        title = 'Sin conexión';
        msg = err.friendlyMessage;
      } else if (!err?.response) {
        title = 'Sin conexión';
        msg = 'No se pudo conectar al servidor.\n\nVerifica que:\n\u2022 El backend esté corriendo\n• Tu teléfono y PC estén en la misma WiFi\n• La IP en client.js sea correcta';
      } else {
        msg = 'Ocurrió un error inesperado. Intenta de nuevo.';
      }

      Alert.alert(title, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0D47A1', '#1565C0', '#00ACC1']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Hero */}
          <View style={styles.hero}>
            <Text style={styles.logo}>💧</Text>
            <Text style={styles.appName}>GeoVisor Agua</Text>
            <Text style={styles.tagline}>Saneamiento y Agua Potable · Zipaquirá</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar Sesión</Text>

            {/* Correo */}
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@correo.com"
                placeholderTextColor="#9CA3AF"
                value={correo}
                onChangeText={setCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Contraseña */}
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Botón */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Ingresar</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Cuentas de prueba */}
            <TouchableOpacity
              style={styles.demoBox}
              onPress={() => {
                Alert.alert(
                  '👤 Cuentas de prueba',
                  'Contraseña de todas: demo2025\n\n' +
                  '📋 Ciudadano:\njuan@test.com\n\n' +
                  '🏢 Entidad:\noperador.acueducto@demo.com\n\n' +
                  '🛡️ Moderador:\nmoderador@demo.com\n\n' +
                  '⚙️ Admin:\nadmin@geovisor.com',
                  [
                    { text: 'Admin', onPress: () => { setCorreo('admin@geovisor.com'); setPassword('demo2025'); } },
                    { text: 'Ciudadano', onPress: () => { setCorreo('juan@test.com'); setPassword('demo2025'); } },
                    { text: 'Cerrar', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={styles.demoText}>👁️ Ver cuentas de prueba</Text>
            </TouchableOpacity>

            {/* Registro */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>¿No tienes cuenta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Regístrate</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footer}>v1.0.0 · Tesis de grado 2025</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64 },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 8, letterSpacing: 0.5 },
  tagline: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#1F2937' },
  inputPassword: { paddingRight: 8 },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },
  btn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  demoBox: {
    marginTop: 14, paddingVertical: 8, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  demoText: { color: '#9CA3AF', fontSize: 12 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  registerText: { color: '#6B7280', fontSize: 14 },
  registerLink: { color: '#1565C0', fontSize: 14, fontWeight: '700' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 24 },
});
