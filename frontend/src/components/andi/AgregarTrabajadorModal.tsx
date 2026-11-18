import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { invitacionesAPI } from '../../api/services';
import { Rol } from '../../types/models';
import { useToast } from './Toast';
import InvitacionTokenModal from './InvitacionTokenModal';
import { andiColors, andiRadius, andiSpace, andiType } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';

interface AgregarTrabajadorModalProps {
  visible: boolean;
  onClose: () => void;
  idEntidad: number;
}

/**
 * "Agregar trabajador" = generar un código de invitación de rol ENTIDAD
 * para esta entidad, pero pidiendo primero el nombre de a quién se lo vas a
 * dar -- el backend (POST /invitaciones/) no recibe ni guarda ese nombre
 * (lo pone el propio trabajador al canjear el código, ver
 * registro_con_invitacion en usuarios.py: la cuenta y su contraseña las
 * crea él, nunca quien invita), así que este campo es solo para que quien
 * genera el código confirme a quién se lo va a compartir, no se persiste
 * en el servidor.
 */
export default function AgregarTrabajadorModal({ visible, onClose, idEntidad }: AgregarTrabajadorModalProps) {
  const r = useResponsive();
  const styles = makeStyles(r);
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [generando, setGenerando] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const handleClose = () => {
    setNombre('');
    setToken(null);
    onClose();
  };

  const handleGenerar = async () => {
    if (!nombre.trim()) { toast.warning('Requerido', 'Ingresa el nombre del trabajador.'); return; }
    try {
      setGenerando(true);
      const res = await invitacionesAPI.crear({ id_rol: Rol.ENTIDAD, id_entidad: idEntidad, es_titular: false });
      setToken(res.data.token);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo generar el código de invitación.');
    } finally {
      setGenerando(false);
    }
  };

  if (token) {
    return (
      <InvitacionTokenModal
        visible={visible}
        onClose={handleClose}
        token={token}
        mensaje={`Comparte este código con ${nombre.trim()}. Al registrarse con él, entra directo como trabajador de tu entidad.`}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: r.maxContentWidth(560), alignSelf: 'center' }}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Agregar trabajador</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar" onPress={handleClose} hitSlop={8}>
                <Feather name="x" size={22} color={andiColors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <Text style={styles.body}>
              Escribe el nombre de la persona que vas a agregar. Al terminar te doy un código para compartirle -- con él se registra solo, eligiendo su propia contraseña.
            </Text>

            <Text style={styles.fieldLabel}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Juan Pérez"
              placeholderTextColor={andiColors.n400}
              autoCapitalize="words"
              autoFocus
            />

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.primaryBtn, generando && styles.primaryBtnDisabled]}
              onPress={handleGenerar}
              disabled={generando}
            >
              {generando
                ? <ActivityIndicator size="small" color={andiColors.surface} />
                : <Text style={styles.primaryBtnText}>Generar código</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: andiColors.surface, borderTopLeftRadius: andiRadius.xl, borderTopRightRadius: andiRadius.xl,
    padding: andiSpace[5], paddingBottom: andiSpace[8],
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: andiSpace[3] },
  title: { ...andiType.headingMd, color: andiColors.onSurface, flex: 1 },
  body: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginBottom: andiSpace[4] },
  fieldLabel: { ...andiType.labelSm, color: andiColors.onSurfaceVariant, marginBottom: andiSpace[1] },
  input: {
    minHeight: 48, borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    paddingHorizontal: andiSpace[3], fontSize: 16, color: andiColors.onSurface,
  },
  primaryBtn: {
    marginTop: andiSpace[5], minHeight: 48, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600,
    justifyContent: 'center', alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { ...andiType.label, color: andiColors.surface },
});
