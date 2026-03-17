/**
 * src/features/home/stores/spineCache.ts
 *
 * Centralized cache for pre-calculated book spine dimensions.
 * Single source of truth for all spine-related calculations.
 *
 * v10: Cover-art spine layout — accent colors extracted from covers,
 * typography removed (determined at render time by genre).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { sqliteCache } from '@/core/services/sqliteCache';
import { createLogger } from '@/shared/utils/logger';
import { apiClient } from '@/core/api';

import { calculateBookDimensions, hashString } from '../utils/spine/adapter';
import { extractAccentColor, getGenreFallbackColor, ensureDarkBackground } from '../services/colorExtractor';

const log = createLogger('SpineCache');

const DIMENSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// TYPE GUARDS
// =============================================================================

function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'metadata' in media && 'duration' in media;
}

function getBookMetadata(item: LibraryItem | null | undefined): BookMetadata | null {
  if (!item || !isBookMedia(item.media)) return null;
  return item.media.metadata;
}

function getBookDuration(item: LibraryItem | null | undefined): number {
  if (!item || !isBookMedia(item.media)) return 0;
  return item.media.duration || 0;
}


// =============================================================================
// TYPES
// =============================================================================

export interface CachedSpineData {
  id: string;
  baseWidth: number;
  baseHeight: number;
  hash: number;
  genres: string[];
  tags: string[];
  duration: number;
  seriesName?: string;
  title: string;
  author: string;
  progress: number;
  /** Accent color extracted from cover image (or genre fallback) */
  accentColor?: string;
}

/** Server spine dimension entry with timestamp for TTL-based expiry */
export interface SpineDimensionEntry {
  width: number;
  height: number;
  cachedAt: number;
}

export interface SpineCacheState {
  cache: Map<string, CachedSpineData>;
  isPopulated: boolean;
  lastPopulatedAt: number | null;
  useColoredSpines: boolean;
  useServerSpines: boolean;
  serverSpineDimensions: Record<string, SpineDimensionEntry>;
  isHydrated: boolean;
  serverSpineDimensionsVersion: number;
  /** Incremented when accent colors arrive — triggers re-renders */
  colorVersion: number;
  cachedManifestBookIds: string[];
  /** Persisted accent colors: bookId -> hex color */
  accentColors: Record<string, string>;
}

export interface SpineCacheActions {
  hydrateFromSQLite: (libraryId: string) => Promise<number>;
  populateFromLibrary: (items: LibraryItem[], libraryId?: string) => Promise<void>;
  getSpineData: (bookId: string) => CachedSpineData | undefined;
  getSpineDataBatch: (bookIds: string[]) => CachedSpineData[];
  updateProgress: (bookId: string, progress: number) => void;
  clearCache: () => void;
  setUseColoredSpines: (enabled: boolean) => void;
  setUseServerSpines: (enabled: boolean) => void;
  saveToSQLite: (libraryId: string) => Promise<void>;
  getServerSpineDimensions: (bookId: string) => { width: number; height: number } | undefined;
  setServerSpineDimensions: (bookId: string, width: number, height: number) => void;
  clearServerSpineDimensions: () => void;
  setCachedManifestBookIds: (bookIds: string[]) => void;
  getCachedManifestBookIds: () => string[];
  /** Set accent color for a single book */
  setAccentColor: (bookId: string, color: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function extractSpineData(item: LibraryItem, accentColors: Record<string, string>): CachedSpineData {
  const metadata = getBookMetadata(item);
  const genres = metadata?.genres || [];
  const tags = isBookMedia(item.media) ? item.media.tags || [] : [];
  const title = metadata?.title || '';
  const duration = getBookDuration(item) || 6 * 60 * 60;
  const seriesName = metadata?.seriesName || metadata?.series?.[0]?.name;
  const progress = item.userMediaProgress?.progress || 0;
  const author = metadata?.authorName || 'Unknown Author';

  const calculated = calculateBookDimensions({
    id: item.id,
    genres,
    tags,
    duration,
    seriesName,
  });

  return {
    id: item.id,
    baseWidth: calculated.width,
    baseHeight: calculated.height,
    hash: hashString(item.id),
    genres,
    tags,
    duration,
    seriesName,
    title,
    author,
    progress,
    accentColor: accentColors[item.id] || undefined,
  };
}

/**
 * Build the cover URL for a book (for color extraction).
 */
function buildCoverUrl(bookId: string): string | null {
  try {
    return apiClient.getItemCoverUrl(bookId);
  } catch {
    return null;
  }
}

// Track whether color extraction is already running to prevent duplicate batches
let _colorExtractionInProgress = false;

/**
 * Extract accent colors for books that don't have one yet.
 * Runs in background, updates store as colors arrive.
 */
async function extractMissingColors(
  items: LibraryItem[],
  existingColors: Record<string, string>,
  setAccentColor: (bookId: string, color: string) => void,
) {
  if (_colorExtractionInProgress) return;
  _colorExtractionInProgress = true;

  try {
    const missing = items.filter(item => !existingColors[item.id]);
    if (missing.length === 0) return;

    log.debug(`Extracting accent colors for ${missing.length} books`);
    const BATCH_SIZE = 10;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (item) => {
        const coverUrl = buildCoverUrl(item.id);
        if (!coverUrl) {
          const metadata = getBookMetadata(item);
          return { id: item.id, color: getGenreFallbackColor(metadata?.genres || [], item.id) };
        }
        try {
          const raw = await extractAccentColor(coverUrl);
          if (raw) {
            const color = ensureDarkBackground(raw);
            return { id: item.id, color };
          }
          // Native module unavailable or no color found — use genre/hash fallback
          const metadata = getBookMetadata(item);
          return { id: item.id, color: getGenreFallbackColor(metadata?.genres || [], item.id) };
        } catch {
          const metadata = getBookMetadata(item);
          return { id: item.id, color: getGenreFallbackColor(metadata?.genres || [], item.id) };
        }
      });

      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          setAccentColor(result.value.id, result.value.color);
        }
      }
    }

    log.debug(`Finished extracting colors for ${missing.length} books`);
  } finally {
    _colorExtractionInProgress = false;
  }
}

// =============================================================================
// STORE
// =============================================================================

export const useSpineCacheStore = create<SpineCacheState & SpineCacheActions>()(
  persist(
    (set, get) => ({
      // State
      cache: new Map(),
      isPopulated: false,
      lastPopulatedAt: null,
      useColoredSpines: true,
      useServerSpines: true,
      serverSpineDimensions: {},
      isHydrated: false,
      serverSpineDimensionsVersion: 0,
      colorVersion: 0,
      cachedManifestBookIds: [],
      accentColors: {},

      // Actions

      hydrateFromSQLite: async (_libraryId: string): Promise<number> => {
        log.debug('Skipping SQLite hydration (colors computed fresh each launch)');
        return 0;
      },

      populateFromLibrary: async (items: LibraryItem[], libraryId?: string) => {
        const startTime = Date.now();
        const newCache = new Map<string, CachedSpineData>();
        const accentColors = get().accentColors;
        let computed = 0;

        for (const item of items) {
          if (!newCache.has(item.id)) {
            try {
              const spineData = extractSpineData(item, accentColors);
              newCache.set(item.id, spineData);
              computed++;
            } catch (error) {
              log.warn(`Failed to process item ${item.id}:`, error);
            }
          }
        }

        set({
          cache: newCache,
          isPopulated: true,
          lastPopulatedAt: Date.now(),
          colorVersion: get().colorVersion + 1,
        });

        const elapsed = Date.now() - startTime;
        log.debug(`Computed ${computed} spine entries in ${elapsed}ms`);

        if (libraryId) {
          sqliteCache.setSpineCache(libraryId, newCache).catch(err => {
            log.warn('Failed to save to SQLite:', err);
          });
        }

        // Queue background color extraction for books without accent colors
        extractMissingColors(items, accentColors, get().setAccentColor);
      },

      getSpineData: (bookId: string) => {
        return get().cache.get(bookId);
      },

      getSpineDataBatch: (bookIds: string[]) => {
        const cache = get().cache;
        const results: CachedSpineData[] = [];
        for (const id of bookIds) {
          const data = cache.get(id);
          if (data) results.push(data);
        }
        return results;
      },

      updateProgress: (bookId: string, progress: number) => {
        const cache = get().cache;
        const existing = cache.get(bookId);
        if (existing && existing.progress !== progress) {
          const newCache = new Map(cache);
          newCache.set(bookId, { ...existing, progress });
          set({ cache: newCache });
        }
      },

      clearCache: () => {
        set({
          cache: new Map(),
          isPopulated: false,
          lastPopulatedAt: null,
        });
      },

      setUseColoredSpines: (enabled: boolean) => {
        set({ useColoredSpines: enabled });
      },

      setUseServerSpines: (enabled: boolean) => {
        set({ useServerSpines: enabled });
      },

      getServerSpineDimensions: (bookId: string) => {
        const entry = get().serverSpineDimensions[bookId];
        if (!entry) return undefined;
        const age = Date.now() - entry.cachedAt;
        if (age > DIMENSION_CACHE_TTL_MS) return undefined;
        return { width: entry.width, height: entry.height };
      },

      setServerSpineDimensions: (bookId: string, width: number, height: number) => {
        const { serverSpineDimensions, serverSpineDimensionsVersion } = get();
        const existing = serverSpineDimensions[bookId];
        if (!existing || existing.width !== width || existing.height !== height) {
          set({
            serverSpineDimensions: {
              ...serverSpineDimensions,
              [bookId]: { width, height, cachedAt: Date.now() },
            },
            serverSpineDimensionsVersion: serverSpineDimensionsVersion + 1,
          });
        }
      },

      clearServerSpineDimensions: () => {
        set({ serverSpineDimensions: {}, serverSpineDimensionsVersion: get().serverSpineDimensionsVersion + 1 });
      },

      setCachedManifestBookIds: (bookIds: string[]) => {
        set({ cachedManifestBookIds: bookIds });
      },

      getCachedManifestBookIds: () => {
        return get().cachedManifestBookIds;
      },

      setAccentColor: (bookId: string, color: string) => {
        const { accentColors, cache, colorVersion } = get();

        // Persist the accent color
        const newAccentColors = { ...accentColors, [bookId]: color };

        // Also update the cached spine data if present
        const existing = cache.get(bookId);
        if (existing && existing.accentColor !== color) {
          const newCache = new Map(cache);
          newCache.set(bookId, { ...existing, accentColor: color });
          set({
            accentColors: newAccentColors,
            cache: newCache,
            colorVersion: colorVersion + 1,
          });
        } else {
          set({ accentColors: newAccentColors });
        }
      },

      saveToSQLite: async (libraryId: string) => {
        const { cache } = get();
        if (cache.size === 0) return;
        try {
          await sqliteCache.setSpineCache(libraryId, cache);
          log.debug(`Saved ${cache.size} items to SQLite`);
        } catch (error) {
          log.warn('Failed to save to SQLite:', error);
        }
      },

    }),
    {
      name: 'spine-settings',
      version: 12, // v12: Clear stale brown colors, use hash-based diverse fallback
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        useColoredSpines: state.useColoredSpines,
        useServerSpines: state.useServerSpines,
        serverSpineDimensions: state.serverSpineDimensions,
        cachedManifestBookIds: state.cachedManifestBookIds,
        accentColors: state.accentColors,
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 12) {
          // v12: Clear all accent colors — previous versions persisted brown fallback for every book
          return {
            ...persistedState,
            useColoredSpines: persistedState.useColoredSpines ?? true,
            useServerSpines: persistedState.useServerSpines ?? true,
            serverSpineDimensions: persistedState.serverSpineDimensions || {},
            cachedManifestBookIds: persistedState.cachedManifestBookIds || [],
            accentColors: {},
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const dimCount = Object.keys(state.serverSpineDimensions || {}).length;
          const manifestCount = state.cachedManifestBookIds?.length || 0;
          const colorCount = Object.keys(state.accentColors || {}).length;
          console.log(`[SpineCache] Hydrated: ${dimCount} server dims, ${manifestCount} manifest, ${colorCount} accent colors`);

          useSpineCacheStore.setState({ isHydrated: true });

          if (manifestCount > 0) {
            const { useLibraryCache } = require('@/core/cache/libraryCache');
            const current = useLibraryCache.getState().booksWithServerSpines;
            if (current.size === 0) {
              useLibraryCache.setState({
                booksWithServerSpines: new Set(state.cachedManifestBookIds),
              });
            }
          }
        }
      },
    }
  )
);

// =============================================================================
// SELECTORS
// =============================================================================

export const selectIsPopulated = (state: SpineCacheState) => state.isPopulated;
export const selectCacheSize = (state: SpineCacheState) => state.cache.size;
export const selectUseColoredSpines = (state: SpineCacheState) => state.useColoredSpines;
export const selectUseServerSpines = (state: SpineCacheState) => state.useServerSpines;
