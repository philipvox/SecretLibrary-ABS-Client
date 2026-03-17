/**
 * src/features/home/hooks/useSeriesStackLayout.ts
 *
 * Hook and caching system for series book stack layouts.
 * Calculates dimensions for stacked book piles with consistent heights
 * and duration-based widths.
 *
 * Cache Strategy:
 * - Global Map stores pre-calculated layouts
 * - Cache key: seriesName + sorted book IDs
 * - Calculate once, reuse everywhere
 */

import { useMemo } from 'react';
// MIGRATED: Now using new spine system via adapter
import { hashString } from '../utils/spine/adapter';

// =============================================================================
// TYPES
// =============================================================================

export interface StackBookData {
  id: string;
  title: string;
  duration?: number; // seconds
  seriesSequence?: number;
}

export interface StackBookLayout {
  book: StackBookData;
  width: number;           // Thickness based on duration
  height: number;          // Same for all books in stack
  horizontalOffset: number; // -10 to +10 px for messy pile effect
  zIndex: number;          // Stack order (higher = on top)
  hash: number;            // For deterministic randomization
}

export interface UseSeriesStackLayoutOptions {
  /** Maximum number of books to display (default: 5) */
  maxBooks?: number;
  /** Fixed height for all books (default: 120) */
  bookHeight?: number;
  /** Scale factor for dimensions (default: 1) */
  scale?: number;
  /** Maximum horizontal offset in pixels (default: 10) */
  maxOffset?: number;
}

export interface StackSize {
  width: number;
  height: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_BOOKS = 5;
const DEFAULT_BOOK_HEIGHT = 120;
const DEFAULT_SCALE = 1;
const DEFAULT_MAX_OFFSET = 3; // Minimal offset for cleaner look

// Width calculation constants (horizontal span of book when lying flat)
const _BASE_WIDTH = 90;      // Base book width
const MIN_WIDTH = 70;       // Minimum book width
const MAX_WIDTH = 130;      // Maximum book width
const DEFAULT_DURATION = 8 * 60 * 60; // 8 hours default
const MAX_DURATION_HOURS = 40; // Cap for width calculation

// =============================================================================
// GLOBAL CACHE
// =============================================================================

interface CachedStackLayout {
  layouts: StackBookLayout[];
  createdAt: number;
}

const stackLayoutCache = new Map<string, CachedStackLayout>();

/**
 * Generate cache key from series name and book IDs
 */
function generateCacheKey(seriesName: string, bookIds: string[]): string {
  const sortedIds = [...bookIds].sort().join(',');
  return `${seriesName.toLowerCase().trim()}:${sortedIds}`;
}

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate width based on duration
 * Longer audiobooks = thicker spines
 */
function calculateWidthFromDuration(duration: number, scale: number): number {
  const hours = duration / 3600;
  const normalizedDuration = Math.min(hours / MAX_DURATION_HOURS, 1);

  // Linear interpolation from MIN to MAX based on duration
  const width = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * normalizedDuration;

  return Math.round(width * scale);
}

/**
 * Calculate horizontal offset for messy pile effect
 * Uses hash for deterministic "randomness"
 */
function calculateHorizontalOffset(hash: number, maxOffset: number): number {
  // Use hash to get a value in range [-maxOffset, +maxOffset]
  const normalized = ((hash % 1000) / 1000) * 2 - 1; // -1 to +1
  return Math.round(normalized * maxOffset);
}

/**
 * Calculate hash-based width variation
 * Adds subtle variation to width (±10%)
 */
function calculateHashVariation(hash: number): number {
  // Variation between 0.9 and 1.1
  return 0.9 + ((hash % 200) / 1000);
}

/**
 * Calculate layouts for a stack of books
 */
function calculateStackLayouts(
  books: StackBookData[],
  options: UseSeriesStackLayoutOptions
): StackBookLayout[] {
  const {
    maxBooks = DEFAULT_MAX_BOOKS,
    bookHeight = DEFAULT_BOOK_HEIGHT,
    scale = DEFAULT_SCALE,
    maxOffset = DEFAULT_MAX_OFFSET,
  } = options;

  // Limit books and sort by sequence if available
  const sortedBooks = [...books]
    .sort((a, b) => (a.seriesSequence || 0) - (b.seriesSequence || 0))
    .slice(0, maxBooks);

  const scaledHeight = Math.round(bookHeight * scale);

  return sortedBooks.map((book, index) => {
    const hash = hashString(book.id);
    const duration = book.duration || DEFAULT_DURATION;

    // Calculate width: base × duration factor × hash variation
    const durationWidth = calculateWidthFromDuration(duration, scale);
    const hashVariation = calculateHashVariation(hash);
    const width = Math.round(durationWidth * hashVariation);

    // Calculate horizontal offset for messy pile
    const horizontalOffset = calculateHorizontalOffset(hash, Math.round(maxOffset * scale));

    // Z-index: book 1 at bottom (index 0), last book on top
    const zIndex = index;

    return {
      book,
      width: Math.max(Math.round(MIN_WIDTH * scale), Math.min(Math.round(MAX_WIDTH * scale), width)),
      height: scaledHeight,
      horizontalOffset,
      zIndex,
      hash,
    };
  });
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get stack layout for a series of books.
 * Uses global cache for performance.
 *
 * @param seriesName Name of the series (for cache key)
 * @param books Array of book data
 * @param options Layout options
 * @returns Array of StackBookLayout with calculated dimensions
 */
export function useSeriesStackLayout(
  seriesName: string,
  books: StackBookData[],
  options: UseSeriesStackLayoutOptions = {}
): StackBookLayout[] {
  const {
    maxBooks = DEFAULT_MAX_BOOKS,
    bookHeight = DEFAULT_BOOK_HEIGHT,
    scale = DEFAULT_SCALE,
    maxOffset = DEFAULT_MAX_OFFSET,
  } = options;

  return useMemo(() => {
    if (!books || books.length === 0) return [];

    // Generate cache key
    const bookIds = books.slice(0, maxBooks).map(b => b.id);
    const cacheKey = generateCacheKey(seriesName, bookIds);

    // Check cache (include options in key for different scales)
    const optionsKey = `${cacheKey}:${bookHeight}:${scale}:${maxOffset}`;
    const cached = stackLayoutCache.get(optionsKey);

    if (cached) {
      return cached.layouts;
    }

    // Calculate layouts
    const layouts = calculateStackLayouts(books, options);

    // Store in cache
    stackLayoutCache.set(optionsKey, {
      layouts,
      createdAt: Date.now(),
    });

    return layouts;
  }, [seriesName, books, maxBooks, bookHeight, scale, maxOffset]);
}

/**
 * Calculate total size of a book stack
 *
 * @param layouts Array of book layouts
 * @param gap Vertical gap between books (default: 2)
 * @returns Size { width, height }
 */
export function useSeriesStackSize(
  layouts: StackBookLayout[],
  gap: number = 2
): StackSize {
  return useMemo(() => {
    if (layouts.length === 0) {
      return { width: 0, height: 0 };
    }

    // Height: all books stacked with gaps
    // Books overlap slightly, so we add partial height per book
    const overlapFactor = 0.15; // Each book shows 15% of the one below
    const firstBookHeight = layouts[0]?.height || 0;
    const additionalHeight = layouts.slice(1).reduce(
      (sum, layout) => sum + (layout.height * overlapFactor) + gap,
      0
    );
    const totalHeight = firstBookHeight + additionalHeight;

    // Width: maximum width + max possible offset on each side
    const maxWidth = Math.max(...layouts.map(l => l.width));
    const maxOffset = Math.max(...layouts.map(l => Math.abs(l.horizontalOffset)));
    const totalWidth = maxWidth + (maxOffset * 2);

    return {
      width: Math.ceil(totalWidth),
      height: Math.ceil(totalHeight),
    };
  }, [layouts, gap]);
}

/**
 * Pre-calculate and cache stack layout for a series.
 * Call this to warm the cache before rendering.
 *
 * @param seriesName Name of the series
 * @param books Array of book data
 * @param options Layout options
 */
export function precacheSeriesStack(
  seriesName: string,
  books: StackBookData[],
  options: UseSeriesStackLayoutOptions = {}
): void {
  if (!books || books.length === 0) return;

  const {
    maxBooks = DEFAULT_MAX_BOOKS,
    bookHeight = DEFAULT_BOOK_HEIGHT,
    scale = DEFAULT_SCALE,
    maxOffset = DEFAULT_MAX_OFFSET,
  } = options;

  const bookIds = books.slice(0, maxBooks).map(b => b.id);
  const cacheKey = generateCacheKey(seriesName, bookIds);
  const optionsKey = `${cacheKey}:${bookHeight}:${scale}:${maxOffset}`;

  // Skip if already cached
  if (stackLayoutCache.has(optionsKey)) {
    return;
  }

  // Calculate and cache
  const layouts = calculateStackLayouts(books, options);
  stackLayoutCache.set(optionsKey, {
    layouts,
    createdAt: Date.now(),
  });
}

/**
 * Clear the series stack layout cache.
 * Call this when library data changes significantly.
 */
export function clearSeriesStackCache(): void {
  stackLayoutCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getSeriesStackCacheStats(): { size: number; keys: string[] } {
  return {
    size: stackLayoutCache.size,
    keys: Array.from(stackLayoutCache.keys()),
  };
}
