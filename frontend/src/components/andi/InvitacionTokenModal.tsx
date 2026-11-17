import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { andiColors, andiRadius, andiSpace, andiType } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';

interface InvitacionTokenModalProps {
  visible: boolean;
  onClose: () => void;
  token: string | null;
  /** Mensaje bajo el código -- p.ej. a quién se invitó o cuándo vence. */
  mensaje?: string;
}

/**
 * Muestra el código de invitación recién generado con un botón de copiar --
 * mismo patrón visual que SolicitudesAccesoScreen.tsx usa tras aprobar una
 * solicitud, factorizado aquí porque ahora también lo usan
 * admin/EntidadesScreen.tsx y shared/PerfilScreen.tsx (una ENTIDAD invitando
 * a un nuevo compañero suyo).
 */
export default function InvitacionTokenModal({ visible, onClose, token, mensaje }: InvitacionTokenModalProps) {
  const r = useResponsive();
  const styles = makeStyles(r);
  const [copied, setCopied] = useState(false);

  const handleCopiar = async () => {
    if (!token) return;
    try {
      await Clipboard.setStringAsync(token);
      setCopied(true);
    } catch (_) {
      // Sin permiso/soporte de portapapeles -- el código sigue visible en
      // pantalla para copiarlo a mano, no hace falta bloquear el flujo.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setCopied(false); onClose(); }}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: '100%', maxWidth: r.maxContentWidth(480), alignSelf: 'center' }]}>
          <Feather name="check-circle" size={32} color={andiColors.success600} style={{ alignSelf: 'center' }} />
          <Text style={styles.title}>Código generado</Text>
          {!!mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}
          <Text style={styles.token}>{token}</Text>
          <Text style={styles.nota}>Vence en 7 días. Compártelo por el canal que uses con tu equipo (chat, voz, papel).</Text>

          <TouchableOpacity accessibilityRole="button" style={styles.copyBtn} onPress={handleCopiar} activeOpacity={0.8}>
            <Feather name={copied ? 'check' : 'copy'} size={16} color={andiColors.primary600} />
            <Text style={styles.copyBtnText}>{copied ? 'Copiado' : 'Copiar código'}</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" style={styles.closeBtn} onPress={() => { setCopied(false); onClose(); }} activeOpacity={0.85}>
            <Text style={styles.closeBtnText}>Listo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'center', padding: andiSpace[6] },
  card: { backgroundColor: andiColors.surface, borderRadius: andiRadius.lg, padding: andiSpace[5] },
  title: { ...andiType.headingMd, color: andiColors.onSurface, textAlign: 'center', marginTop: andiSpace[2] },
  mensaje: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, textAlign: 'center', marginTop: andiSpace[2] },
  token: {
    ...andiType.headingLg, color: andiColors.primary700, textAlign: 'center',
    letterSpacing: 6, marginTop: andiSpace[4], fontWeight: '800', fontSize: r.scaleFont(28),
  },
  nota: { ...andiType.caption, color: andiColors.onSurfaceVariant, textAlign: 'center', marginTop: andiSpace[3] },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: andiSpace[2],
    marginTop: andiSpace[5], height: 44, borderRadius: andiRadius.full,
    borderWidth: 1.5, borderColor: andiColors.primary600,
  },
  copyBtnText: { ...andiType.label, color: andiColors.primary600 },
  closeBtn: { marginTop: andiSpace[3], height: 44, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { ...andiType.label, color: andiColors.surface },
});
