/**
 * src/features/home/utils/spine/profiles/types.ts
 *
 * Unified type definitions for spine genre profiles.
 * Combines typography (from spineTemplates), composition options,
 * and personality flags into a single coherent system.
 */

// =============================================================================
// SIZE SYSTEM
// =============================================================================

/** Size breakpoints for responsive spine templates */
export const SPINE_SIZE_BREAKPOINTS = {
  small: { max: 60 },           // < 60px: narrow spines
  medium: { min: 60, max: 90 }, // 60-90px: standard spines
  large: { min: 90 },           // > 90px: wide spines
} as const;

export type SpineSize = 'small' | 'medium' | 'large';

// =============================================================================
// FONT SYSTEM
// =============================================================================

export type FontFamily =
  // Serif fonts - elegant, traditional
  | 'PlayfairDisplay-Bold' | 'PlayfairDisplay-Regular'
  | 'Lora-Bold' | 'Lora-Regular'
  | 'NotoSerif-Bold' | 'NotoSerif-Regular'
  | 'LibreBaskerville-Bold' | 'LibreBaskerville-Regular'
  // Sans-serif - bold, modern
  | 'Oswald-Bold' | 'Oswald-Regular'
  | 'BebasNeue-Regular'
  // Display/Slab fonts - impactful
  | 'GravitasOne-Regular'
  | 'AlfaSlabOne-Regular'
  | 'Notable-Regular'
  | 'Federo-Regular'
  // Decorative/Themed fonts
  | 'MacondoSwashCaps-Regular'
  | 'UncialAntiqua-Regular'
  | 'GrenzeGotisch-Regular'
  | 'FleurDeLeah-Regular'
  | 'Charm-Regular'
  | 'AlmendraSC-Regular'
  // Futuristic fonts
  | 'Orbitron-Regular'
  | 'Silkscreen-Regular'
  | 'ZenDots-Regular'
  // Playful/Expressive fonts
  | 'Eater-Regular'
  | 'RubikBeastly-Regular'
  | 'Barriecito-Regular';

export type FontWeight = '300' | '400' | '500' | '600' | '700' | '800' | '900';

// =============================================================================
// TYPOGRAPHY ORIENTATIONS & PLACEMENTS
// =============================================================================

export type TitleOrientation =
  | 'horizontal'
  | 'vertical-up'
  | 'vertical-down'
  | 'vertical-two-row'
  | 'stacked-letters'
  | 'stacked-words'
  | 'vertical-with-horizontal-author';

export type AuthorOrientation =
  | 'horizontal'
  | 'vertical-up'
  | 'vertical-down'
  | 'vertical-two-row'
  | 'horizontal-below-title'
  | 'stacked-letters'
  | 'stacked-words';

export type TextCase = 'uppercase' | 'lowercase' | 'capitalize';
export type TextAlign = 'left' | 'center' | 'right' | 'top' | 'bottom';
export type TitlePlacement = 'top' | 'center' | 'bottom' | 'center-top' | 'center-bottom';
export type AuthorPlacement = 'top' | 'bottom';
export type AuthorTreatment = 'plain' | 'prefixed' | 'underlined' | 'boxed';

// =============================================================================
// TITLE CONFIGURATION
// =============================================================================

export interface TitleConfig {
  orientation: TitleOrientation;
  fontSize: number;
  weight: FontWeight;
  fontFamily: FontFamily;
  fontFamilies?: FontFamily[];  // Random selection per book
  case: TextCase;
  letterSpacing?: number;
  lineHeight?: number;
  lineHeightScale?: number;
  maxLines?: number;
  wordsPerLine?: number;
  textSplitPercent?: number;    // For vertical-two-row
  placement: TitlePlacement;
  placements?: TitlePlacement[]; // Random selection per book
  heightPercent: number;
  align?: TextAlign;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

export type TitleSizeOverride = Partial<TitleConfig>;

export interface TitleConfigWithSizes extends TitleConfig {
  sizes?: {
    small?: TitleSizeOverride;
    medium?: TitleSizeOverride;
    large?: TitleSizeOverride;
  };
}

// =============================================================================
// AUTHOR CONFIGURATION
// =============================================================================

export interface AuthorConfig {
  orientation: AuthorOrientation;
  fontSize: number;
  weight: FontWeight;
  fontFamily: FontFamily;
  fontFamilies?: FontFamily[];
  case: TextCase;
  lineHeight?: number;
  lineHeightScale?: number;
  textSplitPercent?: number;
  placement: AuthorPlacement;
  placements?: AuthorPlacement[];
  heightPercent: number;
  treatment?: AuthorTreatment;
  align?: TextAlign;
  letterSpacing?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

export type AuthorSizeOverride = Partial<AuthorConfig>;

export interface AuthorConfigWithSizes extends AuthorConfig {
  sizes?: {
    small?: AuthorSizeOverride;
    medium?: AuthorSizeOverride;
    large?: AuthorSizeOverride;
  };
}

// =============================================================================
// DECORATION CONFIGURATION
// =============================================================================

export type DecorationElement = 'none' | 'divider-line' | 'top-line' | 'bottom-line' | 'partial-border';
export type LineStyle = 'none' | 'thin' | 'medium' | 'thick' | 'double';

export interface DecorationConfig {
  element: DecorationElement;
  lineStyle: LineStyle;
}

// =============================================================================
// COMPOSITION OPTIONS (for generative layouts)
// =============================================================================

/** Title orientation options for composition */
export type CompositionTitleOrientation =
  | 'horizontal'
  | 'vertical-up'
  | 'vertical-down'
  | 'stacked-letters'
  | 'stacked-words';

/** Author orientation options for composition */
export type CompositionAuthorOrientation =
  | 'horizontal'
  | 'vertical-up'
  | 'vertical-down'
  | 'match-title'
  | 'oppose-title';

/** Scale presets for composition */
export type CompositionScale =
  | 'whisper'
  | 'tiny'
  | 'small'
  | 'normal'
  | 'balanced'
  | 'statement'
  | 'shout';

/** Font weight options for composition */
export type CompositionWeight =
  | 'hairline'
  | 'light'
  | 'regular'
  | 'medium'
  | 'bold'
  | 'black';

/** Text case options for composition */
export type CompositionCase =
  | 'uppercase'
  | 'lowercase'
  | 'capitalize'
  | 'none';

/** Author treatment options for composition */
export type CompositionAuthorTreatment =
  | 'plain'
  | 'prefixed'
  | 'underlined'
  | 'boxed'
  | 'bracketed';

/** Layout density options */
export type CompositionDensity =
  | 'minimal'
  | 'balanced'
  | 'dense'
  | 'asymmetric';

/** Vertical alignment options */
export type CompositionAlignment =
  | 'centered'
  | 'top-heavy'
  | 'bottom-heavy'
  | 'left-heavy'
  | 'scattered';

/** Line style options for composition */
export type CompositionLineStyle =
  | 'none'
  | 'thin'
  | 'medium'
  | 'thick'
  | 'double';

/** Decorative element options */
export type CompositionDecorativeElement =
  | 'none'
  | 'divider-line'
  | 'top-line'
  | 'bottom-line'
  | 'side-line'
  | 'partial-border'
  | 'corner-marks';

/**
 * Composition options define the valid ranges for generative layout decisions.
 * The composition generator picks from these arrays deterministically per book.
 */
export interface CompositionOptions {
  // Title options
  titleOrientations: CompositionTitleOrientation[];
  titleScales: CompositionScale[];
  titleWeights: CompositionWeight[];
  titleCases: CompositionCase[];

  // Author options
  authorOrientations: CompositionAuthorOrientation[];
  authorTreatments: CompositionAuthorTreatment[];
  authorScales: CompositionScale[];

  // Layout options
  densities: CompositionDensity[];
  alignments: CompositionAlignment[];

  // Decoration options
  lineStyles: CompositionLineStyle[];
  decorativeElements: CompositionDecorativeElement[];
}

// =============================================================================
// PERSONALITY FLAGS
// =============================================================================

/**
 * Personality flags bias composition decisions toward certain aesthetics.
 * Used by the generator to make smart defaults.
 */
export interface PersonalityFlags {
  prefersBold: boolean;         // Tends toward bold weights
  prefersMinimal: boolean;      // Tends toward minimal layouts
  prefersClassic: boolean;      // Traditional typography
  prefersExperimental: boolean; // Willing to try unusual layouts
}

// =============================================================================
// UNIFIED GENRE PROFILE
// =============================================================================

/**
 * Unified genre profile combining:
 * - Typography (fonts, sizes, orientations)
 * - Composition options (valid layout variations)
 * - Personality (aesthetic preferences)
 * - Matching rules (which genres use this profile)
 */
export interface GenreProfile {
  // Identity
  id: string;
  name: string;
  description: string;

  // Typography (base configuration with size variants)
  title: TitleConfigWithSizes;
  author: AuthorConfigWithSizes;
  decoration: DecorationConfig;

  // Composition options (for generative layouts)
  options: CompositionOptions;

  // Personality flags
  personality: PersonalityFlags;

  // Genre matching
  usedFor: string[];       // All genres this profile handles
  preferredFor?: string[]; // Genres this is optimal for
}

// =============================================================================
// GENERATED COMPOSITION (output from generator)
// =============================================================================

/**
 * Final composition generated for a specific book.
 * Deterministically picked from genre profile based on book ID hash.
 */
export interface GeneratedComposition {
  title: {
    orientation: CompositionTitleOrientation;
    scale: CompositionScale;
    weight: CompositionWeight;
    case: CompositionCase;
    letterSpacing: number;
  };

  author: {
    orientation: CompositionAuthorOrientation;
    treatment: CompositionAuthorTreatment;
    scale: CompositionScale;
    weight: CompositionWeight;
  };

  layout: {
    density: CompositionDensity;
    alignment: CompositionAlignment;
    authorPosition: 'top' | 'bottom';
  };

  decoration: {
    lineStyle: CompositionLineStyle;
    element: CompositionDecorativeElement;
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the size category for a spine width.
 */
export function getSpineSize(spineWidth: number): SpineSize {
  if (spineWidth < SPINE_SIZE_BREAKPOINTS.small.max) {
    return 'small';
  } else if (spineWidth <= SPINE_SIZE_BREAKPOINTS.medium.max) {
    return 'medium';
  }
  return 'large';
}

/**
 * Apply size-specific overrides to a config.
 * Returns the merged config for the given spine width.
 */
export function applySpineSizeOverrides<T extends TitleConfig | AuthorConfig>(
  baseConfig: T & { sizes?: { small?: Partial<T>; medium?: Partial<T>; large?: Partial<T> } },
  spineWidth: number
): T {
  const { sizes, ...defaultConfig } = baseConfig;

  if (!sizes) {
    return baseConfig as T;
  }

  const size = getSpineSize(spineWidth);
  const sizeOverride = sizes[size];

  if (!sizeOverride) {
    return baseConfig as T;
  }

  return { ...defaultConfig, ...sizeOverride } as T;
}

/**
 * Simple string hash for deterministic selection.
 * Same input always produces same output.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Select a font from fontFamilies array based on book title.
 * Deterministic: same book always gets same font.
 */
export function selectFontForBook(
  fontFamily: FontFamily,
  fontFamilies: FontFamily[] | undefined,
  bookTitle: string
): FontFamily {
  if (!fontFamilies || fontFamilies.length === 0) {
    return fontFamily;
  }
  const hash = hashString(bookTitle);
  const index = hash % fontFamilies.length;
  return fontFamilies[index];
}

/**
 * Select a placement from placements array based on book title.
 * Deterministic: same book always gets same placement.
 */
export function selectPlacementForBook<T extends TitlePlacement | AuthorPlacement>(
  defaultPlacement: T,
  placements: T[] | undefined,
  bookTitle: string
): T {
  if (!placements || placements.length === 0) {
    return defaultPlacement;
  }
  const hash = hashString(bookTitle);
  const index = hash % placements.length;
  return placements[index];
}
