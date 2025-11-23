/**
 * Spacing design tokens - More generous spacing for airy feel
 */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

export const layout = {
  // Screen padding - more generous
  screenHorizontal: 20,
  screenVertical: 24,
  
  // Card padding
  cardPadding: 20,
  cardPaddingSmall: 16,
  cardPaddingLarge: 24,
  
  // Section spacing - more breathing room
  sectionGap: 32,
  componentGap: 20,
  itemGap: 16,
  tightGap: 12,
  
  minTouchTarget: 44,
  maxContentWidth: 600,
  
  iconSmall: 20,
  iconMedium: 24,
  iconLarge: 32,
  iconXLarge: 48,
} as const;

// Border Radius - More rounded for softer feel
export const radius = {
  none: 0,
  small: 6,
  medium: 12,
  large: 16,
  xlarge: 20,
  xxlarge: 28,
  full: 9999,
} as const;

// Softer shadows
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#2A241E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#2A241E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#2A241E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;
export type ElevationKey = keyof typeof elevation;