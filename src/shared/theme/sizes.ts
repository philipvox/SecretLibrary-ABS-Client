/**
 * Size design tokens
 * Standardized component dimensions for consistency
 */

import { wp, hp } from './spacing';

// =============================================================================
// COVER IMAGE SIZES
// =============================================================================

/** Standardized cover image sizes */
export const coverSizes = {
  /** Hero section, full player (50% screen width) */
  hero: wp(50),
  /** Standard card cover (24% screen width, ~96px) */
  card: wp(24),
  /** Row item cover (12% screen width, ~48px) */
  row: wp(12),
  /** Mini player cover (6% screen height, ~52px) */
  mini: hp(6),
} as const;

// =============================================================================
// ICON SIZES
// =============================================================================

/** Icon size scale */
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 40,
} as const;

// =============================================================================
// BUTTON SIZES
// =============================================================================

/** Button height scale */
export const buttonSizes = {
  sm: 36,
  md: 44,  // Minimum touch target
  lg: 56,
} as const;

// =============================================================================
// PROGRESS INDICATOR SIZES
// =============================================================================

/** Progress bar heights */
export const progressSizes = {
  /** Mini player progress (very thin) */
  mini: hp(0.3),
  /** Standard progress bar */
  standard: 4,
  /** Large progress bar (player scrubber) */
  large: 8,
} as const;

// =============================================================================
// COMBINED SIZES EXPORT
// =============================================================================

/** All size tokens combined */
export const sizes = {
  // Covers
  coverHero: coverSizes.hero,
  coverCard: coverSizes.card,
  coverRow: coverSizes.row,
  coverMini: coverSizes.mini,

  // Icons
  iconXs: iconSizes.xs,
  iconSm: iconSizes.sm,
  iconMd: iconSizes.md,
  iconLg: iconSizes.lg,
  iconXl: iconSizes.xl,
  iconXxl: iconSizes.xxl,

  // Buttons
  buttonSm: buttonSizes.sm,
  buttonMd: buttonSizes.md,
  buttonLg: buttonSizes.lg,

  // Progress
  progressHeightMini: progressSizes.mini,
  progressHeightStandard: progressSizes.standard,
  progressHeightLarge: progressSizes.large,

  // Avatar sizes
  avatarSm: 36,
  avatarMd: 48,
  avatarLg: 64,
} as const;

// =============================================================================
// CARD TOKENS
// =============================================================================

/** Standardized card sizes and patterns */
export const cardTokens = {
  /** Cover sizes by context */
  cover: {
    listRow: 56,     // Compact list rows
    preview: 100,    // Card previews with info
    grid: 120,       // Grid view cards
    hero: 200,       // Featured/hero cards
  },

  /** Avatar sizes by context */
  avatar: {
    listRow: 48,
    preview: 64,
    hero: 96,
  },

  /** Stacked covers for series/collections */
  stackedCovers: {
    count: 3,         // Max covers to show
    offset: 12,       // Pixel offset between covers
    size: 40,         // Size of each cover in stack
    sizeSmall: 32,    // Compact variant
    sizeLarge: 56,    // Large variant
  },

  /** Progress dots */
  progressDots: {
    size: 6,
    gap: 4,
    maxDots: 5,
  },

  /** Row heights */
  rowHeight: {
    compact: 64,      // Single line with cover
    standard: 80,     // Two lines with cover
    expanded: 100,    // Three lines or extra info
  },

  /** Card aspect ratios (width:height) */
  aspectRatio: {
    book: 0.67,       // 2:3 portrait
    square: 1,        // 1:1 square
    wide: 1.5,        // 3:2 landscape
  },
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Sizes = typeof sizes;
export type SizeKey = keyof typeof sizes;
export type CoverSizeKey = keyof typeof coverSizes;
export type IconSizeKey = keyof typeof iconSizes;
export type CardTokens = typeof cardTokens;
