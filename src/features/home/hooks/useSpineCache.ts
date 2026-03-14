/**
 * src/features/home/hooks/useSpineCache.ts
 *
 * Hook for accessing pre-calculated spine data from the cache.
 * Provides easy conversion to BookSpineVerticalData format.
 */

import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSpineCacheStore, CachedSpineData } from '../stores/spineCache';
import { BookSpineVerticalData } from '../components/BookSpineVertical';
import { LibraryItem } from '@/core/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ScaledSpineData {
  /** The BookSpineVerticalData for rendering */
  book: BookSpineVerticalData;
  /** Scaled width */
  width: number;
  /** Scaled height */
  height: number;
  /** Hash for deterministic randomization */
  hash: number;
  /** Touch padding for small books */
  touchPadding: number;
  /** Pre-computed typography (font family, weight, transforms, etc.) for consistency across screens */
  typography?: {
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    titleTransform: string;
    authorTransform: string;
    authorPosition: string;
    authorBox: string;
    letterSpacing: number;
    titleLetterSpacing: number;
    authorLetterSpacing: number;
    authorOrientationBias: string;
    contrast: string;
    titleWeight: string;
    authorWeight: string;
    authorAbbreviation: string;
  };
}

export interface UseSpineCacheOptions {
  /** Scale factor for dimensions (default: 1) */
  scaleFactor?: number;
  /** Width multiplier for spine thickness (default: 1) */
  thicknessMultiplier?: number;
  /** Minimum touch target width (default: 44) */
  minTouchTarget?: number;
}

// =============================================================================
// CONSTANTS - Conservative defaults to prevent oversized spines
// =============================================================================

const DEFAULT_SCALE = 0.95;  // Reduced from 1 to match BookshelfView dynamic scaling
const DEFAULT_THICKNESS_MULTIPLIER = 1.1;  // Reduced from 1.22 to prevent over-thickening
const DEFAULT_MIN_TOUCH_TARGET = 44;

// =============================================================================
// HOOK
// =============================================================================

/**
 * Get scaled spine data for a list of books.
 * Uses pre-calculated cache for dimensions.
 */
export function useSpineCache(
  bookIds: string[],
  options: UseSpineCacheOptions = {}
): ScaledSpineData[] {
  const {
    scaleFactor = DEFAULT_SCALE,
    thicknessMultiplier = DEFAULT_THICKNESS_MULTIPLIER,
    minTouchTarget = DEFAULT_MIN_TOUCH_TARGET,
  } = options;

  const getSpineDataBatch = useSpineCacheStore((state) => state.getSpineDataBatch);

  return useMemo(() => {
    const cachedItems = getSpineDataBatch(bookIds);

    return cachedItems.map((cached) => {
      const width = cached.baseWidth * scaleFactor * thicknessMultiplier;
      const height = cached.baseHeight * scaleFactor;
      const touchPadding = Math.max(0, Math.ceil((minTouchTarget - width) / 2));

      const book: BookSpineVerticalData = {
        id: cached.id,
        title: cached.title,
        author: cached.author,
        progress: cached.progress,
        genres: cached.genres,
        tags: cached.tags,
        duration: cached.duration,
        seriesName: cached.seriesName,
      };

      return {
        book,
        width,
        height,
        hash: cached.hash,
        touchPadding,
        typography: cached.typography,
      };
    });
  }, [bookIds, scaleFactor, thicknessMultiplier, minTouchTarget, getSpineDataBatch]);
}

/**
 * Convert LibraryItems to BookSpineVerticalData using cache.
 * Falls back to extracting from LibraryItem if not cached.
 */
export function useSpineCacheFromItems(
  items: LibraryItem[],
  options: UseSpineCacheOptions = {}
): ScaledSpineData[] {
  const bookIds = useMemo(() => items.map((i) => i.id), [items]);
  return useSpineCache(bookIds, options);
}

/**
 * Get a single book's cached spine data.
 */
export function useSingleSpineData(
  bookId: string | undefined,
  options: UseSpineCacheOptions = {}
): ScaledSpineData | null {
  const {
    scaleFactor = DEFAULT_SCALE,
    thicknessMultiplier = DEFAULT_THICKNESS_MULTIPLIER,
    minTouchTarget = DEFAULT_MIN_TOUCH_TARGET,
  } = options;

  const getSpineData = useSpineCacheStore((state) => state.getSpineData);

  return useMemo(() => {
    if (!bookId) return null;

    const cached = getSpineData(bookId);
    if (!cached) return null;

    const width = cached.baseWidth * scaleFactor * thicknessMultiplier;
    const height = cached.baseHeight * scaleFactor;
    const touchPadding = Math.max(0, Math.ceil((minTouchTarget - width) / 2));

    const book: BookSpineVerticalData = {
      id: cached.id,
      title: cached.title,
      author: cached.author,
      progress: cached.progress,
      genres: cached.genres,
      tags: cached.tags,
      duration: cached.duration,
      seriesName: cached.seriesName,
    };

    return {
      book,
      width,
      height,
      hash: cached.hash,
      touchPadding,
      composition: cached.composition,
      typography: cached.typography,
    };
  }, [bookId, scaleFactor, thicknessMultiplier, minTouchTarget, getSpineData]);
}

/**
 * Check if the spine cache is populated.
 */
export function useSpineCacheStatus() {
  return useSpineCacheStore(
    useShallow((state) => ({
      isPopulated: state.isPopulated,
      cacheSize: state.cache.size,
      lastPopulatedAt: state.lastPopulatedAt,
    }))
  );
}

/**
 * Get the populate function for manual cache population.
 */
export function usePopulateSpineCache() {
  return useSpineCacheStore((state) => state.populateFromLibrary);
}
