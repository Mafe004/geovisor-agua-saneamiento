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
import { solicitudesAccesoAPI } from '../../api/services';

type Props = NativeStackScreenProps<RootStackParamList, 'SolicitarAcceso'>;

const MOTIVO_MIN = 20;

export default function SolicitarAccesoScreen({ navigation }: Props) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailDuplicado, setEmailDuplicado] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setEmailDuplicado(false);

    if (!nombre.trim() || !correo.trim() || !motivo.trim()) {
      setErrorMsg('Todos los campos son obligatorios.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorMsg('Ingresa un correo válido.');
      return;
    }
    if (motivo.trim().length < MOTIVO_MIN) {
      setErrorMsg(`Cuéntanos un poco más -- mínimo ${MOTIVO_MIN} caracteres.`);
      return;
    }

    try {
      setLoading(true);
      await solicitudesAccesoAPI.crear({
        nombre_completo: nombre.trim(),
        correo: correo.trim().toLowerCase(),
        motivo: motivo.trim(),
      });
      setSent(true);
    } catch (err) {
      if (
        axios.isAxiosError<{ detail?: string }>(err)
        && err.response?.status === 400
        && err.response.data?.detail?.includes('ya tiene una cuenta registrada')
      ) {
        setEmailDuplicado(true);
      } else if (axios.isAxiosError<{ detail?: string }>(err) && err.response?.data?.detail) {
        setErrorMsg(err.response.data.detail);
      } else {
        setErrorMsg('No se pudo enviar la solicitud. Intenta de nuevo más tarde.');
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={22} color={andiColors.surface} />
          </TouchableOpacity>

          <View style={styles.hero}>
            <Feather name="shield" size={48} color={andiColors.surface} />
            <Text style={styles.appName}>Solicitar acceso</Text>
            <Text style={styles.tagline}>
              Cuéntanos quién eres y por qué necesitas una cuenta de Administrador. Un
              administrador existente revisará tu solicitud.
            </Text>
          </View>

          <View style={styles.card}>
            {sent ? (
              <View style={styles.successState}>
                <Feather name="check-circle" size={40} color={andiColors.success600} />
                <Text style={styles.successTitle}>Solicitud recibida</Text>
                <Text style={styles.successBody}>
                  Tu solicitud fue recibida. Te contactaremos al correo indicado si es aprobada.
                </Text>
                <TouchableOpacity
                  style={styles.btn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Login')}
                >
                  <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.btnText}>Volver a la entrada</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>NOMBRE COMPLETO</Text>
                <View style={styles.inputWrap}>
                  <Feather name="user" size={18} color={andiColors.onSurfaceVariant} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="María García"
                    placeholderTextColor={andiColors.onSurfaceVariant}
                    value={nombre}
                    onChangeText={setNombre}
                    autoCapitalize="words"
                  />
                </View>

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

                {emailDuplicado && (
                  <View style={[styles.errorBanner, styles.errorBannerOrange]}>
                    <Feather name="alert-triangle" size={16} color={andiColors.warning600} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.errorTextOrange}>Este correo ya tiene una cuenta registrada.</Text>
                      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.duplicateLinkText}>Ir a iniciar sesión</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Text style={styles.label}>MOTIVO</Text>
                <View style={styles.textareaWrap}>
                  <TextInput
                    style={styles.textarea}
                    placeholder="Explica por qué necesitas acceso de Administrador (mínimo 20 caracteres)"
                    placeholderTextColor={andiColors.onSurfaceVariant}
                    value={motivo}
                    onChangeText={setMotivo}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
                <Text style={styles.charCount}>{motivo.trim().length}/{MOTIVO_MIN} mín.</Text>

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
                      : <Text style={styles.btnText}>Enviar solicitud</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
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
  backBtn: { position: 'absolute', top: andiSpace[10], left: andiSpace[6], padding: andiSpace[2], zIndex: 1 },
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
    marginTop: andiSpace[4],
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
  textareaWrap: {
    borderWidth: 1.5,
    borderColor: andiColors.outline,
    borderRadius: andiRadius.md,
    backgroundColor: andiColors.surfaceDim,
    paddingHorizontal: andiSpace[3],
    paddingVertical: andiSpace[2],
    marginTop: andiSpace[2],
  },
  textarea: { minHeight: 90, fontSize: 15, color: andiColors.onSurface },
  charCount: { ...andiType.caption, color: andiColors.onSurfaceVariant, marginTop: andiSpace[1], textAlign: 'right' },
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
  errorBannerOrange: { borderLeftColor: andiColors.warning600, backgroundColor: andiColors.warning50, alignItems: 'flex-start' },
  errorTextOrange: { ...andiType.bodySm, color: andiColors.warning700 },
  duplicateLinkText: { ...andiType.labelSm, color: andiColors.primary600, textDecorationLine: 'underline', marginTop: andiSpace[1] },
  btn: { marginTop: andiSpace[6], borderRadius: andiRadius.full, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { ...andiType.label, color: andiColors.surface, letterSpacing: 0.5 },
  successState: { alignItems: 'center', paddingVertical: andiSpace[4] },
  successTitle: { ...andiType.headingMd, color: andiColors.onSurface, marginTop: andiSpace[4], textAlign: 'center' },
  successBody: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[2], textAlign: 'center' },
});
