/**
 * Design System - Central Theme Export
 *
 * Single source of truth for all design tokens.
 * Import from '@/shared/theme' for consistent styling.
 *
 * Primary Usage:
 *   import { useTheme, useColors } from '@/shared/theme';
 *   const { colors, mode, toggleMode } = useTheme();
 */

// Theme hooks (primary API)
// Import for combined theme object
import { colors } from './colors';
import {
  spacing,
  layout,
  radius,
  elevation,
  interactiveStates,
  scale,
  wp,
  hp,
  verticalScale,
  moderateScale,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
} from './spacing';
import { typography, fontSize, fontWeight, lineHeight } from './typography';
import { sizes, coverSizes, iconSizes, buttonSizes, progressSizes, cardTokens } from './sizes';
import { animation, duration, spring, easing } from './animation';
import { formatDuration, formatProgress, separators } from './formatting';

export {
  useTheme,
  useColors,
  useThemeMode,
  useThemeStore,
  useIsDarkMode,
  useThemeColors, // deprecated
  themeColors, // deprecated
  type ThemeMode,
  type AccentTheme,
} from './themeStore';

// Color tokens
export {
  lightColors,
  darkColors,
  accentColors,
  accentThemes,
  themePresets,
  getThemeColors,
  colors, // deprecated legacy export
  ACCENT, // Static accent color for StyleSheet usage at module level
  type ThemeColors,
  type LightColors,
  type DarkColors,
} from './colors';

// Re-export all other modules
export * from './spacing';
export * from './typography';
export * from './sizes';
export * from './animation';
export * from './formatting';

// Secret Library design system
export * from './secretLibrary';

/**
 * Combined theme object for convenient access
 * Use destructured imports for tree-shaking: `import { colors, spacing } from '@/shared/theme'`
 */
export const theme = {
  colors,
  spacing,
  layout,
  radius,
  elevation,
  interactiveStates,
  typography,
  fontSize,
  fontWeight,
  lineHeight,
  sizes,
  coverSizes,
  iconSizes,
  buttonSizes,
  progressSizes,
  cardTokens,
  animation,
  duration,
  spring,
  easing,
  formatDuration,
  formatProgress,
  separators,
  // Scale functions
  scale,
  wp,
  hp,
  verticalScale,
  moderateScale,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
} as const;

export type Theme = typeof theme;

export default theme;
