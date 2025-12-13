/**
 * @deprecated This file is deprecated. Import from '@/shared/theme' instead.
 *
 * This file now re-exports from the central theme for backwards compatibility.
 * Migration guide:
 *   BEFORE: import { COLORS, DIMENSIONS } from './homeDesign';
 *   AFTER:  import { colors, layout, scale } from '@/shared/theme';
 */

import {
  colors,
  layout,
  radius,
  elevation,
  typography,
  scale,
  wp,
  hp,
} from '@/shared/theme';

// Log deprecation warning in development
if (__DEV__) {
  console.warn(
    '[homeDesign] This file is deprecated. Import from "@/shared/theme" instead.\n' +
    'Migration: COLORS → colors, DIMENSIONS → layout/scale(), TYPOGRAPHY → typography'
  );
}

// =============================================================================
// DEPRECATED EXPORTS - Mapped to new theme
// =============================================================================

/**
 * @deprecated Use `colors` from '@/shared/theme' instead
 */
export const COLORS = {
  background: colors.backgroundPrimary,
  controlButtonBg: colors.backgroundElevated,
  cardOverlay: colors.overlay.light,
  playButton: colors.accent,
  heart: colors.heartFill,
  sleepTimerRed: colors.sleepTimer,
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
  glassWhite: colors.glass.white,
  glassBorder: colors.glass.border,
  gradientTop: 'rgba(0, 0, 0, 0)',
  gradientMiddle: 'rgba(0, 0, 0, 0.8)',
  gradientBottom: colors.backgroundPrimary,
} as const;

/**
 * @deprecated Use `layout` ratios or `scale()` from '@/shared/theme' instead
 */
export const PROPORTIONS = {
  nowPlayingWidth: 358 / 402,
  nowPlayingAspectRatio: 422 / 358,
  skipButtonSize: 53 / 402,
  playButtonSize: 78 / 402,
  bookCardWidth: 125 / 402,
  bookCardAspectRatio: 188 / 125,
  seriesCardWidth: 125 / 402,
  playlistCardWidth: 125 / 402,
  coverArtworkWidth: 226 / 358,
  coverArtworkAspectRatio: 226 / 226,
  cardRadius: 14 / 402,
  buttonRadius: 5.21 / 53,
  coverRadius: 8 / 402,
  controlButtonGap: 20 / 402,
  sectionGap: 24 / 402,
  carouselItemGap: 12 / 402,
} as const;

/**
 * @deprecated Use `scale()` from '@/shared/theme' for dimensions
 */
export const DIMENSIONS = {
  nowPlayingWidth: scale(358),
  nowPlayingHeight: scale(422),
  skipButtonSize: scale(53),
  skipButtonInnerSize: scale(56),
  playButtonSize: scale(78),
  playButtonInnerSize: scale(81),
  bookCardWidth: scale(125),
  bookCardHeight: scale(188),
  seriesCardWidth: scale(125),
  seriesCardHeight: scale(188),
  playlistCardWidth: scale(125),
  playlistCardHeight: scale(188),
  coverArtworkSize: scale(226),
  cardRadius: radius.card,
  buttonRadius: scale(5.21),
  coverRadius: radius.cover,
  smallRadius: radius.xs,
  controlButtonGap: scale(20),
  sectionGap: layout.sectionGap,
  carouselItemGap: layout.itemGap,
  screenPadding: layout.screenPaddingH,
  infoTileHeight: scale(40),
  heartBadgeSize: scale(24),
  progressBarHeight: scale(4),
} as const;

/**
 * @deprecated Use `typography` from '@/shared/theme' instead
 */
export const TYPOGRAPHY = {
  nowPlayingTitle: {
    fontSize: typography.displaySmall.fontSize,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  nowPlayingChapter: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '400' as const,
  },
  nowPlayingTime: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '500' as const,
    fontFamily: 'SpaceMono',
  },
  sectionTitle: {
    fontSize: typography.displaySmall.fontSize,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  viewAll: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '500' as const,
  },
  cardTitle: {
    fontSize: typography.labelMedium.fontSize,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: '400' as const,
  },
  sleepTimerText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600' as const,
  },
  speedText: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600' as const,
  },
} as const;

/**
 * @deprecated Use `elevation` from '@/shared/theme' instead
 */
export const SHADOWS = {
  card: elevation.large,
  button: elevation.medium,
  cover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  playButtonGlow: elevation.glow,
} as const;

/**
 * @deprecated Keep for glassmorphism effects, consider moving to theme
 */
export const GLASS_LAYERS = {
  base: {
    color: colors.backgroundElevated,
    opacity: 1,
  },
  topGradient: {
    colors: ['rgba(0, 0, 0, 0.2)', 'transparent'] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 0.3 },
  },
  bottomGradient: {
    colors: ['transparent', 'rgba(255, 255, 255, 0.2)'] as const,
    start: { x: 0.5, y: 0.7 },
    end: { x: 0.5, y: 1 },
  },
  cornerGradient: {
    colors: ['rgba(255, 255, 255, 0.1)', 'transparent'] as const,
    radius: 0.5,
  },
  border: {
    color: colors.glass.white,
    width: 0.5,
  },
} as const;

/**
 * SVG icon paths - no change needed, these are feature-specific
 */
export const ICON_PATHS = {
  play: 'M38.7003 43.493C38.7003 40.3412 42.1759 38.4276 44.8392 40.113L59.7278 49.5346C62.2092 51.1049 62.2092 54.7245 59.7278 56.2948L44.8392 65.7164C42.1759 67.4018 38.7003 65.4882 38.7003 62.3364V43.493Z',
  skipForward: {
    first:
      'M29.15 22.8357C29.15 21.1714 31.0641 20.2352 32.3779 21.2569L39.1716 26.541C40.2011 27.3417 40.2011 28.8977 39.1716 29.6984L32.3779 34.9824C31.0641 36.0042 29.15 35.068 29.15 33.4037L29.15 22.8357Z',
    second:
      'M14.4205 22.8357C14.4205 21.1714 16.3347 20.2352 17.6484 21.2569L24.4421 26.541C25.4716 27.3417 25.4716 28.8977 24.4421 29.6984L17.6484 34.9824C16.3347 36.0042 14.4205 35.068 14.4205 33.4037L14.4205 22.8357Z',
  },
  skipBackward: {
    first:
      'M24.9025 22.8357C24.9025 21.1714 22.9884 20.2352 21.6746 21.2569L14.8809 26.541C13.8514 27.3417 13.8514 28.8977 14.8809 29.6984L21.6746 34.9824C22.9884 36.0042 24.9025 35.068 24.9025 33.4037L24.9025 22.8357Z',
    second:
      'M39.632 22.8357C39.632 21.1714 37.7178 20.2352 36.4041 21.2569L29.6104 26.541C28.5809 27.3417 28.5809 28.8977 29.6104 29.6984L36.4041 34.9824C37.7178 36.0042 39.632 35.068 39.632 33.4037L39.632 22.8357Z',
  },
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
} as const;

/**
 * @deprecated Use `animation.duration` from '@/shared/theme' instead
 */
export const ANIMATION = {
  buttonScale: {
    pressed: 0.95,
    duration: 100,
  },
  progressTransition: {
    duration: 300,
  },
  cardTransition: {
    duration: 200,
  },
} as const;

/**
 * @deprecated Use `layout` from '@/shared/theme' instead
 */
export const LAYOUT = {
  tabBarHeight: layout.bottomNavHeight,
  tabBarPadding: scale(34),
  bottomGradientHeight: scale(120),
  nowPlayingMarginTop: scale(20),
  nowPlayingMarginBottom: scale(32),
  sectionHeaderMarginTop: layout.sectionGap,
  sectionHeaderMarginBottom: layout.itemGap,
  carouselPaddingHorizontal: layout.screenPaddingH,
} as const;
