import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SHADOWS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';

export type AndiDialogTone = 'warning' | 'error' | 'info' | 'success';

/** Misma forma que los botones de Alert.alert, para migrar sin tocar callbacks. */
export interface AndiDialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

// Mismos pares de color que SystemBanner (círculo del icono = color del tono).
const TONES: Record<AndiDialogTone, { iconBg: string; icon: string }> = {
  warning: { iconBg: ANDI_COLORS.warning, icon: '!' },
  error: { iconBg: ANDI_COLORS.error, icon: '!' },
  info: { iconBg: ANDI_COLORS.info, icon: 'i' },
  success: { iconBg: ANDI_COLORS.success, icon: '✓' },
};

interface AndiDialogProps {
  visible: boolean;
  tone?: AndiDialogTone;
  title: string;
  message?: string;
  buttons: AndiDialogButton[];
  /** Si se pasa, se muestra la ✕ del encabezado. */
  onClose?: () => void;
}

/**
 * Diálogo Andi del rol Ciudadano. Reemplaza visualmente a Alert.alert, que en
 * nativo no admite estilos y en react-native-web no muestra nada. Al igual
 * que Alert en Android, no se cierra tocando el fondo ni con "atrás".
 */
export default function AndiDialog({ visible, tone = 'info', title, message, buttons, onClose }: AndiDialogProps) {
  const t = TONES[tone];
  // Evita ejecutar dos veces la misma acción por doble toque mientras el
  // diálogo se cierra; se libera cada vez que se muestra un diálogo nuevo.
  const locked = useRef(false);
  useEffect(() => { if (visible) locked.current = false; }, [visible, buttons]);

  const press = (b: AndiDialogButton) => {
    if (locked.current) return;
    locked.current = true;
    b.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: t.iconBg }]}>
              <Text style={styles.icon}>{t.icon}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {!!onClose && (
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            {buttons.map((b, i) => {
              const variant = b.style === 'destructive' ? 'danger'
                : b.style === 'cancel' || i < buttons.length - 1 ? 'outline' : 'primary';
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  style={[styles.btn, styles[variant]]}
                  onPress={() => press(b)}
                  activeOpacity={0.85}
                >
                  <Text style={variant === 'outline' ? styles.outlineText : styles.solidText}>{b.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type DialogState = {
  visible: boolean;
  title: string;
  message?: string;
  tone: AndiDialogTone;
  buttons: AndiDialogButton[];
};

/**
 * Uso local por pantalla, con la misma semántica que Alert.alert: sin
 * botones muestra "OK"; al tocar un botón primero se cierra y luego se
 * ejecuta su onPress. La pantalla debe renderizar `dialog`.
 */
export function useAndiDialog() {
  const [state, setState] = useState<DialogState>({ visible: false, title: '', tone: 'info', buttons: [] });

  const showDialog = useCallback((
    title: string,
    message?: string,
    opts: { tone?: AndiDialogTone; buttons?: AndiDialogButton[] } = {},
  ) => {
    const buttons = opts.buttons?.length ? opts.buttons : [{ text: 'OK' }];
    setState({
      visible: true,
      title,
      message,
      tone: opts.tone ?? 'info',
      buttons: buttons.map((b) => ({
        ...b,
        onPress: () => {
          // Se conserva el contenido para que no parpadee durante el fade.
          setState((s) => ({ ...s, visible: false }));
          b.onPress?.();
        },
      })),
    });
  }, []);

  const dialog = (
    <AndiDialog
      visible={state.visible}
      tone={state.tone}
      title={state.title}
      message={state.message}
      buttons={state.buttons}
    />
  );

  return { showDialog, dialog };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(14,20,22,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: ANDI_SPACING.s6,
  },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: ANDI_COLORS.surface, borderRadius: ANDI_RADIUS.xl,
    padding: ANDI_SPACING.s6, ...ANDI_SHADOWS.el4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: ANDI_SPACING.s3 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  title: { flex: 1, ...ANDI_TYPE.section, color: ANDI_COLORS.onSurface },
  close: { fontSize: 20, color: ANDI_COLORS.onSurfaceVariant, padding: 4 },
  message: { ...ANDI_TYPE.body, color: ANDI_COLORS.onSurfaceVariant, marginTop: ANDI_SPACING.s3 },
  actions: { flexDirection: 'row', gap: ANDI_SPACING.s2, marginTop: ANDI_SPACING.s5 },
  btn: {
    flex: 1, minHeight: 48, paddingHorizontal: ANDI_SPACING.s3,
    borderRadius: ANDI_RADIUS.full, alignItems: 'center', justifyContent: 'center',
  },
  primary: { backgroundColor: ANDI_COLORS.primary600 },
  danger: { backgroundColor: ANDI_COLORS.error },
  outline: { borderWidth: 1, borderColor: ANDI_COLORS.outline },
  outlineText: { color: ANDI_COLORS.onSurface, fontWeight: '600', textAlign: 'center' },
  solidText: { color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
