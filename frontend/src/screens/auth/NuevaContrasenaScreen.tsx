import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiSpace } from '../../theme/andi';
import { usuariosAPI } from '../../api/services';

type Props = NativeStackScreenProps<RootStackParamList, 'nueva-contrasena'>;

const MIN_LENGTH = 8;
const REDIRECT_DELAY_MS = 2000;

type Status = 'form' | 'success' | 'tokenError';

export default function NuevaContrasenaScreen({ navigation, route }: Props) {
  // React Navigation aquí no tiene un `linking` prop (ver comentario en
  // navigation/types.ts), así que route.params no trae el query string --
  // en web hay que leerlo directo de la URL del navegador. Inicializador
  // perezoso de useState en vez de un efecto: corre una sola vez al montar,
  // sin el "setState síncrono dentro de un efecto" que dispara un render en
  // cascada evitable.
  const [token] = useState<string | null>(() => {
    if (route.params?.token) return route.params.token;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('token');
    }
    return null;
  });
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('form');

  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => {
      navigation.replace('Login', {
        successMessage: 'Contraseña actualizada, ya puedes iniciar sesión.',
      });
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, navigation]);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!nuevaPassword || !confirmar) {
      setErrorMsg('Completa ambos campos.');
      return;
    }
    if (nuevaPassword.length < MIN_LENGTH) {
      setErrorMsg(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (nuevaPassword !== confirmar) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    // Sin token no hay nada que enviar -- mismo destino que un token
    // rechazado por el backend (expirado/usado/inválido), ya que para
    // quien mira la pantalla el problema es el mismo: el enlace no sirve.
    if (!token) {
      setStatus('tokenError');
      return;
    }

    try {
      setLoading(true);
      await usuariosAPI.restablecerContrasena({ token, nueva_password: nuevaPassword });
      setStatus('success');
    } catch (err) {
      // El único 400 que devuelve este endpoint es token inválido/usado/
      // expirado (ver restablecer_contrasena en routers/usuarios.py) --
      // por eso cualquier 400 acá va directo a la pantalla de enlace roto.
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setStatus('tokenError');
      } else if (axios.isAxiosError(err) && err.friendlyMessage) {
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

  if (status === 'tokenError') {
    return (
      <View style={styles.screen}>
        <View style={styles.top}>
          <Feather name="slash" size={64} color={andiColors.error400} />
          <Text style={styles.title}>Enlace no válido</Text>
          <Text style={styles.subtitle}>El enlace expiró o ya fue usado. Solicita uno nuevo</Text>
        </View>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.replace('ForgotPassword')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.btnText}>Solicitar un nuevo enlace</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.replace('Login')} activeOpacity={0.7}>
            <Text style={styles.linkText}>Volver a la entrada</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={styles.screen}>
        <View style={styles.top}>
          <Feather name="check-circle" size={64} color={andiColors.success400} />
          <Text style={styles.title}>¡Listo!</Text>
          <Text style={styles.subtitle}>Contraseña actualizada, ya puedes iniciar sesión.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Feather name="lock" size={48} color={andiColors.surface} />
            <Text style={styles.appName}>Nueva contraseña</Text>
            <Text style={styles.tagline}>Elige una contraseña segura para tu cuenta</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>NUEVA CONTRASEÑA</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={andiColors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={andiColors.onSurfaceVariant}
                value={nuevaPassword}
                onChangeText={setNuevaPassword}
                secureTextEntry={!showNueva}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNueva(p => !p)} style={styles.eyeBtn}>
                <Feather name={showNueva ? 'eye-off' : 'eye'} size={18} color={andiColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, styles.labelSpaced]}>CONFIRMAR CONTRASEÑA</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={andiColors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="Repite la contraseña"
                placeholderTextColor={andiColors.onSurfaceVariant}
                value={confirmar}
                onChangeText={setConfirmar}
                secureTextEntry={!showConfirmar}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmar(p => !p)} style={styles.eyeBtn}>
                <Feather name={showConfirmar ? 'eye-off' : 'eye'} size={18} color={andiColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Feather name="alert-triangle" size={16} color={andiColors.error600} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, styles.submitBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color={andiColors.surface} />
                  : <Text style={styles.btnText}>Guardar contraseña</Text>
                }
              </LinearGradient>
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
  hero: { alignItems: 'center', paddingTop: '20%', paddingBottom: andiSpace[8], paddingHorizontal: andiSpace[6] },
  appName: { ...andiType.headingLg, color: andiColors.surface, marginTop: andiSpace[4], textAlign: 'center' },
  tagline: { ...andiType.bodySm, color: andiColors.primary200, marginTop: andiSpace[2], textAlign: 'center' },
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
  btn: { borderRadius: andiRadius.full, overflow: 'hidden' },
  submitBtn: { marginTop: andiSpace[6] },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { ...andiType.label, color: andiColors.surface, letterSpacing: 0.5 },
  linkRow: { alignItems: 'center', marginTop: andiSpace[6] },
  linkText: { ...andiType.bodySm, color: andiColors.primary600 },

  // Estados de pantalla completa (tokenError / success) -- misma estructura
  // que CuentaSuspendidaScreen.tsx.
  top: { alignItems: 'center', paddingTop: '30%', paddingHorizontal: andiSpace[6] },
  title: { ...andiType.headingLg, color: andiColors.surface, marginTop: andiSpace[4], textAlign: 'center' },
  subtitle: { ...andiType.bodySm, color: andiColors.primary200, marginTop: andiSpace[2], textAlign: 'center' },
});
