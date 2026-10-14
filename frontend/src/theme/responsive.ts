import { useMemo } from 'react';
import { useWindowDimensions, type TextStyle } from 'react-native';

/**
 * Baseline: iPhone SE (2nd/3rd gen, 375×667) — the smallest common target
 * and the size every screen in this app was originally laid out against.
 * Scale factors are 1 at this size and grow/shrink from there, so existing
 * spacing/token values stay correct on an SE and adapt on every other size.
 */
const BASE_WIDTH = 375;
const BASE_HEIGHT = 667;

export const BREAKPOINTS = {
  small: 360, // iPhone SE width class / compact Android
  large: 430, // iPhone Pro Max width class / large Android
  tablet: 768,
} as const;

export interface Responsive {
  width: number;
  height: number;
  isSmallDevice: boolean;
  isLargeDevice: boolean;
  isTablet: boolean;
  /** Scales a horizontal size (widths, horizontal padding/margin) against the baseline width. */
  scaleWidth: (size: number) => number;
  /** Scales a vertical size (heights, vertical padding/margin) against the baseline height. */
  scaleHeight: (size: number) => number;
  /**
   * Scales a font size moderately (damped to 30% of the width-scale delta)
   * so text grows/shrinks more gently than raw layout -- a big phone should
   * read bigger, not literally proportionally bigger. The width scale is
   * capped at the largest phone class, so tablets and web don't keep growing.
   */
  scaleFont: (size: number) => number;
  /**
   * Scales a type token's `fontSize` and its `lineHeight` together. Use this
   * instead of spreading a token and overriding only `fontSize` -- a bigger
   * font on the token's original lineHeight makes lines overlap.
   */
  scaleType: (style: TextStyle) => TextStyle;
  /** Caps a value so content doesn't stretch edge-to-edge on tablets (e.g. a login card, a form). */
  maxContentWidth: (cap?: number) => number;
}

/** Font scaling stops growing past the large-phone width class (430/375 ≈ 1.15). */
const MAX_FONT_WIDTH_SCALE = BREAKPOINTS.large / BASE_WIDTH;

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  // Memoized on the window size so the `useMemo(() => makeStyles(r), [r])`
  // calls in screens only rebuild styles when the window actually changes.
  return useMemo(() => makeResponsive(width, height), [width, height]);
}

function makeResponsive(width: number, height: number): Responsive {
  const widthScale = width / BASE_WIDTH;
  const heightScale = height / BASE_HEIGHT;
  const fontWidthScale = Math.min(widthScale, MAX_FONT_WIDTH_SCALE);

  const scaleWidth = (size: number) => Math.round(size * widthScale);
  const scaleHeight = (size: number) => Math.round(size * heightScale);
  const scaleFont = (size: number) => Math.round(size + (fontWidthScale - 1) * size * 0.3);
  const scaleType = (style: TextStyle): TextStyle => {
    const { fontSize, lineHeight } = style;
    if (typeof fontSize !== 'number') return style;
    const scaled = scaleFont(fontSize);
    return {
      ...style,
      fontSize: scaled,
      lineHeight: typeof lineHeight === 'number' ? Math.round(lineHeight * (scaled / fontSize)) : lineHeight,
    };
  };
  const maxContentWidth = (cap = 480) => Math.min(width, cap);

  return {
    width,
    height,
    isSmallDevice: width < BREAKPOINTS.small,
    isLargeDevice: width >= BREAKPOINTS.large && width < BREAKPOINTS.tablet,
    isTablet: width >= BREAKPOINTS.tablet,
    scaleWidth,
    scaleHeight,
    scaleFont,
    scaleType,
    maxContentWidth,
  };
}

/**
 * Scales every `fontSize` (and proportionally its `lineHeight`) in a design
 * token map -- e.g. `andiType` / `ANDI_TYPE` from theme/andi.ts -- so a
 * screen can keep writing `andiType.body` etc. unchanged and just shadow the
 * import with the scaled version:
 *
 *   import { andiType as andiTypeBase } from '../../theme/andi';
 *   import { useScaledType } from '../../theme/responsive';
 *   const andiType = useScaledType(andiTypeBase);
 *
 * Every existing `andiType.xxx` reference in the file then scales for free,
 * with no per-usage edits.
 */
export function useScaledType<T extends Record<string, TextStyle>>(type: T): T {
  const { scaleType } = useResponsive();
  return useMemo(() => {
    const out = {} as T;
    for (const key of Object.keys(type) as (keyof T)[]) {
      out[key] = scaleType(type[key]!) as T[keyof T];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `type` is a module-level constant (andiType/ANDI_TYPE); only scaleType (derived from window width) should retrigger this.
  }, [scaleType]);
}
