/**
 * src/features/home/constants.ts
 *
 * @deprecated Import from '@/shared/theme' instead.
 * This file re-exports theme values for backward compatibility.
 */

import {
  colors,
  spacing as themeSpacing,
  layout,
  radius,
  animation,
  wp,
} from '@/shared/theme';

// Log deprecation warning in development
if (__DEV__) {
  console.warn(
    '[home/constants.ts] DEPRECATED: Import from "@/shared/theme" instead.'
  );
}

// =============================================================================
// SPACING - Re-exported from theme
// =============================================================================

export const SPACING = {
  screenPadding: layout.screenPaddingH,
  cardGap: themeSpacing.md,
  sectionGap: layout.sectionGap,
  componentGap: layout.componentGap,
};

// =============================================================================
// COLORS - Re-exported from theme
// =============================================================================

export const COLORS = colors;

// =============================================================================
// TYPOGRAPHY - Use typography from '@/shared/theme' instead
// =============================================================================

import { typography } from '@/shared/theme';

export const TYPOGRAPHY = {
  nowPlayingTitle: typography.displaySmall,
  nowPlayingChapter: typography.labelLarge,
  nowPlayingTime: typography.labelLarge,
  nowPlayingSpeed: typography.labelMedium,
  sectionTitle: typography.headlineLarge,
  sectionAction: typography.labelLarge,
  cardTitle: typography.labelMedium,
  cardSubtitle: typography.labelSmall,
  emptyTitle: typography.displayMedium,
  emptySubtitle: typography.bodyMedium,
};

// =============================================================================
// NOW PLAYING CARD
// =============================================================================

const SCREEN_WIDTH = wp(100);

export const NOW_PLAYING = {
  width: SCREEN_WIDTH - SPACING.screenPadding * 2,
  borderRadius: radius.lg,
  padding: themeSpacing.lg,
  coverMaxWidth: SCREEN_WIDTH - 80,
  coverAspectRatio: 1,
  coverBorderRadius: radius.md,
  coverShadowRadius: 20,
  coverShadowOpacity: 0.4,
  controlSize: layout.minTouchTarget,
  controlIconSize: 24,
  playButtonSize: 56,
  playIconSize: 28,
  controlGap: themeSpacing.xxl,
  headerHeight: 48,
  headerGap: themeSpacing.lg,
};

// =============================================================================
// SECTION HEADER
// =============================================================================

export const SECTION_HEADER = {
  paddingTop: themeSpacing.xxl,
  paddingBottom: themeSpacing.md,
  paddingHorizontal: SPACING.screenPadding,
};

// =============================================================================
// BOOK CARD
// =============================================================================

export const BOOK_CARD = {
  width: 120,
  coverAspectRatio: 1,
  coverBorderRadius: radius.sm,
  titleMaxLines: 2,
  titleMarginTop: themeSpacing.sm,
  heartBadgeSize: 22,
  heartBadgeOffset: themeSpacing.sm,
};

// =============================================================================
// SERIES CARD
// =============================================================================

export const SERIES_CARD = {
  width: 130,
  coverSize: 55,
  coverOverlap: themeSpacing.md,
  coverBorderRadius: radius.sm,
  outerBorderRadius: radius.sm,
  titleMaxLines: 2,
  titleMarginTop: themeSpacing.sm,
};

// =============================================================================
// CAROUSEL
// =============================================================================

export const CAROUSEL = {
  gap: SPACING.cardGap,
  contentPadding: SPACING.screenPadding,
  initialNumToRender: 5,
  maxToRenderPerBatch: 10,
  windowSize: 5,
};

// =============================================================================
// EMPTY STATE
// =============================================================================

export const EMPTY_STATE = {
  iconSize: 64,
  gap: themeSpacing.lg,
  maxWidth: 280,
};

// =============================================================================
// LOADING
// =============================================================================

export const LOADING = {
  indicatorSize: 'large' as const,
  indicatorColor: colors.accent,
};

// =============================================================================
// ANIMATIONS
// =============================================================================

export const ANIMATIONS = animation;
