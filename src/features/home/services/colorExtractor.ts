/**
 * src/features/home/services/colorExtractor.ts
 *
 * Extracts accent colors from book cover images for spine rendering.
 * Uses react-native-image-colors (native Palette on Android, UIImageColors on iOS).
 */

import { getColors } from 'react-native-image-colors';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('ColorExtractor');

// Genre fallback colors — used when cover color extraction fails
const GENRE_FALLBACK: Record<string, string> = {
  fantasy: '#4A2C2A',
  'science-fiction': '#1A3A5C',
  'sci-fi': '#1A3A5C',
  mystery: '#2E3532',
  romance: '#7A3344',
  thriller: '#1C1C1C',
  biography: '#3D5A80',
  memoir: '#3D5A80',
  history: '#556B2F',
  children: '#5F7A61',
  horror: '#1A1A2E',
  literary: '#4A3728',
  fiction: '#3B3154',
  adventure: '#5C4033',
  humor: '#6B5B3E',
  comedy: '#6B5B3E',
  'self-help': '#2E5050',
  psychology: '#3A4A6B',
  science: '#2B4560',
  philosophy: '#4A4063',
  religion: '#5D4E37',
  spiritual: '#4D5A3D',
  classic: '#5E3A4A',
  poetry: '#5A3D5C',
  drama: '#4B2F3D',
  war: '#3D3D3D',
  crime: '#2D3436',
  detective: '#2D3436',
  western: '#6B4226',
  young: '#4A6E5A',
  teen: '#4A6E5A',
};

// Diverse palette for hash-based fallback when no genre matches
const HASH_PALETTE = [
  '#4A2C2A', '#1A3A5C', '#2E3532', '#7A3344', '#3D5A80',
  '#556B2F', '#5F7A61', '#1A1A2E', '#4A3728', '#3B3154',
  '#5C4033', '#6B5B3E', '#2E5050', '#3A4A6B', '#2B4560',
  '#4A4063', '#5D4E37', '#5A3D5C', '#4B2F3D', '#6B4226',
  '#2D3436', '#4D5A3D', '#5E3A4A', '#3D3D4D', '#4A5759',
  '#8B4513', '#293241', '#6B8E23', '#A0522D', '#2C4A2C',
];

/**
 * Extract the dominant accent color from a cover image URL.
 * Returns a hex color string, or null if extraction failed
 * (native module not available, network error, etc.).
 */
export async function extractAccentColor(coverUrl: string): Promise<string | null> {
  try {
    const result = await getColors(coverUrl, {
      fallback: '#000000',
      quality: 'low',
      pixelSpacing: 10,
    });

    let color: string | undefined;

    if (result.platform === 'android') {
      color = result.vibrant || result.dominant || result.darkVibrant;
    } else if (result.platform === 'ios') {
      color = result.primary || result.secondary || result.background;
    }

    if (color) {
      log.debug(`Extracted: ${color} from ${coverUrl.substring(0, 60)}...`);
      return color;
    }

    log.debug(`No color extracted from ${coverUrl.substring(0, 60)}...`);
    return null;
  } catch (err) {
    log.warn(`Color extraction failed: ${err}`);
    return null;
  }
}

/**
 * Simple string hash for deterministic color picking.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get a fallback color based on the book's genres and ID.
 * Uses genre keywords first, then falls back to a hash-based palette
 * so each book gets a deterministically unique color.
 */
export function getGenreFallbackColor(genres: string[], bookId?: string): string {
  const normalized = genres.map(g => g.toLowerCase());
  for (const genre of normalized) {
    for (const [key, color] of Object.entries(GENRE_FALLBACK)) {
      if (genre.includes(key)) return color;
    }
  }
  // Hash-based: pick from diverse palette so books don't all look the same
  const seed = bookId || genres.join(',') || 'default';
  return HASH_PALETTE[simpleHash(seed) % HASH_PALETTE.length];
}

/**
 * Parse a hex color to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Compute relative luminance (WCAG 2.0).
 */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check if a color is light (luminance > 0.5).
 */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.5;
}

/**
 * Get a text color (white or black) that contrasts well against the background.
 * Uses WCAG luminance calculation.
 */
export function getContrastTextColor(bgHex: string): string {
  return isLightColor(bgHex) ? '#1A1A1A' : '#F5F5F5';
}

/**
 * Darken a hex color by a factor (0-1, where 0 = black, 1 = unchanged).
 */
export function darkenColor(hex: string, factor: number = 0.6): string {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

/**
 * Ensure the accent color is dark enough for a text background.
 * If the extracted color is too light, darken it proportionally.
 */
export function ensureDarkBackground(hex: string): string {
  const lum = relativeLuminance(hex);
  // Very light — darken significantly
  if (lum > 0.6) return darkenColor(hex, 0.35);
  // Moderately light — darken a bit
  if (lum > 0.4) return darkenColor(hex, 0.55);
  // Slightly light — gentle darken
  if (lum > 0.25) return darkenColor(hex, 0.75);
  // Already dark enough
  return hex;
}

/**
 * Extract accent colors for a batch of books.
 * Processes in groups to avoid overwhelming the native bridge.
 * Returns a Map of bookId -> accent color.
 */
export async function extractColorsBatch(
  books: { id: string; coverUrl: string; genres: string[] }[],
  batchSize: number = 10
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < books.length; i += batchSize) {
    const batch = books.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (book) => {
        const color = await extractAccentColor(book.coverUrl);
        return { id: book.id, color };
      })
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const book = batch[j];
      if (result.status === 'fulfilled' && result.value.color) {
        results.set(result.value.id, result.value.color);
      } else {
        // Use genre fallback on failure or null extraction
        results.set(book.id, getGenreFallbackColor(book.genres, book.id));
      }
    }
  }

  return results;
}
