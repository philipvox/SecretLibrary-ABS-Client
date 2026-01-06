/**
 * Icon component wrapper for consistent icon usage
 * Uses Lucide icons as the primary icon set
 *
 * Supports two size modes:
 * 1. Named sizes: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' (responsive via scale())
 * 2. Numeric sizes: any number (for legacy/custom usage)
 *
 * Named size mapping (scaled for responsiveness):
 * - xs:  scale(12) - tiny icons (badges, indicators)
 * - sm:  scale(16) - small icons (inline text, secondary actions)
 * - md:  scale(20) - default (buttons, list items)
 * - lg:  scale(24) - large (primary actions, headers)
 * - xl:  scale(32) - extra large (feature icons)
 * - xxl: scale(48) - huge (empty states, hero sections)
 *
 * Color defaults to theme-aware text color if not provided.
 */

import React from 'react';
import * as LucideIcons from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { scale } from '@/shared/theme';
import { useThemeColors } from '@/shared/theme/themeStore';

/** Standard icon size names */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** Responsive size mapping */
const SIZE_MAP: Record<IconSize, number> = {
  xs: scale(12),
  sm: scale(16),
  md: scale(20),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
};

interface IconProps {
  /** Lucide icon name */
  name: keyof typeof LucideIcons | string;
  /** Size - named ('sm', 'md', 'lg', etc.) or numeric for custom sizes */
  size?: IconSize | number;
  color?: string;
  strokeWidth?: number;
  /** @deprecated Icon set is ignored - all icons are Lucide */
  set?: string;
}

/**
 * Resolve size to numeric value
 * Supports both named sizes and raw numbers for backward compatibility
 */
function resolveSize(size: IconSize | number): number {
  if (typeof size === 'string') {
    return SIZE_MAP[size] ?? SIZE_MAP.md;
  }
  return size;
}

export function Icon({
  name,
  size = 'md',
  color,
  strokeWidth = 2,
}: IconProps) {
  const themeColors = useThemeColors();
  const IconComponent = LucideIcons[name as keyof typeof LucideIcons] as LucideIcon;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Lucide icons`);
    return null;
  }

  const resolvedSize = resolveSize(size);
  // Use provided color or fall back to theme-aware text color
  const resolvedColor = color ?? themeColors.text;

  return <IconComponent size={resolvedSize} color={resolvedColor} strokeWidth={strokeWidth} />;
}

export { LucideIcons, SIZE_MAP as ICON_SIZES };
export type { LucideIcon };