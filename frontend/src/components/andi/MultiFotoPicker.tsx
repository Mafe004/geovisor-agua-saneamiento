import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';

type Props = {
  /** Fotos ya elegidas, pendientes de subir (no incluye las que el reporte
   * ya tiene guardadas en el servidor -- esas las pinta FotoGaleria). */
  fotos: ImagePicker.ImagePickerAsset[];
  onChange: (fotos: ImagePicker.ImagePickerAsset[]) => void;
  /** Igual a MAX_IMAGENES_POR_LISTA en el backend (reportes.py). */
  max?: number;
  disabled?: boolean;
  onPermisoCamaraDenegado?: () => void;
  label?: string;
};

/**
 * Selector de varias fotos adicionales (migración 0008): cámara o galería,
 * con miniaturas removibles y un tope `max`. No sube nada por sí mismo --
 * el caller sube con utils/fotoEvidencia.subirFotos() al enviar el form,
 * igual que ya hacía la foto única (foto/fotoSubida) en CrearReporteScreen.
 */
export default function MultiFotoPicker({
  fotos,
  onChange,
  max = 6,
  disabled,
  onPermisoCamaraDenegado,
  label = 'Fotos adicionales (opcional)',
}: Props) {
  const lleno = fotos.length >= max;

  const agregar = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length) return;
    const espacio = max - fotos.length;
    onChange([...fotos, ...result.assets.slice(0, espacio)]);
  };

  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      onPermisoCamaraDenegado?.();
      return;
    }
    agregar(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }));
  };

  const elegirDeGaleria = async () => {
    agregar(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, max - fotos.length),
      })
    );
  };

  const quitar = (index: number) => onChange(fotos.filter((_, i) => i !== index));

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {fotos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filaContenido}
        >
          {fotos.map((foto, i) => (
            <View key={foto.assetId ?? `${foto.uri}-${i}`} style={styles.miniatura}>
              <Image source={{ uri: foto.uri }} style={styles.miniaturaImg} resizeMode="cover" />
              {!disabled && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  style={styles.quitarBtn}
                  onPress={() => quitar(i)}
                >
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {!disabled && !lleno && (
        <View style={styles.acciones}>
          <TouchableOpacity accessibilityRole="button" style={styles.accionBtn} onPress={tomarFoto}>
            <Feather name="camera" size={16} color={ANDI_COLORS.primary700} />
            <Text style={styles.accionTexto}>Tomar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.accionBtn} onPress={elegirDeGaleria}>
            <Feather name="image" size={16} color={ANDI_COLORS.primary700} />
            <Text style={styles.accionTexto}>Galería</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.contador}>{fotos.length}/{max} fotos adicionales</Text>
    </View>
  );
}

const MINI = 72;

const styles = StyleSheet.create({
  label: { ...ANDI_TYPE.label, color: ANDI_COLORS.onSurfaceVariant, marginBottom: ANDI_SPACING.s2 },
  filaContenido: { gap: ANDI_SPACING.s2, paddingBottom: ANDI_SPACING.s2 },
  miniatura: {
    width: MINI, height: MINI, borderRadius: ANDI_RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, backgroundColor: ANDI_COLORS.surface,
  },
  miniaturaImg: { width: '100%', height: '100%' },
  quitarBtn: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  acciones: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s2 },
  accionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s1,
    minHeight: 40, paddingHorizontal: ANDI_SPACING.s3, borderRadius: ANDI_RADIUS.full,
    backgroundColor: ANDI_COLORS.primary50,
  },
  accionTexto: { color: ANDI_COLORS.primary700, fontWeight: '600', fontSize: 12 },
  contador: { ...ANDI_TYPE.caption, color: ANDI_COLORS.onSurfaceVariant, marginTop: ANDI_SPACING.s1 },
});
