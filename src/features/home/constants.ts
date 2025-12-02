/**
 * src/features/home/constants.ts
 * 
 * Design tokens extracted from HTML mockup
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Card dimensions from HTML mockup
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

// Responsive card width (max 340, or screen - padding)
export const RESPONSIVE_CARD_WIDTH = Math.min(HOME_CARD.width, SCREEN_WIDTH - 32);
export const RESPONSIVE_CARD_HEIGHT = (RESPONSIVE_CARD_WIDTH / HOME_CARD.width) * HOME_CARD.height;
export const RESPONSIVE_COVER_HEIGHT = (RESPONSIVE_CARD_WIDTH / HOME_CARD.width) * HOME_CARD.coverHeight;

// Colors
export const HOME_COLORS = {
  background: '#1a1a1a',
  cardBg: '#262626',
  border: 'rgba(255, 255, 255, 0.3)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  actionText: 'rgba(255, 255, 255, 0.5)',
  actionTextHover: 'rgba(255, 255, 255, 0.8)',
  divider: 'rgba(255, 255, 255, 0.1)',
};

// Gradient configs for card overlays
export const HOME_GRADIENTS = {
  // Top dark shadow
  darkShadow: {
    colors: ['rgba(0, 0, 0, 0.15)', 'rgba(0, 0, 0, 0.1)', 'transparent'],
    locations: [0, 0.05, 0.18],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  // Bottom light highlight
  lightHighlight: {
    colors: ['transparent', 'rgba(255, 255, 255, 0.08)'],
    locations: [0.98, 1],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  // Cover inner shadow (bottom fade)
  coverInnerShadow: {
    colors: ['transparent', 'transparent', 'rgba(0, 0, 0, 0.5)'],
    locations: [0, 0.5, 1],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
};

// Bottom nav dimensions
export const BOTTOM_NAV = {
  buttonSize: 48,
  playButtonSize: 72,
  gap: 48,
  bottomOffset: 24,
};