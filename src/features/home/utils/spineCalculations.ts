/**
 * src/features/home/utils/spineCalculations.ts
 *
 * Core calculation utilities for the dynamic book spine system.
 *
 * DESIGN PRINCIPLES:
 * 1. Every decision has an explicit fallback
 * 2. Series consistency is locked after first calculation
 * 3. Touch targets meet 44px minimum (Apple HIG)
 * 4. All calculations are deterministic (same input = same output)
 * 5. Performance: expensive calculations are cached
 *
 * DIMENSION SYSTEM:
 * - Genre profiles define base height/width and personality
 * - Tags modify dimensions (e.g., epic-fantasy = taller, cozy = compact)
 * - Duration influences width (longer audiobook = thicker spine)
 * - Series books share consistent height
 */

import { Platform } from 'react-native';
import { HEIGHT_SCALE, BASE_DIMENSIONS } from './spine/constants';

// =============================================================================
// TYPES
// =============================================================================

export type AuthorPosition = 'top' | 'bottom';
export type SpinePersonality = 'refined' | 'bold' | 'playful' | 'classic' | 'modern' | 'stark' | 'warm';
export type AuthorBoxPreference = 'never' | 'horizontal-only' | 'always' | 'auto';
export type AuthorOrientationBias = 'horizontal' | 'vertical' | 'neutral';
export type TitleWeight = 'light' | 'normal' | 'heavy';
export type ContrastLevel = 'low' | 'medium' | 'high';
export type FontFamily =
  // Core families (CSS generic)
  | 'serif'              // Classic book typography
  | 'sans-serif'         // Modern clean
  // Literary serifs (elegant, refined)
  | 'spectral'           // Literary fiction → Palatino
  | 'cormorant'          // Classical, elegant → Baskerville
  | 'crimson'            // Traditional book → Georgia
  | 'playfair'           // Elegant display → Didot
  | 'lora'               // Warm, readable → Georgia
  // Modern/Technical
  | 'roboto-slab'        // Modern slab serif → Rockwell
  | 'oswald'             // Condensed, impactful → Helvetica Neue Condensed
  | 'bebas'              // Bold display → Copperplate
  | 'bitter'             // Contemporary slab → American Typewriter
  // Classic iOS fonts
  | 'georgia'            // Elegant, readable serif
  | 'palatino'           // Classical, literary feel
  | 'times'              // Traditional newspaper/book
  | 'baskerville'        // Refined, transitional serif
  | 'didot'              // High contrast, fashion
  | 'bodoni'             // Similar to Didot, elegant
  // Sans-serif varieties
  | 'helvetica'          // Swiss modernism, neutral
  | 'avenir'             // Geometric, contemporary
  | 'futura'             // Bauhaus geometric
  | 'gill-sans'          // British humanist sans
  | 'optima'             // Humanist sans, elegant
  // Display/Specialty
  | 'copperplate'        // Engraved, formal
  | 'american-typewriter' // Typewritten, vintage
  | 'courier'            // Monospace, technical
  | 'marker-felt'        // Handwritten, playful
  | 'zapfino'            // Calligraphic, ornate
  // System
  | 'system';            // Platform default

export type TextTransform = 'none' | 'uppercase' | 'small-caps';

/**
 * Maps logical font names to Google Fonts loaded via expo-font.
 * These fonts are loaded in appInitializer.ts at app startup.
 *
 * NOTE: This was updated from iOS system fonts to Google Fonts
 * when we switched from SVG Text to RN Text components.
 * SVG Text doesn't support custom fonts, but RN Text does!
 */
export function getPlatformFont(font: FontFamily | string): string {
  const fontMap: Record<string, string> = {
    // ═══════════════════════════════════════════════════════════════
    // CORE DEFAULTS
    // ═══════════════════════════════════════════════════════════════
    'serif': 'Lora-Regular',
    'sans-serif': 'Oswald-Regular',
    'system': 'System',

    // ═══════════════════════════════════════════════════════════════
    // LITERARY SERIFS
    // ═══════════════════════════════════════════════════════════════
    'spectral': 'Lora-Regular',
    'cormorant': 'PlayfairDisplay-Regular',
    'crimson': 'Lora-Regular',
    'playfair': 'PlayfairDisplay-Regular',
    'lora': 'Lora-Regular',

    // ═══════════════════════════════════════════════════════════════
    // MODERN/DISPLAY
    // ═══════════════════════════════════════════════════════════════
    'roboto-slab': 'Lora-Bold',
    'oswald': 'Oswald-Regular',
    'bebas': 'BebasNeue-Regular',
    'bitter': 'Lora-Bold',

    // ═══════════════════════════════════════════════════════════════
    // GENRE-SPECIFIC FONTS
    // Download these from Google Fonts to assets/fonts/
    // ═══════════════════════════════════════════════════════════════

    // Fantasy - Tolkien, medieval (Macondo Swash Caps)
    'macondo': 'MacondoSwashCaps-Regular',
    'tolkien': 'MacondoSwashCaps-Regular',
    'high-fantasy': 'MacondoSwashCaps-Regular',

    // Fantasy - Earthsea, mystical (Uncial Antiqua)
    'uncial': 'UncialAntiqua-Regular',
    'earthsea': 'UncialAntiqua-Regular',
    'celtic': 'UncialAntiqua-Regular',

    // European Classics - Gothic (Grenze Gotisch)
    'grenze': 'GrenzeGotisch-Regular',
    'gothic': 'GrenzeGotisch-Regular',
    'european': 'GrenzeGotisch-Regular',
    'german': 'GrenzeGotisch-Regular',

    // Romance - Regency (Fleur De Leah)
    'fleur': 'FleurDeLeah-Regular',
    'regency': 'FleurDeLeah-Regular',
    'romance': 'FleurDeLeah-Regular',
    'austen': 'FleurDeLeah-Regular',

    // Sci-Fi - Futuristic (Orbitron)
    'orbitron': 'Orbitron-Regular',
    'scifi': 'Orbitron-Regular',
    'space': 'Orbitron-Regular',

    // Tech/Computer (Silkscreen)
    'silkscreen': 'Silkscreen-Regular',
    'tech': 'Silkscreen-Regular',
    'computer': 'Silkscreen-Regular',
    'hacker': 'Silkscreen-Regular',

    // Western/Crime/Noir (Notable)
    'notable': 'Notable-Regular',
    'western': 'Notable-Regular',
    'crime': 'Notable-Regular',
    'noir': 'Notable-Regular',

    // Art Deco (Federo)
    'federo': 'Federo-Regular',
    'deco': 'Federo-Regular',
    'gatsby': 'Federo-Regular',

    // ═══════════════════════════════════════════════════════════════
    // DIRECT MAPPINGS (exact font file names)
    // ═══════════════════════════════════════════════════════════════
    'BebasNeue-Regular': 'BebasNeue-Regular',
    'Oswald-Regular': 'Oswald-Regular',
    'Oswald-Bold': 'Oswald-Bold',
    'Lora-Regular': 'Lora-Regular',
    'Lora-Bold': 'Lora-Bold',
    'PlayfairDisplay-Regular': 'PlayfairDisplay-Regular',
    'PlayfairDisplay-Bold': 'PlayfairDisplay-Bold',
    'MacondoSwashCaps-Regular': 'MacondoSwashCaps-Regular',
    'UncialAntiqua-Regular': 'UncialAntiqua-Regular',
    'GrenzeGotisch-Regular': 'GrenzeGotisch-Regular',
    'FleurDeLeah-Regular': 'FleurDeLeah-Regular',
    'Orbitron-Regular': 'Orbitron-Regular',
    'Silkscreen-Regular': 'Silkscreen-Regular',
    'Notable-Regular': 'Notable-Regular',
    'Federo-Regular': 'Federo-Regular',

    // ═══════════════════════════════════════════════════════════════
    // NEW FONTS (2026-01-14)
    // ═══════════════════════════════════════════════════════════════
    // Classic serifs
    'NotoSerif-Regular': 'NotoSerif-Regular',
    'NotoSerif-Bold': 'NotoSerif-Bold',
    'LibreBaskerville-Regular': 'LibreBaskerville-Regular',
    'LibreBaskerville-Bold': 'LibreBaskerville-Bold',
    // Display/slab fonts
    'GravitasOne-Regular': 'GravitasOne-Regular',
    'AlfaSlabOne-Regular': 'AlfaSlabOne-Regular',
    // Decorative/vintage
    'AlmendraSC-Regular': 'AlmendraSC-Regular',
    // Futuristic
    'ZenDots-Regular': 'ZenDots-Regular',
    // Playful/expressive
    'Eater-Regular': 'Eater-Regular',
    'RubikBeastly-Regular': 'RubikBeastly-Regular',
    'Barriecito-Regular': 'Barriecito-Regular',

    // ═══════════════════════════════════════════════════════════════
    // LEGACY iOS FONT NAMES
    // ═══════════════════════════════════════════════════════════════
    'georgia': 'Lora-Regular',
    'palatino': 'PlayfairDisplay-Regular',
    'times': 'Lora-Regular',
    'baskerville': 'PlayfairDisplay-Regular',
    'didot': 'PlayfairDisplay-Regular',
    'helvetica': 'Oswald-Regular',
    'avenir': 'Oswald-Regular',
    'futura': 'BebasNeue-Regular',
    'copperplate': 'BebasNeue-Regular',
  };

  return fontMap[font] || fontMap['serif'];
}

/**
 * Font-specific line height multipliers.
 *
 * Typography principle: For display type (large headlines), tighter leading
 * looks better. Start at 100% (1.0) and go to 90% (0.9) if needed to fit.
 *
 * Each font has different x-heights and ascender/descender proportions:
 * - Bebas Neue: All caps, no descenders - very tight (0.85-0.9)
 * - Oswald: Tall condensed, minimal descenders - tight (0.9-0.95)
 * - Lora: Traditional serif, balanced - moderate (0.95-1.0)
 * - Playfair Display: Elegant with tall ascenders - slightly more (1.0)
 */
export const FONT_LINE_HEIGHTS: Record<string, { title: number; author: number; tight: number }> = {
  // ═══════════════════════════════════════════════════════════════
  // DISPLAY FONTS - Can go very tight (no descenders in caps)
  // ═══════════════════════════════════════════════════════════════
  'BebasNeue-Regular': { title: 0.85, author: 0.9, tight: 0.8 },
  'Oswald-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'Oswald-Bold': { title: 0.9, author: 0.95, tight: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // SERIF FONTS - Need slightly more breathing room
  // ═══════════════════════════════════════════════════════════════
  'Lora-Regular': { title: 0.95, author: 1.0, tight: 0.9 },
  'Lora-Bold': { title: 0.95, author: 1.0, tight: 0.9 },
  'PlayfairDisplay-Regular': { title: 1.0, author: 1.0, tight: 0.95 },
  'PlayfairDisplay-Bold': { title: 1.0, author: 1.0, tight: 0.95 },

  // ═══════════════════════════════════════════════════════════════
  // GENRE-SPECIFIC FONTS
  // ═══════════════════════════════════════════════════════════════
  'MacondoSwashCaps-Regular': { title: 0.95, author: 1.0, tight: 0.9 },
  'UncialAntiqua-Regular': { title: 0.95, author: 1.0, tight: 0.9 },
  'GrenzeGotisch-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'FleurDeLeah-Regular': { title: 1.0, author: 1.0, tight: 0.95 },
  'Charm-Regular': { title: 1.0, author: 1.0, tight: 0.95 },  // Elegant script (romance/poetry)
  'Orbitron-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'Silkscreen-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'Notable-Regular': { title: 0.85, author: 0.9, tight: 0.8 },
  'Federo-Regular': { title: 0.95, author: 1.0, tight: 0.9 },

  // ═══════════════════════════════════════════════════════════════
  // NEW FONTS (2026-01-14)
  // ═══════════════════════════════════════════════════════════════
  // Classic serifs - need breathing room
  'NotoSerif-Regular': { title: 0.95, author: 1.0, tight: 0.9 },
  'NotoSerif-Bold': { title: 0.95, author: 1.0, tight: 0.9 },
  'LibreBaskerville-Regular': { title: 0.95, author: 1.0, tight: 0.9 },
  'LibreBaskerville-Bold': { title: 0.95, author: 1.0, tight: 0.9 },
  // Display/slab fonts - can be tight (bold, all caps)
  'GravitasOne-Regular': { title: 0.85, author: 0.9, tight: 0.8 },
  'AlfaSlabOne-Regular': { title: 0.85, author: 0.9, tight: 0.8 },
  // Decorative - small caps, tight
  'AlmendraSC-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  // Futuristic - geometric, can be tight
  'ZenDots-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  // Playful/expressive - varied metrics
  'Eater-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'RubikBeastly-Regular': { title: 0.9, author: 0.95, tight: 0.85 },
  'Barriecito-Regular': { title: 0.95, author: 1.0, tight: 0.9 },

  // Default fallback
  'default': { title: 0.95, author: 1.0, tight: 0.9 },
};

/**
 * Get line height for a font family.
 * @param fontFamily - The resolved font family name (e.g., 'BebasNeue-Regular')
 * @param type - 'title' | 'author' | 'tight' (tight is for when space is constrained)
 * @returns Line height multiplier (0.8 to 1.1)
 */
export function getFontLineHeight(
  fontFamily: string,
  type: 'title' | 'author' | 'tight' = 'title'
): number {
  const lineHeights = FONT_LINE_HEIGHTS[fontFamily] || FONT_LINE_HEIGHTS['default'];
  return lineHeights[type];
}

// ═══════════════════════════════════════════════════════════════════════════
// VERTICAL TEXT CENTERING UTILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines whether lineHeight should be applied to text based on orientation.
 *
 * BACKGROUND:
 * React Native's Text component calculates line height as: fontSize + vertical padding.
 * When centering text, RN centers this entire "line box", NOT the visual text itself.
 * This causes vertical misalignment for rotated text where the visual center
 * doesn't match the box center.
 *
 * THE SOLUTION:
 * - For horizontal/multi-line text: Use lineHeight (needed for proper line spacing)
 * - For single-line vertical text: Omit lineHeight (natural centering works correctly)
 *
 * @param orientation - The text orientation from spine config
 * @param isMultiLine - Whether the text can wrap to multiple lines
 * @returns Whether to apply lineHeight to the text style
 */
export type SpineTextOrientation =
  | 'horizontal'
  | 'vertical-up'
  | 'vertical-down'
  | 'vertical-two-row'
  | 'stacked-letters'
  | 'stacked-words';

export function shouldUseLineHeight(
  orientation: SpineTextOrientation | string,
  isMultiLine: boolean = false
): boolean {
  // Stacked orientations handle spacing via gap, not lineHeight
  if (orientation === 'stacked-letters' || orientation === 'stacked-words') {
    return false;
  }

  // Horizontal text: always use lineHeight (proper multi-line spacing)
  if (orientation === 'horizontal') {
    return true;
  }

  // Vertical-two-row: use lineHeight when multi-line (text can wrap)
  if (orientation === 'vertical-two-row') {
    return isMultiLine;
  }

  // Single-line vertical (vertical-up, vertical-down): NO lineHeight
  // This allows the text to center naturally within the rotated view
  return false;
}

/**
 * Returns a complete text style object for spine text with proper centering.
 * This is the single source of truth for spine text alignment logic.
 *
 * @param config - Configuration for the text style
 * @returns Style object to spread into Text component
 */
export interface SpineTextStyleConfig {
  orientation: SpineTextOrientation | string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  color: string;
  align?: 'left' | 'center' | 'right' | 'top' | 'bottom';
  lineHeight?: number;
  lineHeightScale?: number;
  letterSpacing?: number;
  isMultiLine?: boolean;
}

export function getSpineTextStyle(config: SpineTextStyleConfig): {
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  includeFontPadding: boolean;
  lineHeight?: number;
  letterSpacing?: number;
} {
  const {
    orientation,
    fontSize,
    fontWeight,
    fontFamily,
    color,
    align = 'center',
    lineHeight,
    lineHeightScale,
    letterSpacing,
    isMultiLine = false,
  } = config;

  // Convert align to textAlign (top/bottom map to center for text alignment)
  const textAlign: 'left' | 'center' | 'right' =
    align === 'left' ? 'left' :
    align === 'right' ? 'right' : 'center';

  // Base style (always applied)
  const style: ReturnType<typeof getSpineTextStyle> = {
    fontSize,
    fontWeight: String(fontWeight),
    fontFamily,
    color,
    textAlign,
    includeFontPadding: false, // Reduces platform-specific padding differences
  };

  // Only add lineHeight if appropriate for this orientation
  if (shouldUseLineHeight(orientation, isMultiLine)) {
    if (lineHeight) {
      style.lineHeight = lineHeight;
    } else if (lineHeightScale) {
      style.lineHeight = fontSize * lineHeightScale;
    }
  }

  // Add letter spacing if specified
  if (letterSpacing !== undefined) {
    style.letterSpacing = letterSpacing;
  }

  return style;
}

// Author name abbreviation styles
export type AuthorAbbreviation =
  | 'full'              // "Brandon Sanderson"
  | 'initials'          // "B.S."
  | 'first-initial'     // "B. Sanderson"
  | 'last-only'         // "Sanderson"
  | 'first-last'        // "Brandon S."
  | 'auto';             // Solver decides based on space

// ═══════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY PROFILE - Visual voice for each genre
// ═══════════════════════════════════════════════════════════════════════════

export interface TitleTypography {
  fontFamily: FontFamily;
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800;
  fontStyle: 'normal' | 'italic';
  textTransform: TextTransform;
  letterSpacing: number;  // em units (-0.02 to 0.15)
}

export interface AuthorTypography {
  fontFamily: FontFamily;
  fontWeight: 300 | 400 | 500 | 600;
  fontStyle: 'normal' | 'italic';
  textTransform: TextTransform;
  letterSpacing: number;
}

export interface LayoutPreferences {
  authorPosition: AuthorPosition;
  authorOrientationBias: AuthorOrientationBias;
  titleWeight: TitleWeight;  // Affects font size balance
  contrast: ContrastLevel;   // Title vs author size difference
  authorAbbreviation?: AuthorAbbreviation;  // How to truncate author name
}

export interface TypographyProfile {
  title: TitleTypography;
  author: AuthorTypography;
  layout: LayoutPreferences;
  personality: SpinePersonality;
}

// Text alignment options
export type TextAlignment = 'left' | 'center' | 'right';

// Legacy interface for backwards compatibility
export interface SpineTypography {
  fontFamily: string;
  fontWeight: string;
  fontStyle?: 'normal' | 'italic';
  titleTransform?: 'uppercase' | 'none' | 'small-caps';
  authorTransform?: 'uppercase' | 'none' | 'small-caps';
  authorPosition: AuthorPosition | 'top-horizontal' | 'top-vertical-down' | 'bottom-vertical-up' | 'auto';
  authorBox?: AuthorBoxPreference;
  letterSpacing?: number;
  authorOrientationBias?: AuthorOrientationBias;
  contrast?: ContrastLevel;
  titleWeight?: string;
  authorWeight?: string;
  titleLetterSpacing?: number;
  authorLetterSpacing?: number;
  titleAlignment?: TextAlignment;  // Title text alignment (default: center)
  authorAlignment?: TextAlignment; // Author text alignment (default: center)
  authorAbbreviation?: AuthorAbbreviation;  // How to truncate author name
  titleLineHeight?: number;  // Line height multiplier for title (0.85-1.1, default: font-specific)
  authorLineHeight?: number; // Line height multiplier for author (0.85-1.1, default: font-specific)
}

// Box styling configuration
export interface AuthorBoxConfig {
  enabled: boolean;
  strokeWidth: number;
  strokeColor: string;
  padding: { x: number; y: number };
  borderRadius: number;
}

// Box style presets - padding increased for better visual spacing
export const AUTHOR_BOX_STYLES = {
  minimal: {
    strokeWidth: 0.5,
    strokeColor: '#666666',
    padding: { x: 6, y: 4 },   // Increased from { x: 3, y: 2 }
    borderRadius: 1,
  },
  classic: {
    strokeWidth: 0.75,
    strokeColor: '#444444',
    padding: { x: 8, y: 5 },   // Increased from { x: 4, y: 3 }
    borderRadius: 2,
  },
  bold: {
    strokeWidth: 1.5,
    strokeColor: '#333333',
    padding: { x: 10, y: 6 },  // Increased from { x: 5, y: 4 }
    borderRadius: 0,
  },
} as const;

export type AuthorBoxStyle = keyof typeof AUTHOR_BOX_STYLES;

export interface GenreDimensionProfile {
  baseHeight: number;
  baseWidth: number;
  heightRange: [number, number];
  widthRange: [number, number];
  durationInfluence: number;
  aspectRatio: { min: number; max: number; ideal: number };
  personality: SpinePersonality;
}

export interface TagModifier {
  heightMultiplier?: number;
  widthMultiplier?: number;
  heightOffset?: number;
  widthOffset?: number;
  aspectRatioShift?: number;
  overridePersonality?: SpinePersonality;
  priority?: number;
}

export interface SeriesStyle {
  normalizedName: string;  // Lowercase, stripped articles
  typography: SpineTypography;
  height: number;
  iconIndex: number;
  locked: boolean;  // Once true, height cannot change
}

export interface SeriesDimensions {
  height: number;
  baseWidth: number;
  personality: SpinePersonality;
  profile: GenreDimensionProfile;
  lockedAt: number;
}

export interface SpineDimensions {
  width: number;
  height: number;
  touchPadding: number;  // Extra padding for 44px touch target
}

export interface CalculatedDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  profile: GenreDimensionProfile;
  personality: SpinePersonality;
  variationSeed: number;
  appliedModifiers?: string[];
  fromSeries: boolean;
}

export interface BookDimensionInput {
  id: string;
  genres?: string[];
  tags?: string[];
  duration?: number; // in seconds
  seriesName?: string;
}

export interface LayoutVariation {
  tilt: number;
  heightOffset: number;
}

export interface ParsedAuthor {
  line1: string;
  line2: string;
  isSingleLine: boolean;
}

export interface TitleSplit {
  line1: string;
  line2: string;
  isSplit: boolean;
  splitIndex: number;
}

// =============================================================================
// GENERATIVE COMPOSITION TYPES
// Editorial-style typographic spine layouts
// =============================================================================

/** How the title text is oriented on the spine */
export type CompositionTitleOrientation =
  | 'horizontal'        // Normal reading direction
  | 'vertical-up'       // Read bottom to top (traditional spine)
  | 'vertical-down'     // Read top to bottom
  | 'stacked-letters'   // Each letter on its own line (W\nH\nY)
  | 'stacked-words';    // Each word on its own line

/** Visual scale/prominence of the title */
export type CompositionTitleScale =
  | 'whisper'           // Tiny, elegant
  | 'normal'            // Standard size
  | 'statement'         // Large, prominent
  | 'shout';            // Massive, fills the spine

/** Font weight for composition elements */
export type CompositionWeight =
  | 'hairline'          // 100
  | 'light'             // 300
  | 'regular'           // 400
  | 'medium'            // 500
  | 'bold'              // 700
  | 'black';            // 900

/** Text case transformation */
export type CompositionCase =
  | 'uppercase'
  | 'lowercase'
  | 'capitalize'
  | 'preserve';         // Keep original

/** Title position on the spine */
export type CompositionTitlePosition =
  | 'top'
  | 'center'
  | 'bottom'
  | 'top-offset'        // Top but not flush
  | 'bottom-offset';    // Bottom but not flush

/** How the author text is oriented */
export type CompositionAuthorOrientation =
  | 'horizontal'
  | 'vertical-up'
  | 'vertical-down'
  | 'match-title'       // Same orientation as title
  | 'oppose-title';     // Opposite of title orientation

/** Visual treatment for author name */
export type CompositionAuthorTreatment =
  | 'plain'             // Just text
  | 'boxed'             // Rectangle frame around
  | 'underlined'        // Line below
  | 'overlined'         // Line above
  | 'bracketed'         // [ Author ]
  | 'prefixed';         // "by Author" or "— Author"

/** Author scale relative to title */
export type CompositionAuthorScale =
  | 'tiny'              // Much smaller than title
  | 'small'             // Noticeably smaller
  | 'balanced'          // Similar to title
  | 'dominant';         // Larger than title (rare)

/** Overall layout density */
export type CompositionDensity =
  | 'minimal'           // Lots of whitespace
  | 'balanced'          // Even distribution
  | 'dense'             // Packed with elements
  | 'asymmetric';       // Intentionally unbalanced

/** Layout alignment preference */
export type CompositionAlignment =
  | 'centered'
  | 'left-heavy'
  | 'right-heavy'
  | 'top-heavy'
  | 'bottom-heavy'
  | 'scattered';

/** Decorative line style */
export type CompositionLineStyle =
  | 'none'
  | 'thin'              // 0.5px
  | 'medium'            // 1px
  | 'thick'             // 2px
  | 'double';           // Two parallel lines

/** Type of decorative element */
export type CompositionDecorativeElement =
  | 'none'
  | 'top-line'
  | 'bottom-line'
  | 'divider-line'      // Between title/author
  | 'side-line'         // Vertical accent
  | 'corner-marks'      // L-shaped corners
  | 'partial-border';   // 2-3 sides only

/** Series number display style */
export type SeriesNumberStyle = 'plain' | 'circled' | 'boxed';

/** Title configuration in a composition */
export interface CompositionTitleConfig {
  orientation: CompositionTitleOrientation;
  scale: CompositionTitleScale;
  weight: CompositionWeight;
  case: CompositionCase;
  position: CompositionTitlePosition;
  letterSpacing: number;   // -0.05 to 0.3 em
  lineHeight: number;      // 0.8 to 1.4
}

/** Author configuration in a composition */
export interface CompositionAuthorConfig {
  orientation: CompositionAuthorOrientation;
  treatment: CompositionAuthorTreatment;
  scale: CompositionAuthorScale;
  weight: CompositionWeight;
  case: CompositionCase;
  splitNames: boolean;     // Stack first/last name
}

/** Layout configuration in a composition */
export interface CompositionLayoutConfig {
  density: CompositionDensity;
  alignment: CompositionAlignment;
}

/** Decoration configuration in a composition */
export interface CompositionDecorationConfig {
  lineStyle: CompositionLineStyle;
  element: CompositionDecorativeElement;
  showSeriesNumber: boolean;
  seriesNumber?: number;
  seriesNumberStyle: SeriesNumberStyle;
  showYear: boolean;
}

/** Complete spine composition - generated for each book */
export interface SpineComposition {
  title: CompositionTitleConfig & { text: string };
  author: CompositionAuthorConfig & { text: string };
  layout: CompositionLayoutConfig;
  decoration: CompositionDecorationConfig;
  hash: number;            // Book hash for debugging
}

/** Genre composition profile - defines valid ranges for a genre */
export interface GenreCompositionProfile {
  // Title options (randomly picked from based on hash)
  titleOrientations: CompositionTitleOrientation[];
  titleScales: CompositionTitleScale[];
  titleWeights: CompositionWeight[];
  titleCases: CompositionCase[];

  // Author options
  authorOrientations: CompositionAuthorOrientation[];
  authorTreatments: CompositionAuthorTreatment[];
  authorScales: CompositionAuthorScale[];

  // Layout options
  densities: CompositionDensity[];
  alignments: CompositionAlignment[];

  // Decoration options
  lineStyles: CompositionLineStyle[];
  decorativeElements: CompositionDecorativeElement[];

  // Personality traits (influence random selection)
  prefersBold: boolean;
  prefersMinimal: boolean;
  prefersClassic: boolean;
  prefersExperimental: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Font families - Maps logical font names to Google Fonts loaded via expo-font
// These fonts are loaded in appInitializer.ts at app startup
const FONT_MAP: Record<string, string> = {
  // Core defaults
  'serif': 'Lora-Regular',
  'sans-serif': 'Oswald-Regular',
  'system': 'System',

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE FONTS (loaded in appInitializer.ts)
  // These provide distinctive typography for book spines
  // ═══════════════════════════════════════════════════════════════════════════
  'bebas': 'BebasNeue-Regular',            // ★ THRILLERS - Bold condensed caps
  'oswald': 'Oswald-Regular',              // ★ ACTION/ADVENTURE - Condensed impact
  'playfair': 'PlayfairDisplay-Regular',   // ★ ROMANCE/HISTORICAL - Elegant display
  'lora': 'Lora-Regular',                  // ★ LITERARY - Warm, readable serif

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK MAPPINGS (for genres not yet assigned Google Fonts)
  // ═══════════════════════════════════════════════════════════════════════════
  'spectral': 'Lora-Regular',
  'cormorant': 'PlayfairDisplay-Regular',
  'crimson': 'Lora-Regular',
  'cinzel': 'PlayfairDisplay-Regular',
  'roboto-slab': 'Oswald-Regular',
  'bitter': 'Lora-Regular',
  'merriweather': 'Lora-Regular',

  // Direct pass-through for explicit font names
  'georgia': 'Lora-Regular',
  'palatino': 'Lora-Regular',
  'baskerville': 'PlayfairDisplay-Regular',
  'didot': 'PlayfairDisplay-Regular',
  'futura': 'Oswald-Regular',
  'avenir': 'Oswald-Regular',
  'copperplate': 'BebasNeue-Regular',
};

/**
 * Resolve font family name from key
 */
function resolveFontFamily(fontKey: string): string {
  return FONT_MAP[fontKey] || FONT_MAP['serif'];
}

/**
 * Check if author name is already abbreviated (contains initials)
 */
function isAlreadyAbbreviated(author: string): boolean {
  // Check for patterns like "J.R.R.", "J. K.", "B.S.", etc.
  const parts = author.split(/\s+/);
  let initialCount = 0;
  for (const part of parts) {
    if (/^[A-Z]\.?$/.test(part) || /^[A-Z]\.[A-Z]\.?/.test(part)) {
      initialCount++;
    }
  }
  // If more than half the parts are initials, consider it abbreviated
  return initialCount > 0 && initialCount >= parts.length / 2;
}

/**
 * Abbreviate author name according to style
 * Respects already-abbreviated names
 */
export function abbreviateAuthor(author: string, style: AuthorAbbreviation): string {
  if (!author || style === 'full') return author;
  if (isAlreadyAbbreviated(author)) return author;  // Don't double-abbreviate

  const parts = author.trim().split(/\s+/);
  if (parts.length === 0) return author;
  if (parts.length === 1) return author;  // Can't abbreviate single names

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleParts = parts.slice(1, -1);

  switch (style) {
    case 'initials':
      // "B.S." or "J.R.R.T." for multi-part names
      return parts.map(p => p[0] + '.').join('');

    case 'first-initial':
      // "B. Sanderson" or "J.R.R. Tolkien" (keep middle initials if present)
      if (middleParts.length > 0 && middleParts.every(m => m.length <= 2)) {
        // Middle parts are already initials
        return firstName[0] + '. ' + middleParts.join(' ') + ' ' + lastName;
      }
      return firstName[0] + '. ' + lastName;

    case 'last-only':
      // "Sanderson"
      return lastName;

    case 'first-last':
      // "Brandon S."
      return firstName + ' ' + lastName[0] + '.';

    case 'auto':
    default:
      // For auto, return full name - let solver decide
      return author;
  }
}

// Character width ratios for different font families
export const FONT_CHAR_RATIOS: Record<string, number> = {
  'Georgia': 0.58,
  'serif': 0.58,
  'System': 0.52,
  'sans-serif': 0.52,
  'default': 0.55,
};

// Dimension constants - imported from spine/constants.ts (single source of truth)
const BASE_HEIGHT = BASE_DIMENSIONS.HEIGHT;
const MIN_HEIGHT = BASE_DIMENSIONS.MIN_HEIGHT;
const MAX_HEIGHT = BASE_DIMENSIONS.MAX_HEIGHT;

// Width constants - directly tied to audiobook duration
// Target: dramatic visual difference - epic books should be CHUNKY
// Min matches touch target (44px), Epic (50+hr): 280px
const MIN_WIDTH = 44;      // Minimum width - matches touch target
const MAX_WIDTH = 380;     // Epic series like Oathbringer (~65hr) - TWICE as thick
const MEDIAN_WIDTH = 60;   // Fallback when duration unknown
const MIN_TOUCH_TARGET = 44;  // Apple HIG minimum (use hitSlop for thin books)

// Duration constants for width calculation
// Logarithmic: fast growth early, slows for very long books
const MIN_DURATION_HOURS = 1;    // Books under 1hr get MIN_WIDTH
const MAX_DURATION_HOURS = 50;   // Books over 50hr get MAX_WIDTH

// =============================================================================
// COMPREHENSIVE GENRE TYPOGRAPHY PROFILES
// Visual voice for each genre - 50+ profiles
// =============================================================================

const GENRE_TYPOGRAPHY: Record<string, TypographyProfile> = {
  // ═══════════════════════════════════════════════════════════════════════
  // CHILDREN'S - Friendly, clear, playful
  // ═══════════════════════════════════════════════════════════════════════
  "Children's 0-2": {
    title: { fontFamily: 'sans-serif', fontWeight: 700, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'playful',
  },
  "Children's 3-5": {
    title: { fontFamily: 'sans-serif', fontWeight: 700, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'playful',
  },
  "Children's 6-8": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'playful',
  },
  "Children's 9-12": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'playful',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // YOUNG READERS
  // ═══════════════════════════════════════════════════════════════════════
  "Teen 13-17": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Young Adult": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "New Adult": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // LITERARY & CLASSICS - Refined, elegant, timeless
  // ═══════════════════════════════════════════════════════════════════════
  "Literary Fiction": {
    title: { fontFamily: 'spectral', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'cormorant', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.03 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  "Classics": {
    title: { fontFamily: 'crimson', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    author: { fontFamily: 'cormorant', fontWeight: 400, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.05 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'low' },
    personality: 'classic',
  },
  "Literature & Fiction": {
    title: { fontFamily: 'playfair', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'cormorant', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'low' },
    personality: 'refined',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // SPECULATIVE FICTION
  // ═══════════════════════════════════════════════════════════════════════
  "Fantasy": {
    // Fantasy uses serif with dramatic styling: UPPERCASE for epic/classic feel
    // Heavy weight and wide letter-spacing evoke ancient tomes and epic sagas
    title: { fontFamily: 'serif', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'heavy', contrast: 'high' },
    personality: 'classic',
  },
  "Science Fiction": {
    title: { fontFamily: 'roboto-slab', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.08 },
    author: { fontFamily: 'oswald', fontWeight: 400, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.06 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Horror": {
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'vertical', titleWeight: 'heavy', contrast: 'high' },
    personality: 'stark',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // CRIME & THRILLER
  // ═══════════════════════════════════════════════════════════════════════
  "Thriller": {
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.06 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  "Mystery": {
    title: { fontFamily: 'bitter', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'bitter', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'classic',
  },
  "Crime": {
    title: { fontFamily: 'bitter', fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.05 },
    author: { fontFamily: 'oswald', fontWeight: 400, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'bold',
  },
  "True Crime": {
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'oswald', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'stark',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // ROMANCE & RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════════════════
  "Romance": {
    title: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'light', contrast: 'low' },
    personality: 'warm',
  },
  "Women's Fiction": {
    title: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'light', contrast: 'low' },
    personality: 'warm',
  },
  "LGBTQ+ Fiction": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Contemporary Fiction": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // OTHER FICTION
  // ═══════════════════════════════════════════════════════════════════════
  "Adventure": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'bold',
  },
  "Historical Fiction": {
    title: { fontFamily: 'crimson', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'cormorant', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'low' },
    personality: 'classic',
  },
  "Western": {
    title: { fontFamily: 'serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  "Humor": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    layout: { authorPosition: 'top', authorOrientationBias: 'stacked-words', titleWeight: 'normal', contrast: 'medium' },
    personality: 'playful',
  },
  "Satire": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.04 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // SHORT FORM
  // ═══════════════════════════════════════════════════════════════════════
  "Short Stories": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  "Essays": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.04 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  "Anthology": {
    title: { fontFamily: 'serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'classic',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // NON-FICTION - Narrative
  // ═══════════════════════════════════════════════════════════════════════
  "Biography": {
    title: { fontFamily: 'merriweather', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'merriweather', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'classic',
  },
  "Autobiography": {
    title: { fontFamily: 'serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    author: { fontFamily: 'serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.04 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'low' },
    personality: 'classic',
  },
  "Memoir": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'light', contrast: 'low' },
    personality: 'warm',
  },
  "History": {
    title: { fontFamily: 'serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'medium' },
    personality: 'classic',
  },
  "Journalism": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Travel": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // NON-FICTION - Instructional
  // ═══════════════════════════════════════════════════════════════════════
  "Self-Help": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  "Business": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  "Personal Finance": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  "Education": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Health & Wellness": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'warm',
  },
  "Parenting & Family": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'warm',
  },
  "Food & Cooking": {
    title: { fontFamily: 'serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'warm',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // NON-FICTION - Academic/Intellectual
  // ═══════════════════════════════════════════════════════════════════════
  "Philosophy": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.05 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  "Psychology": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Science": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.015 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Popular Science": {
    title: { fontFamily: 'sans-serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Nature": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  "Politics": {
    title: { fontFamily: 'serif', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'medium' },
    personality: 'classic',
  },
  "Religion & Spirituality": {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.025 },
    author: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.04 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'light', contrast: 'low' },
    personality: 'refined',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // NON-FICTION - Arts & Culture
  // ═══════════════════════════════════════════════════════════════════════
  "Art": {
    title: { fontFamily: 'sans-serif', fontWeight: 300, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.12 },
    author: { fontFamily: 'sans-serif', fontWeight: 300, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.08 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'light', contrast: 'low' },
    personality: 'modern',
  },
  "Music": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Sports": {
    title: { fontFamily: 'sans-serif', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // SPECIAL GENRES
  // ═══════════════════════════════════════════════════════════════════════
  "LitRPG": {
    title: { fontFamily: 'sans-serif', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    author: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  "GameLit": {
    title: { fontFamily: 'sans-serif', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    author: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high' },
    personality: 'bold',
  },
  // ═══════════════════════════════════════════════════════════════════════
  // CATCH-ALL
  // ═══════════════════════════════════════════════════════════════════════
  "Adult": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Non-Fiction": {
    title: { fontFamily: 'merriweather', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.005 },
    author: { fontFamily: 'merriweather', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "Fiction": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
  "default": {
    title: { fontFamily: 'sans-serif', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0 },
    author: { fontFamily: 'sans-serif', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'top', authorOrientationBias: 'neutral', titleWeight: 'normal', contrast: 'medium' },
    personality: 'modern',
  },
};

// =============================================================================
// COMBO GENRE TYPOGRAPHY PROFILES
// When a book has multiple genres, use a blended style
// Keys are "genre1+genre2" (alphabetically sorted for consistent lookup)
// =============================================================================

const COMBO_GENRE_TYPOGRAPHY: Record<string, TypographyProfile> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FANTASY COMBOS
  // ═══════════════════════════════════════════════════════════════════════════
  "adventure+fantasy": {
    // Swashbuckling adventure fantasy - geometric sans, heroic
    title: { fontFamily: 'futura', fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'palatino', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'medium', authorAbbreviation: 'first-initial' },
    personality: 'bold',
  },
  "fantasy+thriller": {
    // Dark fantasy action - bold, tense, modern edge, last name only
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.05 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'last-only' },
    personality: 'stark',
  },
  "fantasy+romance": {
    // Romantic fantasy - elegant, warm, full name vertical
    title: { fontFamily: 'playfair', fontWeight: 500, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'medium', authorAbbreviation: 'full' },
    personality: 'warm',
  },
  "fantasy+humor": {
    // Comic fantasy - playful, warm, distinctive serif
    title: { fontFamily: 'playfair', fontWeight: 600, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.01 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.01 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'stacked-words', titleWeight: 'normal', contrast: 'medium', authorAbbreviation: 'full' },
    personality: 'playful',
  },
  "fantasy+mystery": {
    // Fantasy mystery - intriguing, classic, first initial
    title: { fontFamily: 'baskerville', fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'bitter', fontWeight: 400, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'heavy', contrast: 'medium', authorAbbreviation: 'first-initial' },
    personality: 'classic',
  },
  "fantasy+horror": {
    // Dark fantasy horror - ominous, heavy, last name only
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'last-only' },
    personality: 'stark',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // SCI-FI COMBOS
  // ═══════════════════════════════════════════════════════════════════════════
  "adventure+science fiction": {
    // Space opera adventure - epic, bold, cinematic, initials
    title: { fontFamily: 'roboto-slab', fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.06 },
    author: { fontFamily: 'oswald', fontWeight: 400, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'initials' },
    personality: 'bold',
  },
  "science fiction+thriller": {
    // Tech thriller - sleek, tense, modern, last name
    title: { fontFamily: 'roboto-slab', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.08 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.05 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'last-only' },
    personality: 'modern',
  },
  "romance+science fiction": {
    // Sci-fi romance - futuristic warmth, full name
    title: { fontFamily: 'avenir', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.04 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'medium', authorAbbreviation: 'full' },
    personality: 'warm',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // THRILLER/MYSTERY COMBOS
  // ═══════════════════════════════════════════════════════════════════════════
  "mystery+thriller": {
    // Suspense thriller - tense, horizontal boxed, last name
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'last-only' },
    personality: 'bold',
  },
  "crime+thriller": {
    // Crime thriller - gritty, urgent, boxed, first initial
    title: { fontFamily: 'bebas', fontWeight: 700, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.05 },
    author: { fontFamily: 'bitter', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'first-initial' },
    personality: 'stark',
  },
  "horror+thriller": {
    // Horror thriller - terrifying, stark, last name
    title: { fontFamily: 'bebas', fontWeight: 800, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.03 },
    author: { fontFamily: 'oswald', fontWeight: 500, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    layout: { authorPosition: 'bottom', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'last-only' },
    personality: 'stark',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // ROMANCE COMBOS
  // ═══════════════════════════════════════════════════════════════════════════
  "historical fiction+romance": {
    // Historical romance - elegant, period feel, full name
    title: { fontFamily: 'playfair', fontWeight: 500, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'cormorant', fontWeight: 400, fontStyle: 'normal', textTransform: 'small-caps', letterSpacing: 0.04 },
    layout: { authorPosition: 'top', authorOrientationBias: 'vertical', titleWeight: 'normal', contrast: 'low', authorAbbreviation: 'full' },
    personality: 'classic',
  },
  "mystery+romance": {
    // Romantic mystery - intriguing yet warm, first initial
    title: { fontFamily: 'bitter', fontWeight: 500, fontStyle: 'normal', textTransform: 'none', letterSpacing: 0.02 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'normal', contrast: 'medium', authorAbbreviation: 'first-initial' },
    personality: 'warm',
  },
  "romance+thriller": {
    // Romantic suspense - tension meets passion, first initial
    title: { fontFamily: 'bebas', fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', letterSpacing: 0.04 },
    author: { fontFamily: 'lora', fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0.02 },
    layout: { authorPosition: 'top', authorOrientationBias: 'horizontal', titleWeight: 'heavy', contrast: 'high', authorAbbreviation: 'first-initial' },
    personality: 'bold',
  },
};

/**
 * Get a combo genre key from two genres (alphabetically sorted)
 */
function getComboGenreKey(genre1: string, genre2: string): string {
  const g1 = genre1.toLowerCase();
  const g2 = genre2.toLowerCase();
  return g1 < g2 ? `${g1}+${g2}` : `${g2}+${g1}`;
}

/**
 * Try to find a matching combo genre profile
 */
function findComboGenreProfile(genres: string[]): TypographyProfile | null {
  if (!genres || genres.length < 2) return null;

  // Try first two genres
  const key = getComboGenreKey(genres[0], genres[1]);
  if (COMBO_GENRE_TYPOGRAPHY[key]) {
    return COMBO_GENRE_TYPOGRAPHY[key];
  }

  // Try partial matches (e.g., "Science Fiction" matches "science fiction")
  const g1Lower = genres[0].toLowerCase();
  const g2Lower = genres[1].toLowerCase();

  for (const [comboKey, profile] of Object.entries(COMBO_GENRE_TYPOGRAPHY)) {
    const [c1, c2] = comboKey.split('+');
    if ((g1Lower.includes(c1) || c1.includes(g1Lower)) &&
        (g2Lower.includes(c2) || c2.includes(g2Lower))) {
      return profile;
    }
    // Also check reverse order
    if ((g1Lower.includes(c2) || c2.includes(g1Lower)) &&
        (g2Lower.includes(c1) || c1.includes(g2Lower))) {
      return profile;
    }
  }

  return null;
}

// =============================================================================
// TAG TYPOGRAPHY MODIFIERS
// =============================================================================

interface TypographyModifier {
  title?: Partial<TitleTypography>;
  author?: Partial<AuthorTypography>;
  layout?: Partial<LayoutPreferences>;
  letterSpacingAdjust?: number;
  weightAdjust?: number;
  overridePersonality?: SpinePersonality;
  priority?: number;
}

const TAG_TYPOGRAPHY_MODIFIERS: Record<string, TypographyModifier> = {
  // Epic/Grand subgenres
  'epic-fantasy': {
    title: { fontFamily: 'serif', fontWeight: 700, textTransform: 'none' },
    author: { textTransform: 'small-caps', letterSpacing: 0.04 },
    layout: { titleWeight: 'heavy' },
    overridePersonality: 'classic',
    priority: 10,
  },
  'space-opera': {
    title: { fontFamily: 'sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.10 },
    author: { textTransform: 'uppercase', letterSpacing: 0.06 },
    overridePersonality: 'bold',
    priority: 10,
  },
  'grimdark': {
    title: { fontFamily: 'serif', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.02 },
    author: { fontWeight: 500, textTransform: 'uppercase' },
    layout: { titleWeight: 'heavy', contrast: 'high' },
    overridePersonality: 'stark',
    priority: 10,
  },
  'dark-fantasy': {
    title: { fontFamily: 'serif', fontWeight: 600 },
    weightAdjust: 100,
    overridePersonality: 'stark',
    priority: 8,
  },
  // Cozy subgenres
  'cozy': {
    title: { fontFamily: 'serif', fontStyle: 'italic', fontWeight: 400 },
    author: { fontWeight: 400 },
    layout: { titleWeight: 'light', contrast: 'low' },
    overridePersonality: 'warm',
    priority: 10,
  },
  'cozy-fantasy': {
    title: { fontFamily: 'serif', fontStyle: 'italic', fontWeight: 400, letterSpacing: 0.02 },
    layout: { titleWeight: 'light' },
    overridePersonality: 'warm',
    priority: 10,
  },
  'cozy-mystery': {
    title: { fontFamily: 'serif', fontWeight: 400 },
    layout: { titleWeight: 'light', authorOrientationBias: 'horizontal' },
    overridePersonality: 'warm',
    priority: 10,
  },
  // Urban/Modern
  'urban-fantasy': {
    title: { fontFamily: 'sans-serif', fontWeight: 600 },
    overridePersonality: 'modern',
    priority: 6,
  },
  'cyberpunk': {
    title: { fontFamily: 'sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.12 },
    author: { textTransform: 'uppercase', letterSpacing: 0.08 },
    overridePersonality: 'modern',
    priority: 8,
  },
  'post-apocalyptic': {
    title: { fontFamily: 'sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.04 },
    overridePersonality: 'stark',
    priority: 7,
  },
  'dystopian': {
    title: { fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: 0.08 },
    priority: 5,
  },
  // Gothic/Noir
  'gothic': {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', letterSpacing: 0.03 },
    author: { fontFamily: 'serif', textTransform: 'small-caps', letterSpacing: 0.05 },
    layout: { authorOrientationBias: 'vertical', titleWeight: 'light' },
    overridePersonality: 'refined',
    priority: 9,
  },
  'noir': {
    title: { fontFamily: 'serif', fontWeight: 600, fontStyle: 'italic' },
    layout: { contrast: 'high' },
    overridePersonality: 'stark',
    priority: 7,
  },
  'psychological-horror': {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', letterSpacing: 0.025 },
    layout: { titleWeight: 'light' },
    overridePersonality: 'refined',
    priority: 7,
  },
  // Procedural/Legal
  'police-procedural': {
    title: { fontFamily: 'sans-serif', fontWeight: 600, textTransform: 'uppercase' },
    overridePersonality: 'bold',
    priority: 6,
  },
  'legal-thriller': {
    title: { fontFamily: 'serif', fontWeight: 600 },
    overridePersonality: 'classic',
    priority: 6,
  },
  'domestic-thriller': {
    title: { fontFamily: 'sans-serif', fontWeight: 500 },
    layout: { titleWeight: 'normal' },
    priority: 5,
  },
  // Romance subgenres
  'historical-romance': {
    title: { fontFamily: 'serif', fontStyle: 'italic', letterSpacing: 0.025 },
    author: { textTransform: 'small-caps' },
    overridePersonality: 'classic',
    priority: 6,
  },
  'paranormal-romance': {
    title: { fontFamily: 'serif', fontWeight: 500, fontStyle: 'italic' },
    priority: 6,
  },
  'rom-com': {
    title: { fontFamily: 'sans-serif', fontWeight: 500 },
    layout: { authorOrientationBias: 'horizontal' },
    overridePersonality: 'playful',
    priority: 6,
  },
  'dark-romance': {
    title: { fontFamily: 'serif', fontWeight: 500, fontStyle: 'italic' },
    weightAdjust: 100,
    priority: 5,
  },
  'small-town-romance': {
    title: { fontFamily: 'serif', fontStyle: 'italic' },
    overridePersonality: 'warm',
    priority: 5,
  },
  // Era/Setting
  'medieval': {
    title: { fontFamily: 'serif', fontWeight: 600 },
    author: { textTransform: 'small-caps' },
    overridePersonality: 'classic',
    priority: 4,
  },
  'victorian': {
    title: { fontFamily: 'serif', fontWeight: 400, letterSpacing: 0.03 },
    author: { textTransform: 'small-caps', letterSpacing: 0.05 },
    layout: { authorOrientationBias: 'vertical' },
    overridePersonality: 'refined',
    priority: 6,
  },
  'regency': {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', letterSpacing: 0.025 },
    author: { textTransform: 'small-caps' },
    overridePersonality: 'refined',
    priority: 6,
  },
  // Creature/Element tags
  'vampires': {
    title: { fontFamily: 'serif', fontStyle: 'italic', letterSpacing: 0.02 },
    overridePersonality: 'refined',
    priority: 5,
  },
  'fae': {
    title: { fontFamily: 'serif', fontStyle: 'italic', letterSpacing: 0.025 },
    layout: { titleWeight: 'light' },
    overridePersonality: 'refined',
    priority: 5,
  },
  'ghosts': {
    title: { fontFamily: 'serif', fontWeight: 400, fontStyle: 'italic', letterSpacing: 0.03 },
    layout: { titleWeight: 'light' },
    overridePersonality: 'refined',
    priority: 4,
  },
  // Vibe/Tone tags
  'atmospheric': {
    title: { fontFamily: 'serif', fontStyle: 'italic', letterSpacing: 0.02 },
    layout: { titleWeight: 'light' },
    overridePersonality: 'refined',
    priority: 4,
  },
  'whimsical': {
    title: { fontFamily: 'sans-serif', fontWeight: 500 },
    layout: { titleWeight: 'normal' },
    overridePersonality: 'playful',
    priority: 4,
  },
  'heartwarming': {
    title: { fontFamily: 'serif', fontStyle: 'italic' },
    layout: { titleWeight: 'light' },
    overridePersonality: 'warm',
    priority: 3,
  },
  'action-packed': {
    title: { fontFamily: 'sans-serif', fontWeight: 700, textTransform: 'uppercase' },
    overridePersonality: 'bold',
    priority: 4,
  },
  'slow-burn': {
    title: { fontFamily: 'serif', fontStyle: 'italic' },
    layout: { titleWeight: 'light' },
    priority: 2,
  },
  // Trope tags
  'heist': {
    title: { fontFamily: 'sans-serif', fontWeight: 600 },
    overridePersonality: 'bold',
    priority: 4,
  },
  'quest': {
    title: { fontFamily: 'serif', fontWeight: 600 },
    overridePersonality: 'classic',
    priority: 3,
  },
  'fairy-tale-retelling': {
    title: { fontFamily: 'serif', fontStyle: 'italic', letterSpacing: 0.02 },
    overridePersonality: 'playful',
    priority: 5,
  },
  'survival': {
    title: { fontFamily: 'sans-serif', fontWeight: 600, textTransform: 'uppercase' },
    overridePersonality: 'stark',
    priority: 4,
  },
  'war': {
    title: { fontFamily: 'serif', fontWeight: 700 },
    layout: { titleWeight: 'heavy' },
    overridePersonality: 'classic',
    priority: 5,
  },
  // Quality tags
  'award-winner': {
    title: { fontFamily: 'serif', letterSpacing: 0.02 },
    author: { textTransform: 'small-caps', letterSpacing: 0.04 },
    overridePersonality: 'refined',
    priority: 6,
  },
  'classic': {
    title: { fontFamily: 'serif' },
    author: { textTransform: 'small-caps' },
    overridePersonality: 'classic',
    priority: 5,
  },
  'bestseller': {
    weightAdjust: 100,
    priority: 2,
  },
};

// =============================================================================
// LEGACY TYPOGRAPHY CONVERSION
// Converts new TypographyProfile to legacy SpineTypography for compatibility
// =============================================================================

function profileToLegacy(profile: TypographyProfile): SpineTypography {
  const fontFamily = resolveFontFamily(profile.title.fontFamily);
  return {
    fontFamily,
    fontWeight: String(profile.title.fontWeight),
    fontStyle: profile.title.fontStyle,
    titleTransform: profile.title.textTransform,
    authorTransform: profile.author.textTransform,
    authorPosition: profile.layout.authorPosition,
    authorBox: 'auto',  // Determined by personality
    letterSpacing: profile.title.letterSpacing,
    titleLetterSpacing: profile.title.letterSpacing,
    authorLetterSpacing: profile.author.letterSpacing,
    authorOrientationBias: profile.layout.authorOrientationBias,
    contrast: profile.layout.contrast,
    titleWeight: String(profile.title.fontWeight),
    authorWeight: String(profile.author.fontWeight),
    authorAbbreviation: profile.layout.authorAbbreviation || 'auto',
  };
}

// Legacy preset map for backward compatibility
const TYPOGRAPHY_PRESETS: Record<string, SpineTypography> = {};
for (const [key, profile] of Object.entries(GENRE_TYPOGRAPHY)) {
  TYPOGRAPHY_PRESETS[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = profileToLegacy(profile);
}

const PRESET_KEYS = Object.keys(TYPOGRAPHY_PRESETS);

// Default typography - used as fallback when no genre match
const DEFAULT_TYPOGRAPHY: SpineTypography = {
  fontFamily: 'serif',
  fontWeight: '400',
  fontStyle: 'normal',
  titleTransform: 'none',
  authorTransform: 'none',
  authorPosition: 'bottom',
  authorBox: 'auto',
  letterSpacing: 0.02,
  authorOrientationBias: 'neutral',
  contrast: 'medium',
  titleWeight: '500',
  authorWeight: '400',
  titleLetterSpacing: 0.02,
  authorLetterSpacing: 0.01,
};

// =============================================================================
// GENRE DIMENSION PROFILES - Complete taxonomy
// =============================================================================

export const GENRE_PROFILES: Record<string, GenreDimensionProfile> = {
  // Children's - Age-banded, progressively taller
  "Children's 0-2": {
    baseHeight: 180, baseWidth: 55,
    heightRange: [0.85, 1.15], widthRange: [0.80, 1.30],
    durationInfluence: 0.3,
    aspectRatio: { min: 2.5, max: 4, ideal: 3.2 },
    personality: 'playful',
  },
  "Children's 3-5": {
    baseHeight: 210, baseWidth: 52,
    heightRange: [0.85, 1.15], widthRange: [0.80, 1.25],
    durationInfluence: 0.4,
    aspectRatio: { min: 3, max: 5, ideal: 4 },
    personality: 'playful',
  },
  "Children's 6-8": {
    baseHeight: 250, baseWidth: 45,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.25],
    durationInfluence: 0.5,
    aspectRatio: { min: 4, max: 6.5, ideal: 5.2 },
    personality: 'playful',
  },
  "Children's 9-12": {
    baseHeight: 290, baseWidth: 42,
    heightRange: [0.88, 1.12], widthRange: [0.75, 1.30],
    durationInfluence: 0.6,
    aspectRatio: { min: 5, max: 7.5, ideal: 6.5 },
    personality: 'playful',
  },

  // Young Readers - Teen progression
  "Teen 13-17": {
    baseHeight: 330, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.25],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'classic',
  },
  "Young Adult": {
    baseHeight: 340, baseWidth: 46,
    heightRange: [0.88, 1.15], widthRange: [0.75, 1.30],
    durationInfluence: 0.75,
    aspectRatio: { min: 5.5, max: 8.5, ideal: 7 },
    personality: 'classic',
  },
  "New Adult": {
    baseHeight: 330, baseWidth: 44,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.25],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8, ideal: 7.2 },
    personality: 'classic',
  },

  // Literary & Classics - Tall and elegant
  "Literary Fiction": {
    baseHeight: 380, baseWidth: 38,
    heightRange: [0.92, 1.08], widthRange: [0.85, 1.15],
    durationInfluence: 0.6,
    aspectRatio: { min: 8, max: 12, ideal: 10 },
    personality: 'refined',
  },
  "Classics": {
    baseHeight: 400, baseWidth: 42,
    heightRange: [0.95, 1.05], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 8, max: 11, ideal: 9.5 },
    personality: 'bold',
  },
  "Literature & Fiction": {
    baseHeight: 360, baseWidth: 40,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.65,
    aspectRatio: { min: 7, max: 10, ideal: 8.5 },
    personality: 'refined',
  },

  // Genre Fiction - Speculative
  "Fantasy": {
    baseHeight: 400, baseWidth: 52,
    heightRange: [0.85, 1.15], widthRange: [0.70, 1.35],
    durationInfluence: 0.85,
    aspectRatio: { min: 5.5, max: 9, ideal: 7.5 },
    personality: 'bold',
  },
  "Science Fiction": {
    baseHeight: 370, baseWidth: 48,
    heightRange: [0.85, 1.15], widthRange: [0.70, 1.35],
    durationInfluence: 0.85,
    aspectRatio: { min: 5.5, max: 9.5, ideal: 7.5 },
    personality: 'bold',
  },
  "Horror": {
    baseHeight: 350, baseWidth: 40,
    heightRange: [0.85, 1.15], widthRange: [0.75, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 7, max: 10, ideal: 8.5 },
    personality: 'refined',
  },

  // Genre Fiction - Crime/Thriller
  "Thriller": {
    baseHeight: 330, baseWidth: 46,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.75,
    aspectRatio: { min: 6, max: 8, ideal: 7 },
    personality: 'classic',
  },
  "Mystery": {
    baseHeight: 320, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'classic',
  },
  "Crime": {
    baseHeight: 310, baseWidth: 46,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.15],
    durationInfluence: 0.75,
    aspectRatio: { min: 5.5, max: 7.5, ideal: 6.5 },
    personality: 'bold',
  },
  "True Crime": {
    baseHeight: 330, baseWidth: 48,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.75,
    aspectRatio: { min: 5.5, max: 7.5, ideal: 6.8 },
    personality: 'bold',
  },

  // Genre Fiction - Romance & Relationships
  "Romance": {
    baseHeight: 290, baseWidth: 42,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.65,
    aspectRatio: { min: 5.5, max: 8, ideal: 6.8 },
    personality: 'warm',
  },
  "Women's Fiction": {
    baseHeight: 310, baseWidth: 44,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.15],
    durationInfluence: 0.65,
    aspectRatio: { min: 6, max: 8, ideal: 7 },
    personality: 'warm',
  },
  "LGBTQ+ Fiction": {
    baseHeight: 320, baseWidth: 42,
    heightRange: [0.88, 1.12], widthRange: [0.85, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.5 },
    personality: 'classic',
  },
  "Contemporary Fiction": {
    baseHeight: 310, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8, ideal: 7 },
    personality: 'classic',
  },

  // Genre Fiction - Other
  "Adventure": {
    baseHeight: 340, baseWidth: 48,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.25],
    durationInfluence: 0.75,
    aspectRatio: { min: 5.5, max: 8, ideal: 7 },
    personality: 'classic',
  },
  "Historical Fiction": {
    baseHeight: 380, baseWidth: 50,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.25],
    durationInfluence: 0.8,
    aspectRatio: { min: 6, max: 9, ideal: 7.5 },
    personality: 'bold',
  },
  "Western": {
    baseHeight: 300, baseWidth: 44,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 5.5, max: 7.5, ideal: 6.5 },
    personality: 'bold',
  },
  "Humor": {
    baseHeight: 270, baseWidth: 46,
    heightRange: [0.85, 1.20], widthRange: [0.85, 1.25],
    durationInfluence: 0.5,
    aspectRatio: { min: 4.5, max: 7, ideal: 5.5 },
    personality: 'playful',
  },
  "Satire": {
    baseHeight: 300, baseWidth: 40,
    heightRange: [0.88, 1.12], widthRange: [0.85, 1.15],
    durationInfluence: 0.6,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'refined',
  },

  // Short Form
  "Short Stories": {
    baseHeight: 300, baseWidth: 32,
    heightRange: [0.85, 1.15], widthRange: [0.80, 1.10],
    durationInfluence: 0.5,
    aspectRatio: { min: 8, max: 11, ideal: 9.5 },
    personality: 'refined',
  },
  "Essays": {
    baseHeight: 310, baseWidth: 34,
    heightRange: [0.88, 1.12], widthRange: [0.85, 1.15],
    durationInfluence: 0.5,
    aspectRatio: { min: 7.5, max: 10, ideal: 9 },
    personality: 'refined',
  },
  "Anthology": {
    baseHeight: 350, baseWidth: 54,
    heightRange: [0.85, 1.15], widthRange: [0.80, 1.30],
    durationInfluence: 0.8,
    aspectRatio: { min: 5, max: 8, ideal: 6.5 },
    personality: 'bold',
  },

  // Non-Fiction - Narrative
  "Biography": {
    baseHeight: 370, baseWidth: 50,
    heightRange: [0.88, 1.12], widthRange: [0.75, 1.30],
    durationInfluence: 0.8,
    aspectRatio: { min: 6, max: 9, ideal: 7.5 },
    personality: 'bold',
  },
  "Autobiography": {
    baseHeight: 360, baseWidth: 48,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.25],
    durationInfluence: 0.75,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'bold',
  },
  "Memoir": {
    baseHeight: 340, baseWidth: 42,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 7, max: 9, ideal: 8 },
    personality: 'refined',
  },
  "History": {
    baseHeight: 390, baseWidth: 56,
    heightRange: [0.85, 1.15], widthRange: [0.70, 1.40],
    durationInfluence: 0.85,
    aspectRatio: { min: 5, max: 8, ideal: 6.5 },
    personality: 'bold',
  },
  "Journalism": {
    baseHeight: 330, baseWidth: 44,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'classic',
  },
  "Travel": {
    baseHeight: 300, baseWidth: 46,
    heightRange: [0.88, 1.15], widthRange: [0.85, 1.25],
    durationInfluence: 0.6,
    aspectRatio: { min: 5, max: 7.5, ideal: 6.2 },
    personality: 'classic',
  },

  // Non-Fiction - Instructional/Reference
  "Self-Help": {
    baseHeight: 290, baseWidth: 46,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.6,
    aspectRatio: { min: 5, max: 7, ideal: 6 },
    personality: 'warm',
  },
  "Business": {
    baseHeight: 300, baseWidth: 48,
    heightRange: [0.92, 1.08], widthRange: [0.85, 1.15],
    durationInfluence: 0.65,
    aspectRatio: { min: 5, max: 7, ideal: 6 },
    personality: 'bold',
  },
  "Personal Finance": {
    baseHeight: 290, baseWidth: 46,
    heightRange: [0.92, 1.08], widthRange: [0.90, 1.15],
    durationInfluence: 0.6,
    aspectRatio: { min: 5, max: 7, ideal: 6 },
    personality: 'bold',
  },
  "Education": {
    baseHeight: 320, baseWidth: 50,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.25],
    durationInfluence: 0.7,
    aspectRatio: { min: 5, max: 7.5, ideal: 6.2 },
    personality: 'bold',
  },
  "Health & Wellness": {
    baseHeight: 300, baseWidth: 48,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.6,
    aspectRatio: { min: 5, max: 7, ideal: 6 },
    personality: 'warm',
  },
  "Parenting & Family": {
    baseHeight: 290, baseWidth: 46,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.15],
    durationInfluence: 0.6,
    aspectRatio: { min: 5, max: 7, ideal: 6 },
    personality: 'warm',
  },
  "Food & Cooking": {
    baseHeight: 280, baseWidth: 52,
    heightRange: [0.88, 1.15], widthRange: [0.85, 1.25],
    durationInfluence: 0.5,
    aspectRatio: { min: 4, max: 6, ideal: 5 },
    personality: 'bold',
  },

  // Non-Fiction - Academic/Intellectual
  "Philosophy": {
    baseHeight: 360, baseWidth: 36,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.15],
    durationInfluence: 0.6,
    aspectRatio: { min: 8, max: 11, ideal: 9.5 },
    personality: 'refined',
  },
  "Psychology": {
    baseHeight: 340, baseWidth: 46,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'classic',
  },
  "Science": {
    baseHeight: 360, baseWidth: 50,
    heightRange: [0.88, 1.12], widthRange: [0.75, 1.30],
    durationInfluence: 0.75,
    aspectRatio: { min: 6, max: 8.5, ideal: 7 },
    personality: 'bold',
  },
  "Popular Science": {
    baseHeight: 330, baseWidth: 46,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8, ideal: 7 },
    personality: 'classic',
  },
  "Nature": {
    baseHeight: 340, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.85, 1.20],
    durationInfluence: 0.65,
    aspectRatio: { min: 6.5, max: 8.5, ideal: 7.5 },
    personality: 'refined',
  },
  "Politics": {
    baseHeight: 350, baseWidth: 48,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.25],
    durationInfluence: 0.75,
    aspectRatio: { min: 6, max: 8, ideal: 7 },
    personality: 'bold',
  },
  "Religion & Spirituality": {
    baseHeight: 340, baseWidth: 40,
    heightRange: [0.90, 1.10], widthRange: [0.80, 1.20],
    durationInfluence: 0.65,
    aspectRatio: { min: 7, max: 9.5, ideal: 8.2 },
    personality: 'refined',
  },

  // Non-Fiction - Arts & Culture
  "Art": {
    baseHeight: 300, baseWidth: 55,
    heightRange: [0.85, 1.15], widthRange: [0.85, 1.25],
    durationInfluence: 0.5,
    aspectRatio: { min: 4, max: 6.5, ideal: 5.2 },
    personality: 'bold',
  },
  "Music": {
    baseHeight: 320, baseWidth: 46,
    heightRange: [0.88, 1.12], widthRange: [0.85, 1.20],
    durationInfluence: 0.6,
    aspectRatio: { min: 5.5, max: 8, ideal: 6.8 },
    personality: 'classic',
  },
  "Sports": {
    baseHeight: 310, baseWidth: 50,
    heightRange: [0.90, 1.10], widthRange: [0.85, 1.20],
    durationInfluence: 0.65,
    aspectRatio: { min: 5, max: 7, ideal: 6 },
    personality: 'bold',
  },

  // Catch-All
  "Adult": {
    baseHeight: 330, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'classic',
  },
  "Non-Fiction": {
    baseHeight: 330, baseWidth: 48,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.25],
    durationInfluence: 0.7,
    aspectRatio: { min: 5.5, max: 8, ideal: 6.8 },
    personality: 'classic',
  },
  "Fiction": {
    baseHeight: 340, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8.5, ideal: 7.2 },
    personality: 'classic',
  },
  "default": {
    baseHeight: 320, baseWidth: 44,
    heightRange: [0.88, 1.12], widthRange: [0.80, 1.20],
    durationInfluence: 0.7,
    aspectRatio: { min: 6, max: 8, ideal: 7 },
    personality: 'classic',
  },
};

// =============================================================================
// TAG MODIFIERS - Adjust dimensions based on tags
// =============================================================================

export const TAG_MODIFIERS: Record<string, TagModifier> = {
  // Subgenre Tags - Epic/Big
  'epic-fantasy': { heightMultiplier: 1.15, widthMultiplier: 1.20, overridePersonality: 'bold', priority: 10 },
  'space-opera': { heightMultiplier: 1.12, widthMultiplier: 1.18, overridePersonality: 'bold', priority: 10 },
  'grimdark': { heightMultiplier: 1.10, widthMultiplier: 1.15, overridePersonality: 'bold', priority: 8 },
  'dark-fantasy': { heightMultiplier: 1.08, widthMultiplier: 1.10, overridePersonality: 'bold', priority: 8 },

  // Subgenre Tags - Cozy/Small
  'cozy': { heightMultiplier: 0.90, widthMultiplier: 0.95, overridePersonality: 'warm', priority: 10 },
  'cozy-fantasy': { heightMultiplier: 0.88, widthMultiplier: 0.92, overridePersonality: 'warm', priority: 10 },
  'cozy-mystery': { heightMultiplier: 0.88, widthMultiplier: 0.95, overridePersonality: 'warm', priority: 10 },

  // Urban/Modern
  'urban-fantasy': { heightMultiplier: 0.95, widthMultiplier: 1.02, priority: 6 },
  'cyberpunk': { heightMultiplier: 0.98, widthMultiplier: 1.05, priority: 6 },
  'portal-fantasy': { heightMultiplier: 1.05, widthMultiplier: 1.08, priority: 5 },
  'post-apocalyptic': { heightMultiplier: 0.95, widthMultiplier: 1.12, overridePersonality: 'bold', priority: 7 },
  'dystopian': { heightMultiplier: 1.02, widthMultiplier: 1.05, priority: 5 },

  // Gothic/Noir
  'gothic': { heightMultiplier: 1.10, widthMultiplier: 0.90, overridePersonality: 'refined', priority: 8 },
  'noir': { heightMultiplier: 0.95, widthMultiplier: 1.00, overridePersonality: 'warm', priority: 6 },
  'psychological-horror': { heightMultiplier: 1.05, widthMultiplier: 0.92, overridePersonality: 'refined', priority: 7 },

  // Procedural/Legal
  'police-procedural': { heightMultiplier: 0.95, widthMultiplier: 1.08, overridePersonality: 'bold', priority: 6 },
  'legal-thriller': { heightMultiplier: 1.00, widthMultiplier: 1.10, overridePersonality: 'bold', priority: 6 },
  'domestic-thriller': { heightMultiplier: 0.95, widthMultiplier: 1.00, overridePersonality: 'warm', priority: 5 },

  // Romance subgenres
  'historical-romance': { heightMultiplier: 1.08, widthMultiplier: 1.05, priority: 6 },
  'paranormal-romance': { heightMultiplier: 1.05, widthMultiplier: 1.08, priority: 6 },
  'rom-com': { heightMultiplier: 0.92, widthMultiplier: 1.00, overridePersonality: 'playful', priority: 6 },
  'dark-romance': { heightMultiplier: 1.05, widthMultiplier: 1.02, priority: 5 },
  'clean-romance': { heightMultiplier: 0.95, widthMultiplier: 0.98, overridePersonality: 'warm', priority: 4 },
  'small-town-romance': { heightMultiplier: 0.92, widthMultiplier: 0.98, overridePersonality: 'warm', priority: 5 },

  // Era/Setting Tags
  'medieval': { heightMultiplier: 1.08, widthMultiplier: 1.05, priority: 4 },
  'victorian': { heightMultiplier: 1.06, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 5 },
  'regency': { heightMultiplier: 1.04, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 5 },
  '1920s': { heightMultiplier: 1.02, widthMultiplier: 0.98, priority: 3 },
  'wwii': { heightMultiplier: 1.05, widthMultiplier: 1.08, priority: 4 },
  'civil-war': { heightMultiplier: 1.06, widthMultiplier: 1.05, priority: 4 },

  // Setting Tags
  'small-town': { heightMultiplier: 0.95, widthMultiplier: 0.98, overridePersonality: 'warm', priority: 3 },
  'big-city': { heightMultiplier: 1.02, widthMultiplier: 1.02, priority: 2 },
  'castle': { heightMultiplier: 1.08, widthMultiplier: 1.05, priority: 3 },
  'haunted-house': { heightMultiplier: 1.05, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 4 },
  'academy': { heightMultiplier: 1.02, widthMultiplier: 1.00, priority: 2 },
  'college': { heightMultiplier: 0.98, widthMultiplier: 1.02, priority: 2 },

  // Creature/Element Tags
  'dragons': { heightMultiplier: 1.08, widthMultiplier: 1.10, priority: 5 },
  'vampires': { heightMultiplier: 1.05, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 5 },
  'werewolves': { heightMultiplier: 1.02, widthMultiplier: 1.08, priority: 4 },
  'witches': { heightMultiplier: 1.02, widthMultiplier: 1.00, priority: 3 },
  'fae': { heightMultiplier: 1.05, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 5 },
  'ghosts': { heightMultiplier: 1.03, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 4 },
  'aliens': { heightMultiplier: 1.02, widthMultiplier: 1.05, priority: 3 },
  'magic-users': { heightMultiplier: 1.03, widthMultiplier: 1.02, priority: 2 },

  // Vibe/Pacing Tags
  'fast-paced': { widthMultiplier: 1.05, priority: 2 },
  'action-packed': { widthMultiplier: 1.08, priority: 3 },
  'page-turner': { widthMultiplier: 1.05, priority: 2 },
  'slow-burn': { heightMultiplier: 1.03, widthMultiplier: 0.98, priority: 2 },
  'atmospheric': { heightMultiplier: 1.05, widthMultiplier: 0.95, overridePersonality: 'refined', priority: 3 },
  'character-driven': { heightMultiplier: 1.02, widthMultiplier: 0.98, priority: 2 },
  'plot-driven': { widthMultiplier: 1.03, priority: 2 },

  // Emotional vibes
  'whimsical': { heightMultiplier: 0.95, widthMultiplier: 1.02, overridePersonality: 'playful', priority: 4 },
  'funny': { heightMultiplier: 0.95, widthMultiplier: 1.00, overridePersonality: 'playful', priority: 3 },
  'dark': { heightMultiplier: 1.05, widthMultiplier: 1.02, priority: 3 },
  'heartwarming': { heightMultiplier: 0.98, widthMultiplier: 1.00, overridePersonality: 'warm', priority: 2 },
  'heartbreaking': { heightMultiplier: 1.02, widthMultiplier: 0.98, overridePersonality: 'refined', priority: 2 },
  'emotional': { heightMultiplier: 1.02, widthMultiplier: 0.98, priority: 2 },
  'thought-provoking': { heightMultiplier: 1.03, widthMultiplier: 0.97, overridePersonality: 'refined', priority: 2 },
  'suspenseful': { heightMultiplier: 1.02, widthMultiplier: 1.03, priority: 2 },
  'mysterious': { heightMultiplier: 1.03, widthMultiplier: 0.98, priority: 2 },
  'adventurous': { widthMultiplier: 1.05, priority: 2 },

  // Duration Tags (high priority - override calculated duration)
  'under-5-hours': { widthMultiplier: 0.80, heightMultiplier: 0.95, priority: 15 },
  '5-10-hours': { widthMultiplier: 0.95, priority: 12 },
  '10-15-hours': { widthMultiplier: 1.05, priority: 12 },
  '15-20-hours': { widthMultiplier: 1.15, priority: 12 },
  'over-20-hours': { widthMultiplier: 1.25, heightMultiplier: 1.05, priority: 15 },

  // Trope Tags
  'found-family': { heightMultiplier: 0.98, priority: 1 },
  'chosen-one': { heightMultiplier: 1.03, priority: 2 },
  'heist': { widthMultiplier: 1.05, priority: 3 },
  'quest': { heightMultiplier: 1.05, widthMultiplier: 1.05, priority: 3 },
  'time-travel': { heightMultiplier: 1.02, priority: 2 },
  'fairy-tale-retelling': { heightMultiplier: 0.98, widthMultiplier: 0.98, overridePersonality: 'playful', priority: 4 },
  'coming-of-age': { heightMultiplier: 0.98, priority: 1 },
  'first-contact': { heightMultiplier: 1.05, widthMultiplier: 1.05, priority: 3 },
  'survival': { widthMultiplier: 1.05, overridePersonality: 'bold', priority: 3 },
  'war': { heightMultiplier: 1.05, widthMultiplier: 1.08, overridePersonality: 'bold', priority: 4 },
  'revenge': { heightMultiplier: 1.02, widthMultiplier: 1.02, priority: 2 },

  // Character Tags
  'antihero': { heightMultiplier: 1.02, priority: 1 },
  'morally-grey': { heightMultiplier: 1.02, priority: 1 },
  'underdog': { heightMultiplier: 0.98, priority: 1 },
  'unreliable-narrator': { heightMultiplier: 1.02, widthMultiplier: 0.98, priority: 2 },

  // Quality Tags
  'award-winner': { heightMultiplier: 1.05, widthMultiplier: 0.98, overridePersonality: 'refined', priority: 6 },
  'classic': { heightMultiplier: 1.05, widthMultiplier: 1.02, overridePersonality: 'bold', priority: 5 },
  'bestseller': { widthMultiplier: 1.05, priority: 3 },
  'debut': { heightMultiplier: 0.98, widthMultiplier: 0.98, priority: 2 },
};

// =============================================================================
// HASH UTILITIES
// =============================================================================

/**
 * Generate a deterministic hash from a string
 * Algorithm: djb2 variant - proven consistent across platforms
 */
export function hashString(str: string): number {
  if (!str) return 0;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char;
  }
  return Math.abs(hash);
}

/**
 * Get a seeded random number in range [min, max]
 * Uses Linear Congruential Generator for determinism
 */
export function seededRandom(seed: number, min: number, max: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  const next = (a * seed + c) % m;
  const normalized = next / m;
  return Math.floor(min + normalized * (max - min + 1));
}

// =============================================================================
// GENRE COMPOSITION PROFILES
// Each genre defines valid ranges for generative typographic layouts
// =============================================================================

export const GENRE_COMPOSITION_PROFILES: Record<string, GenreCompositionProfile> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // FANTASY - Bold, dramatic, can be experimental
  // ═══════════════════════════════════════════════════════════════════════════
  'fantasy': {
    // Fantasy: vertical orientation for that classic spine look, no boxes (elegant)
    titleOrientations: ['vertical-up', 'vertical-down', 'stacked-letters'],
    titleScales: ['statement', 'shout', 'normal'],
    titleWeights: ['bold', 'black', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['stacked-words', 'vertical-up', 'stacked-words', 'vertical-down'],  // NO horizontal - prefer stacked for epic fantasy look
    authorTreatments: ['plain', 'underlined'],  // NO boxed - more elegant/classic
    authorScales: ['tiny', 'small'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'medium', 'double'],
    decorativeElements: ['divider-line', 'top-line', 'bottom-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: true,  // Changed to true - fantasy is CLASSIC
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LITERARY FICTION - Elegant, refined, typographically sophisticated
  // ═══════════════════════════════════════════════════════════════════════════
  'literary': {
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'whisper', 'statement'],
    titleWeights: ['light', 'regular', 'medium'],
    titleCases: ['capitalize', 'lowercase', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'prefixed', 'underlined'],
    authorScales: ['small', 'balanced'],
    densities: ['minimal', 'balanced'],
    alignments: ['centered', 'top-heavy', 'bottom-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['none', 'divider-line'],
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // THRILLER - High contrast, tension, asymmetric
  // ═══════════════════════════════════════════════════════════════════════════
  'thriller': {
    titleOrientations: ['horizontal', 'stacked-letters', 'vertical-down'],
    titleScales: ['shout', 'statement'],
    titleWeights: ['black', 'bold'],
    titleCases: ['uppercase'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'boxed'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'top-heavy', 'scattered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MYSTERY - Classic, structured, intriguing
  // ═══════════════════════════════════════════════════════════════════════════
  'mystery': {
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'boxed', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'double'],
    decorativeElements: ['divider-line', 'partial-border'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROMANCE - Warm, elegant, flowing
  // ═══════════════════════════════════════════════════════════════════════════
  'romance': {
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['light', 'regular', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'prefixed', 'underlined'],
    authorScales: ['small', 'balanced'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'double'],
    decorativeElements: ['divider-line', 'top-line', 'bottom-line'],
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCI-FI - Modern, geometric, clean
  // ═══════════════════════════════════════════════════════════════════════════
  'sci-fi': {
    titleOrientations: ['horizontal', 'vertical-up', 'stacked-words'],
    titleScales: ['normal', 'statement', 'whisper'],
    titleWeights: ['light', 'medium', 'bold'],
    titleCases: ['uppercase', 'lowercase'],
    authorOrientations: ['horizontal', 'vertical-up'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small'],
    densities: ['minimal', 'balanced', 'asymmetric'],
    alignments: ['centered', 'left-heavy', 'scattered'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['corner-marks', 'side-line', 'none'],
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HORROR - Dark, unsettling, experimental
  // ═══════════════════════════════════════════════════════════════════════════
  'horror': {
    titleOrientations: ['stacked-letters', 'vertical-down', 'horizontal'],
    titleScales: ['shout', 'statement', 'whisper'],
    titleWeights: ['black', 'bold', 'hairline'],
    titleCases: ['uppercase', 'lowercase'],
    authorOrientations: ['horizontal', 'oppose-title', 'vertical-down'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'minimal', 'dense'],
    alignments: ['scattered', 'bottom-heavy', 'top-heavy'],
    lineStyles: ['thick', 'thin', 'none'],
    decorativeElements: ['partial-border', 'side-line', 'none'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NON-FICTION - Clean, authoritative, informative
  // ═══════════════════════════════════════════════════════════════════════════
  'non-fiction': {
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold', 'regular'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up', 'match-title'],  // Added vertical variety
    authorTreatments: ['plain', 'prefixed'],
    authorScales: ['small', 'balanced'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['top-line', 'bottom-line', 'none'],
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BIOGRAPHY / MEMOIR - Personal, dignified
  // ═══════════════════════════════════════════════════════════════════════════
  'biography': {
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['regular', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'underlined', 'prefixed'],
    authorScales: ['balanced', 'small'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['divider-line', 'none'],
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY - Traditional, authoritative
  // ═══════════════════════════════════════════════════════════════════════════
  'history': {
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thin'],
    decorativeElements: ['top-line', 'bottom-line', 'divider-line'],
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS - Professional, bold, modern
  // ═══════════════════════════════════════════════════════════════════════════
  'business': {
    titleOrientations: ['horizontal', 'stacked-words'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-down', 'oppose-title'],  // Added vertical variety
    authorTreatments: ['boxed', 'plain'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'centered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SELF-HELP - Inspiring, accessible, clear
  // ═══════════════════════════════════════════════════════════════════════════
  'self-help': {
    titleOrientations: ['horizontal', 'stacked-words'],
    titleScales: ['statement', 'normal'],
    titleWeights: ['bold', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up', 'match-title'],  // Added vertical variety
    authorTreatments: ['plain', 'boxed'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thin'],
    decorativeElements: ['divider-line', 'top-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CRIME - Noir, gritty, structured
  // ═══════════════════════════════════════════════════════════════════════════
  'crime': {
    titleOrientations: ['horizontal', 'vertical-down', 'stacked-letters'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['uppercase'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['boxed', 'plain'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'scattered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHILDREN'S - Playful, clear, friendly
  // ═══════════════════════════════════════════════════════════════════════════
  'children': {
    titleOrientations: ['horizontal', 'stacked-words'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'vertical-up', 'vertical-down'],  // Added vertical variety for playful look
    authorTreatments: ['plain'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thick'],
    decorativeElements: ['top-line', 'bottom-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // YOUNG ADULT - Modern, energetic
  // ═══════════════════════════════════════════════════════════════════════════
  'young-adult': {
    titleOrientations: ['horizontal', 'vertical-up', 'stacked-letters'],
    titleScales: ['statement', 'normal'],
    titleWeights: ['bold', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'asymmetric'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['divider-line', 'side-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POETRY - Delicate, artistic, minimal
  // ═══════════════════════════════════════════════════════════════════════════
  'poetry': {
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['whisper', 'normal'],
    titleWeights: ['light', 'regular'],
    titleCases: ['lowercase', 'capitalize'],
    authorOrientations: ['match-title', 'horizontal'],
    authorTreatments: ['plain', 'prefixed'],
    authorScales: ['balanced', 'small'],
    densities: ['minimal'],
    alignments: ['centered', 'scattered'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['none', 'divider-line'],
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HUMOR - Playful, bold, quirky
  // ═══════════════════════════════════════════════════════════════════════════
  'humor': {
    titleOrientations: ['horizontal', 'stacked-letters', 'stacked-words'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['stacked-words', 'oppose-title'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'balanced'],
    alignments: ['scattered', 'centered'],
    lineStyles: ['medium', 'thick'],
    decorativeElements: ['corner-marks', 'partial-border'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVENTURE - Dynamic, bold
  // ═══════════════════════════════════════════════════════════════════════════
  'adventure': {
    titleOrientations: ['vertical-up', 'horizontal', 'stacked-letters'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['tiny', 'small'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thick'],
    decorativeElements: ['divider-line', 'top-line'],
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT - Balanced, versatile
  // ═══════════════════════════════════════════════════════════════════════════
  'default': {
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title', 'vertical-up', 'vertical-down', 'oppose-title'],  // Full variety
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['divider-line', 'none'],
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },
};

// =============================================================================
// SERIES REGISTRY (with locking)
// =============================================================================

const seriesRegistry = new Map<string, SeriesStyle>();

/**
 * Normalize series name for consistent matching
 * "The Lord of the Rings" → "lord of the rings"
 * "A Song of Ice and Fire" → "song of ice and fire"
 */
export function normalizeSeriesName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*#[\d.]+$/, '')      // Remove trailing #N or #N.N (e.g., "#7", "#3.5")
    .replace(/^(the|a|an)\s+/i, '')  // Remove leading articles
    .replace(/['']/g, "'")           // Normalize apostrophes
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();                          // Final trim after all replacements
}

/**
 * Get or create a consistent style for a series
 * LOCKING: Once a series style is created, its height is locked
 */
export function getSeriesStyle(seriesName: string): SeriesStyle {
  if (!seriesName) {
    // Return a default style for non-series books
    return {
      normalizedName: '',
      typography: { ...DEFAULT_TYPOGRAPHY },
      height: BASE_HEIGHT,
      iconIndex: 0,
      locked: false,
    };
  }

  const normalized = normalizeSeriesName(seriesName);

  if (seriesRegistry.has(normalized)) {
    return seriesRegistry.get(normalized)!;
  }

  // Create new series style
  const hash = hashString(normalized);
  const presetIndex = hash % PRESET_KEYS.length;
  const presetKey = PRESET_KEYS[presetIndex];
  const typography = { ...TYPOGRAPHY_PRESETS[presetKey] };

  // Height with variation (locked after creation)
  const heightVariation = seededRandom(hash, -30, 50);
  const height = Math.min(Math.max(BASE_HEIGHT + heightVariation, MIN_HEIGHT), MAX_HEIGHT);

  const style: SeriesStyle = {
    normalizedName: normalized,
    typography,
    height,
    iconIndex: hash % 12,
    locked: true,  // Lock immediately
  };

  seriesRegistry.set(normalized, style);
  return style;
}

/**
 * Clear the series registry (for testing or refresh)
 */
export function clearSeriesCache(): void {
  seriesRegistry.clear();
}

// =============================================================================
// GENRE DETECTION (with priority order)
// =============================================================================

/**
 * Genre detection priority (higher = checked first)
 * More specific genres take precedence
 */
const GENRE_PRIORITY: Array<{ keywords: string[]; category: string }> = [
  // Most specific first - commercial genres with boxes
  { keywords: ['thriller', 'suspense'], category: 'thriller' },
  { keywords: ['crime', 'detective', 'noir', 'police'], category: 'crime' },
  { keywords: ['mystery'], category: 'mystery' },
  { keywords: ['true crime'], category: 'crime' },
  // Elegant genres without boxes
  { keywords: ['horror', 'scary', 'supernatural', 'gothic'], category: 'horror' },
  { keywords: ['romance', 'love', 'romantic'], category: 'romance' },
  { keywords: ['science fiction', 'sci-fi', 'scifi', 'space opera', 'cyberpunk'], category: 'scifi' },
  { keywords: ['fantasy', 'magic', 'dragons', 'epic fantasy', 'urban fantasy'], category: 'fantasy' },
  { keywords: ['children', 'kids', 'juvenile', 'young readers', 'middle grade'], category: 'children' },
  { keywords: ['poetry', 'poems', 'verse'], category: 'poetry' },
  // Non-fiction with boxes
  { keywords: ['biography', 'memoir', 'autobiography'], category: 'biography' },
  { keywords: ['history', 'historical'], category: 'history' },
  { keywords: ['business', 'economics', 'finance', 'management', 'entrepreneurship'], category: 'business' },
  { keywords: ['self-help', 'self help', 'personal development', 'self improvement'], category: 'selfhelp' },
  { keywords: ['non-fiction', 'nonfiction'], category: 'nonfiction' },
  // Least specific last
  { keywords: ['fiction', 'literary', 'literature', 'classics', 'general fiction'], category: 'literary' },
];

/**
 * Detect primary genre from genres array
 * Prioritizes the FIRST genre in the array (the book's primary classification)
 * Returns null if no match (will use fallback)
 */
function detectGenreCategory(genres: string[] | undefined): string | null {
  if (!genres || genres.length === 0) return null;

  const lowerGenres = genres.map(g => g.toLowerCase());

  // Check genres in ORDER (first genre = primary classification)
  // This means "Fantasy, Thriller" will match Fantasy first
  for (const genre of lowerGenres) {
    for (const { keywords, category } of GENRE_PRIORITY) {
      if (keywords.some(kw => genre.includes(kw))) {
        return category;
      }
    }
  }

  return null;
}

// =============================================================================
// TYPOGRAPHY SELECTION (with fallback cascade)
// =============================================================================

/**
 * Get typography style with explicit fallback cascade:
 * 1. Genre-based typography
 * 2. Deterministic random from book ID
 * 3. Default typography
 */
export function getTypographyForGenres(
  genres: string[] | undefined,
  bookId: string
): SpineTypography {
  // Get base typography from genre or fallback
  let typography: SpineTypography;
  let fromCombo = false;

  // 1. First, check for combo genre match (e.g., "Fantasy + Thriller")
  const comboProfile = findComboGenreProfile(genres || []);
  if (comboProfile) {
    typography = profileToLegacy(comboProfile);
    fromCombo = true;
    if (__DEV__) {
      const key = genres && genres.length >= 2 ? getComboGenreKey(genres[0], genres[1]) : 'unknown';
      console.log(`[GenreCombo] Using combo profile: ${key}`);
    }
  }
  // 2. Fall back to single genre detection
  else {
    const category = detectGenreCategory(genres);
    if (category && TYPOGRAPHY_PRESETS[category]) {
      typography = { ...TYPOGRAPHY_PRESETS[category] };
    } else if (bookId) {
      const hash = hashString(bookId);
      const presetIndex = hash % PRESET_KEYS.length;
      const presetKey = PRESET_KEYS[presetIndex];
      typography = { ...TYPOGRAPHY_PRESETS[presetKey] };
    } else {
      typography = { ...DEFAULT_TYPOGRAPHY };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYOUT VARIATIONS - Add visual variety based on book ID
  // Progress ALWAYS stays at bottom, but title/author can vary
  // ═══════════════════════════════════════════════════════════════════════════

  if (bookId) {
    const hash = hashString(bookId);

    // --- AUTHOR ROTATION VARIATION ---
    // ~40% of books with neutral bias get forced to vertical (rotated) author
    // This creates more visual variety on the shelf
    if (typography.authorOrientationBias === 'neutral') {
      const rotationRoll = (hash >> 4) % 10;  // 0-9
      if (rotationRoll < 4) {
        // 40% chance: force vertical author rotation
        typography.authorOrientationBias = 'vertical';
      } else if (rotationRoll < 6) {
        // 20% chance: force horizontal author
        typography.authorOrientationBias = 'horizontal';
      }
      // else 40%: keep neutral (solver decides)
    }

    // --- AUTHOR BOX VARIATION ---
    // ~25% of books with horizontal author get a box around the name
    // Only applies when author would render horizontally
    if (typography.authorBox === 'auto' || !typography.authorBox) {
      const boxRoll = (hash >> 8) % 100;
      if (boxRoll < 25) {
        // 25% chance: add box for horizontal authors
        typography.authorBox = 'horizontal-only';
      }
    }

    // --- POSITION VARIATION ---
    // ~30% of books swap title/author order (author on top vs bottom)
    // Progress ALWAYS stays at bottom regardless of this
    const positionRoll = (hash >> 12) % 10;
    if (positionRoll < 3) {
      // 30% chance: swap author position
      if (typography.authorPosition === 'top' ||
          typography.authorPosition === 'top-horizontal' ||
          typography.authorPosition === 'top-vertical-down') {
        typography.authorPosition = 'bottom';
      } else if (typography.authorPosition === 'bottom' ||
                 typography.authorPosition === 'bottom-vertical-up') {
        typography.authorPosition = 'top';
      }
    }
  }

  return typography;
}

// =============================================================================
// WIDTH CALCULATION (explicit formula)
// =============================================================================

/**
 * Calculate spine width from duration using LINEAR scaling
 *
 * Width directly and linearly correlates with audiobook length:
 * - 1 hour: 20px (minimum - short stories, podcasts)
 * - 5 hours: ~46px (novella like Edgedancer)
 * - 10 hours: ~72px (standard novel)
 * - 25 hours: ~150px (long novel)
 * - 50+ hours: 280px (epic like Oathbringer, Malazan)
 *
 * Linear scaling gives DRAMATIC visual differentiation:
 * - Edgedancer (5hr) → ~46px (thin)
 * - Oathbringer (65hr) → 280px (CHUNKY)
 * - Ratio: 6x difference (VERY visible!)
 *
 * @param duration Duration in seconds (undefined = use median fallback)
 */
export function calculateSpineWidth(
  duration: number | undefined,
  _genres?: string[]
): number {
  // Explicit fallback for missing duration
  if (duration === undefined || duration === null || duration <= 0) {
    return MEDIAN_WIDTH;  // 40px for unknown duration
  }

  const hours = duration / 3600;

  // Very short content gets minimum width
  if (hours <= MIN_DURATION_HOURS) {
    return MIN_WIDTH;
  }

  // Very long content gets maximum width
  if (hours >= MAX_DURATION_HOURS) {
    return MAX_WIDTH;
  }

  // Linear scaling: width grows proportionally with duration
  // This gives maximum visual differentiation between short and long books
  const ratio = hours / MAX_DURATION_HOURS;
  const width = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * ratio;

  return Math.round(width);
}

/**
 * Calculate touch padding needed for 44px minimum touch target
 */
export function calculateTouchPadding(spineWidth: number): number {
  return Math.max(0, Math.ceil((MIN_TOUCH_TARGET - spineWidth) / 2));
}

// =============================================================================
// HEIGHT CALCULATION
// =============================================================================

/**
 * Genre-specific height adjustments
 */
const GENRE_HEIGHT_ADJUSTMENTS: Record<string, { min: number; max: number }> = {
  children: { min: 60, max: 100 },     // Tall (picture books)
  poetry: { min: -80, max: -40 },      // Short
  essays: { min: -60, max: -20 },      // Shorter
  fantasy: { min: 10, max: 70 },       // Slightly taller
  scifi: { min: 20, max: 50 },         // Slightly taller
  epic: { min: 30, max: 70 },          // Taller
};

/**
 * Calculate spine height based on genres
 */
export function calculateSpineHeight(
  genres: string[] | undefined,
  bookId: string
): number {
  const hash = hashString(bookId || 'default');

  // Base variation (±20px)
  const baseVariation = seededRandom(hash, -40, 40);

  // Check for genre-specific adjustments
  if (genres && genres.length > 0) {
    const lowerGenres = genres.map(g => g.toLowerCase());

    for (const [genre, adjustment] of Object.entries(GENRE_HEIGHT_ADJUSTMENTS)) {
      if (lowerGenres.some(g => g.includes(genre))) {
        const genreVariation = seededRandom(hash + 1, adjustment.min, adjustment.max);
        return Math.min(Math.max(BASE_HEIGHT + genreVariation, MIN_HEIGHT), MAX_HEIGHT);
      }
    }
  }

  // Standard height with variation
  return Math.min(Math.max(BASE_HEIGHT + baseVariation, MIN_HEIGHT), MAX_HEIGHT);
}

// =============================================================================
// SPINE DIMENSIONS (complete)
// =============================================================================

/**
 * Get full spine dimensions for a book
 * Includes width, height, and touch padding
 */
export function getSpineDimensions(
  bookId: string,
  genres: string[] | undefined,
  duration: number | undefined,
  seriesName?: string
): SpineDimensions {
  const width = calculateSpineWidth(duration, genres);
  const touchPadding = calculateTouchPadding(width);

  // Series books use locked series height
  if (seriesName) {
    const seriesStyle = getSeriesStyle(seriesName);
    return {
      width,
      height: seriesStyle.height,
      touchPadding,
    };
  }

  return {
    width,
    height: calculateSpineHeight(genres, bookId),
    touchPadding,
  };
}

// =============================================================================
// AUTHOR NAME PARSING (handles compound surnames)
// =============================================================================

/**
 * Surname particles that indicate compound last names
 * "de", "van", "von", etc. are part of the last name
 */
const SURNAME_PARTICLES = [
  'van', 'von', 'de', 'du', 'del', 'della', 'di', 'da',
  'le', 'la', 'les', 'lo',
  'mc', 'mac', "o'", 'st', 'saint',
  'bin', 'ibn', 'ben', 'al', 'el',
];

/**
 * Parse author name into two lines for horizontal display
 * Handles compound surnames correctly:
 * - "Ursula K. Le Guin" → "Ursula K." / "Le Guin"
 * - "Vincent van Gogh" → "Vincent" / "van Gogh"
 * - "J.R.R. Tolkien" → "J.R.R." / "Tolkien"
 */
export function parseAuthorName(author: string | undefined): ParsedAuthor {
  // Handle missing/empty author
  if (!author || author.trim() === '') {
    return { line1: '', line2: '', isSingleLine: true };
  }

  const trimmed = author.trim();
  const parts = trimmed.split(/\s+/);

  // Single word → single line (can't split)
  if (parts.length === 1) {
    return { line1: trimmed, line2: '', isSingleLine: true };
  }

  // Find where the "last name" starts (including particles)
  let lastNameStart = parts.length - 1;

  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i].toLowerCase().replace(/[.,]/g, '');
    if (SURNAME_PARTICLES.includes(part)) {
      lastNameStart = i;
    } else {
      break;  // Stop at first non-particle
    }
  }

  // If lastNameStart is 0, entire name would be "last name" - treat as single line
  if (lastNameStart === 0) {
    return { line1: trimmed, line2: '', isSingleLine: true };
  }

  const line1 = parts.slice(0, lastNameStart).join(' ');
  const line2 = parts.slice(lastNameStart).join(' ');

  return { line1, line2, isSingleLine: false };
}

// =============================================================================
// TITLE SPLIT (with linguistic awareness)
// =============================================================================

/**
 * Words that are good break points (split AFTER these)
 */
const PREFERRED_BREAK_AFTER = [
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but',
  'with', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
];

/**
 * Words/patterns to keep together (don't split between these)
 */
const KEEP_TOGETHER_PATTERNS = [
  /^vol\.?\s*\d+/i,      // Vol. 1
  /^book\s*\d+/i,        // Book 1
  /^part\s*\d+/i,        // Part 1
  /^chapter\s*\d+/i,     // Chapter 1
  /^#\d+/,               // #1
];

/**
 * Find the best split point for a title
 * Returns character index where split should occur
 */
export function findBestTitleSplit(title: string): TitleSplit {
  if (!title || title.length <= 6) {
    return { line1: title || '', line2: '', isSplit: false, splitIndex: -1 };
  }

  const words = title.split(' ');

  // Single word: split at middle
  if (words.length === 1) {
    const mid = Math.ceil(title.length / 2);
    return {
      line1: title.slice(0, mid) + '-',
      line2: title.slice(mid),
      isSplit: true,
      splitIndex: mid,
    };
  }

  // Find best word boundary split
  const midPoint = title.length / 2;
  let bestSplit = Math.floor(words.length / 2);
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ');
    const right = words.slice(i).join(' ');

    // Base score: how far from middle
    let score = Math.abs(left.length - midPoint);

    // Bonus: breaking after preferred words
    const lastWordLeft = words[i - 1].toLowerCase();
    if (PREFERRED_BREAK_AFTER.includes(lastWordLeft)) {
      score -= 10;
    }

    // Penalty: breaking keep-together patterns
    const rightStart = right.toLowerCase();
    if (KEEP_TOGETHER_PATTERNS.some(p => p.test(rightStart))) {
      score += 50;
    }

    // Penalty: very unbalanced splits
    const balanceRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    if (balanceRatio < 0.3) {
      score += 20;
    }

    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  const line1 = words.slice(0, bestSplit).join(' ');
  const line2 = words.slice(bestSplit).join(' ');

  return {
    line1,
    line2,
    isSplit: true,
    splitIndex: line1.length,
  };
}

// =============================================================================
// LAYOUT VARIATION
// =============================================================================

/**
 * Get randomized layout variations for a book
 * Deterministic based on book ID
 */
export function getLayoutVariation(bookId: string): LayoutVariation {
  const hash = hashString(bookId || 'default');

  return {
    tilt: seededRandom(hash, -3, 3),
    heightOffset: seededRandom(hash + 100, -10, 10),
  };
}

// =============================================================================
// TEXT SIZE CALCULATION (with caching)
// =============================================================================

const fontSizeCache = new Map<string, number>();

/**
 * Calculate font size that fills the container
 * Cached for performance
 */
export function calculateFillFontSize(
  text: string,
  containerWidth: number,
  containerHeight: number,
  fontFamily: string,
  isVertical: boolean
): number {
  // Handle empty text
  if (!text || text.length === 0) {
    return 12;  // Sensible default
  }

  // Cache key
  const cacheKey = `${text.length}:${containerWidth}:${containerHeight}:${fontFamily}:${isVertical}`;
  if (fontSizeCache.has(cacheKey)) {
    return fontSizeCache.get(cacheKey)!;
  }

  const ratio = FONT_CHAR_RATIOS[fontFamily] || FONT_CHAR_RATIOS['default'];

  // For vertical text (rotated -90°), width and height swap
  const effectiveLength = isVertical ? containerHeight : containerWidth;
  const effectiveThickness = isVertical ? containerWidth : containerHeight;

  // Size to fill length
  const sizeByLength = (effectiveLength * 0.92) / (text.length * ratio);

  // Size constrained by thickness
  const sizeByThickness = effectiveThickness * 0.95;

  const result = Math.min(sizeByLength, sizeByThickness);

  // Cache result (limit cache size)
  if (fontSizeCache.size > 500) {
    fontSizeCache.clear();
  }
  fontSizeCache.set(cacheKey, result);

  return result;
}

/**
 * Calculate author font size (slightly smaller than title)
 */
export function calculateAuthorFontSize(
  author: string,
  containerWidth: number,
  containerHeight: number,
  fontFamily: string,
  isVertical: boolean
): number {
  const baseSize = calculateFillFontSize(
    author,
    containerWidth,
    containerHeight,
    fontFamily,
    isVertical
  );

  return baseSize * 0.92;
}

// =============================================================================
// GENRE-BASED DIMENSION CALCULATIONS
// =============================================================================

/**
 * Series dimension registry for consistent heights within a series
 */
const seriesDimensionRegistry = new Map<string, SeriesDimensions>();

/**
 * Clear series dimension registry (for testing or refresh)
 */
export function clearSeriesDimensionRegistry(): void {
  seriesDimensionRegistry.clear();
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Seeded random number in range (returns float, not floored)
 */
function seededRandomFloat(seed: number, min: number, max: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  const next = (a * seed + c) % m;
  const normalized = next / m;
  return min + normalized * (max - min);
}

/**
 * Calculate duration factor (0.6 = short, 1.0 = average, 1.6 = epic)
 */
function calculateDurationFactor(durationSeconds: number | undefined, _profile: GenreDimensionProfile): number {
  if (!durationSeconds || durationSeconds <= 0) {
    return 1.0; // Default to average
  }

  const hours = durationSeconds / 3600;

  // Typical audiobook range: 5-15 hours
  if (hours < 3) return 0.6;
  if (hours < 5) return 0.75;
  if (hours < 8) return 0.9;
  if (hours < 12) return 1.0;
  if (hours < 18) return 1.15;
  if (hours < 25) return 1.3;
  if (hours < 35) return 1.45;
  return 1.6; // 35+ hours - truly epic
}

/**
 * Resolve genre profile from genres array
 * Tries exact match, then case-insensitive, then partial match
 */
export function resolveGenreProfile(genres?: string[]): GenreDimensionProfile {
  if (!genres || genres.length === 0) {
    return GENRE_PROFILES['default'];
  }

  const genreKeys = Object.keys(GENRE_PROFILES);

  // Try exact match first
  for (const genre of genres) {
    if (GENRE_PROFILES[genre]) {
      return GENRE_PROFILES[genre];
    }
  }

  // Try case-insensitive match
  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    const match = genreKeys.find(k => k.toLowerCase() === lowerGenre);
    if (match) {
      return GENRE_PROFILES[match];
    }
  }

  // Try partial match (genre contains or is contained by key)
  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    const match = genreKeys.find(k => {
      const lowerKey = k.toLowerCase();
      return lowerKey.includes(lowerGenre) || lowerGenre.includes(lowerKey);
    });
    if (match) {
      return GENRE_PROFILES[match];
    }
  }

  return GENRE_PROFILES['default'];
}

/**
 * Apply tag modifiers to base dimensions
 */
interface DimensionModResult {
  width: number;
  height: number;
  aspectRatio: number;
  personality: SpinePersonality;
  appliedModifiers: string[];
}

function applyTagModifiers(
  baseDimensions: { width: number; height: number },
  baseProfile: GenreDimensionProfile,
  tags: string[]
): DimensionModResult {
  let width = baseDimensions.width;
  let height = baseDimensions.height;
  let personality = baseProfile.personality;
  const appliedModifiers: string[] = [];

  // Normalize tags (lowercase, trim, replace spaces with hyphens)
  const normalizedTags = tags
    .map(t => t.toLowerCase().trim().replace(/\s+/g, '-'))
    .filter(t => TAG_MODIFIERS[t] !== undefined);

  // Sort by priority (lower first, so higher priority applies last and wins)
  const sortedTags = normalizedTags
    .map(tag => ({ tag, modifier: TAG_MODIFIERS[tag]! }))
    .sort((a, b) => (a.modifier.priority ?? 0) - (b.modifier.priority ?? 0));

  // Apply each modifier
  for (const { tag, modifier } of sortedTags) {
    let applied = false;

    if (modifier.heightMultiplier) {
      height *= modifier.heightMultiplier;
      applied = true;
    }
    if (modifier.widthMultiplier) {
      width *= modifier.widthMultiplier;
      applied = true;
    }
    if (modifier.heightOffset) {
      height += modifier.heightOffset;
      applied = true;
    }
    if (modifier.widthOffset) {
      width += modifier.widthOffset;
      applied = true;
    }
    if (modifier.overridePersonality) {
      personality = modifier.overridePersonality;
      applied = true;
    }

    if (applied) {
      appliedModifiers.push(tag);
    }
  }

  // Clamp to valid ranges
  width = clamp(Math.round(width), 24, 85);
  height = clamp(Math.round(height), 180, 500);

  return {
    width,
    height,
    aspectRatio: height / width,
    personality,
    appliedModifiers,
  };
}

/**
 * Calculate width for a series book (height is locked, width varies by duration)
 */
function calculateSeriesWidth(
  book: BookDimensionInput,
  _seriesDims: SeriesDimensions,
  _profile: GenreDimensionProfile
): number {
  // Width is DIRECTLY tied to duration - no genre/series modifiers
  // This ensures a 5-hour book is visibly thinner than a 65-hour book
  return calculateSpineWidth(book.duration);
}

/**
 * Calculate dimensions for a book spine based on genre, tags, duration, and series
 */
export function calculateBookDimensions(book: BookDimensionInput): CalculatedDimensions {
  // Step 1: Get base genre profile
  const profile = resolveGenreProfile(book.genres);

  // Step 2: Check series registry (consistency first)
  if (book.seriesName) {
    const seriesKey = normalizeSeriesName(book.seriesName);
    const seriesDims = seriesDimensionRegistry.get(seriesKey);

    if (seriesDims) {
      // Series exists - use locked height, calculate width
      const width = calculateSeriesWidth(book, seriesDims, profile);
      return {
        width,
        height: seriesDims.height,
        aspectRatio: seriesDims.height / width,
        profile,
        personality: seriesDims.personality,
        variationSeed: hashString(book.id),
        fromSeries: true,
      };
    }
  }

  // Step 3: Calculate base dimensions from profile + duration
  const seed = hashString(book.id);

  // Height variation within genre range
  const heightVariation = seededRandomFloat(seed, profile.heightRange[0], profile.heightRange[1]);
  let baseHeight = Math.round(profile.baseHeight * heightVariation);

  // Width: DIRECTLY from duration (28-70px based on audiobook length)
  // This is the primary driver - genre/tags don't affect width
  let baseWidth = calculateSpineWidth(book.duration);

  // Step 4: Apply tag modifiers (height only - width is duration-driven)
  const allTags = book.tags ?? [];
  const modified = applyTagModifiers(
    { width: baseWidth, height: baseHeight },
    profile,
    allTags
  );

  // Width stays duration-based, height can be modified by tags
  let finalWidth = baseWidth;  // Don't use modified.width - keep duration-based
  let finalHeight = modified.height;

  // Step 5: Enforce height constraints only (width is locked to duration)
  finalHeight = clamp(finalHeight, 180, 500);

  // Step 7: Register series if applicable
  if (book.seriesName) {
    const seriesKey = normalizeSeriesName(book.seriesName);
    if (!seriesDimensionRegistry.has(seriesKey)) {
      seriesDimensionRegistry.set(seriesKey, {
        height: finalHeight,
        baseWidth: finalWidth,
        personality: modified.personality,
        profile,
        lockedAt: Date.now(),
      });
    }
  }

  return {
    width: finalWidth,
    height: finalHeight,
    aspectRatio: finalHeight / finalWidth,
    profile,
    personality: modified.personality,
    variationSeed: seed,
    appliedModifiers: modified.appliedModifiers,
    fromSeries: false,
  };
}

/**
 * Batch calculate dimensions for multiple books
 * Processes series books together for consistency
 */
export function calculateBatchDimensions(books: BookDimensionInput[]): Map<string, CalculatedDimensions> {
  const results = new Map<string, CalculatedDimensions>();

  // Group by series first
  const seriesGroups = new Map<string, BookDimensionInput[]>();
  const standalones: BookDimensionInput[] = [];

  for (const book of books) {
    if (book.seriesName) {
      const key = normalizeSeriesName(book.seriesName);
      if (!seriesGroups.has(key)) {
        seriesGroups.set(key, []);
      }
      seriesGroups.get(key)!.push(book);
    } else {
      standalones.push(book);
    }
  }

  // Process series groups first (first book in each series sets the height)
  for (const [_, seriesBooks] of seriesGroups) {
    // Sort by some deterministic order (id) to ensure consistent "first" book
    seriesBooks.sort((a, b) => a.id.localeCompare(b.id));

    for (const book of seriesBooks) {
      results.set(book.id, calculateBookDimensions(book));
    }
  }

  // Process standalones
  for (const book of standalones) {
    results.set(book.id, calculateBookDimensions(book));
  }

  return results;
}

// =============================================================================
// AUTHOR BOX STYLE RESOLUTION
// =============================================================================

// Tag-to-box-style mapping for overrides
const TAG_BOX_STYLE_OVERRIDES: Record<string, AuthorBoxStyle> = {
  'thriller': 'classic',
  'crime': 'classic',
  'noir': 'bold',
  'police-procedural': 'bold',
  'legal-thriller': 'bold',
  'business': 'minimal',
  'self-help': 'minimal',
  'bestseller': 'classic',
  'history': 'classic',
  'biography': 'classic',
  'true-crime': 'bold',
};

// Tags that should NEVER have boxes (override genre preference)
const TAGS_NO_BOX: string[] = [
  'literary-fiction',
  'poetry',
  'gothic',
  'cozy',
  'cozy-fantasy',
  'cozy-mystery',
  'romance',
  'award-winner',
  'atmospheric',
];

/**
 * Resolve whether to show an author box based on typography preference,
 * layout orientation, and tag overrides
 */
export function resolveAuthorBox(
  typography: SpineTypography,
  orientation: 'horizontal' | 'vertical',
  tags?: string[]
): AuthorBoxConfig | null {
  // Only horizontal layouts can have boxes
  if (orientation !== 'horizontal') {
    return null;
  }

  // Check for tags that explicitly disable boxes
  if (tags && tags.length > 0) {
    const normalizedTags = tags.map(t => t.toLowerCase().trim().replace(/\s+/g, '-'));
    if (normalizedTags.some(tag => TAGS_NO_BOX.includes(tag))) {
      return null;
    }
  }

  // Check typography preference
  const boxPref = typography.authorBox ?? 'never';
  if (boxPref === 'never' || boxPref === 'auto') {
    return null;  // 'auto' means solver decides orientation, but no box
  }

  // Determine box style from tags or default to 'classic'
  let boxStyle: AuthorBoxStyle = 'classic';
  if (tags && tags.length > 0) {
    const normalizedTags = tags.map(t => t.toLowerCase().trim().replace(/\s+/g, '-'));
    for (const tag of normalizedTags) {
      if (TAG_BOX_STYLE_OVERRIDES[tag]) {
        boxStyle = TAG_BOX_STYLE_OVERRIDES[tag];
        break;
      }
    }
  }

  const styleConfig = AUTHOR_BOX_STYLES[boxStyle];
  return {
    enabled: true,
    strokeWidth: styleConfig.strokeWidth,
    strokeColor: styleConfig.strokeColor,
    padding: { ...styleConfig.padding },
    borderRadius: styleConfig.borderRadius,
  };
}

// =============================================================================
// SPINE COLOR SYSTEM
// Genre-based background colors for visual variety
// =============================================================================

/**
 * Color palette for spine backgrounds based on genre personality
 * Each personality has multiple color options for variety within genre
 */
const PERSONALITY_COLORS: Record<SpinePersonality, string[]> = {
  // Playful - Bright, cheerful colors (children's, humor)
  playful: [
    '#FF6B6B', // Coral red
    '#4ECDC4', // Teal
    '#FFE66D', // Yellow
    '#95E1D3', // Mint
    '#F38181', // Salmon
    '#AA96DA', // Lavender
    '#FCBAD3', // Pink
    '#A8D8EA', // Sky blue
  ],
  // Classic - Rich, traditional library colors (fantasy, classics, mystery)
  classic: [
    '#722F37', // Wine/burgundy
    '#1A4D2E', // Forest green
    '#1E3A5F', // Navy blue
    '#9B2D5B', // Deep magenta
    '#4A235A', // Deep purple
    '#154360', // Dark blue
    '#1B4332', // Dark green
    '#8B3A62', // Plum pink
  ],
  // Modern - Cool, contemporary (sci-fi, young adult)
  modern: [
    '#2C3E50', // Charcoal blue
    '#34495E', // Steel gray
    '#8E44AD', // Purple
    '#16A085', // Teal
    '#2980B9', // Blue
    '#27AE60', // Green
    '#F39C12', // Orange
    '#1ABC9C', // Turquoise
  ],
  // Bold - High-impact, dramatic (thriller, crime, action)
  bold: [
    '#1C1C1C', // Near black
    '#C0392B', // Deep red
    '#192A56', // Dark navy
    '#2C3A47', // Dark slate
    '#B71540', // Crimson
    '#0C2461', // Midnight blue
    '#3C1361', // Deep purple
    '#1B1B2F', // Dark indigo
  ],
  // Refined - Muted, elegant (literary fiction)
  refined: [
    '#6D6875', // Warm gray
    '#B5838D', // Dusty rose
    '#7D8491', // Cool gray
    '#A5A58D', // Sage
    '#9370DB', // Medium purple
    '#6B705C', // Olive
    '#C9A9C7', // Lilac
    '#708090', // Slate gray
  ],
  // Stark - High contrast, dramatic (horror)
  stark: [
    '#0D0D0D', // Almost black
    '#1A1A2E', // Dark navy
    '#16213E', // Midnight
    '#200F21', // Dark purple
    '#2B0B0B', // Dark blood
    '#0F0E17', // Void black
    '#1C1427', // Dark violet
    '#0D1B1E', // Dark teal
  ],
  // Warm - Inviting, cozy (romance, memoir, self-help)
  warm: [
    '#E07A5F', // Terra cotta
    '#D4A373', // Tan
    '#BC6C25', // Amber
    '#DDA15E', // Gold
    '#FAEDCD', // Cream (light)
    '#CDB4DB', // Light purple
    '#FFC8DD', // Light pink
    '#BDE0FE', // Light blue
  ],
};

/**
 * Map genres to personalities for color selection
 * This supplements the typography personality for color choices
 */
const GENRE_TO_COLOR_PERSONALITY: Record<string, SpinePersonality> = {
  // Children's
  "Children's 0-2": 'playful',
  "Children's 3-5": 'playful',
  "Children's 6-8": 'playful',
  "Children's 9-12": 'playful',
  'Children': 'playful',
  'Kids': 'playful',
  // Young readers
  'Teen 13-17': 'modern',
  'Young Adult': 'modern',
  'New Adult': 'modern',
  'YA': 'modern',
  // Literary
  'Literary Fiction': 'refined',
  'Classics': 'classic',
  'Literature & Fiction': 'refined',
  'Literary': 'refined',
  // Speculative
  'Fantasy': 'classic',
  'Science Fiction': 'modern',
  'Sci-Fi': 'modern',
  'Horror': 'stark',
  // Crime & Thriller
  'Thriller': 'bold',
  'Mystery': 'classic',
  'Crime': 'bold',
  'True Crime': 'bold',
  'Suspense': 'bold',
  // Romance
  'Romance': 'warm',
  'Romantic Comedy': 'warm',
  'Contemporary Romance': 'warm',
  // Non-fiction
  'Biography': 'refined',
  'Memoir': 'warm',
  'Self-Help': 'warm',
  'Business': 'modern',
  'History': 'classic',
  'Science': 'modern',
  'Philosophy': 'refined',
  // Other
  'Humor': 'playful',
  'Comedy': 'playful',
  'Adventure': 'classic',
  'Action': 'bold',
  'Western': 'warm',
  'Historical Fiction': 'classic',
  'Urban Fantasy': 'modern',
  'Epic Fantasy': 'classic',
  'Cozy Mystery': 'warm',
  'Paranormal': 'stark',
  'Dystopian': 'modern',
  'LitRPG': 'modern',
  'GameLit': 'modern',
  'Progression Fantasy': 'modern',
};

/**
 * Vibrant spine color palette - single source of truth
 * Used as fallback when no genre data available
 * Also exported for direct use by components
 */
/**
 * Genre colors organized by COLOR THEORY
 * Using the color wheel for harmonious relationships
 *
 * RED (0°) - Passion, danger, excitement
 * ORANGE (30°) - Energy, warmth, creativity
 * YELLOW (60°) - Joy, optimism, youth
 * GREEN (120°) - Nature, growth, harmony
 * CYAN (180°) - Calm, clarity, refreshing
 * BLUE (240°) - Trust, intellect, depth
 * PURPLE (270°) - Mystery, spirituality, luxury
 * MAGENTA (300°) - Love, femininity, playfulness
 */
export const GENRE_BASE_COLORS: Record<string, string> = {
  // ═══════════════════════════════════════════════════════════════
  // WARM REDS & CORALS - Muted, vintage feel
  // ═══════════════════════════════════════════════════════════════
  'Romance': '#C1666B',           // Dusty rose
  'Action': '#9E5A5A',            // Muted terracotta
  'Sports': '#8B4049',            // Faded brick
  'Politics': '#7D4E57',          // Dusty mauve-red
  'True Crime': '#6B3A3A',        // Deep burgundy

  // ═══════════════════════════════════════════════════════════════
  // WARM ORANGES & TERRACOTTA - Earthy, cozy tones
  // ═══════════════════════════════════════════════════════════════
  'Self-Help': '#C08552',         // Warm caramel
  'Business': '#9A7B4F',          // Antique brass
  'Food & Cooking': '#D4A574',    // Soft peach
  'Personal Finance': '#B8860B',  // Dark goldenrod
  'Western': '#A0522D',           // Sienna

  // ═══════════════════════════════════════════════════════════════
  // WARM YELLOWS & OCHRES - Soft, mustard tones
  // ═══════════════════════════════════════════════════════════════
  "Children's 0-2": '#E8C872',    // Soft gold
  "Children's 3-5": '#D4A84B',    // Warm mustard
  "Children's 6-8": '#C9A227',    // Antique gold
  "Children's 9-12": '#B8963E',   // Old gold
  'Humor': '#DEB841',             // Harvest yellow
  'Satire': '#C4A35A',            // Muted ochre

  // ═══════════════════════════════════════════════════════════════
  // SAGE & OLIVE GREENS - Muted, natural tones
  // ═══════════════════════════════════════════════════════════════
  'Fantasy': '#5F7161',           // Sage green
  'Nature': '#6B7B3E',            // Olive
  'Health & Wellness': '#7D8C6E', // Dusty sage

  // ═══════════════════════════════════════════════════════════════
  // LITERARY GENRES - Spread across spectrum
  // ═══════════════════════════════════════════════════════════════
  'Adventure': '#8B7355',         // Warm khaki
  'Classics': '#6B4423',          // Antique brown
  'Literary Fiction': '#5B6178',  // Slate blue-gray
  'Fiction': '#7B8B8B',           // Warm gray

  // ═══════════════════════════════════════════════════════════════
  // DUSTY TEALS - Muted, calm tones
  // ═══════════════════════════════════════════════════════════════
  'Young Adult': '#5D8A8E',       // Dusty teal
  'New Adult': '#6B9A9E',         // Soft teal
  'Teen 13-17': '#7BA3A4',        // Faded seafoam
  'Travel': '#4D7C7F',            // Deep dusty teal
  'Contemporary Fiction': '#5A7F7E', // Muted cyan

  // ═══════════════════════════════════════════════════════════════
  // DUSTY BLUES - Powder blues, slate tones
  // ═══════════════════════════════════════════════════════════════
  'Science Fiction': '#4A5D7A',   // Slate blue
  'Science': '#5B7B9A',           // Dusty steel blue
  'Popular Science': '#8BA4B5',   // Powder blue
  'Education': '#6B8299',         // Muted periwinkle
  'Mystery': '#3D4F5F',           // Deep slate
  'Technology': '#7A99AC',        // Soft steel
  'Journalism': '#5A7A8C',        // Dusty blue
  'Historical Fiction': '#4A6670', // Dark teal-blue

  // ═══════════════════════════════════════════════════════════════
  // MUTED PURPLES & MAUVES - Soft, dusty tones
  // ═══════════════════════════════════════════════════════════════
  'Horror': '#4A3F55',            // Deep dusty purple
  'Philosophy': '#5D4E6D',        // Muted grape
  'Religion & Spirituality': '#7A6B8A', // Dusty lavender
  'Art': '#8B7B9B',               // Soft mauve
  'Psychology': '#6B5B7B',        // Muted violet
  'Memoir': '#9A8BA8',            // Pale dusty purple

  // ═══════════════════════════════════════════════════════════════
  // DUSTY PINKS & ROSES - Warm, muted tones
  // ═══════════════════════════════════════════════════════════════
  "Women's Fiction": '#B07B8E',   // Dusty rose
  'LGBTQ+ Fiction': '#C49CA4',    // Soft pink
  'Parenting & Family': '#D4B5B8', // Pale blush
  'Music': '#8B6B75',             // Muted mauve

  // ═══════════════════════════════════════════════════════════════
  // WARM NEUTRALS - Sophisticated grays with warmth
  // ═══════════════════════════════════════════════════════════════
  'Thriller': '#2F2F2F',          // Charcoal
  'Crime': '#3D3D3D',             // Dark charcoal
  'Suspense': '#4A4A4A',          // Medium charcoal
  'History': '#5C5347',           // Warm gray-brown
  'Biography': '#7A7265',         // Taupe
  'Autobiography': '#9A9285',     // Light taupe
  'Non-Fiction': '#6B6560',       // Warm gray
  'Essays': '#5A5650',            // Stone gray
  'Anthology': '#8A857D',         // Greige
  'Short Stories': '#ADA8A0',     // Pale stone
  'Adult': '#6A6A6A',             // Neutral gray
  'Literature & Fiction': '#5B5F70', // Cool slate
};

// Fallback palette for unknown genres
export const SPINE_COLOR_PALETTE = Object.values(GENRE_BASE_COLORS);

export interface SpineColor {
  backgroundColor: string;
  textColor: string;
}

/**
 * Get spine color based on genres and book ID
 * Uses genre-based personality mapping with hash-based selection within palette
 *
 * @param genres Array of genre strings
 * @param bookId Book ID for deterministic hash
 * @returns SpineColor with background and text colors
 */
/**
 * Adjust a hex color's hue and lightness based on a hash value
 * This creates variety within the same genre
 */
function adjustColorByHash(hex: string, hash: number): string {
  // Parse hex to RGB
  const color = hex.replace('#', '');
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);

  // Convert to HSL for easier manipulation
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  // Adjust hue by ±10 degrees based on hash
  const hueShift = ((hash % 20) - 10) / 360;
  h = (h + hueShift + 1) % 1;

  // Adjust lightness by ±10% based on hash
  const lightnessShift = ((hash >> 8) % 20 - 10) / 100;
  l = Math.max(0.1, Math.min(0.9, l + lightnessShift));

  // Convert back to RGB
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

/**
 * Get luminance of a color (0-1)
 */
function getLuminance(hex: string): number {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function getSpineColorForGenres(genres: string[], bookId: string): SpineColor {
  const hash = hashString(bookId);

  // Find base color for matching genre
  let baseColor: string | null = null;

  for (const genre of genres) {
    // Try exact match
    if (GENRE_BASE_COLORS[genre]) {
      baseColor = GENRE_BASE_COLORS[genre];
      break;
    }
    // Try case-insensitive match
    const lowerGenre = genre.toLowerCase();
    for (const [key, color] of Object.entries(GENRE_BASE_COLORS)) {
      if (key.toLowerCase() === lowerGenre) {
        baseColor = color;
        break;
      }
    }
    if (baseColor) break;

    // Try partial match
    for (const [key, color] of Object.entries(GENRE_BASE_COLORS)) {
      if (genre.includes(key) || key.includes(genre)) {
        baseColor = color;
        break;
      }
    }
    if (baseColor) break;
  }

  // Use genre color or fallback to hash-based selection
  if (!baseColor) {
    const fallbackIndex = Math.abs(hash) % SPINE_COLOR_PALETTE.length;
    baseColor = SPINE_COLOR_PALETTE[fallbackIndex];
  }

  // Adjust color slightly based on hash for variety
  const backgroundColor = adjustColorByHash(baseColor, hash);

  // Auto-detect text color based on background luminance
  const luminance = getLuminance(backgroundColor);
  const textColor = luminance > 0.5 ? '#1a1a1a' : '#FFFFFF';

  return { backgroundColor, textColor };
}

/**
 * Calculate relative luminance and return appropriate text color
 * Uses WCAG contrast ratio guidelines
 */
function getContrastTextColor(backgroundColor: string): string {
  // Parse hex color
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Use white text for dark backgrounds, dark text for light backgrounds
  // Threshold adjusted for better readability
  return luminance > 0.5 ? '#1a1a1a' : '#f5f5f0';
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const color = hex.replace('#', '');
  const r = Math.max(0, Math.floor(parseInt(color.substring(0, 2), 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(parseInt(color.substring(2, 4), 16) * (1 - percent)));
  const b = Math.max(0, Math.floor(parseInt(color.substring(4, 6), 16) * (1 - percent)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// =============================================================================
// GENERATIVE COMPOSITION SYSTEM
// Creates unique, editorial-style typographic layouts for each book
// =============================================================================

/**
 * Pick from array using hash for deterministic randomization
 */
function pickFromHash<T>(arr: readonly T[], hash: number, offset: number): T {
  const index = Math.abs((hash >> offset) % arr.length);
  return arr[index];
}

/**
 * Get single bit from hash as boolean
 */
function hashBit(hash: number, bit: number): boolean {
  return ((hash >> bit) & 1) === 1;
}

/**
 * Calculate letter spacing based on weight and case
 */
function calculateCompositionLetterSpacing(weight: CompositionWeight, textCase: CompositionCase): number {
  let base = 0;

  // Heavy weights need more spacing
  if (weight === 'black') base += 0.02;
  if (weight === 'bold') base += 0.01;

  // Uppercase needs more spacing
  if (textCase === 'uppercase') base += 0.05;

  // Light weights can be tighter
  if (weight === 'hairline' || weight === 'light') base -= 0.01;

  return base;
}

/**
 * Get genre composition profile with fallback resolution
 */
function getCompositionProfile(genres: string[]): GenreCompositionProfile {
  for (const genre of genres) {
    const normalized = genre.toLowerCase().trim();

    // Try exact match
    if (GENRE_COMPOSITION_PROFILES[normalized]) {
      return GENRE_COMPOSITION_PROFILES[normalized];
    }

    // Try kebab-case
    const kebab = normalized.replace(/\s+/g, '-');
    if (GENRE_COMPOSITION_PROFILES[kebab]) {
      return GENRE_COMPOSITION_PROFILES[kebab];
    }

    // Try partial match
    for (const [key, profile] of Object.entries(GENRE_COMPOSITION_PROFILES)) {
      if (key === 'default') continue;
      if (normalized.includes(key) || key.includes(normalized)) {
        return profile;
      }
    }
  }

  return GENRE_COMPOSITION_PROFILES['default'];
}

/**
 * Generate a unique spine composition for a book.
 * Uses book hash for deterministic randomization within genre constraints.
 *
 * @param bookId - Unique book identifier for hash
 * @param title - Book title
 * @param author - Author name
 * @param genres - Array of genre strings
 * @param seriesInfo - Optional series information
 * @returns SpineComposition with all layout configuration
 */
export function generateSpineComposition(
  bookId: string,
  title: string,
  author: string,
  genres: string[],
  seriesInfo?: { name: string; number: number }
): SpineComposition {
  const hash = hashString(bookId);
  const profile = getCompositionProfile(genres);

  // ─────────────────────────────────────────────────────────────────
  // TITLE DECISIONS
  // ─────────────────────────────────────────────────────────────────

  // Pick from genre's valid options based on hash
  let titleOrientation = pickFromHash(profile.titleOrientations, hash, 0);
  let titleScale = pickFromHash(profile.titleScales, hash, 1);
  const titleWeight = pickFromHash(profile.titleWeights, hash, 2);
  const titleCase = pickFromHash(profile.titleCases, hash, 3);

  // Adjust based on title length
  if (title.length > 20 && titleScale === 'shout') {
    titleScale = 'statement'; // Long titles can't be huge
  }

  // Count letters without spaces for stacking decisions
  const titleLettersOnly = title.replace(/\s+/g, '');
  const titleWordCount = title.trim().split(/\s+/).length;

  // Stacked-letters: ONLY for very short titles (≤8 letters, like "WHY" or "DUNE")
  // This creates the dramatic W-H-Y poster effect
  if (titleLettersOnly.length <= 8 && profile.prefersExperimental && hashBit(hash, 10)) {
    titleOrientation = 'stacked-letters';
  }

  // Stacked-words: Only for titles with 2-4 words, each word ≤12 chars
  // This creates the "ERSTE / LIEBE" effect
  const longestWord = title.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  if (titleWordCount >= 2 && titleWordCount <= 4 && longestWord <= 12) {
    // Keep stacked-words if profile allows it
  } else if (titleOrientation === 'stacked-words') {
    // Title too complex for stacked-words, fall back
    titleOrientation = 'vertical-up';
  }

  // SAFETY: Force fallback for any title too long for special orientations
  if (titleOrientation === 'stacked-letters' && titleLettersOnly.length > 8) {
    titleOrientation = 'vertical-up';
  }
  if (titleOrientation === 'stacked-words' && (titleWordCount > 4 || longestWord > 12)) {
    titleOrientation = 'vertical-up';
  }

  // Position influenced by layout alignment
  let titlePosition: CompositionTitlePosition = 'center';
  const alignment = pickFromHash(profile.alignments, hash, 10);
  if (alignment === 'top-heavy' && hashBit(hash, 4)) {
    titlePosition = 'top-offset';
  } else if (alignment === 'bottom-heavy' && hashBit(hash, 5)) {
    titlePosition = 'bottom-offset';
  }

  // Letter spacing and line height
  const titleLetterSpacing = calculateCompositionLetterSpacing(titleWeight, titleCase);

  // Get font-specific line height
  // For stacked letters, use tight line height; otherwise use title line height
  const typography = getTypographyForGenres(genres, bookId);
  const resolvedFont = getPlatformFont(typography.fontFamily);
  const fontLineHeights = FONT_LINE_HEIGHTS[resolvedFont] || FONT_LINE_HEIGHTS['default'];
  const titleLineHeight = titleOrientation === 'stacked-letters'
    ? fontLineHeights.tight   // Very tight for stacked letters
    : fontLineHeights.title;  // Font-specific title line height

  // ─────────────────────────────────────────────────────────────────
  // AUTHOR DECISIONS
  // ─────────────────────────────────────────────────────────────────

  let authorOrientation = pickFromHash(profile.authorOrientations, hash, 6);

  // Resolve relative orientations
  if (authorOrientation === 'match-title') {
    authorOrientation = titleOrientation === 'stacked-letters'
      ? 'horizontal'
      : (titleOrientation === 'stacked-words' ? 'horizontal' : titleOrientation) as CompositionAuthorOrientation;
  } else if (authorOrientation === 'oppose-title') {
    authorOrientation = (titleOrientation === 'horizontal' || titleOrientation === 'stacked-letters' || titleOrientation === 'stacked-words')
      ? 'vertical-up'
      : 'horizontal';
  }

  const authorTreatment = pickFromHash(profile.authorTreatments, hash, 7);
  const authorScale = pickFromHash(profile.authorScales, hash, 8);
  const authorWeight: CompositionWeight = profile.prefersBold ? 'medium' : 'regular';
  const authorCase: CompositionCase = profile.prefersClassic ? 'capitalize' : 'uppercase';

  // Name splitting decision
  const authorWords = author.split(' ');
  let splitNames = false;
  if (authorWords.length >= 2 && hashBit(hash, 11)) {
    // Can split names when there's room (not horizontal with horizontal title)
    if (authorOrientation !== 'horizontal' || titleOrientation !== 'horizontal') {
      splitNames = true;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // LAYOUT DECISIONS
  // ─────────────────────────────────────────────────────────────────

  const density = pickFromHash(profile.densities, hash, 9);

  // ─────────────────────────────────────────────────────────────────
  // DECORATION DECISIONS
  // ─────────────────────────────────────────────────────────────────

  const lineStyle = pickFromHash(profile.lineStyles, hash, 11);
  const decorElement = pickFromHash(profile.decorativeElements, hash, 12);

  // Series books always show number
  const showSeriesNumber = !!seriesInfo;
  const seriesNumberStyle = pickFromHash(
    ['plain', 'circled', 'boxed'] as const,
    hash,
    13
  );

  // Year shown occasionally for classic/non-fiction
  const showYear = profile.prefersClassic && hashBit(hash, 14);

  // ─────────────────────────────────────────────────────────────────
  // ASSEMBLE COMPOSITION
  // ─────────────────────────────────────────────────────────────────

  return {
    title: {
      text: title,
      orientation: titleOrientation,
      scale: titleScale,
      weight: titleWeight,
      case: titleCase,
      position: titlePosition,
      letterSpacing: titleLetterSpacing,
      lineHeight: titleLineHeight,
    },
    author: {
      text: author,
      orientation: authorOrientation,
      treatment: authorTreatment,
      scale: authorScale,
      weight: authorWeight,
      case: authorCase,
      splitNames,
    },
    layout: {
      density,
      alignment,
    },
    decoration: {
      lineStyle,
      element: decorElement,
      showSeriesNumber,
      seriesNumber: seriesInfo?.number,
      seriesNumberStyle,
      showYear,
    },
    hash,
  };
}

/**
 * Get font weight number from composition weight
 */
export function getCompositionFontWeight(weight: CompositionWeight): number {
  switch (weight) {
    case 'hairline': return 100;
    case 'light': return 300;
    case 'regular': return 400;
    case 'medium': return 500;
    case 'bold': return 700;
    case 'black': return 900;
    default: return 400;
  }
}

/**
 * Apply case transformation to text
 */
export function applyCompositionCase(text: string, textCase: CompositionCase): string {
  switch (textCase) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'capitalize': return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    case 'preserve':
    default: return text;
  }
}

/**
 * Get line width from line style
 */
export function getLineWidth(style: CompositionLineStyle): number {
  switch (style) {
    case 'thin': return 0.5;
    case 'medium': return 1;
    case 'thick': return 2;
    case 'double': return 1; // Rendered as two 1px lines
    case 'none':
    default: return 0;
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Check if a color is light (luminance > threshold)
 */
export function isLightColor(hex: string, threshold = 0.4): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > threshold;
}

/**
 * Darken a hex color by a percentage (exported for use in BookshelfView)
 */
export function darkenColorForDisplay(hex: string, percent: number = 0.65): string {
  return darkenColor(hex, percent);
}

export {
  BASE_HEIGHT,
  MIN_HEIGHT,
  MAX_HEIGHT,
  MIN_WIDTH,
  MAX_WIDTH,
  MEDIAN_WIDTH,
  MIN_TOUCH_TARGET,
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_PRESETS,
};
