import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usuariosAPI } from '../../api/services';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    telefono: '',
    password: '',
    confirmPass: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    if (!form.nombre || !form.apellido || !form.correo || !form.password)
      return 'Nombre, apellido, correo y contraseña son obligatorios.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      return 'Ingresa un correo válido.';
    if (form.password.length < 6)
      return 'La contraseña debe tener al menos 6 caracteres.';
    if (form.password !== form.confirmPass)
      return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleRegister = async () => {
    const err = validate();
    if (err) { Alert.alert('Datos incompletos', err); return; }
    try {
      setLoading(true);
      await usuariosAPI.register({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        correo: form.correo.trim().toLowerCase(),
        telefono: form.telefono.trim() || null,
        password: form.password,
        id_rol: 1, // CIUDADANO
      });
      Alert.alert(
        '¡Cuenta creada!',
        'Tu cuenta fue registrada exitosamente. Ya puedes iniciar sesión.',
        [{ text: 'Ir al login', onPress: () => navigation.navigate('Login') }],
      );
    } catch (e) {
      const msg = e?.response?.data?.detail || 'No se pudo crear la cuenta. Intenta más tarde.';
      Alert.alert('Error al registrarse', msg);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, icon, field, placeholder, keyboard = 'default', secure = false }) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>{icon}</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={form[field]}
          onChangeText={v => update(field, v)}
          keyboardType={keyboard}
          secureTextEntry={secure}
          autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        />
      </View>
    </>
  );

  return (
    <LinearGradient colors={['#0D47A1', '#1565C0', '#00ACC1']} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.topTitle}>Crear cuenta</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.hero}>
            <Text style={styles.logo}>💧</Text>
            <Text style={styles.subtitle}>Ciudadano · GeoVisor Agua</Text>
          </View>

          <View style={styles.card}>
            <Field label="Nombre" icon="👤" field="nombre" placeholder="María" />
            <Field label="Apellido" icon="👤" field="apellido" placeholder="García" />
            <Field label="Correo" icon="✉️" field="correo" placeholder="tu@correo.com" keyboard="email-address" />
            <Field label="Teléfono (opcional)" icon="📱" field="telefono" placeholder="+57 300 0000000" keyboard="phone-pad" />
            <Field label="Contraseña" icon="🔒" field="password" placeholder="Mínimo 6 caracteres" secure />
            <Field label="Confirmar contraseña" icon="🔒" field="confirmPass" placeholder="Repite tu contraseña" secure />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#1565C0', '#00ACC1']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Crear cuenta</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Inicia sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 32 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 22, fontWeight: '600' },
  topTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '700' },
  hero: { alignItems: 'center', marginBottom: 20 },
  logo: { fontSize: 48 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
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
  btn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  loginText: { color: '#6B7280', fontSize: 14 },
  loginLink: { color: '#1565C0', fontSize: 14, fontWeight: '700' },
});
