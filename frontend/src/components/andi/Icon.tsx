import React from 'react';
import { Feather } from '@expo/vector-icons';
import { andiColors } from '../../theme/andi';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 };

type Props = {
  name: keyof typeof Feather.glyphMap;
  /** 'sm'=16, 'md'=20, 'lg'=24 (default 'md'), o un número exacto. */
  size?: IconSize | number;
  color?: string;
};

/**
 * Wrapper único de Feather para toda la app -- ver Fase 2 de la auditoría
 * frontend: antes había caracteres sueltos (✕ ← → ✓ ● ⌕ ↻ ◍ ⚿ ◔) usados
 * como icono en vez de un icon-font real, con riesgo de glifo faltante en
 * fuentes de sistema más viejas y sin un tamaño/color consistente entre
 * pantallas.
 */
export default function Icon({ name, size = 'md', color = andiColors.onSurface }: Props) {
  const resolved = typeof size === 'number' ? size : SIZE[size];
  return <Feather name={name} size={resolved} color={color} />;
}
