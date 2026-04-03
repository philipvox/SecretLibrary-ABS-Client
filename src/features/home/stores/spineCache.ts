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
  /** Legacy: background color (kept for compatibility) */
  backgroundColor?: string;
  /** Legacy: text color (kept for compatibility) */
  textColor?: string;
  /** Legacy: typography config (kept for compatibility) */
  typography?: {
    fontFamily?: string;
    fontWeight?: string;
    titleWeight?: string;
    textTransform?: string;
    fontStyle?: string;
  };
  /** Series sequence number */
  seriesSequence?: number;
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
  /** Custom spine server URL (e.g. http://192.168.1.100:8786). If empty, uses main ABS server. */
  spineServerUrl: string;
  /** Use community spine images from Secret Spines (on by default) */
  useCommunitySpines: boolean;
  serverSpineDimensions: Record<string, SpineDimensionEntry>;
  isHydrated: boolean;
  serverSpineDimensionsVersion: number;
  /** Incremented when accent colors arrive — triggers re-renders */
  colorVersion: number;
  cachedManifestBookIds: string[];
  /** Persisted community spine book IDs for instant hydration */
  cachedCommunityBookIds: string[];
  /** Maps localItemId → communityBookId for spine URL construction */
  communityBookMap: Record<string, string>;
  /** Per-book spine overrides: bookId → community spine URL or local file URI (user-selected) */
  spineOverrides: Record<string, string>;
  /** Whether to prompt to submit custom spines to community server (default true) */
  promptCommunitySubmit: boolean;
  /** Pending community spine submissions: spineId -> bookTitle */
  pendingSubmissions: Record<string, string>;
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
  setSpineServerUrl: (url: string) => void;
  setUseCommunitySpines: (enabled: boolean) => void;
  saveToSQLite: (libraryId: string) => Promise<void>;
  getServerSpineDimensions: (bookId: string) => { width: number; height: number } | undefined;
  setServerSpineDimensions: (bookId: string, width: number, height: number) => void;
  /** Batch set dimensions for many books at once (single state update) */
  batchSetServerSpineDimensions: (dims: Record<string, [number, number]>) => void;
  clearServerSpineDimensions: () => void;
  setCachedManifestBookIds: (bookIds: string[]) => void;
  getCachedManifestBookIds: () => string[];
  setCachedCommunityBookIds: (bookIds: string[]) => void;
  /** Set the community book ID mapping (localItemId → communityBookId) */
  setCommunityBookMap: (map: Record<string, string>) => void;
  /** Get the community book ID for a local item */
  getCommunityBookId: (localItemId: string) => string | undefined;
  /** Set a per-book spine override URL */
  setSpineOverride: (bookId: string, spineUrl: string) => void;
  /** Clear a per-book spine override */
  clearSpineOverride: (bookId: string) => void;
  /** Get the spine override for a book */
  getSpineOverride: (bookId: string) => string | undefined;
  /** Toggle community submission prompt */
  setPromptCommunitySubmit: (enabled: boolean) => void;
  /** Track a pending community spine submission */
  addPendingSubmission: (spineId: string, bookTitle: string) => void;
  /** Remove a pending submission (after it's been resolved) */
  removePendingSubmission: (spineId: string) => void;
  /** Check status of all pending submissions and return resolved ones */
  checkPendingSubmissions: () => Promise<Array<{ id: string; status: string; bookTitle: string }>>;
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

// Debounce buffer for server spine dimension updates
let _pendingDimUpdates: Record<string, { width: number; height: number }> = {};
let _dimFlushTimer: ReturnType<typeof setTimeout> | null = null;

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
      // Batch all colors from this batch into a single store update
      const batchColors: { id: string; color: string }[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchColors.push(result.value);
        } else {
          log.debug('Color extraction rejected:', result.reason);
        }
      }
      if (batchColors.length > 0) {
        const store = useSpineCacheStore.getState();
        const newAccentColors = { ...store.accentColors };
        const newCache = new Map(store.cache);
        let cacheChanged = false;
        for (const { id, color } of batchColors) {
          newAccentColors[id] = color;
          const existing = newCache.get(id);
          if (existing && existing.accentColor !== color) {
            newCache.set(id, { ...existing, accentColor: color });
            cacheChanged = true;
          }
        }
        useSpineCacheStore.setState({
          accentColors: newAccentColors,
          ...(cacheChanged ? { cache: newCache, colorVersion: store.colorVersion + 1 } : {}),
        });
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
      spineServerUrl: '',
      useCommunitySpines: true,
      serverSpineDimensions: {},
      isHydrated: false,
      serverSpineDimensionsVersion: 0,
      colorVersion: 0,
      cachedManifestBookIds: [],
      cachedCommunityBookIds: [],
      communityBookMap: {},
      spineOverrides: {},
      promptCommunitySubmit: true,
      pendingSubmissions: {},
      accentColors: {},

      // Actions

      hydrateFromSQLite: async (libraryId: string): Promise<number> => {
        try {
          const cached = await sqliteCache.getSpineCache(libraryId);
          if (cached && cached.size > 0) {
            set({ cache: cached, isPopulated: true, lastPopulatedAt: Date.now() });
            log.debug(`Hydrated ${cached.size} spine entries from SQLite`);
            return cached.size;
          }
        } catch (err) {
          log.warn('SQLite spine hydration failed, will recompute:', err);
        }
        return 0;
      },

      populateFromLibrary: async (items: LibraryItem[], libraryId?: string) => {
        // Skip recomputation if cache is already populated with the same number of items
        const currentCache = get().cache;
        if (currentCache.size === items.length && get().isPopulated) {
          log.debug(`Spine cache already populated with ${currentCache.size} items, skipping recomputation`);
          // Still extract missing colors in background
          extractMissingColors(items, get().accentColors, get().setAccentColor);
          return;
        }

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

      setSpineServerUrl: (url: string) => {
        set({ spineServerUrl: url.trim().replace(/\/+$/, '') });
      },

      setUseCommunitySpines: (enabled: boolean) => {
        set({ useCommunitySpines: enabled });
      },

      getServerSpineDimensions: (bookId: string) => {
        const entry = get().serverSpineDimensions[bookId];
        if (!entry) return undefined;
        const age = Date.now() - entry.cachedAt;
        if (age > DIMENSION_CACHE_TTL_MS) return undefined;
        return { width: entry.width, height: entry.height };
      },

      setServerSpineDimensions: (bookId: string, width: number, height: number) => {
        // Debounced: collect dimension updates and flush in a single batch
        _pendingDimUpdates[bookId] = { width, height };
        if (!_dimFlushTimer) {
          _dimFlushTimer = setTimeout(() => {
            const { serverSpineDimensions, serverSpineDimensionsVersion } = useSpineCacheStore.getState();
            const updates = { ...serverSpineDimensions };
            let changed = false;
            for (const [id, dims] of Object.entries(_pendingDimUpdates)) {
              const existing = updates[id];
              if (!existing || existing.width !== dims.width || existing.height !== dims.height) {
                updates[id] = { ...dims, cachedAt: Date.now() };
                changed = true;
              }
            }
            _pendingDimUpdates = {};
            _dimFlushTimer = null;
            if (changed) {
              useSpineCacheStore.setState({
                serverSpineDimensions: updates,
                serverSpineDimensionsVersion: serverSpineDimensionsVersion + 1,
              });
            }
          }, 200);
        }
      },

      batchSetServerSpineDimensions: (dims: Record<string, [number, number]>) => {
        const { serverSpineDimensions, serverSpineDimensionsVersion } = get();
        const now = Date.now();
        const merged = { ...serverSpineDimensions };
        let changed = 0;
        for (const [bookId, [w, h]] of Object.entries(dims)) {
          const existing = merged[bookId];
          if (!existing || existing.width !== w || existing.height !== h) {
            merged[bookId] = { width: w, height: h, cachedAt: now };
            changed++;
          }
        }
        if (changed > 0) {
          set({
            serverSpineDimensions: merged,
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

      setCachedCommunityBookIds: (bookIds: string[]) => {
        set({ cachedCommunityBookIds: bookIds });
      },

      setCommunityBookMap: (map: Record<string, string>) => {
        set({ communityBookMap: map });
      },

      getCommunityBookId: (localItemId: string) => {
        return get().communityBookMap[localItemId];
      },

      setSpineOverride: (bookId: string, spineUrl: string) => {
        set({ spineOverrides: { ...get().spineOverrides, [bookId]: spineUrl } });
      },

      clearSpineOverride: (bookId: string) => {
        const { [bookId]: _, ...rest } = get().spineOverrides;
        set({ spineOverrides: rest });
      },

      getSpineOverride: (bookId: string) => {
        return get().spineOverrides[bookId];
      },

      setPromptCommunitySubmit: (enabled: boolean) => {
        set({ promptCommunitySubmit: enabled });
      },

      addPendingSubmission: (spineId: string, bookTitle: string) => {
        set({ pendingSubmissions: { ...get().pendingSubmissions, [spineId]: bookTitle } });
      },

      removePendingSubmission: (spineId: string) => {
        const { [spineId]: _, ...rest } = get().pendingSubmissions;
        set({ pendingSubmissions: rest });
      },

      checkPendingSubmissions: async () => {
        const pending = get().pendingSubmissions;
        const ids = Object.keys(pending);
        if (ids.length === 0) return [];

        try {
          const res = await fetch(
            `https://spines.mysecretlibrary.com/api/submissions/check?ids=${ids.join(',')}`
          );
          if (!res.ok) return [];
          const data = await res.json();
          const resolved: Array<{ id: string; status: string; bookTitle: string }> = [];

          for (const result of data.results || []) {
            if (result.status === 'approved' || result.status === 'denied') {
              resolved.push({
                id: result.id,
                status: result.status,
                bookTitle: pending[result.id] || result.bookTitle || 'Unknown',
              });
              // Remove from pending
              const { [result.id]: _, ...rest } = get().pendingSubmissions;
              set({ pendingSubmissions: rest });
            }
          }

          return resolved;
        } catch {
          log.debug('Failed to check pending submissions');
          return [];
        }
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
      version: 17, // v17: Add pendingSubmissions for community spine status tracking
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        useColoredSpines: state.useColoredSpines,
        useServerSpines: state.useServerSpines,
        spineServerUrl: state.spineServerUrl,
        useCommunitySpines: state.useCommunitySpines,
        serverSpineDimensions: state.serverSpineDimensions,
        cachedManifestBookIds: state.cachedManifestBookIds,
        cachedCommunityBookIds: state.cachedCommunityBookIds,
        communityBookMap: state.communityBookMap,
        spineOverrides: state.spineOverrides,
        promptCommunitySubmit: state.promptCommunitySubmit,
        pendingSubmissions: state.pendingSubmissions,
        accentColors: state.accentColors,
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 12) {
          // v12: Clear all accent colors — previous versions persisted brown fallback for every book
          return {
            ...persistedState,
            useColoredSpines: persistedState.useColoredSpines ?? true,
            useServerSpines: persistedState.useServerSpines ?? true,
            spineServerUrl: '',
            serverSpineDimensions: persistedState.serverSpineDimensions || {},
            cachedManifestBookIds: persistedState.cachedManifestBookIds || [],
            accentColors: {},
          };
        }
        if (version < 13) {
          // v13: Reset spineServerUrl — was accidentally set to an IP address
          return { ...persistedState, spineServerUrl: '' };
        }
        if (version < 14) {
          // v14: Add community spines (on by default)
          return { ...persistedState, useCommunitySpines: true, communityBookMap: {} };
        }
        if (version < 15) {
          // v15: Add communityBookMap for universal matching (preserve existing)
          return { ...persistedState, communityBookMap: persistedState.communityBookMap || {} };
        }
        if (version < 16) {
          // v16: Add per-book spine overrides
          return { ...persistedState, spineOverrides: {} };
        }
        if (version < 17) {
          // v17: Add pending submissions tracking
          return { ...persistedState, pendingSubmissions: {} };
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

          // Hydrate spine dimensions from SQLite in background
          const { useLibraryCache: getLibCache } = require('@/core/cache/libraryCache');
          const libraryId = getLibCache.getState().currentLibraryId;
          if (libraryId) {
            useSpineCacheStore.getState().hydrateFromSQLite(libraryId).catch(() => {});
          }

          const { useLibraryCache } = require('@/core/cache/libraryCache');
          if (manifestCount > 0) {
            const current = useLibraryCache.getState().booksWithServerSpines;
            if (current.size === 0) {
              useLibraryCache.setState({
                booksWithServerSpines: new Set(state.cachedManifestBookIds),
              });
            }
          }
          const communityCount = state.cachedCommunityBookIds?.length || 0;
          if (communityCount > 0) {
            const currentCommunity = useLibraryCache.getState().booksWithCommunitySpines;
            if (currentCommunity.size === 0) {
              useLibraryCache.setState({
                booksWithCommunitySpines: new Set(state.cachedCommunityBookIds),
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
export const selectUseCommunitySpines = (state: SpineCacheState) => state.useCommunitySpines;
