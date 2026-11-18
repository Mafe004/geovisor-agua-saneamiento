import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { uriImagenServidor } from '../../utils/fotoEvidencia';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';

type Props = {
  /** Título de la sección (p.ej. "Fotos del incidente" o "Evidencia de la atención"). */
  titulo: string;
  /** Rutas relativas del servidor, en el orden en que deben mostrarse --
   * ya mezcla la foto legada (imagen_url) con las de reporte_imagenes, eso
   * lo arma el caller (ver DetalleReporteScreen). */
  urls: (string | null | undefined)[];
};

/**
 * Tira de miniaturas + visor de pantalla completa con flechas. Usada tanto
 * para las fotos del incidente (reportes.imagen_url + reporte_imagenes tipo
 * INCIDENTE) como para la evidencia de cada cambio de estado (migración 0008).
 * No distingue entre "legada" y "adicional" -- para quien mira el reporte
 * son la misma cosa: fotos de esa situación.
 */
export default function FotoGaleria({ titulo, urls }: Props) {
  const absolutas = urls.map((u) => uriImagenServidor(u)).filter((u): u is string => !!u);
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);

  if (absolutas.length === 0) return null;

  const anterior = () => setIndiceAbierto((i) => (i === null ? i : (i - 1 + absolutas.length) % absolutas.length));
  const siguiente = () => setIndiceAbierto((i) => (i === null ? i : (i + 1) % absolutas.length));

  return (
    <View style={styles.wrap}>
      <Text style={styles.titulo}>{titulo} {absolutas.length > 1 ? `(${absolutas.length})` : ''}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
        {absolutas.map((uri, i) => (
          <TouchableOpacity
            key={uri + i}
            accessibilityRole="button"
            accessibilityLabel={`Ver foto ${i + 1} de ${absolutas.length}`}
            onPress={() => setIndiceAbierto(i)}
          >
            <Image source={{ uri }} style={styles.miniatura} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={indiceAbierto !== null} transparent animationType="fade" onRequestClose={() => setIndiceAbierto(null)}>
        <View style={styles.visorOverlay}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={styles.visorCerrar}
            onPress={() => setIndiceAbierto(null)}
          >
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
          {indiceAbierto !== null && (
            <>
              <Image source={{ uri: absolutas[indiceAbierto] }} style={styles.visorImagen} resizeMode="contain" />
              {absolutas.length > 1 && (
                <View style={styles.visorNav}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Foto anterior" style={styles.visorNavBtn} onPress={anterior}>
                    <Feather name="chevron-left" size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.visorContador}>{indiceAbierto + 1} / {absolutas.length}</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Foto siguiente" style={styles.visorNavBtn} onPress={siguiente}>
                    <Feather name="chevron-right" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const MINI = 88;

const styles = StyleSheet.create({
  wrap: { marginTop: ANDI_SPACING.s3 },
  titulo: { ...ANDI_TYPE.label, color: ANDI_COLORS.onSurfaceVariant, marginBottom: ANDI_SPACING.s2 },
  fila: { gap: ANDI_SPACING.s2 },
  miniatura: {
    width: MINI, height: MINI, borderRadius: ANDI_RADIUS.lg,
    borderWidth: 1, borderColor: ANDI_COLORS.outlineVariant, backgroundColor: ANDI_COLORS.surface,
  },
  visorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  visorCerrar: { position: 'absolute', top: 48, right: 20, zIndex: 1, padding: ANDI_SPACING.s2 },
  visorImagen: { width: '100%', height: '75%' },
  visorNav: {
    position: 'absolute', bottom: 48, flexDirection: 'row', alignItems: 'center',
    gap: ANDI_SPACING.s4,
  },
  visorNavBtn: { padding: ANDI_SPACING.s2 },
  visorContador: { color: '#fff', fontWeight: '600', minWidth: 56, textAlign: 'center' },
});
