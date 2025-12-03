/**
 * src/features/home/constants.ts
 *
 * Design tokens and configuration for the Home screen
 * Based on Figma mockups
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =============================================================================
// SPACING
// =============================================================================

export const SPACING = {
  screenPadding: 16,
  cardGap: 12,
  sectionGap: 24,
  componentGap: 8,
};

// =============================================================================
// COLORS
// =============================================================================

export const COLORS = {
  // Background
  background: '#000000',
  cardBackground: 'rgba(255, 255, 255, 0.08)',
  cardBackgroundHover: 'rgba(255, 255, 255, 0.12)',

  // Accent (lime green from design)
  accent: '#CCFF00',
  accentDark: '#99CC00',
  accentDim: 'rgba(204, 255, 0, 0.3)',

  // Heart/Favorite
  heartFill: '#4ADE80',
  heartOutline: 'rgba(255, 255, 255, 0.5)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textTertiary: 'rgba(255, 255, 255, 0.5)',
  textMuted: 'rgba(255, 255, 255, 0.3)',

  // Controls
  controlBackground: 'rgba(255, 255, 255, 0.1)',
  controlBackgroundActive: 'rgba(255, 255, 255, 0.15)',

  // Sleep timer (red from design)
  sleepTimer: '#FF6B6B',

  // Borders
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const TYPOGRAPHY = {
  // Now Playing Card
  nowPlayingTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  nowPlayingChapter: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  nowPlayingTime: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '500' as const,
  },
  nowPlayingSpeed: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '400' as const,
  },

  // Section headers
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '500' as const,
  },

  // Card titles
  cardTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 14,
  },

  // Empty state
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
};

// =============================================================================
// NOW PLAYING CARD
// =============================================================================

export const NOW_PLAYING = {
  width: SCREEN_WIDTH - SPACING.screenPadding * 2,
  borderRadius: 16,
  padding: 16,

  // Cover image
  coverMaxWidth: SCREEN_WIDTH - 80,
  coverAspectRatio: 1, // Square
  coverBorderRadius: 12,
  coverShadowRadius: 20,
  coverShadowOpacity: 0.4,

  // Controls
  controlSize: 44,
  controlIconSize: 24,
  playButtonSize: 56,
  playIconSize: 28,
  controlGap: 24,

  // Header layout
  headerHeight: 48,
  headerGap: 16,
};

// =============================================================================
// SECTION HEADER
// =============================================================================

export const SECTION_HEADER = {
  paddingTop: 24,
  paddingBottom: 12,
  paddingHorizontal: SPACING.screenPadding,
};

// =============================================================================
// BOOK CARD
// =============================================================================

export const BOOK_CARD = {
  width: 120,
  coverAspectRatio: 1, // Square audiobook covers
  coverBorderRadius: 8,
  titleMaxLines: 2,
  titleMarginTop: 8,
  heartBadgeSize: 22,
  heartBadgeOffset: 8,
};

// =============================================================================
// SERIES CARD
// =============================================================================

export const SERIES_CARD = {
  width: 130,
  coverSize: 55,
  coverOverlap: 12,
  coverBorderRadius: 6,
  outerBorderRadius: 8,
  titleMaxLines: 2,
  titleMarginTop: 8,
};

// =============================================================================
// PLAYLIST CARD
// =============================================================================

export const PLAYLIST_CARD = {
  width: 140,
  gridSize: 2, // 2x2 grid
  gridGap: 4,
  coverBorderRadius: 4,
  outerBorderRadius: 8,
  titleMaxLines: 2,
  titleMarginTop: 8,
};

// =============================================================================
// HEART BADGE
// =============================================================================

export const HEART_BADGE = {
  size: 22,
  iconSize: 14,
  offset: 8,
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
// BOTTOM GRADIENT
// =============================================================================

export const BOTTOM_GRADIENT = {
  height: 200,
  colors: ['transparent', 'rgba(0,0,0,0.8)', '#000000'] as const,
  locations: [0, 0.5, 1] as const,
};

// =============================================================================
// TAB BAR (for spacing reference)
// =============================================================================

export const TAB_BAR = {
  height: 80,
  bottomPadding: 100, // Extra space for content to scroll above tab bar
};

// =============================================================================
// EMPTY STATE
// =============================================================================

export const EMPTY_STATE = {
  iconSize: 64,
  gap: 16,
  maxWidth: 280,
};

// =============================================================================
// LOADING
// =============================================================================

export const LOADING = {
  indicatorSize: 'large' as const,
  indicatorColor: COLORS.accent,
};

// =============================================================================
// ANIMATIONS
// =============================================================================

export const ANIMATIONS = {
  spring: {
    damping: 15,
    stiffness: 150,
  },
  timing: {
    duration: 200,
  },
};

// =============================================================================
// DEPRECATED - kept for backwards compatibility
// =============================================================================

/** @deprecated Use NOW_PLAYING instead */
export const HOME_CARD = {
  width: 340,
  height: 500,
  borderRadius: 8,
  coverHeight: 330,
  coverMargin: 5,
  coverBorderRadius: 8,
  scaleFactor: 0.8,
  gap: 8,
};

/** @deprecated Use COLORS instead */
export const HOME_COLORS = COLORS;

/** @deprecated Use NOW_PLAYING instead */
export const RESPONSIVE_CARD_WIDTH = NOW_PLAYING.width;
export const RESPONSIVE_CARD_HEIGHT = NOW_PLAYING.width;
export const RESPONSIVE_COVER_HEIGHT = NOW_PLAYING.coverMaxWidth;

/** @deprecated */
export const HOME_GRADIENTS = {
  darkShadow: {
    colors: ['rgba(0, 0, 0, 0.15)', 'rgba(0, 0, 0, 0.1)', 'transparent'],
    locations: [0, 0.05, 0.18],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  lightHighlight: {
    colors: ['transparent', 'rgba(255, 255, 255, 0.08)'],
    locations: [0.98, 1],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  coverInnerShadow: {
    colors: ['transparent', 'transparent', 'rgba(0, 0, 0, 0.5)'],
    locations: [0, 0.5, 1],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
};

/** @deprecated */
export const BOTTOM_NAV = {
  buttonSize: 48,
  playButtonSize: 72,
  gap: 48,
  bottomOffset: 24,
};
