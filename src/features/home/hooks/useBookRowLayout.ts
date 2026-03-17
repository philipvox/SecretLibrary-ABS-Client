/**
 * src/features/home/hooks/useBookRowLayout.ts
 *
 * Reusable hook for calculating book row layouts.
 * Uses pre-calculated spine cache for dimensions.
 * Handles leaning logic and scaling on top of cached data.
 * Used by BookshelfView, SeriesSpineCard, and other book row displays.
 */

import { useMemo, useCallback } from 'react';
import { BookSpineVerticalData } from '../components/BookSpineVertical';
// MIGRATED: Now using new spine system via adapter
import { calculateBookDimensions, hashString } from '../utils/spine/adapter';
import { SERVER_SPINE_BOX, PROCEDURAL_SPINE_BOX } from '../utils/spine/constants';
import { fitToBoundingBox, getDurationScale } from '../utils/spine/core/dimensions';
import { useSpineCacheStore } from '../stores/spineCache';

// =============================================================================
// TYPES
// =============================================================================

export interface BookLayoutInfo {
  book: BookSpineVerticalData;
  width: number;
  height: number;
  leanAngle: number;
  shouldLean: boolean;
  touchPadding: number;
}

export interface UseBookRowLayoutOptions {
  /** Scale factor for dimensions (default: 1) */
  scaleFactor?: number;
  /** @deprecated Ignored — bounding-box scaling preserves aspect ratio automatically */
  thicknessMultiplier?: number;
  /** Lean angle in degrees (default: 3) */
  leanAngle?: number;
  /** Minimum touch target width in pixels (default: 44) */
  minTouchTarget?: number;
  /** Gap between books in pixels (default: 9) */
  bookGap?: number;
  /** Whether to apply leaning logic (default: true) */
  enableLeaning?: boolean;
  /** Fixed height for all books (overrides calculated height) */
  fixedHeight?: number;
}

// =============================================================================
// CONSTANTS - Conservative defaults to prevent oversized spines
// =============================================================================

const DEFAULT_SCALE = 0.95;  // Reduced from 1 to prevent clipping
const DEFAULT_LEAN_ANGLE = 3;
const DEFAULT_MIN_TOUCH_TARGET = 44;
const DEFAULT_BOOK_GAP = 9;
const DEFAULT_DURATION = 6 * 60 * 60; // 6 hours


// =============================================================================
// HOOK
// =============================================================================

/**
 * Calculate layout information for a row of books.
 * Uses pre-calculated spine cache for dimensions when available.
 * Handles leaning patterns and touch targets.
 *
 * Leaning pattern:
 * - Every ~5 books, one book leans (direction based on hash)
 * - Last book always leans left (like a bookend)
 *
 * @param books Array of book data
 * @param options Configuration options
 * @returns Array of BookLayoutInfo with calculated dimensions and angles
 */
export function useBookRowLayout(
  books: BookSpineVerticalData[],
  options: UseBookRowLayoutOptions = {}
): BookLayoutInfo[] {
  const {
    scaleFactor = DEFAULT_SCALE,
    leanAngle = DEFAULT_LEAN_ANGLE,
    minTouchTarget = DEFAULT_MIN_TOUCH_TARGET,
    enableLeaning = true,
    fixedHeight,
  } = options;

  // Get spine cache for fast lookups
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);

  // Server spine settings
  const useServerSpines = useSpineCacheStore((state) => state.useServerSpines);
  const isHydrated = useSpineCacheStore((state) => state.isHydrated);

  // Per-row dimension fingerprint — only triggers recalc when a book IN THIS ROW
  // gets new server dimensions (not when any random book changes).
  // Replaces global serverSpineDimensionsVersion counter that caused all rows to recalc.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rowDimsSelector = useCallback((state: any) => {
    if (!state.isHydrated || !state.useServerSpines) return 0;
    let hash = 0;
    for (const book of books) {
      const d = state.serverSpineDimensions[book.id];
      if (d) {
        hash = (hash * 31 + d.width) | 0;
        hash = (hash * 31 + d.height) | 0;
      }
    }
    return hash;
  }, [books]);
  const rowDimsFingerprint = useSpineCacheStore(rowDimsSelector);

  return useMemo(() => {
    if (!books || books.length === 0) return [];

    const totalBooks = books.length;
    let nextLeanAt = 5; // First lean at index 5

    const isLastIndex = (index: number) => index === totalBooks - 1;

    return books.map((book, index) => {
      // Try to get from cache first
      const cached = getSpineData(book.id);

      let baseWidth: number;
      let baseHeight: number;
      let bookHash: number;

      if (cached) {
        // Use cached dimensions and hash
        baseWidth = cached.baseWidth;
        baseHeight = cached.baseHeight;
        bookHash = cached.hash;
      } else {
        // Fallback: calculate on the fly (for uncached books)
        const genres = book.genres || [];
        const tags = book.tags || [];
        const duration = book.duration || DEFAULT_DURATION;

        const calculated = calculateBookDimensions({
          id: book.id,
          genres,
          tags,
          duration,
          seriesName: book.seriesName,
        });

        baseWidth = calculated.width;
        baseHeight = calculated.height;
        bookHash = hashString(book.id);
      }

      // Read dimensions via getState() - version counter in deps triggers recalc
      const allDims = useSpineCacheStore.getState().serverSpineDimensions;
      const cachedServerDims = isHydrated ? allDims[book.id] : undefined;

      // Calculate width and height
      let width: number;
      let height: number;

      const duration = book.duration || DEFAULT_DURATION;
      const durationScale = getDurationScale(duration);

      if (fixedHeight) {
        // Fixed height override — preserve aspect ratio
        const targetHeight = fixedHeight * scaleFactor;
        const ratio = baseWidth / baseHeight;
        height = targetHeight;
        width = Math.round(targetHeight * ratio);
      } else if (useServerSpines && cachedServerDims) {
        // Server spines: Fit within max bounds preserving aspect ratio
        const { width: serverWidth, height: serverHeight } = cachedServerDims;

        const maxW = SERVER_SPINE_BOX.MAX_WIDTH * scaleFactor * durationScale;
        const maxH = SERVER_SPINE_BOX.MAX_HEIGHT * scaleFactor * durationScale;
        const fitted = fitToBoundingBox(serverWidth, serverHeight, maxW, maxH);
        width = fitted.width;
        height = fitted.height;

      } else {
        // Procedural spines: bounding-box fit preserves aspect ratio
        const maxW = PROCEDURAL_SPINE_BOX.MAX_WIDTH * scaleFactor * durationScale;
        const maxH = PROCEDURAL_SPINE_BOX.MAX_HEIGHT * scaleFactor * durationScale;
        const fitted = fitToBoundingBox(baseWidth, baseHeight, maxW, maxH);
        width = fitted.width;
        height = fitted.height;
      }

      // Calculate touch padding for small books
      const touchPadding = Math.max(0, Math.ceil((minTouchTarget - width) / 2));

      // Determine leaning
      let bookLeanAngle = 0;
      let shouldLean = false;

      if (enableLeaning && totalBooks > 1) {
        // Last book always leans LEFT (like a bookend)
        if (isLastIndex(index)) {
          bookLeanAngle = -leanAngle;
          shouldLean = true;
        } else {
          // Check if this book should lean
          shouldLean = index === nextLeanAt;
          if (shouldLean) {
            // Schedule next lean 5-9 books later
            nextLeanAt = index + 5 + (bookHash % 5);
            // Alternate lean direction based on hash
            bookLeanAngle = (bookHash % 2 === 0) ? leanAngle : -leanAngle;
          }
        }
      }

      // Enrich book with cached colors if not already present
      const enrichedBook = (book.backgroundColor && book.textColor)
        ? book
        : cached
          ? { ...book, backgroundColor: cached.backgroundColor, textColor: cached.textColor }
          : book;

      return {
        book: enrichedBook,
        width,
        height,
        leanAngle: bookLeanAngle,
        shouldLean,
        touchPadding,
      };
    });
  }, [books, scaleFactor, leanAngle, minTouchTarget, enableLeaning, fixedHeight, getSpineData, useServerSpines, rowDimsFingerprint, isHydrated]);
}

/**
 * Get the total width of a book row including gaps.
 */
export function getBookRowWidth(
  layouts: BookLayoutInfo[],
  gap: number = DEFAULT_BOOK_GAP
): number {
  if (layouts.length === 0) return 0;
  const booksWidth = layouts.reduce((sum, l) => sum + l.width + (l.touchPadding * 2), 0);
  const gapsWidth = (layouts.length - 1) * gap;
  return booksWidth + gapsWidth;
}

/**
 * Get the maximum height of books in a row.
 */
export function getBookRowHeight(layouts: BookLayoutInfo[]): number {
  if (layouts.length === 0) return 0;
  return Math.max(...layouts.map(l => l.height));
}
