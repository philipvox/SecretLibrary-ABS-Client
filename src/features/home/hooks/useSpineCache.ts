/**
 * src/features/home/hooks/useSpineCache.ts
 *
 * Hook for accessing pre-calculated spine data from the cache.
 * Provides easy conversion to BookSpineVerticalData format.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSpineCacheStore } from '../stores/spineCache';
import { BookSpineVerticalData } from '../components/BookSpineVertical';
import { LibraryItem } from '@/core/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ScaledSpineData {
  book: BookSpineVerticalData;
  width: number;
  height: number;
  hash: number;
  touchPadding: number;
  accentColor?: string;
}

export interface UseSpineCacheOptions {
  scaleFactor?: number;
  thicknessMultiplier?: number;
  minTouchTarget?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_SCALE = 0.95;
const DEFAULT_THICKNESS_MULTIPLIER = 1.1;
const DEFAULT_MIN_TOUCH_TARGET = 44;

// =============================================================================
// HOOK
// =============================================================================

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
        accentColor: cached.accentColor,
      };
    });
  }, [bookIds, scaleFactor, thicknessMultiplier, minTouchTarget, getSpineDataBatch]);
}

export function useSpineCacheFromItems(
  items: LibraryItem[],
  options: UseSpineCacheOptions = {}
): ScaledSpineData[] {
  const bookIds = useMemo(() => items.map((i) => i.id), [items]);
  return useSpineCache(bookIds, options);
}

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
      accentColor: cached.accentColor,
    };
  }, [bookId, scaleFactor, thicknessMultiplier, minTouchTarget, getSpineData]);
}

export function useSpineCacheStatus() {
  return useSpineCacheStore(
    useShallow((state) => ({
      isPopulated: state.isPopulated,
      cacheSize: state.cache.size,
      lastPopulatedAt: state.lastPopulatedAt,
    }))
  );
}

export function usePopulateSpineCache() {
  return useSpineCacheStore((state) => state.populateFromLibrary);
}
