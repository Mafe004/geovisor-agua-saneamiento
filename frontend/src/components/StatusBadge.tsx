import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Los estados/severidades son catálogos de la BD (ver domain.ts) -- las
// claves de este mapa son solo los valores conocidos hoy para darles un
// color/label bonito; un valor de catálogo nuevo cae en el fallback
// (SEVERITY_CONFIG.BAJA / STATUS_CONFIG.PENDIENTE) en vez de romper, así
// que se tipa con index signature en vez de una unión cerrada.
type BadgeConfigMap = Record<string, { bg: string; text: string; label: string; dot?: string }>;

const STATUS_CONFIG: BadgeConfigMap = {
  PENDIENTE:    { bg: '#FEF3C7', text: '#92400E', label: 'Pendiente',    dot: '#F59E0B' },
  EN_REVISION:  { bg: '#DBEAFE', text: '#1E40AF', label: 'En Revisión',  dot: '#3B82F6' },
  EN_PROCESO:   { bg: '#EDE9FE', text: '#5B21B6', label: 'En Proceso',   dot: '#8B5CF6' },
  RESUELTO:     { bg: '#D1FAE5', text: '#065F46', label: 'Resuelto',     dot: '#10B981' },
  RECHAZADO:    { bg: '#FEE2E2', text: '#991B1B', label: 'Rechazado',    dot: '#EF4444' },
  CERRADO:      { bg: '#F3F4F6', text: '#374151', label: 'Cerrado',      dot: '#6B7280' },
};

const SEVERITY_CONFIG: BadgeConfigMap = {
  BAJA:   { bg: '#D1FAE5', text: '#065F46', label: 'Baja'   },
  MEDIA:  { bg: '#FEF3C7', text: '#92400E', label: 'Media'  },
  ALTA:   { bg: '#FEE2E2', text: '#991B1B', label: 'Alta'   },
  CRITICA:{ bg: '#450A0A', text: '#FECACA', label: 'Crítica' },
};

interface StatusBadgeProps {
  status?: string;
  type?: 'status' | 'severity';
  size?: 'sm' | 'lg';
}

export default function StatusBadge({ status, type = 'status', size = 'sm' }: StatusBadgeProps) {
  // (status ?? '') en vez de status? -- mismo resultado: ninguna clave real
  // del mapa es "" ni "undefined", así que un status vacío/ausente sigue
  // cayendo en el mismo fallback que antes.
  // El `!` final es seguro: BAJA/PENDIENTE son claves fijas del propio
  // objeto literal (no vienen de un índice dinámico), pero como
  // BadgeConfigMap es un Record<string, ...> puro, noUncheckedIndexedAccess
  // igual las tipa como posiblemente undefined -- TS no distingue "clave
  // que sé que existe" de "clave calculada" dentro de un index signature.
  const config = (
    type === 'severity'
      ? SEVERITY_CONFIG[(status ?? '').toUpperCase()] || SEVERITY_CONFIG.BAJA
      : STATUS_CONFIG[(status ?? '').toUpperCase()] || STATUS_CONFIG.PENDIENTE
  )!;

  const isLg = size === 'lg';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isLg && styles.badgeLg]}>
      {type === 'status' && (
        <View style={[styles.dot, { backgroundColor: config.dot }]} />
      )}
      <Text style={[styles.label, { color: config.text }, isLg && styles.labelLg]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeLg: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelLg: {
    fontSize: 13,
  },
});
