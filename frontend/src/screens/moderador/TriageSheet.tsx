import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { reportesAPI } from '../../api/services';
import { andiColors, andiRadius, andiSpace, andiType, andiOverlineDecor, andiStatusPill, andiElevation } from '../../theme/andi';
import type { Reporte, EstadoReporteItem, EntidadDetalle } from '../../types/domain';

interface TriageSheetProps {
  visible: boolean;
  reporte: Reporte | null;
  estadosDisponibles: EstadoReporteItem[];
  entidades: EntidadDetalle[];
  onClose: () => void;
  onSaved: (updated: Reporte) => void;
}

// Orden visual del canvas (column-reverse): destino final arriba, el estado
// actual del reporte queda al fondo y apagado -- "no es un destino".
const ESTADO_ORDEN = ['RESUELTO', 'EN_PROCESO', 'EN_REVISION', 'PENDIENTE'];

export default function TriageSheet({
  visible, reporte, estadosDisponibles, entidades, onClose, onSaved,
}: TriageSheetProps) {
  const [idEntidad, setIdEntidad] = useState<number | null>(null);
  const [changingEntidad, setChangingEntidad] = useState(false);
  const [idEstadoNuevo, setIdEstadoNuevo] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && reporte) {
      setIdEntidad(reporte.id_entidad ?? reporte.id_entidad_sugerida ?? null);
      setChangingEntidad(false);
      setIdEstadoNuevo(null);
      setComentario('');
    }
  }, [visible, reporte]);

  if (!reporte) return null;

  const entidadSeleccionada = entidades.find(e => e.id_entidad === idEntidad);
  const esSugerida = idEntidad === reporte.id_entidad_sugerida;

  const estadosOrdenados = ESTADO_ORDEN
    .map(nombre => estadosDisponibles.find(e => e.nombre === nombre))
    .filter((e): e is EstadoReporteItem => !!e);

  const handleGuardar = async () => {
    const entidadCambio = idEntidad != null && idEntidad !== reporte.id_entidad;
    const estadoSeleccionado = estadosDisponibles.find(e => e.id_estado === idEstadoNuevo);
    const estadoCambio = !!estadoSeleccionado && estadoSeleccionado.nombre !== reporte.estado;

    if (!entidadCambio && !estadoCambio) {
      Alert.alert('Sin cambios', 'Selecciona una entidad o un estado diferente al actual.');
      return;
    }

    try {
      setSaving(true);
      let actualizado: Reporte = reporte;

      if (entidadCambio) {
        const res = await reportesAPI.asignarEntidad(reporte.id_reporte, { id_entidad: idEntidad as number });
        actualizado = res.data.reporte;
      }
      if (estadoCambio) {
        const res = await reportesAPI.cambiarEstado(reporte.id_reporte, {
          id_estado_nuevo: idEstadoNuevo as number,
          comentario: comentario.trim() || undefined,
        });
        actualizado = res.data.reporte;
      }

      onSaved(actualizado);
      onClose();
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      Alert.alert('Error', msg || 'No se pudo guardar el triage.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kbWrap}>
          <View style={[styles.card, andiElevation[4]]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.handle} />

              <View style={styles.titleBlock}>
                <Text style={andiType.section}>Triar reporte</Text>
                <Text style={[andiType.caption, styles.caption]}>Queda registrado en el historial con tu nombre.</Text>
              </View>

              <View style={styles.section}>
                <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Entidad</Text>
                <View style={styles.entidadCard}>
                  <View style={styles.entidadIcon}>
                    <Feather name="arrow-right" size={15} color={andiColors.n0} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[andiType.label, styles.entidadName]}>
                      {entidadSeleccionada?.nombre_entidad ?? 'Sin asignar'}
                    </Text>
                    <Text style={[andiType.caption, styles.entidadCaption]}>
                      {esSugerida
                        ? `Sugerido por tipo · ${reporte.tipo_incidente ?? ''}`
                        : 'Asignación manual'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.changeBtn} onPress={() => setChangingEntidad(v => !v)}>
                    <Text style={styles.changeBtnText}>Cambiar</Text>
                  </TouchableOpacity>
                </View>

                {changingEntidad && (
                  <View style={styles.entidadGrid}>
                    {entidades.map(ent => (
                      <TouchableOpacity
                        key={ent.id_entidad}
                        style={[styles.entidadChip, idEntidad === ent.id_entidad && styles.entidadChipActive]}
                        onPress={() => { setIdEntidad(ent.id_entidad); setChangingEntidad(false); }}
                      >
                        <Text style={[styles.entidadChipText, idEntidad === ent.id_entidad && styles.entidadChipTextActive]}>
                          {ent.nombre_entidad}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Nuevo estado</Text>
                <View style={{ gap: andiSpace[2] }}>
                  {estadosOrdenados.map(e => {
                    const isCurrent = e.nombre === reporte.estado;
                    const isSelected = idEstadoNuevo === e.id_estado;
                    const cfg = andiStatusPill[e.nombre] ?? andiStatusPill.PENDIENTE!;
                    return (
                      <TouchableOpacity
                        key={e.id_estado}
                        disabled={isCurrent}
                        onPress={() => setIdEstadoNuevo(e.id_estado)}
                        style={[
                          styles.estadoPill,
                          { backgroundColor: cfg.bg, borderColor: cfg.bd, borderWidth: isSelected ? 2 : 1 },
                          isCurrent && styles.estadoPillDimmed,
                        ]}
                      >
                        {cfg.icon === 'circle'
                          ? <View style={[styles.estadoDot, { backgroundColor: cfg.fg }]} />
                          : <Feather name={cfg.icon} size={13} color={cfg.fg} />}
                        <Text style={[styles.estadoPillText, { color: cfg.fg }]}>
                          {cfg.label}{isSelected ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[andiType.caption, styles.helperText]}>
                  Pendiente se ve apagado: es el estado del que vienes, no un destino.
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Comentario · lo lee el ciudadano</Text>
                <TextInput
                  style={styles.comentarioInput}
                  placeholder="Ej: Clasificado y asignado a la entidad correspondiente."
                  placeholderTextColor={andiColors.onSurfaceVariant}
                  multiline
                  numberOfLines={3}
                  value={comentario}
                  onChangeText={setComentario}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, andiElevation[2], saving && styles.saveBtnDisabled]}
                  onPress={handleGuardar}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={andiColors.n0} />
                    : <Text style={styles.saveBtnText}>Guardar cambio</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  kbWrap: { width: '100%' },
  card: {
    backgroundColor: andiColors.surface,
    borderTopLeftRadius: andiRadius['2xl'], borderTopRightRadius: andiRadius['2xl'],
    paddingHorizontal: andiSpace[5], paddingTop: andiSpace[3], paddingBottom: andiSpace[6],
    width: '100%', maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: andiRadius.full, backgroundColor: andiColors.outline, alignSelf: 'center', marginBottom: andiSpace[4] },
  titleBlock: { marginBottom: andiSpace[4] },
  caption: { color: andiColors.onSurfaceVariant, marginTop: 2 },

  section: { marginBottom: andiSpace[4] },
  sectionLabel: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[2] },

  entidadCard: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    backgroundColor: andiColors.infoContainer, borderWidth: 1, borderColor: andiColors.info,
    borderRadius: andiRadius.lg, padding: andiSpace[3],
  },
  entidadIcon: {
    width: 36, height: 36, borderRadius: andiRadius.full,
    backgroundColor: andiColors.info, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  entidadName: { color: andiColors.onInfoContainer },
  entidadCaption: { color: andiColors.onInfoContainer, marginTop: 2 },
  changeBtn: {
    minHeight: 40, paddingHorizontal: andiSpace[3], borderRadius: andiRadius.full,
    backgroundColor: andiColors.surface, borderWidth: 1, borderColor: andiColors.info,
    alignItems: 'center', justifyContent: 'center',
  },
  changeBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: andiColors.onInfoContainer },

  entidadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[2], marginTop: andiSpace[3] },
  entidadChip: {
    paddingHorizontal: andiSpace[3], paddingVertical: andiSpace[2],
    borderRadius: andiRadius.full, backgroundColor: andiColors.surfaceMid,
    borderWidth: 1, borderColor: andiColors.outline,
  },
  entidadChipActive: { backgroundColor: andiColors.primary600, borderColor: andiColors.primary600 },
  entidadChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: andiColors.onSurface },
  entidadChipTextActive: { color: andiColors.n0 },

  estadoPill: {
    minHeight: 28, borderRadius: andiRadius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: andiSpace[4],
  },
  estadoPillDimmed: { opacity: 0.55 },
  estadoDot: { width: 8, height: 8, borderRadius: 4 },
  estadoPillText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  helperText: { color: andiColors.onSurfaceVariant, marginTop: andiSpace[2] },

  comentarioInput: {
    backgroundColor: andiColors.surfaceMid, borderWidth: 1, borderColor: andiColors.outlineVariant,
    borderRadius: andiRadius.lg, padding: andiSpace[3], minHeight: 64,
    fontSize: 14, lineHeight: 20, color: andiColors.onSurface,
  },

  actionRow: { flexDirection: 'row', gap: andiSpace[2] },
  cancelBtn: {
    minHeight: 56, paddingHorizontal: andiSpace[5], borderRadius: andiRadius.full,
    borderWidth: 1, borderColor: andiColors.outline, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: andiColors.onSurface },
  saveBtn: {
    flex: 1, minHeight: 56, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary600, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: andiColors.n0 },
});
