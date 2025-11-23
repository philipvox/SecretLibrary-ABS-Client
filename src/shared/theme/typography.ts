/**
 * Typography design tokens
 * 
 * Font scale and text styles for consistent typography
 */

import { TextStyle } from 'react-native';

// Font Sizes
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 36,
  '6xl': 48,
} as const;

// Font Weights
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Line Heights (1.4-1.6 for readability)
export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.6,
} as const;

// Text Styles (pre-composed styles for common use cases)
export const textStyles: Record<string, TextStyle> = {
  // Display (largest)
  displayLarge: {
    fontSize: fontSize['6xl'],
    lineHeight: fontSize['6xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  displayMedium: {
    fontSize: fontSize['5xl'],
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  displaySmall: {
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },

  // Headings
  h1: {
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h2: {
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.normal,
    fontWeight: fontWeight.bold,
  },
  h3: {
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.normal,
    fontWeight: fontWeight.semibold,
  },
  h4: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.normal,
    fontWeight: fontWeight.semibold,
  },

  // Body text
  bodyLarge: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.relaxed,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
    fontWeight: fontWeight.regular,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },

  // Labels and UI text
  label: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    fontWeight: fontWeight.medium,
  },
  labelSmall: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    fontWeight: fontWeight.medium,
  },

  // Captions
  caption: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    fontWeight: fontWeight.regular,
  },

  // Buttons
  button: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.tight,
    fontWeight: fontWeight.semibold,
  },
  buttonSmall: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.tight,
    fontWeight: fontWeight.semibold,
  },
  buttonLarge: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.tight,
    fontWeight: fontWeight.semibold,
  },
} as const;

// Type exports
export type FontSizeKey = keyof typeof fontSize;
export type FontWeightKey = keyof typeof fontWeight;
export type TextStyleKey = keyof typeof textStyles;