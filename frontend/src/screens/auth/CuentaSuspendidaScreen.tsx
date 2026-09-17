import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiSpace } from '../../theme/andi';

type Props = NativeStackScreenProps<RootStackParamList, 'CuentaSuspendida'>;

export default function CuentaSuspendidaScreen({ navigation, route }: Props) {
  const message = route.params?.message ?? 'Tu cuenta no está activa en este momento.';

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Feather name="slash" size={64} color={andiColors.error400} />
        <Text style={styles.title}>No pudimos entrar</Text>
        <Text style={styles.subtitle}>{message}</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>SUSPENDIDO</Text>
        </View>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => Linking.openURL('mailto:admin@geovisor.com')}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#0A6F78', '#1FA5AD']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.btnText}>Escribir al administrador</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.replace('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Volver a la entrada</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: andiColors.primary900, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: '30%', paddingHorizontal: andiSpace[6] },
  title: { ...andiType.headingLg, color: andiColors.surface, marginTop: andiSpace[4], textAlign: 'center' },
  subtitle: { ...andiType.bodySm, color: andiColors.primary200, marginTop: andiSpace[2], textAlign: 'center', minHeight: 16 },
  chip: {
    marginTop: andiSpace[4],
    backgroundColor: andiColors.error100,
    borderRadius: andiRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipText: { ...andiType.labelSm, color: andiColors.error700, letterSpacing: 0.8 },
  card: {
    backgroundColor: andiColors.surface,
    borderTopLeftRadius: andiRadius.xl,
    borderTopRightRadius: andiRadius.xl,
    paddingHorizontal: andiSpace[6],
    paddingTop: andiSpace[8],
    paddingBottom: andiSpace[10],
  },
  btn: { borderRadius: andiRadius.full, overflow: 'hidden' },
  btnGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  btnText: { ...andiType.label, color: andiColors.surface, letterSpacing: 0.5 },
  linkRow: { alignItems: 'center', marginTop: andiSpace[6] },
  linkText: { ...andiType.bodySm, color: andiColors.primary600 },
});
