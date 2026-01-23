/**
 * src/features/home/utils/spine/colors/lazyExtractor.ts
 *
 * Lazy color extraction for book spines.
 * Only extracts colors when spine becomes visible.
 */

import { useState, useEffect, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SpineColors {
  background: string;
  text: string;
  status: 'pending' | 'loading' | 'loaded' | 'error';
}

export interface ColorCache {
  [bookId: string]: SpineColors;
}

// =============================================================================
// IN-MEMORY CACHE
// =============================================================================

/** Global color cache - survives component unmounts */
const colorCache: ColorCache = {};

/** Set of books currently being extracted */
const extracting = new Set<string>();

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Get cached colors for a book.
 */
export function getCachedColors(bookId: string): SpineColors | null {
  return colorCache[bookId] || null;
}

/**
 * Set cached colors for a book.
 */
function setCachedColors(bookId: string, colors: SpineColors): void {
  colorCache[bookId] = colors;
}

/**
 * Clear color cache (for testing or memory management).
 */
export function clearColorCache(): void {
  Object.keys(colorCache).forEach(key => delete colorCache[key]);
  extracting.clear();
}

/**
 * Preload colors for specific books (e.g., current library items).
 */
export function preloadColors(books: Array<{ id: string; coverUrl?: string }>): void {
  books.forEach(book => {
    if (!book.coverUrl || colorCache[book.id]) return;

    // Queue for extraction (but don't block)
    extractColorAsync(book.id, book.coverUrl);
  });
}

// =============================================================================
// COLOR EXTRACTION
// =============================================================================

/**
 * Extract colors from cover image asynchronously.
 * Returns cached result immediately if available.
 */
async function extractColorAsync(
  bookId: string,
  coverUrl: string
): Promise<SpineColors> {
  // Check cache
  const cached = getCachedColors(bookId);
  if (cached && cached.status === 'loaded') {
    return cached;
  }

  // Check if already extracting
  if (extracting.has(bookId)) {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        const result = getCachedColors(bookId);
        if (result && result.status !== 'loading') {
          clearInterval(interval);
          resolve(result);
        }
      }, 100);
    });
  }

  // Mark as extracting
  extracting.add(bookId);
  setCachedColors(bookId, {
    background: '#F5F5F5',
    text: '#000000',
    status: 'loading',
  });

  try {
    // TODO: Import and use your actual color extraction library
    // const { getColors } = await import('@/path/to/color/extractor');
    // const result = await getColors(coverUrl, { /* options */ });

    // Placeholder - replace with real extraction
    const colors: SpineColors = {
      background: '#F5F5F5', // result.dominantColor
      text: '#000000',       // result.textColor
      status: 'loaded',
    };

    setCachedColors(bookId, colors);
    extracting.delete(bookId);
    return colors;
  } catch (error) {
    console.error(`[SpineColors] Failed to extract colors for ${bookId}:`, error);

    const fallback: SpineColors = {
      background: '#F5F5F5',
      text: '#000000',
      status: 'error',
    };

    setCachedColors(bookId, fallback);
    extracting.delete(bookId);
    return fallback;
  }
}

// =============================================================================
// REACT HOOK
// =============================================================================

/**
 * React hook for lazy color extraction.
 * Only extracts colors when component is mounted and visible.
 *
 * @param bookId - Unique book identifier
 * @param coverUrl - Cover image URL
 * @param enabled - Enable extraction (default: true)
 * @returns Spine colors with loading state
 *
 * @example
 * function BookSpine({ book }) {
 *   const colors = useSpineColors(book.id, book.coverUrl);
 *
 *   return (
 *     <View style={{ backgroundColor: colors.background }}>
 *       <Text style={{ color: colors.text }}>{book.title}</Text>
 *     </View>
 *   );
 * }
 */
export function useSpineColors(
  bookId: string,
  coverUrl: string | undefined,
  enabled: boolean = true
): SpineColors {
  // Start with cached or default
  const [colors, setColors] = useState<SpineColors>(() => {
    const cached = getCachedColors(bookId);
    return cached || {
      background: '#F5F5F5',
      text: '#000000',
      status: 'pending',
    };
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!enabled || !coverUrl || colors.status === 'loaded') {
      return;
    }

    // Extract colors when component mounts
    extractColorAsync(bookId, coverUrl).then(extracted => {
      if (isMountedRef.current) {
        setColors(extracted);
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [bookId, coverUrl, enabled, colors.status]);

  return colors;
}

// =============================================================================
// FALLBACK COLORS
// =============================================================================

/**
 * Get genre-based fallback colors when cover extraction fails.
 * Provides better defaults than pure grey.
 */
export function getGenreFallbackColors(genres: string[]): SpineColors {
  const genreLower = genres[0]?.toLowerCase() || '';

  // Map genres to appropriate colors
  if (genreLower.includes('fantasy')) {
    return { background: '#2C1810', text: '#F5E6D3', status: 'loaded' };
  }
  if (genreLower.includes('thriller') || genreLower.includes('mystery')) {
    return { background: '#1a1a1a', text: '#ffffff', status: 'loaded' };
  }
  if (genreLower.includes('romance')) {
    return { background: '#4a2c2a', text: '#f5e6e0', status: 'loaded' };
  }
  if (genreLower.includes('science fiction') || genreLower.includes('sci-fi')) {
    return { background: '#1a2332', text: '#e0e8f0', status: 'loaded' };
  }

  // Default grey
  return { background: '#F5F5F5', text: '#000000', status: 'loaded' };
}
