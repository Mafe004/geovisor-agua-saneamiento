import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiSpace } from '../../theme/andi';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation, route }: Props) {
  const { login } = useContext(AuthContext);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  // Inline banner replaces Alert for every auth-flow error on this screen
  // (spec: "Do NOT use Alert for auth errors") -- including the empty-field
  // check, for consistency, not just the 401 case it was called out for.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Same reasoning, reused for the success case: RegisterScreen's
  // Entidad/Moderador flows land here with a "cuenta creada" message
  // instead of a toast library (none is installed in this project).
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // React Navigation keeps Login mounted once it's been visited, so a later
  // navigate('Login', { successMessage }) updates route.params without
  // remounting the component. Adjusting state during render (React's own
  // recommended pattern for this) instead of a useEffect, which would call
  // setState after an extra commit and trip the "no setState in an effect
  // to sync from props" lint rule.
  const [lastParamMsg, setLastParamMsg] = useState<string | undefined>(undefined);
  if (route.params?.successMessage && route.params.successMessage !== lastParamMsg) {
    setLastParamMsg(route.params.successMessage);
    setSuccessMsg(route.params.successMessage);
  }

  const handleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!correo.trim() || !password.trim()) {
      setErrorMsg('Ingresa tu correo y contraseña.');
      return;
    }

    try {
      setLoading(true);
      await login(correo.trim().toLowerCase(), password);
      // Éxito: AuthContext.login() setea el user, y AppNavigator cambia de
      // stack solo según id_rol -- no hace falta navegar manualmente acá.
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setErrorMsg('Correo o contraseña incorrectos.');
      } else if (axios.isAxiosError<{ detail?: string }>(err) && err.response?.status === 403) {
        navigation.navigate('CuentaSuspendida', { message: err.response.data?.detail });
      } else if (axios.isAxiosError(err) && err.friendlyMessage) {
        // Mensaje mejorado de error de red (generado en client.ts)
        setErrorMsg(err.friendlyMessage);
      } else if (axios.isAxiosError(err) && !err.response) {
        setErrorMsg('No se pudo conectar al servidor. Verifica tu conexión e inténtalo de nuevo.');
      } else {
        setErrorMsg('Ocurrió un error inesperado. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.logo}>💧</Text>
            <Text style={styles.appName}>Andi</Text>
            <Text style={styles.tagline}>Agua y saneamiento · Cundinamarca</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Correo */}
            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={18} color={andiColors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="tu@correo.com"
                placeholderTextColor={andiColors.onSurfaceVariant}
                value={correo}
                onChangeText={setCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Contraseña */}
            <Text style={[styles.label, styles.labelSpaced]}>CONTRASEÑA</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={andiColors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="••••••••"
                placeholderTextColor={andiColors.onSurfaceVariant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={andiColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Olvidé mi contraseña */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            {/* Éxito inline (viene de RegisterScreen) */}
            {successMsg && (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={16} color={andiColors.success600} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {/* Error inline */}
            {errorMsg && (
              <View style={styles.errorBanner}>
                <Feather name="alert-triangle" size={16} color={andiColors.error600} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Entrar */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color={andiColors.surface} />
                  : <Text style={styles.btnText}>Entrar</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>o</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Crear cuenta de ciudadano */}
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => navigation.navigate('Register', { id_rol: 1 })}
              activeOpacity={0.85}
            >
              <Text style={styles.outlineBtnText}>Crear cuenta de ciudadano</Text>
            </TouchableOpacity>

            {/* Código de invitación */}
            <TouchableOpacity
              style={styles.invitacionRow}
              onPress={() => navigation.navigate('Invitacion')}
              activeOpacity={0.7}
            >
              <Feather name="key" size={16} color={andiColors.primary600} />
              <Text style={styles.invitacionText}>Tengo un código de invitación</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.primary900 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  hero: { alignItems: 'center', paddingTop: '20%', paddingBottom: andiSpace[8] },
  logo: { fontSize: 48 },
  appName: { ...andiType.displayLg, color: andiColors.surface, marginTop: andiSpace[2] },
  tagline: { ...andiType.bodySm, color: andiColors.primary200, marginTop: andiSpace[1], textAlign: 'center' },
  card: {
    backgroundColor: andiColors.surface,
    borderTopLeftRadius: andiRadius.xl,
    borderTopRightRadius: andiRadius.xl,
    paddingHorizontal: andiSpace[6],
    paddingTop: andiSpace[8],
    paddingBottom: andiSpace[10],
  },
  label: {
    ...andiType.labelSm,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: andiColors.onSurfaceVariant,
  },
  labelSpaced: { marginTop: andiSpace[4] },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: andiColors.outline,
    borderRadius: andiRadius.md,
    backgroundColor: andiColors.surfaceDim,
    paddingHorizontal: andiSpace[3],
    marginTop: andiSpace[2],
    minHeight: 48,
  },
  inputIcon: { marginRight: andiSpace[2] },
  input: { flex: 1, minHeight: 48, fontSize: 15, color: andiColors.onSurface },
  inputPassword: { paddingRight: andiSpace[2] },
  eyeBtn: { padding: andiSpace[1] },
  forgotRow: { alignSelf: 'flex-end', marginTop: andiSpace[2] },
  forgotText: { ...andiType.bodySm, color: andiColors.primary600 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: andiSpace[2],
    marginTop: andiSpace[4],
    paddingVertical: andiSpace[2],
    paddingHorizontal: andiSpace[3],
    borderLeftWidth: 3,
    borderLeftColor: andiColors.error600,
    backgroundColor: andiColors.error50,
    borderRadius: andiRadius.xs,
  },
  errorText: { ...andiType.bodySm, color: andiColors.error700, flexShrink: 1 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: andiSpace[2],
    marginTop: andiSpace[4],
    paddingVertical: andiSpace[2],
    paddingHorizontal: andiSpace[3],
    borderLeftWidth: 3,
    borderLeftColor: andiColors.success600,
    backgroundColor: andiColors.success50,
    borderRadius: andiRadius.xs,
  },
  successText: { ...andiType.bodySm, color: andiColors.success700, flexShrink: 1 },
  btn: { marginTop: andiSpace[6], borderRadius: andiRadius.full, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { ...andiType.label, color: andiColors.surface, letterSpacing: 0.5 },
  separatorRow: { flexDirection: 'row', alignItems: 'center', marginTop: andiSpace[6], gap: andiSpace[3] },
  separatorLine: { flex: 1, height: 1, backgroundColor: andiColors.outlineVariant },
  separatorText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant },
  outlineBtn: {
    marginTop: andiSpace[6],
    height: 52,
    borderRadius: andiRadius.full,
    borderWidth: 1.5,
    borderColor: andiColors.primary600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnText: { ...andiType.label, color: andiColors.primary600 },
  invitacionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: andiSpace[2],
    marginTop: andiSpace[6],
  },
  invitacionText: { ...andiType.bodySm, color: andiColors.primary600 },
});
