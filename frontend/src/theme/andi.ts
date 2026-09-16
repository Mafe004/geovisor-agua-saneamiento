/**
 * Design tokens for the "Andi" visual system — ported 1:1 from the
 * `[data-andi]` scope in the Claude Design canvas "Andi - Moderador.dc.html"
 * (project "Product scope and visual system"). Used only by the Moderador
 * and Entidad screens; every other role keeps the app's existing blue theme
 * (see theme/colors.ts) — the canvas itself only redesigns these two roles.
 *
 * Values are copied verbatim from the canvas's CSS custom properties (light
 * theme only — the canvas also defines a dark variant, but the app has no
 * theme toggle today, so it's not wired here). Never hand-tune a value here
 * without checking it still matches the canvas.
 */
import type { TextStyle } from 'react-native';

export const andiColors = {
  primary50: '#E6F7F8', primary100: '#C2EAEC', primary200: '#8FD6DA', primary300: '#56BFC5',
  primary400: '#1FA5AD', primary500: '#0E8B95', primary600: '#0A6F78', primary700: '#085862',
  primary800: '#06434A', primary900: '#042F34',

  accent50: '#FDF2EC', accent100: '#F8DDCC', accent300: '#E8A075', accent500: '#D2693A',
  accent600: '#B0562C', accent700: '#8C4322',

  n0: '#FFFFFF', n50: '#F7F9FA', n100: '#EEF2F4', n200: '#DEE5E8', n300: '#C2CCD1',
  n400: '#8E9CA3', n500: '#5C6B72', n600: '#3D4A50', n700: '#2A3438', n800: '#1A2125', n900: '#0E1416',

  success: '#1E7F4E', successContainer: '#D7F0E0', onSuccessContainer: '#0E4A2B',
  warning: '#B8861B', warningContainer: '#FBEFC9', onWarningContainer: '#5C4408',
  error: '#B23A2C', errorContainer: '#FCDCD7', onErrorContainer: '#5C1A12',
  info: '#1F6FB2', infoContainer: '#D6E8F7', onInfoContainer: '#0E3A5C',

  sevBaja: '#3FA34D', sevMedia: '#E8B022', sevAlta: '#E2691E',

  stPendBg: '#FBEFC9', stPendFg: '#5C4408', stPendBd: '#B8861B',
  stRevBg: '#D6E8F7', stRevFg: '#0E3A5C', stRevBd: '#1F6FB2',
  stProBg: '#C2EAEC', stProFg: '#042F34', stProBd: '#0A6F78',
  stResBg: '#D7F0E0', stResFg: '#0E4A2B', stResBd: '#1E7F4E',

  // Semantic aliases — same mapping as the canvas's [data-andi] light theme.
  primary: '#0A6F78',       // --primary: var(--primary-600)
  surface: '#FFFFFF',       // --surface: var(--n-0)
  surfaceDim: '#F7F9FA',    // --surface-dim / --surface-low: var(--n-50)
  surfaceMid: '#EEF2F4',    // --surface-mid: var(--n-100)
  outline: '#C2CCD1',       // --outline: var(--n-300)
  outlineVariant: '#DEE5E8',// --outline-variant: var(--n-200)
  onSurface: '#1A2125',     // --on-surface: var(--n-800)
  onSurfaceVariant: '#5C6B72', // --on-surface-variant: var(--n-500)
  mapGround: '#EEF2F4',     // --map-ground: var(--n-100)
  mapLine: '#FFFFFF',       // --map-line: var(--n-0)
} as const;

export const andiSpace = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

export const andiRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, full: 999,
} as const;

/** RN shadow props (iOS) + elevation (Android), tuned to match --el-1..4. */
export const andiElevation = {
  1: { shadowColor: '#042F34', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.13, shadowRadius: 3, elevation: 2 },
  2: { shadowColor: '#042F34', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 4 },
  3: { shadowColor: '#042F34', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8 },
  4: { shadowColor: '#042F34', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.21, shadowRadius: 20, elevation: 14 },
} as const;

/** --font: 'Inter' — falls back to the platform's default humanist sans since
 * this app doesn't load Inter/JetBrains Mono as custom fonts (out of scope
 * for a visual port: it would need expo-font + async load-gating on every
 * screen). Weights/sizes/line-heights below are copied exactly; only the
 * family is a system-font substitute. */
export const andiFont = 'System';
export const andiMono = 'monospace';

type Type = Pick<TextStyle, 'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'>;

/** Pure font shorthand — matches the canvas's --t-* vars exactly (weight/
 * size/line-height only). `overline` here is JUST the 10px/14 semibold font;
 * the uppercase + letter-spacing seen on section/stat labels in the canvas
 * is added per call-site via inline style (see andiOverlineDecor variants
 * below) — it's not baked into the --t-overline token itself. */
export const andiType: Record<
  'displayLg' | 'display' | 'screen' | 'section' | 'card' | 'bodyLg' | 'body' | 'caption' | 'label' | 'overline',
  Type
> = {
  displayLg: { fontFamily: andiFont, fontWeight: '700', fontSize: 36, lineHeight: 44 },
  display:   { fontFamily: andiFont, fontWeight: '700', fontSize: 28, lineHeight: 36 },
  screen:    { fontFamily: andiFont, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  section:   { fontFamily: andiFont, fontWeight: '600', fontSize: 18, lineHeight: 24 },
  card:      { fontFamily: andiFont, fontWeight: '600', fontSize: 16, lineHeight: 22 },
  bodyLg:    { fontFamily: andiFont, fontWeight: '400', fontSize: 16, lineHeight: 24 },
  body:      { fontFamily: andiFont, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  caption:   { fontFamily: andiFont, fontWeight: '400', fontSize: 12, lineHeight: 16 },
  label:     { fontFamily: andiFont, fontWeight: '600', fontSize: 14, lineHeight: 20 },
  overline:  { fontFamily: andiFont, fontWeight: '600', fontSize: 10, lineHeight: 14 },
};

/** Section/page overline decoration — `letter-spacing:1.5px` in the canvas
 * (e.g. "Bandeja · Zipaquirá"). Combine with andiType.overline. */
export const andiOverlineDecor: Pick<TextStyle, 'textTransform' | 'letterSpacing'> = {
  textTransform: 'uppercase', letterSpacing: 1.5,
};

/** Small stat-number-label decoration — `letter-spacing:.8px` in the canvas
 * (e.g. "Sin revisar" under a big number). Combine with andiType.overline. */
export const andiStatLabelDecor: Pick<TextStyle, 'textTransform' | 'letterSpacing'> = {
  textTransform: 'uppercase', letterSpacing: 0.8,
};

/** Status pill visuals — background / foreground / border / icon / label,
 * keyed by the estado_reporte catalog's `nombre` (see backend seed data). */
export const andiStatusPill: Record<string, { bg: string; fg: string; bd: string; icon: 'circle' | 'search' | 'refresh-cw' | 'check'; label: string }> = {
  PENDIENTE:   { bg: andiColors.stPendBg, fg: andiColors.stPendFg, bd: andiColors.stPendBd, icon: 'circle',     label: 'Pendiente' },
  EN_REVISION: { bg: andiColors.stRevBg,  fg: andiColors.stRevFg,  bd: andiColors.stRevBd,  icon: 'search',     label: 'En revisión' },
  EN_PROCESO:  { bg: andiColors.stProBg,  fg: andiColors.stProFg,  bd: andiColors.stProBd,  icon: 'refresh-cw', label: 'En proceso' },
  RESUELTO:    { bg: andiColors.stResBg,  fg: andiColors.stResFg,  bd: andiColors.stResBd,  icon: 'check',      label: 'Resuelto' },
};

/** Severity dot color, keyed by the severidad catalog's `nombre`. */
export const andiSeverityColor: Record<string, string> = {
  BAJA: andiColors.sevBaja,
  MEDIA: andiColors.sevMedia,
  ALTA: andiColors.sevAlta,
  CRITICA: andiColors.sevAlta,
};
