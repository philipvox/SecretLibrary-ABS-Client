/**
 * src/features/home/utils/spine/constants.ts
 *
 * Central constants for the book spine system.
 * All magic numbers are defined here with clear documentation.
 */

// =============================================================================
// MASTER HEIGHT SCALE - CHANGE THIS TO MAKE ALL BOOKS TALLER/SHORTER
// =============================================================================

/**
 * Master scale for all book heights.
 * - 1.0 = default height
 * - 1.2 = 20% taller
 * - 0.8 = 20% shorter
 */
export const HEIGHT_SCALE = 1.3;

// =============================================================================
// DIMENSION CONSTANTS
// =============================================================================

/** Base spine dimensions (scaled by HEIGHT_SCALE) */
export const BASE_DIMENSIONS = {
  /** Default height for unknown genres (in pixels) */
  HEIGHT: Math.round(250 * HEIGHT_SCALE),
  /** Minimum allowed height (lowered to accommodate children's books) */
  MIN_HEIGHT: Math.round(160 * HEIGHT_SCALE),
  /** Maximum allowed height */
  MAX_HEIGHT: Math.round(550),
} as const;

/** Spine width calculation (duration-based) */
export const WIDTH_CALCULATION = {
  /** Minimum width for very short audiobooks (<1hr) - matches touch target */
  MIN: 44,
  /** Maximum width for epic audiobooks (>50hr) */
  MAX: 280,
  /** Median fallback when duration is unknown */
  MEDIAN: 44,
  /** Minimum duration in hours (books under this get MIN width) */
  MIN_DURATION_HOURS: 1,
  /** Maximum duration in hours (books over this get MAX width) */
  MAX_DURATION_HOURS: 50,
} as const;

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

/**
 * Spine layout configuration
 * Defines how title, author, and progress sections are arranged vertically
 */
export const SPINE_LAYOUT = {
  /** Section height percentages (must sum to 100%) */
  SECTIONS: {
    /** Title section - dominant visual element */
    TITLE: 90,
    /** Author section - supporting element */
    AUTHOR: 9,
    /** Progress/series number section - minimal space at bottom */
    PROGRESS: 1,
  },

  /** Internal spacing between elements (in pixels) */
  SPACING: {
    /** No padding at edges - maximize usable space */
    EDGE_PADDING: 0,
    /** Minimal margin from section boundaries to prevent text clipping */
    INNER_MARGIN: 1,
    /** Gap between sections (title/author, author/progress) */
    SECTION_GAP: 2,
    /** Top padding for ascenders (tall letters like 'h', 'l') */
    TOP_PADDING: 8,
    /** Bottom padding (tight for professional look) */
    BOTTOM_PADDING: 4,
    /** Extra buffer for fonts with tall ascenders */
    ASCENDER_BUFFER: 3,
  },

  /** Corner radius for spine edges */
  CORNER_RADIUS: 5,

  /** Download indicator bar height at top */
  DOWNLOAD_INDICATOR_HEIGHT: 3,
} as const;

// =============================================================================
// TOUCH TARGET CONSTANTS
// =============================================================================

/**
 * Touch target configuration
 * Follows Apple HIG and Material Design guidelines
 */
export const TOUCH_TARGETS = {
  /** Minimum touch target size (44px per Apple HIG) */
  MIN: 44,
  /** Minimum threshold for very thin spines */
  MIN_THICKNESS: 35,
} as const;

// =============================================================================
// SCALING CONTEXTS
// =============================================================================

/**
 * Scaling factors for different display contexts
 * Each context has a specific scale to fit its container
 */
export const SPINE_SCALES = {
  /** Main library shelf view - large, prominent */
  shelf: 1,
  /** Horizontal stack view - medium size */
  stack: 0.45,
  /** Small preview cards (series, recommendations) */
  card: 0.35,
  /** Full-size detail view - 1:1 scale */
  detail: 1.0,
} as const;

export type SpineContext = keyof typeof SPINE_SCALES;

// =============================================================================
// ANIMATION CONSTANTS
// =============================================================================

/** Animation timing and easing */
export const ANIMATION = {
  /** Delay between each book in domino animation (ms) */
  DOMINO_DELAY: 25,
  /** Duration of enter animation (ms) */
  ENTER_DURATION: 180,
  /** Spring animation config */
  SPRING: {
    damping: 15,
    stiffness: 200,
  },
} as const;

// =============================================================================
// COLOR CONSTANTS
// =============================================================================

/** Spine color defaults */
export const SPINE_COLORS = {
  /** Default light background for stroke design */
  DEFAULT_BG: '#F5F5F5',
  /** Default text color (black on light) */
  DEFAULT_TEXT: '#000000',
  /** Download indicator accent color */
  DOWNLOAD_ACCENT: '#FF6B35',
} as const;

// =============================================================================
// FONT LINE HEIGHT MULTIPLIERS
// =============================================================================

/**
 * Font-specific line height ratios
 * Different fonts need different spacing for optimal readability
 */
export const FONT_LINE_HEIGHTS = {
  // Display fonts - can be tighter (no descenders in caps)
  'BebasNeue-Regular': { title: 0.85, author: 0.9, tight: 0.8 },
  'Oswald-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'Oswald-Bold': { title: 0.9, author: 0.95, tight: 0.85 },

  // Serif fonts - need breathing room
  'Lora-Regular': { title: 0.95, author: 1.0, tight: 0.9 },
  'Lora-Bold': { title: 0.95, author: 1.0, tight: 0.9 },
  'PlayfairDisplay-Regular': { title: 1.0, author: 1.0, tight: 0.95 },
  'PlayfairDisplay-Bold': { title: 1.0, author: 1.0, tight: 0.95 },

  // Default fallback
  'default': { title: 0.95, author: 1.0, tight: 0.9 },
} as const;

// =============================================================================
// DERIVED VALUES
// =============================================================================

/** Calculate total section percentages for validation */
export const TOTAL_SECTION_PERCENT =
  SPINE_LAYOUT.SECTIONS.TITLE +
  SPINE_LAYOUT.SECTIONS.AUTHOR +
  SPINE_LAYOUT.SECTIONS.PROGRESS;

// Compile-time validation
if (TOTAL_SECTION_PERCENT !== 100) {
  throw new Error(
    `Section percentages must sum to 100%, got ${TOTAL_SECTION_PERCENT}%`
  );
}
