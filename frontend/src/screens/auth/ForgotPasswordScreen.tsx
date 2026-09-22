import React, { useState } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!correo.trim()) {
      setErrorMsg('Ingresa tu correo.');
      return;
    }
    try {
      setLoading(true);
      // El backend siempre responde 200 con el mismo mensaje ambiguo, exista
      // o no la cuenta (ver MENSAJE_RECUPERACION en routers/usuarios.py) --
      // por eso acá solo hay éxito o error de red/servidor, nunca un 4xx por
      // "correo no encontrado".
      await usuariosAPI.solicitarRecuperacion({ correo: correo.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.friendlyMessage) {
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Feather name="key" size={48} color={andiColors.surface} />
            <Text style={styles.appName}>Recuperar acceso</Text>
            <Text style={styles.tagline}>Te enviaremos un enlace para restablecer tu contraseña</Text>
          </View>

          <View style={styles.card}>
            {sent ? (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={16} color={andiColors.success600} />
                <Text style={styles.successText}>Si el correo existe, recibirás un enlace en breve.</Text>
              </View>
            ) : (
              <>
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

                {errorMsg && (
                  <View style={styles.errorBanner}>
                    <Feather name="alert-triangle" size={16} color={andiColors.error600} />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color={andiColors.surface} />
                      : <Text style={styles.btnText}>Enviar enlace</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.replace('Login')} activeOpacity={0.7}>
              <Text style={styles.linkText}>Volver a la entrada</Text>
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
  hero: { alignItems: 'center', paddingTop: '25%', paddingBottom: andiSpace[8], paddingHorizontal: andiSpace[6] },
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
  linkRow: { alignItems: 'center', marginTop: andiSpace[6] },
  linkText: { ...andiType.bodySm, color: andiColors.primary600 },
});
