/**
 * src/features/home/stores/spineCache.ts
 *
 * Centralized cache for pre-calculated book spine dimensions.
 * Single source of truth for all spine-related calculations.
 *
 * Benefits:
 * - Dimensions calculated once per book, not on every render
 * - Consistent dimensions across all components
 * - Reduces CPU usage in lists with many books
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { sqliteCache } from '@/core/services/sqliteCache';
import { createLogger } from '@/shared/utils/logger';

// MIGRATED: Now using new spine system via adapter
import { calculateBookDimensions, hashString, getSpineColorForGenres, getTypographyForGenres } from '../utils/spine/adapter';
// Template system - spines use this when available, so cache must too
import { shouldUseTemplates, applyTemplateConfig } from '../utils/spine/templateAdapter';
// getPlatformFont resolves custom fonts to available fonts (same as BookSpineVertical)
import { getPlatformFont } from '../utils/spineCalculations';

const log = createLogger('SpineCache');

// Dimension cache TTL: 24 hours
// Ensures stale dimensions are refreshed if server spine images change
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
  /** Book ID */
  id: string;
  /** Base width in pixels (unscaled) */
  baseWidth: number;
  /** Base height in pixels (unscaled) */
  baseHeight: number;
  /** Hash of book ID for deterministic randomization */
  hash: number;
  /** Genres for styling */
  genres: string[];
  /** Tags for styling */
  tags: string[];
  /** Duration in seconds */
  duration: number;
  /** Series name if part of series */
  seriesName?: string;
  /** Title for display */
  title: string;
  /** Author for display */
  author: string;
  /** User progress (0-1) */
  progress: number;
  /** Background color for spine (genre-based) */
  backgroundColor: string;
  /** Text color for spine (contrast-based) */
  textColor: string;
  /** Pre-computed typography (font family, weight, transform, etc.) - ensures consistency across all screens */
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

/** Server spine dimension entry with timestamp for TTL-based expiry */
export interface SpineDimensionEntry {
  width: number;
  height: number;
  cachedAt: number;  // Date.now() when cached
}

export interface SpineCacheState {
  /** Map of bookId -> cached spine data */
  cache: Map<string, CachedSpineData>;
  /** Whether initial population is complete */
  isPopulated: boolean;
  /** Last population timestamp */
  lastPopulatedAt: number | null;
  /** Whether to use genre-based colored spines (default: true) */
  useColoredSpines: boolean;
  /** Whether to use server-provided spine images (default: false until images are generated) */
  useServerSpines: boolean;
  /** Record of bookId -> server spine image dimensions with TTL - persisted */
  serverSpineDimensions: Record<string, SpineDimensionEntry>;
  /** Whether persisted state has been hydrated from AsyncStorage */
  isHydrated: boolean;
  /** Version counter for serverSpineDimensions - increments on any change.
   *  Subscribe to this instead of the full object to avoid mass re-renders. */
  serverSpineDimensionsVersion: number;
  /** Version counter for color changes - increments when spine colors are updated */
  colorVersion: number;
  /** Persisted spine manifest book IDs — provides instant server spine lookup on app restart
   *  without waiting for the network manifest fetch */
  cachedManifestBookIds: string[];
}

export interface SpineCacheActions {
  /** Hydrate cache from SQLite only (fast, no computation) - call during app init */
  hydrateFromSQLite: (libraryId: string) => Promise<number>;
  /** Populate cache from library items - tries SQLite first, then computes missing */
  populateFromLibrary: (items: LibraryItem[], libraryId?: string) => Promise<void>;
  /** Get cached data for a single book */
  getSpineData: (bookId: string) => CachedSpineData | undefined;
  /** Get cached data for multiple books */
  getSpineDataBatch: (bookIds: string[]) => CachedSpineData[];
  /** Update progress for a book */
  updateProgress: (bookId: string, progress: number) => void;
  /** Clear the cache */
  clearCache: () => void;
  /** Toggle colored spines on/off */
  setUseColoredSpines: (enabled: boolean) => void;
  /** Toggle server-provided spine images on/off */
  setUseServerSpines: (enabled: boolean) => void;
  /** Save current cache to SQLite for persistence */
  saveToSQLite: (libraryId: string) => Promise<void>;
  /** Get cached server spine image dimensions for a book */
  getServerSpineDimensions: (bookId: string) => { width: number; height: number } | undefined;
  /** Set server spine image dimensions after image loads */
  setServerSpineDimensions: (bookId: string, width: number, height: number) => void;
  /** Clear all cached server spine dimensions (call when refreshing spines) */
  clearServerSpineDimensions: () => void;
  /** Persist the spine manifest book IDs for instant lookup on next launch */
  setCachedManifestBookIds: (bookIds: string[]) => void;
  /** Get the persisted manifest book IDs */
  getCachedManifestBookIds: () => string[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract spine-relevant data from a LibraryItem
 */
function extractSpineData(item: LibraryItem): CachedSpineData {
  const metadata = getBookMetadata(item);
  const genres = metadata?.genres || [];
  // Tags are on BookMedia, not metadata
  const tags = isBookMedia(item.media) ? item.media.tags || [] : [];
  const duration = getBookDuration(item) || 6 * 60 * 60; // Default 6 hours

  // DEBUG: Log tags to verify they're loading
  if (tags.length > 0 || genres.length > 0) {
    log.debug(`${metadata?.title?.substring(0, 20) || item.id}:`, {
      genres: genres.slice(0, 3),
      tags: tags.slice(0, 3),
    });
  }
  // Get series name from either string format or array format
  const seriesName = metadata?.seriesName || metadata?.series?.[0]?.name;
  const progress = item.userMediaProgress?.progress || 0;

  // Calculate base dimensions using shared utility
  const calculated = calculateBookDimensions({
    id: item.id,
    genres,
    tags,
    duration,
    seriesName,
  });

  // Calculate spine colors based on genres
  const colors = getSpineColorForGenres(genres, item.id);
  const author = metadata?.authorName || 'Unknown Author';

  // Pre-compute typography (font family, weight, transforms, etc.)
  // CRITICAL: Must match EXACTLY what BookSpineVertical uses!
  // The spine checks templates FIRST, then falls back to genre typography.
  // We must do the same here to ensure book detail/player match the spine.
  const useTemplates = shouldUseTemplates(genres);
  let typography: any;

  if (useTemplates) {
    // Use template system - same as BookSpineVertical line 977-981
    const templateConfig = applyTemplateConfig(genres, calculated.width, title);

    // CRITICAL: Resolve fonts using getPlatformFont() - same as BookSpineVertical line 1654
    // This converts custom font names (e.g., 'AlmendraSC-Regular') to available fonts (e.g., 'Lora-Regular')
    const resolvedTitleFont = getPlatformFont(templateConfig.title.fontFamily);
    const resolvedAuthorFont = getPlatformFont(templateConfig.author.fontFamily);

    typography = {
      // Map template config to typography format - use RESOLVED fonts!
      fontFamily: resolvedTitleFont,
      fontWeight: templateConfig.title.weight,
      fontStyle: 'normal',
      titleTransform: templateConfig.title.case,
      authorTransform: templateConfig.author.case,
      authorPosition: templateConfig.author.placement,
      authorBox: 'none',
      letterSpacing: templateConfig.title.letterSpacing,
      titleLetterSpacing: templateConfig.title.letterSpacing,
      authorLetterSpacing: templateConfig.author.letterSpacing,
      authorOrientationBias: templateConfig.author.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      contrast: 'high',
      titleWeight: templateConfig.title.weight,
      authorWeight: templateConfig.author.weight,
      authorAbbreviation: 'none',
      authorFontFamily: resolvedAuthorFont,
      // Store template info for debugging
      _fromTemplate: templateConfig.templateId,
      _rawTitleFont: templateConfig.title.fontFamily,
    };

    log.debug(`"${title?.substring(0, 20)}" TEMPLATE: ${templateConfig.templateName}, raw: ${templateConfig.title.fontFamily} → resolved: ${resolvedTitleFont}`);
  } else {
    // No template - use genre-based typography
    const genreTypo = getTypographyForGenres(genres, item.id);

    // CRITICAL: Also resolve genre typography fonts!
    const resolvedFont = getPlatformFont(genreTypo.fontFamily);

    typography = {
      ...genreTypo,
      fontFamily: resolvedFont,
    };

    log.debug(`"${title?.substring(0, 20)}" GENRE: raw: ${genreTypo.fontFamily} → resolved: ${resolvedFont}`);
  }

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
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    typography,
  };
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
      useColoredSpines: true, // Default to colored spines enabled
      useServerSpines: true, // Default to server spines when available
      serverSpineDimensions: {}, // Cache for server spine image dimensions (persisted)
      isHydrated: false, // Set to true once AsyncStorage hydration completes
      serverSpineDimensionsVersion: 0,
      colorVersion: 0,
      cachedManifestBookIds: [],

      // Actions

      /**
       * Hydrate cache from SQLite ONLY (no computation).
       * Call this during app initialization to pre-load spine data.
       * Returns the number of items loaded.
       */
      hydrateFromSQLite: async (_libraryId: string): Promise<number> => {
        // Skip SQLite hydration — always compute fresh to ensure correct colors
        log.debug('Skipping SQLite hydration (colors computed fresh each launch)');
        return 0;
      },

      populateFromLibrary: async (items: LibraryItem[], libraryId?: string) => {

        const startTime = Date.now();
        const newCache = new Map<string, CachedSpineData>();
        const _itemIds = new Set(items.map(i => i.id));
        let computed = 0;

        // Always compute fresh — ensures colors match current palette
        log.debug('Computing spine data for all items');

        // Compute only for items not in cache
        for (const item of items) {
          if (!newCache.has(item.id)) {
            try {
              const spineData = extractSpineData(item);
              newCache.set(item.id, spineData);
              computed++;
            } catch (error) {
              // Skip items that fail to process
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

        // Save to SQLite as write-through cache
        if (libraryId) {
          // Run in background, don't block
          sqliteCache.setSpineCache(libraryId, newCache).catch(err => {
            log.warn('Failed to save to SQLite:', err);
          });
        }
      },

    getSpineData: (bookId: string) => {
      return get().cache.get(bookId);
    },

    getSpineDataBatch: (bookIds: string[]) => {
      const cache = get().cache;
      const results: CachedSpineData[] = [];

      for (const id of bookIds) {
        const data = cache.get(id);
        if (data) {
          results.push(data);
        }
      }

      return results;
    },

    updateProgress: (bookId: string, progress: number) => {
      const cache = get().cache;
      const existing = cache.get(bookId);

      // Skip if progress unchanged - prevents unnecessary re-renders
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

      // Check if entry has expired (24h TTL)
      const age = Date.now() - entry.cachedAt;
      if (age > DIMENSION_CACHE_TTL_MS) {
        // Expired - return undefined to trigger refresh
        return undefined;
      }

      return { width: entry.width, height: entry.height };
    },

    setServerSpineDimensions: (bookId: string, width: number, height: number) => {
      const { serverSpineDimensions, serverSpineDimensionsVersion } = get();
      const existing = serverSpineDimensions[bookId];
      // Update if new or dimensions changed (allows refresh after expiry)
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
      console.log('[SpineCache] Cleared all server spine dimensions');
    },

    setCachedManifestBookIds: (bookIds: string[]) => {
      set({ cachedManifestBookIds: bookIds });
    },

    getCachedManifestBookIds: () => {
      return get().cachedManifestBookIds;
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
      version: 9, // v9: Vibrant genre color palette
      storage: createJSONStorage(() => AsyncStorage),
      // Persist settings, serverSpineDimensions, and manifest book IDs
      partialize: (state) => ({
        useColoredSpines: state.useColoredSpines,
        useServerSpines: state.useServerSpines,
        serverSpineDimensions: state.serverSpineDimensions,
        cachedManifestBookIds: state.cachedManifestBookIds,
      }),
      // Migration: v1 -> v2: Enable colored spines for light mode theme
      // Migration: v2 -> v3: Add server spines setting (default off)
      // Migration: v3 -> v4: Persist serverSpineDimensions to eliminate flash
      // Migration: v4 -> v5: Add cachedAt timestamp for 24h TTL expiry
      // Migration: v5 -> v6: Persist spine manifest book IDs for instant lookup
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Enable colored spines for new light mode theme
          return {
            ...persistedState,
            useColoredSpines: true,
            useServerSpines: false,
            serverSpineDimensions: {},
          };
        }
        if (version < 3) {
          // Add server spines setting (default off until images are generated)
          return {
            ...persistedState,
            useServerSpines: false,
            serverSpineDimensions: {},
          };
        }
        if (version < 4) {
          // Add persisted serverSpineDimensions (previously was Map, now Record)
          return {
            ...persistedState,
            serverSpineDimensions: {},
          };
        }
        if (version < 5) {
          // Add cachedAt timestamp to existing dimension entries
          const oldDimensions = persistedState.serverSpineDimensions || {};
          const newDimensions: Record<string, { width: number; height: number; cachedAt: number }> = {};
          const now = Date.now();
          for (const [bookId, dims] of Object.entries(oldDimensions)) {
            const d = dims as { width: number; height: number; cachedAt?: number };
            newDimensions[bookId] = {
              width: d.width,
              height: d.height,
              cachedAt: d.cachedAt || now, // Add timestamp if missing
            };
          }
          return {
            ...persistedState,
            serverSpineDimensions: newDimensions,
          };
        }
        if (version < 6) {
          // Add cachedManifestBookIds (empty — will be populated on next manifest fetch)
          return {
            ...persistedState,
            cachedManifestBookIds: [],
          };
        }
        if (version < 7) {
          // Force full recompute to pick up genre-based colors (SQLite has stale #F5F5F5)
          return {
            ...persistedState,
            _forceRecompute: true,
          };
        }
        if (version < 8) {
          // Force recompute: removed useServerSpines guard, need fresh genre colors
          return {
            ...persistedState,
            _forceRecompute: true,
          };
        }
        if (version < 9) {
          // Force recompute: vibrant color palette
          return {
            ...persistedState,
            _forceRecompute: true,
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        // Called when hydration from AsyncStorage completes
        if (state) {
          const dimCount = Object.keys(state.serverSpineDimensions || {}).length;
          const manifestCount = state.cachedManifestBookIds?.length || 0;
          console.log(`[SpineCache] Hydrated from AsyncStorage: ${dimCount} server spine dimensions, ${manifestCount} manifest entries`);


          // Mark as hydrated so components know persisted data is available
          useSpineCacheStore.setState({ isHydrated: true });

          // Pre-populate libraryCache with persisted manifest for instant server spine lookup.
          // This runs BEFORE components render, eliminating the flash of generative spines.
          if (manifestCount > 0) {
            // Lazy import to avoid circular dependency (libraryCache imports spineCache)
            const { useLibraryCache } = require('@/core/cache/libraryCache');
            const current = useLibraryCache.getState().booksWithServerSpines;
            // Only populate if libraryCache hasn't already loaded from network
            if (current.size === 0) {
              useLibraryCache.setState({
                booksWithServerSpines: new Set(state.cachedManifestBookIds),
              });
              console.log(`[SpineCache] Pre-populated libraryCache with ${manifestCount} manifest entries`);
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

/**
 * Select just the population status (stable reference)
 */
export const selectIsPopulated = (state: SpineCacheState) => state.isPopulated;

/**
 * Select cache size for debugging
 */
export const selectCacheSize = (state: SpineCacheState) => state.cache.size;

/**
 * Select colored spines setting
 */
export const selectUseColoredSpines = (state: SpineCacheState) => state.useColoredSpines;

/**
 * Select server spines setting
 */
export const selectUseServerSpines = (state: SpineCacheState) => state.useServerSpines;
