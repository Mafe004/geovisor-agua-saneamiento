import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { entidadesAPI } from '../../api/services';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';
import type { UsuarioDeEntidadItem } from '../../types/domain';

interface AsignarTrabajadorModalProps {
  visible: boolean;
  onClose: () => void;
  idEntidad: number;
  /** id_usuario_asignado actual del reporte, o null si no tiene -- habilita
   * la opción "Quitar asignación" cuando hay uno. */
  idUsuarioActual: number | null;
  /** id del usuario que está usando la app -- solo para marcar "(tú)" en la lista. */
  idUsuarioPropio?: number;
  onElegir: (idUsuarioAsignado: number | null) => void | Promise<void>;
  asignando: boolean;
}

/**
 * Picker de "a qué compañero de la entidad asignar este reporte" --
 * compartido por entidad/ReportesAsignadosScreen.tsx (donde una entidad
 * reparte su propio trabajo) y entidad/DetalleReporteScreen.tsx (donde
 * Admin/Moderador también pueden asignar, ver puede_cambiar_estado en el
 * backend). GET /entidades/{id}/usuarios ya valida en el servidor que
 * ENTIDAD solo pueda pedir la lista de su propia entidad.
 */
export default function AsignarTrabajadorModal({
  visible, onClose, idEntidad, idUsuarioActual, idUsuarioPropio, onElegir, asignando,
}: AsignarTrabajadorModalProps) {
  const r = useResponsive();
  const styles = makeStyles(r);
  const [colegas, setColegas] = useState<UsuarioDeEntidadItem[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    // Inline (no un useCallback aparte, que no se reusa en ningún otro
    // lado) -- así el linter puede ver que todo setState ocurre después
    // de un await, en vez de tratar la llamada como si pudiera setState
    // de forma síncrona dentro del efecto.
    if (!visible) return;
    (async () => {
      setCargando(true);
      try {
        const res = await entidadesAPI.usuarios(idEntidad);
        setColegas((res.data.usuarios || []).filter(u => u.rol === 'ENTIDAD' && u.estado_cuenta === 'ACTIVO'));
      } catch (_) {
        setColegas([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [visible, idEntidad]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Asignar a un compañero</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose}>
              <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {idUsuarioActual != null && (
            <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={() => onElegir(null)} disabled={asignando}>
              <Feather name="user-x" size={16} color={andiColors.error600} />
              <Text style={styles.quitarText}>Quitar asignación</Text>
            </TouchableOpacity>
          )}

          {cargando ? (
            <ActivityIndicator size="small" color={andiColors.primary} style={{ marginVertical: andiSpace[4] }} />
          ) : (
            <FlatList
              data={colegas}
              keyExtractor={c => String(c.id_usuario)}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={<Text style={styles.vacio}>Esta entidad no tiene más trabajadores registrados.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={() => onElegir(item.id_usuario)} disabled={asignando}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(item.nombre_completo || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.nombre}>
                    {item.nombre_completo}{item.id_usuario === idUsuarioPropio ? ' (tú)' : ''}
                    {item.id_usuario === idUsuarioActual ? ' · asignado actual' : ''}
                  </Text>
                  {asignando && <ActivityIndicator size="small" color={andiColors.primary} />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: andiColors.surface, borderTopLeftRadius: andiRadius['2xl'], borderTopRightRadius: andiRadius['2xl'],
    paddingHorizontal: andiSpace[5], paddingTop: andiSpace[4], paddingBottom: andiSpace[8], maxHeight: '80%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: andiSpace[3] },
  title: { fontSize: r.scaleFont(16), fontWeight: '700', color: andiColors.onSurface, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[3], paddingVertical: andiSpace[3], borderBottomWidth: 1, borderBottomColor: andiColors.outlineVariant },
  avatar: { width: 36, height: 36, borderRadius: andiRadius.full, backgroundColor: andiColors.primary100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: andiColors.primary700 },
  nombre: { flex: 1, fontSize: r.scaleFont(14), color: andiColors.onSurface },
  quitarText: { flex: 1, fontSize: r.scaleFont(14), color: andiColors.error600, fontWeight: '600' },
  vacio: { color: andiColors.onSurfaceVariant, paddingVertical: andiSpace[4], textAlign: 'center' },
});
