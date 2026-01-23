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
import { Platform } from 'react-native';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { sqliteCache } from '@/core/services/sqliteCache';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('SpineCache');
// MIGRATED: Now using new spine system via adapter
import { calculateBookDimensions, hashString, getSpineColorForGenres, generateSpineComposition, SpineComposition, getTypographyForGenres } from '../utils/spine/adapter';
// Template system - spines use this when available, so cache must too
import { shouldUseTemplates, applyTemplateConfig } from '../utils/spine/templateAdapter';
// getPlatformFont resolves custom fonts to available fonts (same as BookSpineVertical)
import { getPlatformFont } from '../utils/spineCalculations';

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
  /** Pre-computed spine composition (title orientation, author treatment, etc.) */
  composition?: SpineComposition;
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

export interface SpineCacheState {
  /** Map of bookId -> cached spine data */
  cache: Map<string, CachedSpineData>;
  /** Whether initial population is complete */
  isPopulated: boolean;
  /** Last population timestamp */
  lastPopulatedAt: number | null;
  /** Whether to use genre-based colored spines (default: true) */
  useColoredSpines: boolean;
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
  /** Save current cache to SQLite for persistence */
  saveToSQLite: (libraryId: string) => Promise<void>;
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

  // Pre-compute spine composition (title orientation, author treatment, etc.)
  // This ensures consistent styling across home, book detail, and player screens
  const title = metadata?.title || 'Unknown';
  const author = metadata?.authorName || 'Unknown Author';
  // Pass spine width for smart layout constraints (horizontal only on wide spines)
  const composition = generateSpineComposition(item.id, title, author, genres, seriesName ? { name: seriesName, number: 1 } : undefined, calculated.width);

  // Pre-compute typography (font family, weight, transforms, etc.)
  // CRITICAL: Must match EXACTLY what BookSpineVertical uses!
  // The spine checks templates FIRST, then falls back to genre typography.
  // We must do the same here to ensure book detail/player match the spine.
  const useTemplates = shouldUseTemplates(genres);
  let typography: any;

  if (useTemplates && genres.length > 0) {
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
    composition,
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

      // Actions

      /**
       * Hydrate cache from SQLite ONLY (no computation).
       * Call this during app initialization to pre-load spine data.
       * Returns the number of items loaded.
       */
      hydrateFromSQLite: async (libraryId: string): Promise<number> => {
        if (!libraryId) return 0;

        // Skip if already populated (avoid duplicate work)
        if (get().isPopulated && get().cache.size > 0) {
          log.debug('Already populated, skipping hydration');
          return get().cache.size;
        }

        const startTime = Date.now();

        try {
          const sqliteData = await sqliteCache.getSpineCache(libraryId);

          if (sqliteData.size > 0) {
            set({
              cache: sqliteData,
              isPopulated: true,
              lastPopulatedAt: Date.now(),
            });

            const elapsed = Date.now() - startTime;
            log.debug(`Hydrated ${sqliteData.size} items from SQLite in ${elapsed}ms`);
            return sqliteData.size;
          }
        } catch (error) {
          log.warn('Hydration from SQLite failed:', error);
        }

        return 0;
      },

      populateFromLibrary: async (items: LibraryItem[], libraryId?: string) => {
        const startTime = Date.now();
        const newCache = new Map<string, CachedSpineData>();
        const itemIds = new Set(items.map(i => i.id));
        let loadedFromSQLite = 0;
        let computed = 0;

        // Try to load from SQLite first (if libraryId provided)
        if (libraryId) {
          try {
            const sqliteData = await sqliteCache.getSpineCache(libraryId);

            // Use SQLite data for items that still exist
            for (const [bookId, data] of sqliteData.entries()) {
              if (itemIds.has(bookId)) {
                newCache.set(bookId, data);
                loadedFromSQLite++;
              }
            }

            if (loadedFromSQLite > 0) {
              log.debug(`Loaded ${loadedFromSQLite} items from SQLite`);
            }
          } catch (error) {
            log.warn('Failed to load from SQLite:', error);
          }
        }

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
        });

        const elapsed = Date.now() - startTime;
        log.debug(`Populated ${newCache.size} items (${loadedFromSQLite} from SQLite, ${computed} computed) in ${elapsed}ms`);

        // Save back to SQLite if we computed new items
        if (libraryId && computed > 0) {
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

      if (existing) {
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
      version: 2, // Increment to trigger migration
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the settings, not the cache
      partialize: (state) => ({
        useColoredSpines: state.useColoredSpines,
      }),
      // Migration: v1 -> v2: Enable colored spines for light mode theme
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Enable colored spines for new light mode theme
          return {
            ...persistedState,
            useColoredSpines: true,
          };
        }
        return persistedState;
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
