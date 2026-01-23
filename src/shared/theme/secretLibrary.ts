/**
 * src/shared/theme/secretLibrary.ts
 *
 * Secret Library Design System
 * Clean, editorial design inspired by classic book design.
 *
 * Now theme-aware! Use useSecretLibraryColors() hook in components
 * for automatic dark/light mode support.
 *
 * Uses system fonts by default (Georgia/serif, System/sans-serif, Menlo/monospace).
 * For custom fonts, install expo-google-fonts packages:
 *   - Playfair Display (titles)
 *   - Inter (body)
 *   - JetBrains Mono (metadata)
 *   - Cormorant Garamond (author names)
 *   - Oswald (uppercase titles)
 *   - Shadows Into Light (handwritten)
 */

import { Platform } from 'react-native';
import { useThemeStore } from './themeStore';

// =============================================================================
// COLORS - LIGHT MODE (Original Secret Library palette)
// =============================================================================

export const secretLibraryLightColors = {
  // Mode indicator for theme detection
  isDark: false as const,

  // Core
  black: '#0f0f0f',
  white: '#e8e8e8',
  cream: '#e8e8e8',
  creamGray: '#e8e8e8', // Grey version of cream (same lightness, no warmth)
  buttonGray: '#d8d8d8', // Subtle button background (slightly darker than creamGray)

  // Grays
  gray: '#888888',
  grayLight: '#F5F5F5',
  grayLine: '#E0E0E0',

  // Accent colors (for covers/spines)
  orange: '#FF6B35',
  coral: '#FF5A5F',
  purple: '#8B5CF6',
  green: '#1A4D2E',
  olive: '#9BA17B',
  blue: '#0047FF',
  gold: '#F3B60C', // Primary accent color (warm gold)

  // Shelf mode
  shelfBg: '#0f0f0f',

  // Semantic (same naming, light mode values)
  text: '#000000',
  textSecondary: '#888888',
  textMuted: '#AAAAAA',
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  borderLight: 'rgba(0,0,0,0.06)',
} as const;

// =============================================================================
// COLORS - DARK MODE (Inverted Secret Library palette)
// =============================================================================

export const secretLibraryDarkColors = {
  // Mode indicator for theme detection
  isDark: true as const,

  // Core - inverted for dark mode
  black: '#FFFFFF',        // Text color (was black, now white)
  white: '#0f0f0f',        // Background color (soft black, not pure black)
  cream: '#1A1A1A',        // Dark warm surface
  creamGray: '#1F1F1F',    // Dark grey surface
  buttonGray: '#2A2A2A',   // Dark button background

  // Grays - adjusted for dark mode
  gray: '#999999',         // Slightly lighter for visibility
  grayLight: '#1A1A1A',    // Dark background
  grayLine: '#333333',     // Dark border

  // Accent colors (same in both modes - they're decorative)
  orange: '#FF6B35',
  coral: '#FF5A5F',
  purple: '#8B5CF6',
  green: '#1A4D2E',
  olive: '#9BA17B',
  blue: '#0047FF',
  gold: '#F3B60C', // Primary accent color (warm gold)

  // Shelf mode
  shelfBg: '#0f0f0f',

  // Semantic (same naming, dark mode values)
  text: '#FFFFFF',
  textSecondary: '#999999',
  textMuted: '#666666',
  background: '#000000',
  backgroundSecondary: '#1A1A1A',
  surface: '#1A1A1A',
  border: '#333333',
  borderLight: 'rgba(255,255,255,0.08)',
} as const;

// =============================================================================
// STATIC EXPORT (backwards compatibility - defaults to light mode)
// For StyleSheet.create() at module level. Use useSecretLibraryColors() in
// component render functions for theme-aware colors.
// =============================================================================

export const secretLibraryColors = secretLibraryLightColors;

// =============================================================================
// THEME-AWARE HOOK
// =============================================================================

export type SecretLibraryColors = typeof secretLibraryLightColors | typeof secretLibraryDarkColors;

/**
 * Hook to get theme-aware Secret Library colors.
 * Use this in components for automatic dark/light mode support.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const colors = useSecretLibraryColors();
 *   return <Text style={{ color: colors.black }}>Hello</Text>;
 * }
 * ```
 */
export function useSecretLibraryColors(): SecretLibraryColors {
  const mode = useThemeStore((state) => state.mode);
  return mode === 'dark' ? secretLibraryDarkColors : secretLibraryLightColors;
}

/**
 * Get Secret Library colors for a specific mode (non-reactive)
 * Use this for one-off color lookups outside of React components.
 */
export function getSecretLibraryColors(isDark: boolean): SecretLibraryColors {
  return isDark ? secretLibraryDarkColors : secretLibraryLightColors;
}

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * Font family names for use in StyleSheet
 *
 * CUSTOM GOOGLE FONTS - Install with:
 *   npx expo install expo-font \
 *     @expo-google-fonts/playfair-display \
 *     @expo-google-fonts/inter \
 *     @expo-google-fonts/jetbrains-mono \
 *     @expo-google-fonts/cormorant-garamond \
 *     @expo-google-fonts/oswald \
 *     @expo-google-fonts/cinzel \
 *     @expo-google-fonts/bebas-neue \
 *     @expo-google-fonts/lora \
 *     @expo-google-fonts/merriweather \
 *     @expo-google-fonts/bitter \
 *     @expo-google-fonts/crimson-text \
 *     @expo-google-fonts/roboto-slab \
 *     @expo-google-fonts/spectral
 *
 * Until fonts are installed, falls back to system fonts:
 * iOS: Georgia (serif), System (sans), Menlo (mono)
 * Android: serif, sans-serif, monospace
 */

// System font fallbacks
const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const sansFont = Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' });
const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// Google Font names (use these once fonts are loaded)
const PLAYFAIR = 'PlayfairDisplay_400Regular';
const PLAYFAIR_ITALIC = 'PlayfairDisplay_400Regular_Italic';
const PLAYFAIR_MEDIUM = 'PlayfairDisplay_500Medium';
const PLAYFAIR_SEMIBOLD = 'PlayfairDisplay_600SemiBold';
const PLAYFAIR_BOLD = 'PlayfairDisplay_700Bold';

const CINZEL = 'Cinzel_400Regular';
const CINZEL_MEDIUM = 'Cinzel_500Medium';
const CINZEL_SEMIBOLD = 'Cinzel_600SemiBold';
const CINZEL_BOLD = 'Cinzel_700Bold';

const BEBAS = 'BebasNeue_400Regular';

const LORA = 'Lora_400Regular';
const LORA_ITALIC = 'Lora_400Regular_Italic';
const LORA_MEDIUM = 'Lora_500Medium';
const LORA_SEMIBOLD = 'Lora_600SemiBold';
const LORA_BOLD = 'Lora_700Bold';

const MERRIWEATHER = 'Merriweather_400Regular';
const MERRIWEATHER_ITALIC = 'Merriweather_400Regular_Italic';
const MERRIWEATHER_BOLD = 'Merriweather_700Bold';

const BITTER = 'Bitter_400Regular';
const BITTER_MEDIUM = 'Bitter_500Medium';
const BITTER_SEMIBOLD = 'Bitter_600SemiBold';
const BITTER_BOLD = 'Bitter_700Bold';

const CRIMSON = 'CrimsonText_400Regular';
const CRIMSON_ITALIC = 'CrimsonText_400Regular_Italic';
const CRIMSON_SEMIBOLD = 'CrimsonText_600SemiBold';
const CRIMSON_BOLD = 'CrimsonText_700Bold';

const ROBOTO_SLAB = 'RobotoSlab_400Regular';
const ROBOTO_SLAB_MEDIUM = 'RobotoSlab_500Medium';
const ROBOTO_SLAB_BOLD = 'RobotoSlab_700Bold';

const SPECTRAL = 'Spectral_400Regular';
const SPECTRAL_ITALIC = 'Spectral_400Regular_Italic';
const SPECTRAL_MEDIUM = 'Spectral_500Medium';
const SPECTRAL_SEMIBOLD = 'Spectral_600SemiBold';

const OSWALD = 'Oswald_400Regular';
const OSWALD_MEDIUM = 'Oswald_500Medium';
const OSWALD_SEMIBOLD = 'Oswald_600SemiBold';

const INTER = 'Inter_400Regular';
const INTER_MEDIUM = 'Inter_500Medium';
const INTER_SEMIBOLD = 'Inter_600SemiBold';
const INTER_BOLD = 'Inter_700Bold';

const JETBRAINS = 'JetBrainsMono_400Regular';
const JETBRAINS_MEDIUM = 'JetBrainsMono_500Medium';
const JETBRAINS_BOLD = 'JetBrainsMono_700Bold';

const CORMORANT = 'CormorantGaramond_400Regular';
const CORMORANT_ITALIC = 'CormorantGaramond_400Regular_Italic';
const CORMORANT_MEDIUM = 'CormorantGaramond_500Medium';
const CORMORANT_LIGHT = 'CormorantGaramond_300Light';

export const secretLibraryFonts = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FONTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Playfair Display - Elegant serif for titles (Fantasy, Literary Fiction)
  playfair: {
    regular: serifFont,      // TODO: PLAYFAIR when loaded
    regularItalic: serifFont, // TODO: PLAYFAIR_ITALIC
    medium: serifFont,        // TODO: PLAYFAIR_MEDIUM
    mediumItalic: serifFont,
    semiBold: serifFont,      // TODO: PLAYFAIR_SEMIBOLD
    bold: serifFont,          // TODO: PLAYFAIR_BOLD
  },

  // Inter - Clean sans-serif for body text
  inter: {
    regular: sansFont,   // TODO: INTER
    medium: sansFont,    // TODO: INTER_MEDIUM
    semiBold: sansFont,  // TODO: INTER_SEMIBOLD
    bold: sansFont,      // TODO: INTER_BOLD
    extraBold: sansFont,
  },

  // JetBrains Mono - Monospace for metadata
  jetbrainsMono: {
    regular: monoFont,  // TODO: JETBRAINS
    medium: monoFont,   // TODO: JETBRAINS_MEDIUM
    bold: monoFont,     // TODO: JETBRAINS_BOLD
  },

  // Cormorant Garamond - Classic serif for author names
  cormorant: {
    light: serifFont,        // TODO: CORMORANT_LIGHT
    lightItalic: serifFont,
    regular: serifFont,      // TODO: CORMORANT
    regularItalic: serifFont, // TODO: CORMORANT_ITALIC
    medium: serifFont,       // TODO: CORMORANT_MEDIUM
  },

  // Oswald - Condensed sans for uppercase titles (Thriller, Action)
  oswald: {
    regular: sansFont,   // TODO: OSWALD
    medium: sansFont,    // TODO: OSWALD_MEDIUM
    semiBold: sansFont,  // TODO: OSWALD_SEMIBOLD
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GENRE-SPECIFIC FONTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Cinzel - Classic display for Fantasy, Epic, Historical
  cinzel: {
    regular: serifFont,   // TODO: CINZEL
    medium: serifFont,    // TODO: CINZEL_MEDIUM
    semiBold: serifFont,  // TODO: CINZEL_SEMIBOLD
    bold: serifFont,      // TODO: CINZEL_BOLD
  },

  // Bebas Neue - Bold condensed for Thriller, Action, Horror
  bebas: {
    regular: sansFont,  // TODO: BEBAS
  },

  // Lora - Elegant serif for Romance, Women's Fiction
  lora: {
    regular: serifFont,      // TODO: LORA
    regularItalic: serifFont, // TODO: LORA_ITALIC
    medium: serifFont,       // TODO: LORA_MEDIUM
    semiBold: serifFont,     // TODO: LORA_SEMIBOLD
    bold: serifFont,         // TODO: LORA_BOLD
  },

  // Merriweather - Readable serif for Non-Fiction, Biography
  merriweather: {
    regular: serifFont,      // TODO: MERRIWEATHER
    regularItalic: serifFont, // TODO: MERRIWEATHER_ITALIC
    bold: serifFont,         // TODO: MERRIWEATHER_BOLD
  },

  // Bitter - Slab serif for Crime, Mystery, Detective
  bitter: {
    regular: serifFont,   // TODO: BITTER
    medium: serifFont,    // TODO: BITTER_MEDIUM
    semiBold: serifFont,  // TODO: BITTER_SEMIBOLD
    bold: serifFont,      // TODO: BITTER_BOLD
  },

  // Crimson Text - Classic book font for Historical, Classics
  crimson: {
    regular: serifFont,      // TODO: CRIMSON
    regularItalic: serifFont, // TODO: CRIMSON_ITALIC
    semiBold: serifFont,     // TODO: CRIMSON_SEMIBOLD
    bold: serifFont,         // TODO: CRIMSON_BOLD
  },

  // Roboto Slab - Modern slab for Sci-Fi, Tech Thriller
  robotoSlab: {
    regular: serifFont,  // TODO: ROBOTO_SLAB
    medium: serifFont,   // TODO: ROBOTO_SLAB_MEDIUM
    bold: serifFont,     // TODO: ROBOTO_SLAB_BOLD
  },

  // Spectral - Screen-optimized serif for Literary Fiction
  spectral: {
    regular: serifFont,      // TODO: SPECTRAL
    regularItalic: serifFont, // TODO: SPECTRAL_ITALIC
    medium: serifFont,       // TODO: SPECTRAL_MEDIUM
    semiBold: serifFont,     // TODO: SPECTRAL_SEMIBOLD
  },

  // Shadows Into Light - Handwritten style (using serif as fallback)
  shadowsIntoLight: {
    regular: serifFont,
  },
} as const;

/**
 * Genre to font mapping for quick reference
 *
 * Fantasy/Epic       → Cinzel (classic, medieval feel)
 * Thriller/Action    → Bebas Neue or Oswald (bold, condensed)
 * Romance            → Lora (elegant, flowing)
 * Mystery/Crime      → Bitter (slab serif, noir feel)
 * Sci-Fi             → Roboto Slab (modern, technical)
 * Historical         → Crimson Text (classic book feel)
 * Literary Fiction   → Spectral or Playfair (refined)
 * Non-Fiction        → Merriweather (readable, authoritative)
 * Horror             → Bebas Neue (bold, impactful)
 */
export const genreFontMap = {
  fantasy: 'cinzel',
  'epic-fantasy': 'cinzel',
  'urban-fantasy': 'playfair',
  romance: 'lora',
  'paranormal-romance': 'lora',
  thriller: 'bebas',
  'psychological-thriller': 'oswald',
  mystery: 'bitter',
  crime: 'bitter',
  'sci-fi': 'robotoSlab',
  'space-opera': 'robotoSlab',
  historical: 'crimson',
  'historical-fiction': 'crimson',
  'literary-fiction': 'spectral',
  'non-fiction': 'merriweather',
  biography: 'merriweather',
  horror: 'bebas',
  default: 'playfair',
} as const;

/**
 * Typography presets for common use cases
 */
export const secretLibraryTypography = {
  // Page titles (48-52px Playfair)
  pageTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: 48,
    fontWeight: '400' as const,
    letterSpacing: -1,
    lineHeight: 1,
  },

  // Section titles (20px Playfair)
  sectionTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: 20,
    fontWeight: '400' as const,
  },

  // Book titles (16-18px Playfair medium)
  bookTitle: {
    fontFamily: secretLibraryFonts.playfair.medium,
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 1.2,
  },

  // Large display numbers (72px Playfair italic)
  displayNumber: {
    fontFamily: secretLibraryFonts.playfair.regularItalic,
    fontSize: 72,
    fontWeight: '400' as const,
    fontStyle: 'italic' as const,
  },

  // Progress percentage (32px Playfair italic)
  progressPercent: {
    fontFamily: secretLibraryFonts.playfair.regularItalic,
    fontSize: 32,
    fontStyle: 'italic' as const,
  },

  // Author/metadata (11-12px JetBrains Mono)
  metadata: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // Labels (8-10px JetBrains Mono uppercase)
  label: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },

  // Body text (14px Inter)
  body: {
    fontFamily: secretLibraryFonts.inter.regular,
    fontSize: 14,
    lineHeight: 1.6,
  },

  // Chapter title (14px Inter medium)
  chapterTitle: {
    fontFamily: secretLibraryFonts.inter.medium,
    fontSize: 14,
    fontWeight: '500' as const,
  },

  // Button text (13px Inter medium)
  button: {
    fontFamily: secretLibraryFonts.inter.medium,
    fontSize: 13,
    fontWeight: '500' as const,
  },

  // Pill/tag text (11px JetBrains Mono)
  pill: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: 11,
    fontWeight: '500' as const,
  },

  // Time display (10px JetBrains Mono)
  time: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: 10,
  },
} as const;

// =============================================================================
// SPACING
// =============================================================================

export const secretLibrarySpacing = {
  screenPaddingH: 24,
  screenPaddingV: 20,
  sectionGap: 24,
  itemGap: 16,
  elementGap: 8,
} as const;

// =============================================================================
// COMPONENT SIZES
// =============================================================================

export const secretLibrarySizes = {
  // Buttons
  iconButton: 30,
  iconButtonBorderRadius: 15,
  iconButtonIconSize: 12,

  playButton: 56,
  controlButton: 44,

  // Pill buttons
  pillHeight: 30,
  pillBorderRadius: 15,
  pillPaddingH: 10,

  // Cover images
  coverSmall: 72,
  coverMedium: 140,
  coverLarge: 200,

  // Progress bar
  progressBarHeight: 2,
  progressBarHeightThick: 3,

  // Header
  headerHeight: 50,
  logoSize: 28,
} as const;

// =============================================================================
// BOOK SPINE STYLES
// =============================================================================

export type SpineStyle =
  | 'classicWide'
  | 'tower'
  | 'thinClassic'
  | 'eastern'
  | 'handwritten'
  | 'compact';

export interface SpineStyleConfig {
  authorPercent: number;
  titlePercent: number;
  iconPercent: number;
  authorPosition: 'top-horizontal' | 'top-vertical-down' | 'bottom-vertical-up';
  titleFont: string;
  titleWeight: string;
  titleTransform?: 'uppercase';
  authorFont: string;
  authorWeight: string;
  authorStyle?: 'italic';
  authorTransform?: 'uppercase';
  authorColor?: string;
}

export const spineStyles: Record<SpineStyle, SpineStyleConfig> = {
  classicWide: {
    authorPercent: 15,
    titlePercent: 80,
    iconPercent: 5,
    authorPosition: 'top-horizontal',
    titleFont: secretLibraryFonts.playfair.medium,
    titleWeight: '500',
    authorFont: secretLibraryFonts.cormorant.medium,
    authorWeight: '500',
  },
  tower: {
    authorPercent: 20,
    titlePercent: 80,
    iconPercent: 0,
    authorPosition: 'bottom-vertical-up',
    titleFont: secretLibraryFonts.oswald.medium,
    titleWeight: '500',
    authorFont: secretLibraryFonts.cormorant.regular,
    authorWeight: '400',
    authorTransform: 'uppercase',
    authorColor: '#3a3a3a',
  },
  thinClassic: {
    authorPercent: 12,
    titlePercent: 83,
    iconPercent: 5,
    authorPosition: 'top-horizontal',
    titleFont: secretLibraryFonts.oswald.regular,
    titleWeight: '400',
    titleTransform: 'uppercase',
    authorFont: secretLibraryFonts.cormorant.regular,
    authorWeight: '400',
  },
  eastern: {
    authorPercent: 12,
    titlePercent: 83,
    iconPercent: 5,
    authorPosition: 'top-horizontal',
    titleFont: secretLibraryFonts.playfair.semiBold,
    titleWeight: '600',
    authorFont: secretLibraryFonts.cormorant.regular,
    authorWeight: '400',
  },
  handwritten: {
    authorPercent: 25,
    titlePercent: 70,
    iconPercent: 5,
    authorPosition: 'top-vertical-down',
    titleFont: secretLibraryFonts.shadowsIntoLight.regular,
    titleWeight: '400',
    authorFont: secretLibraryFonts.cormorant.regular,
    authorWeight: '400',
    authorColor: '#3a3a3a',
  },
  compact: {
    authorPercent: 25,
    titlePercent: 70,
    iconPercent: 5,
    authorPosition: 'bottom-vertical-up',
    titleFont: secretLibraryFonts.oswald.medium,
    titleWeight: '500',
    authorFont: secretLibraryFonts.cormorant.regular,
    authorWeight: '400',
    authorColor: '#3a3a3a',
  },
};

/**
 * Get a spine style based on book title/author for visual variety
 */
export function getSpineStyleForBook(bookId: string, title: string): SpineStyle {
  // Use hash of bookId for consistent but varied assignment
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = bookId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const styles: SpineStyle[] = ['classicWide', 'tower', 'thinClassic', 'eastern', 'handwritten', 'compact'];

  // Short titles get tower or compact
  if (title.length <= 10) {
    return Math.abs(hash) % 2 === 0 ? 'tower' : 'compact';
  }

  // Long titles get classicWide or eastern
  if (title.length > 25) {
    return Math.abs(hash) % 2 === 0 ? 'classicWide' : 'eastern';
  }

  // Medium titles get any style
  return styles[Math.abs(hash) % styles.length];
}

/**
 * Calculate spine dimensions based on title length and style
 */
export function getSpineDimensions(
  title: string,
  style: SpineStyle,
  baseHeight: number = 340
): { width: number; height: number } {
  const config = spineStyles[style];

  // Vary height based on style
  const heightVariation: Record<SpineStyle, number> = {
    classicWide: 0,
    tower: 80,      // Taller
    thinClassic: 40,
    eastern: 20,
    handwritten: -40, // Shorter
    compact: -80,
  };

  const height = baseHeight + heightVariation[style];

  // Width based on title length and style
  let width: number;
  if (style === 'tower') {
    width = 30 + (title.length > 15 ? 5 : 0);
  } else if (style === 'thinClassic') {
    width = 32 + (title.length > 20 ? 4 : 0);
  } else if (style === 'compact') {
    width = 36 + (title.length > 12 ? 4 : 0);
  } else if (style === 'classicWide') {
    width = 50 + Math.min(title.length * 0.5, 15);
  } else {
    width = 40 + Math.min(title.length * 0.3, 10);
  }

  return { width: Math.round(width), height };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const secretLibrary = {
  colors: secretLibraryColors,
  fonts: secretLibraryFonts,
  typography: secretLibraryTypography,
  spacing: secretLibrarySpacing,
  sizes: secretLibrarySizes,
  spineStyles,
  getSpineStyleForBook,
  getSpineDimensions,
} as const;

export default secretLibrary;
