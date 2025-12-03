/**
 * src/features/home/homeDesign.ts
 *
 * Design constants from Figma spec for Home Screen
 * Base canvas: 402px width
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Proportional scaling from 402px Figma canvas
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

// =============================================================================
// COLORS
// =============================================================================
export const COLORS = {
  // Backgrounds
  background: '#000000',
  controlButtonBg: '#262626',
  cardOverlay: 'rgba(0, 0, 0, 0.2)',

  // Accent colors
  playButton: '#C8FF00', // Lime green play button
  heart: '#34C759', // Green heart badge
  sleepTimerRed: '#F12802', // Red sleep timer indicator

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textTertiary: 'rgba(255, 255, 255, 0.5)',

  // Glass effects
  glassWhite: 'rgba(255, 255, 255, 0.5)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',

  // Gradients
  gradientTop: 'rgba(0, 0, 0, 0)',
  gradientMiddle: 'rgba(0, 0, 0, 0.8)',
  gradientBottom: '#000000',
} as const;

// =============================================================================
// PROPORTIONS (from 402px canvas)
// =============================================================================
export const PROPORTIONS = {
  // Now Playing Card
  nowPlayingWidth: 358 / 402, // ~89% of screen
  nowPlayingAspectRatio: 422 / 358, // height/width

  // Control buttons
  skipButtonSize: 53 / 402,
  playButtonSize: 78 / 402,

  // Carousel cards
  bookCardWidth: 125 / 402,
  bookCardAspectRatio: 188 / 125,
  seriesCardWidth: 125 / 402,
  playlistCardWidth: 125 / 402,

  // Cover artwork
  coverArtworkWidth: 226 / 358, // relative to now playing card
  coverArtworkAspectRatio: 226 / 226, // square

  // Corner radius
  cardRadius: 14 / 402,
  buttonRadius: 5.21 / 53, // relative to button size
  coverRadius: 8 / 402,

  // Spacing
  controlButtonGap: 20 / 402,
  sectionGap: 24 / 402,
  carouselItemGap: 12 / 402,
} as const;

// =============================================================================
// SCALED DIMENSIONS
// =============================================================================
export const DIMENSIONS = {
  // Now Playing Card
  nowPlayingWidth: scale(358),
  nowPlayingHeight: scale(422),

  // Control buttons
  skipButtonSize: scale(53),
  skipButtonInnerSize: scale(56), // SVG viewBox height
  playButtonSize: scale(78),
  playButtonInnerSize: scale(81), // SVG viewBox height

  // Carousel cards
  bookCardWidth: scale(125),
  bookCardHeight: scale(188),
  seriesCardWidth: scale(125),
  seriesCardHeight: scale(188),
  playlistCardWidth: scale(125),
  playlistCardHeight: scale(188),

  // Cover artwork in Now Playing
  coverArtworkSize: scale(226),

  // Corner radii
  cardRadius: scale(14),
  buttonRadius: scale(5.21),
  coverRadius: scale(8),
  smallRadius: scale(4),

  // Spacing
  controlButtonGap: scale(20),
  sectionGap: scale(24),
  carouselItemGap: scale(12),
  screenPadding: scale(22),

  // Info tiles
  infoTileHeight: scale(40),

  // Heart badge
  heartBadgeSize: scale(24),

  // Progress bar
  progressBarHeight: scale(4),
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================
export const TYPOGRAPHY = {
  // Now Playing Card
  nowPlayingTitle: {
    fontSize: scale(18),
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  nowPlayingChapter: {
    fontSize: scale(14),
    fontWeight: '400' as const,
  },
  nowPlayingTime: {
    fontSize: scale(12),
    fontWeight: '500' as const,
    fontFamily: 'SpaceMono', // Monospace for time display
  },

  // Section headers
  sectionTitle: {
    fontSize: scale(20),
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  viewAll: {
    fontSize: scale(14),
    fontWeight: '500' as const,
  },

  // Card titles
  cardTitle: {
    fontSize: scale(13),
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: scale(11),
    fontWeight: '400' as const,
  },

  // Sleep timer
  sleepTimerText: {
    fontSize: scale(10),
    fontWeight: '600' as const,
  },

  // Playback speed
  speedText: {
    fontSize: scale(12),
    fontWeight: '600' as const,
  },
} as const;

// =============================================================================
// SHADOWS
// =============================================================================
export const SHADOWS = {
  // Card shadow
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },

  // Button shadow
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Cover artwork shadow
  cover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },

  // Glow effect for play button
  playButtonGlow: {
    shadowColor: COLORS.playButton,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

// =============================================================================
// GLASS MORPHISM LAYERS (for GlassButton)
// =============================================================================
export const GLASS_LAYERS = {
  // Base dark fill
  base: {
    color: COLORS.controlButtonBg,
    opacity: 1,
  },

  // Top gradient (dark to transparent)
  topGradient: {
    colors: ['rgba(0, 0, 0, 0.2)', 'transparent'] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 0.3 },
  },

  // Bottom gradient (transparent to white)
  bottomGradient: {
    colors: ['transparent', 'rgba(255, 255, 255, 0.2)'] as const,
    start: { x: 0.5, y: 0.7 },
    end: { x: 0.5, y: 1 },
  },

  // Corner radial gradients
  cornerGradient: {
    colors: ['rgba(255, 255, 255, 0.1)', 'transparent'] as const,
    radius: 0.5,
  },

  // Border highlight
  border: {
    color: COLORS.glassWhite,
    width: 0.5,
  },
} as const;

// =============================================================================
// SVG ICON PATHS
// =============================================================================
export const ICON_PATHS = {
  // Play icon (lime triangle from Play.svg)
  play: 'M38.7003 43.493C38.7003 40.3412 42.1759 38.4276 44.8392 40.113L59.7278 49.5346C62.2092 51.1049 62.2092 54.7245 59.7278 56.2948L44.8392 65.7164C42.1759 67.4018 38.7003 65.4882 38.7003 62.3364V43.493Z',

  // Skip forward chevrons (from Fast forward.svg)
  skipForward: {
    first:
      'M29.15 22.8357C29.15 21.1714 31.0641 20.2352 32.3779 21.2569L39.1716 26.541C40.2011 27.3417 40.2011 28.8977 39.1716 29.6984L32.3779 34.9824C31.0641 36.0042 29.15 35.068 29.15 33.4037L29.15 22.8357Z',
    second:
      'M14.4205 22.8357C14.4205 21.1714 16.3347 20.2352 17.6484 21.2569L24.4421 26.541C25.4716 27.3417 25.4716 28.8977 24.4421 29.6984L17.6484 34.9824C16.3347 36.0042 14.4205 35.068 14.4205 33.4037L14.4205 22.8357Z',
  },

  // Skip backward chevrons (from REwind.svg - mirrored)
  skipBackward: {
    first:
      'M24.9025 22.8357C24.9025 21.1714 22.9884 20.2352 21.6746 21.2569L14.8809 26.541C13.8514 27.3417 13.8514 28.8977 14.8809 29.6984L21.6746 34.9824C22.9884 36.0042 24.9025 35.068 24.9025 33.4037L24.9025 22.8357Z',
    second:
      'M39.632 22.8357C39.632 21.1714 37.7178 20.2352 36.4041 21.2569L29.6104 26.541C28.5809 27.3417 28.5809 28.8977 29.6104 29.6984L36.4041 34.9824C37.7178 36.0042 39.632 35.068 39.632 33.4037L39.632 22.8357Z',
  },

  // Heart icon
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
} as const;

// =============================================================================
// ANIMATION CONFIG
// =============================================================================
export const ANIMATION = {
  // Button press
  buttonScale: {
    pressed: 0.95,
    duration: 100,
  },

  // Progress bar
  progressTransition: {
    duration: 300,
  },

  // Card transitions
  cardTransition: {
    duration: 200,
  },
} as const;

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================
export const LAYOUT = {
  // Tab bar
  tabBarHeight: scale(83),
  tabBarPadding: scale(34),

  // Bottom gradient
  bottomGradientHeight: scale(120),

  // Now Playing position
  nowPlayingMarginTop: scale(20),
  nowPlayingMarginBottom: scale(32),

  // Section spacing
  sectionHeaderMarginTop: scale(24),
  sectionHeaderMarginBottom: scale(12),

  // Carousel
  carouselPaddingHorizontal: scale(22),
} as const;
