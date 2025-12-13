/**
 * useResponsive Hook
 *
 * Re-exports design tokens from the central theme.
 * Kept for backwards compatibility - prefer importing directly from '@/shared/theme'.
 */

// Re-export scale functions from theme (single source of truth)
export {
  scale,
  wp,
  hp,
  verticalScale,
  moderateScale,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
} from '@/shared/theme';

// Re-export token objects
export { spacing, layout, radius, elevation } from '@/shared/theme';
export { colors } from '@/shared/theme';
export { typography, fontSize } from '@/shared/theme';
export { sizes, coverSizes, iconSizes } from '@/shared/theme';
export { formatDuration, formatProgress } from '@/shared/theme';

// Import for hook return
import {
  scale,
  wp,
  hp,
  verticalScale,
  moderateScale,
  spacing,
  layout,
  radius,
  colors,
  typography,
  sizes,
  formatDuration,
  formatProgress,
} from '@/shared/theme';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =============================================================================
// LEGACY COMPATIBILITY EXPORTS
// =============================================================================

/**
 * @deprecated Use `layout` from '@/shared/theme' instead
 * Kept for backwards compatibility during migration
 */
export const LAYOUT = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  homeDiscRatio: layout.homeDiscRatio,
  playerDiscRatio: layout.playerDiscRatio,
  discHoleRatio: layout.discHoleRatio,
  horizontalPadding: layout.screenPaddingH / SCREEN_WIDTH,
  sectionGap: layout.sectionGap / SCREEN_WIDTH,
  itemGap: layout.itemGap / SCREEN_WIDTH,
  compactCard: layout.compactCardRatio,
  coverThumb: layout.coverThumbRatio,
  miniPlayerHeight: layout.miniPlayerHeight / SCREEN_HEIGHT,
  bottomNavHeight: layout.bottomNavHeight / SCREEN_HEIGHT,
  pillHeight: layout.pillHeight / SCREEN_WIDTH,
  pillBorderRadius: layout.pillBorderRadius / SCREEN_WIDTH,
  cardRadius: 0.08,
  coverRadius: 0.125,
  minTouchTarget: layout.minTouchTarget,
};

/**
 * @deprecated Use `sizes` from '@/shared/theme' instead
 */
export const DIMENSIONS = {
  homeDiscSize: wp(70),
  playerDiscSize: wp(95),
  horizontalPadding: layout.screenPaddingH,
  sectionGap: layout.sectionGap,
  itemGap: layout.itemGap,
  compactCardSize: sizes.coverCard,
  coverThumbSize: sizes.coverRow,
  miniPlayerHeight: layout.miniPlayerHeight,
  bottomNavHeight: layout.bottomNavHeight,
  pillHeight: layout.pillHeight,
  pillBorderRadius: layout.pillBorderRadius,
};

/**
 * @deprecated Use `typography` from '@/shared/theme' instead
 */
export const TYPOGRAPHY = {
  title: typography.headlineLarge.fontSize,
  subtitle: typography.headlineMedium.fontSize,
  sectionHeader: typography.bodyLarge.fontSize,
  body: typography.bodyMedium.fontSize,
  caption: typography.bodySmall.fontSize,
  small: typography.labelSmall.fontSize,
  tiny: typography.caption.fontSize,
};

/**
 * @deprecated Use `spacing` from '@/shared/theme' instead
 */
export const SPACING = {
  xs: wp(1),
  sm: wp(2),
  md: wp(3),
  lg: wp(4),
  xl: wp(5),
  xxl: wp(6),
};

/**
 * @deprecated Use `colors` from '@/shared/theme' instead
 */
export const COLORS = {
  accent: colors.accent,
  accentDark: colors.accentDark,
  background: colors.backgroundPrimary,
  cardBackground: colors.cardBackground,
  cardBackgroundHover: colors.cardBackgroundHover,
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
  textMuted: colors.textMuted,
  border: colors.border,
  borderLight: colors.borderLight,
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for responsive design utilities
 * @deprecated Prefer direct imports from '@/shared/theme' for tree-shaking
 */
export function useResponsive() {
  return {
    // Screen dimensions
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,

    // Scale functions
    scale,
    wp,
    hp,
    verticalScale,
    moderateScale,

    // Design tokens
    layout,
    spacing,
    radius,
    colors,
    typography,
    sizes,

    // Formatting utilities
    formatDuration,
    formatProgress,

    // Legacy exports (deprecated)
    dimensions: DIMENSIONS,
  };
}

export default useResponsive;
