import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, type NativeSyntheticEvent, type TextInputKeyPressEventData,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiSpace } from '../../theme/andi';
import { Rol } from '../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Invitacion'>;

const CODE_LENGTH = 6;

type RolCodigo = keyof typeof Rol;

const ROL_ICON: Record<RolCodigo, keyof typeof Feather.glyphMap> = {
  CIUDADANO: 'user',
  ENTIDAD: 'briefcase',
  MODERADOR: 'shield',
  ADMINISTRADOR: 'shield',
};

const ROL_LABEL: Record<RolCodigo, string> = {
  CIUDADANO: 'Ciudadano',
  ENTIDAD: 'Entidad',
  MODERADOR: 'Moderador',
  ADMINISTRADOR: 'Administrador',
};

type ValidarCodigoResult =
  | { status: 'ok'; rol: RolCodigo; entidad: string }
  | { status: 'expired' }
  | { status: 'used' };

// TODO: connect endpoint — replace with authAPI.validarCodigo(codigo) once
// POST /auth/validar-codigo exists on the backend. Two reserved codes drive
// the error states below for local testing: 'EXPIRE' and 'USED01'; any
// other 6-char code resolves as a successful ENTIDAD invitation.
async function mockValidarCodigo(codigo: string): Promise<ValidarCodigoResult> {
  await new Promise(resolve => setTimeout(resolve, 400));
  if (codigo === 'EXPIRE') return { status: 'expired' };
  if (codigo === 'USED01') return { status: 'used' };
  return { status: 'ok', rol: 'ENTIDAD', entidad: 'Empresa Ejemplo' };
}

export default function InvitacionScreen({ navigation }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'expired' | 'used' | null>(null);
  const [result, setResult] = useState<{ rol: RolCodigo; entidad: string } | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const codigo = digits.join('');

  const submit = async (fullCodigo: string) => {
    setLoading(true);
    setStatus(null);
    setResult(null);
    try {
      const res = await mockValidarCodigo(fullCodigo);
      if (res.status === 'ok') {
        setResult({ rol: res.rol, entidad: res.entidad });
      } else {
        setStatus(res.status);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangeDigit = (index: number, value: string) => {
    // Un solo carácter por celda -- si el usuario pega el código completo
    // en una celda, se reparte automáticamente en las siguientes.
    const chars = value.toUpperCase().split('');
    const next = [...digits];
    let cursor = index;
    for (const ch of chars) {
      if (cursor >= CODE_LENGTH) break;
      next[cursor] = ch;
      cursor += 1;
    }
    setDigits(next);
    setStatus(null);
    setResult(null);

    if (cursor < CODE_LENGTH) {
      inputRefs.current[cursor]?.focus();
    } else {
      inputRefs.current[CODE_LENGTH - 1]?.blur();
    }

    const joined = next.join('');
    if (joined.length === CODE_LENGTH && next.every(d => d !== '')) {
      submit(joined);
    }
  };

  const handleKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Feather name="arrow-left" size={22} color={andiColors.surface} />
      </TouchableOpacity>

      <View style={styles.hero}>
        <Feather name="key" size={48} color={andiColors.surface} />
        <Text style={styles.title}>Tengo un código</Text>
        <Text style={styles.subtitle}>Escribe las 6 letras o números que recibiste</Text>
      </View>

      <View style={styles.otpRow}>
        {digits.map((digit, i) => (
          <TextInput
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            style={[styles.otpCell, digit !== '' && styles.otpCellFilled]}
            value={digit}
            onChangeText={v => handleChangeDigit(i, v)}
            onKeyPress={e => handleKeyPress(i, e)}
            maxLength={CODE_LENGTH - i}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading && !result}
          />
        ))}
      </View>

      {status === 'expired' && (
        <View style={[styles.banner, styles.bannerWarning]}>
          <Feather name="clock" size={16} color={andiColors.warning700} />
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTextWarning}>Este código ya venció.</Text>
            <TouchableOpacity onPress={() => navigation.replace('Register', { id_rol: Rol.CIUDADANO })}>
              <Text style={styles.bannerLink}>Ingresar como Ciudadano</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'used' && (
        <View style={[styles.banner, styles.bannerError]}>
          <Feather name="x-circle" size={16} color={andiColors.error700} />
          <Text style={styles.bannerTextError}>Este código ya fue utilizado.</Text>
        </View>
      )}

      {result && (
        <View style={styles.confirmCard}>
          <Feather name={ROL_ICON[result.rol]} size={32} color={andiColors.primary600} />
          <Text style={styles.confirmRoleLabel}>{ROL_LABEL[result.rol]}</Text>
          <Text style={styles.confirmEntidad}>{result.entidad}</Text>
          <TouchableOpacity
            style={styles.confirmBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Register', {
              id_rol: Rol[result.rol],
              codigoData: { codigo, rol: result.rol, entidad: result.entidad },
            })}
          >
            <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.confirmBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.confirmBtnText}>Continuar como {ROL_LABEL[result.rol]}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.primary900, paddingHorizontal: andiSpace[6] },
  backBtn: { marginTop: andiSpace[10], alignSelf: 'flex-start', padding: andiSpace[2] },
  hero: { alignItems: 'center', marginTop: andiSpace[6] },
  title: { ...andiType.headingLg, color: andiColors.surface, marginTop: andiSpace[4], textAlign: 'center' },
  subtitle: { ...andiType.bodySm, color: andiColors.primary200, marginTop: andiSpace[2], textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: andiSpace[2], marginTop: andiSpace[8] },
  otpCell: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: andiColors.outline,
    borderRadius: andiRadius.md,
    backgroundColor: andiColors.surface,
    textAlign: 'center',
    fontSize: 20,
    color: andiColors.onSurface,
  },
  otpCellFilled: { borderColor: andiColors.primary400 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: andiSpace[2],
    marginTop: andiSpace[6],
    paddingVertical: andiSpace[2],
    paddingHorizontal: andiSpace[3],
    borderLeftWidth: 3,
    borderRadius: andiRadius.xs,
  },
  bannerWarning: { borderLeftColor: andiColors.warning600, backgroundColor: andiColors.warning50 },
  bannerError: { borderLeftColor: andiColors.error600, backgroundColor: andiColors.error50 },
  bannerTextWrap: { flex: 1 },
  bannerTextWarning: { ...andiType.bodySm, color: andiColors.warning700 },
  bannerTextError: { ...andiType.bodySm, color: andiColors.error700, flex: 1 },
  bannerLink: { ...andiType.bodySm, color: andiColors.primary600, fontWeight: '700', marginTop: andiSpace[1] },
  confirmCard: {
    backgroundColor: andiColors.surface,
    borderRadius: andiRadius.xl,
    alignItems: 'center',
    padding: andiSpace[6],
    marginTop: andiSpace[8],
  },
  confirmRoleLabel: {
    ...andiType.labelMd,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: andiColors.onSurfaceVariant,
    marginTop: andiSpace[3],
  },
  confirmEntidad: { ...andiType.headingMd, color: andiColors.onSurface, marginTop: andiSpace[1], minHeight: 26, textAlign: 'center' },
  confirmBtn: { alignSelf: 'stretch', borderRadius: andiRadius.full, overflow: 'hidden', marginTop: andiSpace[6] },
  confirmBtnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { ...andiType.label, color: andiColors.surface, letterSpacing: 0.5 },
});
