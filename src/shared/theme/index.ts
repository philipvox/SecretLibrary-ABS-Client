/**
 * Central theme export
 * 
 * Combines all design tokens into a single theme object
 */

import { colors } from './colors';
import { spacing, layout, radius, elevation } from './spacing';
import { fontSize, fontWeight, lineHeight, textStyles } from './typography';

export const theme = {
  colors,
  spacing,
  layout,
  radius,
  elevation,
  fontSize,
  fontWeight,
  lineHeight,
  textStyles,
} as const;

// Re-export individual modules for direct imports
export * from './colors';
export * from './spacing';
export * from './typography';

// Export type
export type Theme = typeof theme;

// Default export
export default theme;