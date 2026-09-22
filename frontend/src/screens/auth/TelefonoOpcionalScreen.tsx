import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiSpace } from '../../theme/andi';

type Props = NativeStackScreenProps<RootStackParamList, 'TelefonoOpcional'>;

const INFO_ROWS: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  { icon: 'bell', text: 'Te avisamos por SMS si el estado de tu reporte cambia.' },
  { icon: 'shield', text: 'Nunca compartimos tu número con terceros.' },
];

export default function TelefonoOpcionalScreen({ navigation }: Props) {
  const { logout } = useContext(AuthContext);
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);

  const finish = async (successMessage?: string) => {
    // La cuenta recién registrada aún no tiene sesión (queda PENDIENTE hasta
    // que un admin la active, y este flujo corre antes del primer login) --
    // logout() acá solo limpia cualquier estado local residual, es seguro
    // llamarlo aunque nunca hubo sesión.
    await logout();
    navigation.navigate('Login', successMessage ? { successMessage } : undefined);
  };

  const handleGuardar = async () => {
    setLoading(true);
    // TODO: connect endpoint — no route exists that this screen could call:
    // PUT /usuarios/perfil (app/routers/usuarios.py actualizar_perfil)
    // requires require_active_user (a valid JWT AND id_estado_cuenta=ACTIVO),
    // but a just-registered account has neither yet (it's PENDIENTE and the
    // user was never issued a token). Simulated locally for now.
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoading(false);
    await finish('Teléfono guardado. Ya puedes iniciar sesión.');
  };

  const handleAhoraNo = () => {
    finish();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Feather name="phone" size={64} color={andiColors.primary600} />
        <Text style={styles.title}>¿Añades tu teléfono?</Text>
        <Text style={styles.subtitle}>Opcional — te avisaremos por SMS sobre tus reportes.</Text>
      </View>

      <View style={styles.infoTable}>
        {INFO_ROWS.map((row, i) => (
          <View key={i} style={styles.infoRow}>
            <Feather name={row.icon} size={18} color={andiColors.primary600} />
            <Text style={styles.infoText}>{row.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>TELÉFONO</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.prefix}>+57</Text>
        <View style={styles.prefixDivider} />
        <TextInput
          style={styles.input}
          placeholder="300 0000000"
          placeholderTextColor={andiColors.onSurfaceVariant}
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.outlineBtn} onPress={handleAhoraNo} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.outlineBtnText}>Ahora no</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, (!telefono.trim() || loading) && styles.btnDisabled]}
          onPress={handleGuardar}
          disabled={!telefono.trim() || loading}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.primaryBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color={andiColors.surface} /> : <Text style={styles.primaryBtnText}>Guardar teléfono</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.surface, padding: andiSpace[6] },
  hero: { alignItems: 'center', marginTop: andiSpace[10] },
  title: { ...andiType.headingMd, color: andiColors.onSurface, marginTop: andiSpace[4], textAlign: 'center' },
  subtitle: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[2], textAlign: 'center' },

  infoTable: { marginTop: andiSpace[8], gap: andiSpace[3] },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: andiSpace[3] },
  infoText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, flex: 1, lineHeight: 18 },

  label: {
    ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 1.5,
    color: andiColors.onSurfaceVariant, marginTop: andiSpace[8],
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    backgroundColor: andiColors.surfaceDim, paddingHorizontal: andiSpace[3],
    marginTop: andiSpace[2], minHeight: 48,
  },
  prefix: { ...andiType.bodyLg, color: andiColors.onSurface },
  prefixDivider: { width: 1, height: 20, backgroundColor: andiColors.outlineVariant, marginHorizontal: andiSpace[2] },
  input: { flex: 1, minHeight: 48, fontSize: 15, color: andiColors.onSurface },

  btnRow: { flexDirection: 'row', gap: andiSpace[3], marginTop: andiSpace[8] },
  outlineBtn: {
    flex: 1, height: 52, borderRadius: andiRadius.full,
    borderWidth: 1.5, borderColor: andiColors.primary600,
    justifyContent: 'center', alignItems: 'center',
  },
  outlineBtnText: { ...andiType.label, color: andiColors.primary600 },
  primaryBtn: { flex: 1, borderRadius: andiRadius.full, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  primaryBtnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { ...andiType.label, color: andiColors.surface, textAlign: 'center' },
});
