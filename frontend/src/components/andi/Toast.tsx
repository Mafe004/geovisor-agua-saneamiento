/**
 * Global toast system — replaces `Alert.alert()` for non-blocking notices
 * (validation errors, API errors, success confirmations). `Alert.alert` is
 * a documented no-op on react-native-web (no UI, callbacks never fire), so
 * every screen using it silently swallowed its own messages when run in a
 * browser. This renders a real banner on every platform instead.
 *
 * For a *blocking* yes/no confirmation (e.g. "¿Seguro que quieres salir?"),
 * use `confirmAsync` from `utils/confirmDialog.ts` instead — that one needs
 * to pause the caller for an answer, which a toast (fire-and-forget) can't.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.error('Error', 'No se pudo enviar el reporte.');
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { andiColors, andiRadius, andiSpace, andiType } from '../../theme/andi';
import { useResponsive } from '../../theme/responsive';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE: Record<ToastType, { bg: string; icon: keyof typeof Feather.glyphMap }> = {
  success: { bg: andiColors.success700, icon: 'check-circle' },
  error: { bg: andiColors.error700, icon: 'alert-circle' },
  warning: { bg: andiColors.warning700, icon: 'alert-triangle' },
  info: { bg: andiColors.primary700, icon: 'info' },
};

// Errors stay up longer than a quick success acknowledgement — the user
// needs time to actually read what went wrong.
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3500,
  warning: 4500,
  error: 5500,
};

let idSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, title: string, message?: string) => {
    idSeq += 1;
    const id = idSeq;
    setToasts((prev) => [...prev, { id, type, title, message, duration: DEFAULT_DURATION[type] }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      warning: (title, message) => push('warning', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() debe usarse dentro de <ToastProvider> (ver App.js).');
  return ctx;
}

function ToastHost({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View style={[styles.host, { top: insets.top + andiSpace[3] }]} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const r = useResponsive();
  // useState con inicializador perezoso en vez de useRef(...).current -- el
  // valor sigue siendo estable entre renders, pero no dispara el lint del
  // React Compiler "Cannot access refs during render" (el mismo que ya
  // tienen Skeleton.tsx/AndiSkeletonCard.tsx por este mismo patrón con
  // useRef, sin corregir ahí).
  const [translateY] = useState(() => new Animated.Value(-24));
  const [opacity] = useState(() => new Animated.Value(0));
  const tone = TONE[toast.type];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(onDismiss);
    }, toast.duration);
    return () => clearTimeout(timer);
    // Mount-only animation + auto-dismiss timer; `toast`/`onDismiss` are
    // stable for this card's lifetime (keyed by id, never re-rendered with
    // new props).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: tone.bg, opacity, transform: [{ translateY }] }]}
    >
      <TouchableOpacity
        style={styles.cardInner}
        activeOpacity={0.9}
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.title}${toast.message ? '. ' + toast.message : ''}. Toca para cerrar.`}
      >
        <Feather name={tone.icon} size={20} color={andiColors.n0} style={styles.icon} />
        <View style={styles.textWrap}>
          <Text style={[andiType.label, { color: andiColors.n0, fontSize: r.scaleFont(14) }]}>
            {toast.title}
          </Text>
          {!!toast.message && (
            <Text
              style={[andiType.body, { color: andiColors.n0, fontSize: r.scaleFont(13) }]}
              numberOfLines={3}
            >
              {toast.message}
            </Text>
          )}
        </View>
        <Feather name="x" size={18} color={andiColors.n0} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: andiSpace[4],
    right: andiSpace[4],
    zIndex: 9999,
    gap: andiSpace[2],
  },
  card: {
    borderRadius: andiRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: andiSpace[3],
    paddingVertical: andiSpace[3],
    paddingHorizontal: andiSpace[4],
    minHeight: 48,
  },
  icon: { marginTop: 2 },
  textWrap: { flex: 1, gap: 2 },
});
