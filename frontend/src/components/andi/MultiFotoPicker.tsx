import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uriImagenServidor } from '../../utils/fotoEvidencia';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';

type Props = {
  /** Fotos que el reporte ya tiene guardadas en el servidor (rutas
   * relativas) -- solo aplica en edición o en evidencia ya subida. Quitar
   * una de aquí la marca para borrar, pero no la borra del servidor hasta
   * que se guarde el formulario. */
  existentes?: string[];
  onQuitarExistente?: (url: string) => void;
  /** Fotos nuevas elegidas en este formulario, pendientes de subir. */
  nuevas: ImagePicker.ImagePickerAsset[];
  onChangeNuevas: (fotos: ImagePicker.ImagePickerAsset[]) => void;
  /** Igual a MAX_IMAGENES_POR_LISTA + 1 en el backend (reportes.py): el
   * tope real es 1 imagen_url + 6 imagenes, pero de cara al usuario es "una
   * sola lista de fotos" -- no hay dos topes que explicar. */
  max?: number;
  /** >0 pinta un aviso mientras el total de fotos (existentes + nuevas) no
   * lo alcance. No bloquea nada por sí mismo -- el caller decide si el
   * envío se detiene (ver EntidadCierreView: obligatorio solo al resolver). */
  minimo?: number;
  disabled?: boolean;
  onPermisoCamaraDenegado?: () => void;
  label?: string;
};

/**
 * Selector único de fotos (una o varias, migración 0008): cámara o
 * galería, miniaturas removibles para lo ya guardado y lo recién elegido
 * en la misma tira -- un solo lugar para "subir imagen", no dos como
 * antes (una foto "principal" con sus propios botones y una lista
 * "adicional" aparte). No sube nada por sí mismo: el caller sube con
 * utils/fotoEvidencia.subirFotos() al enviar el form.
 */
export default function MultiFotoPicker({
  existentes = [],
  onQuitarExistente,
  nuevas,
  onChangeNuevas,
  max = 7,
  minimo = 0,
  disabled,
  onPermisoCamaraDenegado,
  label = 'Fotos (opcional)',
}: Props) {
  const total = existentes.length + nuevas.length;
  const lleno = total >= max;
  const faltanParaMinimo = Math.max(0, minimo - total);

  const agregar = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.length) return;
    const espacio = max - total;
    onChangeNuevas([...nuevas, ...result.assets.slice(0, espacio)]);
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
        selectionLimit: Math.max(1, max - total),
      })
    );
  };

  const quitarNueva = (index: number) => onChangeNuevas(nuevas.filter((_, i) => i !== index));

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {minimo > 0 && (
          <Text style={[styles.requiredTag, faltanParaMinimo === 0 && styles.requiredTagOk]}>
            {faltanParaMinimo === 0 ? 'Listo' : `Obligatorio · mínimo ${minimo}`}
          </Text>
        )}
      </View>

      {total > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filaContenido}
        >
          {existentes.map((url) => (
            <View key={url} style={styles.miniatura}>
              <Image source={{ uri: uriImagenServidor(url) ?? undefined }} style={styles.miniaturaImg} resizeMode="cover" />
              {!disabled && !!onQuitarExistente && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  style={styles.quitarBtn}
                  onPress={() => onQuitarExistente(url)}
                >
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {nuevas.map((foto, i) => (
            <View key={foto.assetId ?? `${foto.uri}-${i}`} style={styles.miniatura}>
              <Image source={{ uri: foto.uri }} style={styles.miniaturaImg} resizeMode="cover" />
              {!disabled && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  style={styles.quitarBtn}
                  onPress={() => quitarNueva(i)}
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
      <Text style={styles.contador}>{total}/{max} fotos</Text>
    </View>
  );
}

const MINI = 72;

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: ANDI_SPACING.s2 },
  label: { ...ANDI_TYPE.label, color: ANDI_COLORS.onSurfaceVariant },
  requiredTag: { ...ANDI_TYPE.caption, color: ANDI_COLORS.error, fontWeight: '700' },
  requiredTagOk: { color: ANDI_COLORS.success },
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
