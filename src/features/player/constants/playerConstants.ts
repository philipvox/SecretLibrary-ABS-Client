/**
 * src/features/player/constants/playerConstants.ts
 *
 * Constants for the player UI including dimensions, quick options, and timeline settings.
 */

import { scale, wp, hp } from '@/shared/theme';
import { colors } from '@/shared/theme';

// =============================================================================
// SCREEN DIMENSIONS
// =============================================================================

export const SCREEN_WIDTH = wp(100);
export const SCREEN_HEIGHT = hp(100);

// =============================================================================
// PLAYER LAYOUT
// =============================================================================

export const COVER_SIZE = scale(360); // Large centered cover
export const ACCENT_COLOR = colors.accent;

// =============================================================================
// QUICK OPTIONS
// =============================================================================

/** Quick speed options for settings panel */
export const SPEED_QUICK_OPTIONS = [1, 1.25, 1.5, 2];

/** Sleep timer quick options (in minutes) */
export const SLEEP_QUICK_OPTIONS = [5, 15, 30, 60];

// =============================================================================
// TIMELINE CONSTANTS (Book Mode)
// =============================================================================

export const TIMELINE_WIDTH = SCREEN_WIDTH - scale(44); // Match progress bar padding
export const TIMELINE_HEIGHT = scale(32);
/** Book mode tick heights (plain numbers, not scaled) */
export const TIMELINE_MARKER_RADIUS = 8;
export const TIMELINE_MAJOR_TICK_HEIGHT = 10;
export const TIMELINE_MINOR_TICK_HEIGHT = 5;

// =============================================================================
// CHAPTER TIMELINE CONSTANTS (Chapter Mode)
// =============================================================================

/** Fixed center position for the marker */
export const CHAPTER_MARKER_X = TIMELINE_WIDTH / 2;

/** Large red circle size at marker position */
export const CHAPTER_MARKER_CIRCLE_SIZE = scale(100);

/** Tallest tick - chapter boundaries */
export const CHAPTER_TICK_HEIGHT = scale(80);

/** Medium tick - 10 minute marks */
export const TEN_MIN_TICK_HEIGHT = scale(45);

/** Small tick - 1 minute marks */
export const ONE_MIN_TICK_HEIGHT = scale(24);

/** Smallest tick - 15 second marks */
export const FIFTEEN_SEC_TICK_HEIGHT = scale(11);

/** Y position for chapter labels above ticks */
export const CHAPTER_LABEL_Y = scale(16);

/** Minutes visible on screen at once (~5 minutes zoomed in) */
export const MINUTES_PER_SCREEN = 5;

/** Pixels per second for timeline scrolling */
export const PIXELS_PER_SECOND = TIMELINE_WIDTH / (MINUTES_PER_SCREEN * 60);

/** Total height from marker circle to bottom */
export const CHAPTER_TIMELINE_TOTAL_HEIGHT = scale(220);

/** Computed heights */
export const CHAPTER_TICKS_AREA_HEIGHT = CHAPTER_LABEL_Y + CHAPTER_TICK_HEIGHT + scale(8);
export const CHAPTER_MARKER_LINE_HEIGHT = CHAPTER_TIMELINE_TOTAL_HEIGHT - CHAPTER_MARKER_CIRCLE_SIZE;

// =============================================================================
// SCRUB GESTURE CONSTANTS
// =============================================================================

/** Pixels from screen edge to trigger auto-scroll */
export const EDGE_ZONE = 80;

/** Speed mode labels for scrub indicator */
export const SPEED_MODE_LABELS = {
  normal: '1x',
  half: '0.5x - HALF SPEED',
  quarter: '0.25x - QUARTER SPEED',
  fine: '0.1x - FINE',
  fast: '2x - FAST',
} as const;

// =============================================================================
// BOOKMARK FLAG CONSTANTS
// =============================================================================

/** Width of the bookmark flag pennant */
export const BOOKMARK_FLAG_PENNANT_WIDTH = scale(24);

/** Height of the bookmark flag pennant */
export const BOOKMARK_FLAG_PENNANT_HEIGHT = scale(12);

/** Width of the bookmark flag pole */
export const BOOKMARK_FLAG_POLE_WIDTH = 2;

/** Color of the bookmark flag */
export const BOOKMARK_FLAG_COLOR = '#0146F5';

/** Color of the bookmark stem */
export const BOOKMARK_STEM_COLOR = '#64B5F6';
