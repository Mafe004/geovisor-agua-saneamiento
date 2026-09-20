import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ANDI_COLORS, ANDI_RADIUS, ANDI_SPACING, ANDI_TYPE } from '../../theme/andi';

type Tone = 'warning' | 'error' | 'info' | 'success';

const TONES: Record<Tone, { bg: string; border: string; iconBg: string; fg: string }> = {
  warning: { bg: ANDI_COLORS.warningContainer, border: ANDI_COLORS.warning, iconBg: ANDI_COLORS.warning, fg: ANDI_COLORS.onWarningContainer },
  error: { bg: ANDI_COLORS.errorContainer, border: ANDI_COLORS.error, iconBg: ANDI_COLORS.error, fg: ANDI_COLORS.onErrorContainer },
  info: { bg: ANDI_COLORS.infoContainer, border: ANDI_COLORS.info, iconBg: ANDI_COLORS.info, fg: ANDI_COLORS.onInfoContainer },
  success: { bg: ANDI_COLORS.successContainer, border: ANDI_COLORS.success, iconBg: ANDI_COLORS.success, fg: ANDI_COLORS.onSuccessContainer },
};

interface SystemBannerProps {
  tone?: Tone;
  icon: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SystemBanner({ tone = 'info', icon, title, message, actionLabel, onAction }: SystemBannerProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.iconBg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: t.fg }]}>{title}</Text>
        {!!message && <Text style={[styles.message, { color: t.fg }]}>{message}</Text>}
        {!!actionLabel && (
          <TouchableOpacity style={[styles.actionBtn, { borderColor: t.border }]} onPress={onAction} activeOpacity={0.8}>
            <Text style={[styles.actionText, { color: t.fg }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: ANDI_SPACING.s3,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: ANDI_RADIUS.lg,
    padding: ANDI_SPACING.s3,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 15, color: '#fff' },
  content: { flex: 1 },
  title: { ...ANDI_TYPE.label },
  message: { ...ANDI_TYPE.caption, marginTop: 2 },
  actionBtn: {
    marginTop: ANDI_SPACING.s2, alignSelf: 'flex-start',
    minHeight: 40, paddingHorizontal: ANDI_SPACING.s4,
    borderRadius: ANDI_RADIUS.full, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: ANDI_COLORS.surface,
  },
  actionText: { ...ANDI_TYPE.label, fontSize: 12 },
});
