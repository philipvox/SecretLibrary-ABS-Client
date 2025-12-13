/**
 * Design System - Central Theme Export
 *
 * Single source of truth for all design tokens.
 * Import from '@/shared/theme' for consistent styling.
 */

// Re-export all modules
export * from './colors';
export * from './spacing';
export * from './typography';
export * from './sizes';
export * from './animation';
export * from './formatting';

// Import for combined theme object
import { colors } from './colors';
import {
  spacing,
  layout,
  radius,
  elevation,
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
