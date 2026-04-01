/**
 * src/core/cache/libraryCache.ts
 *
 * Persistent library cache with 30-day TTL
 * Caches entire library on startup for instant navigation
 *
 * STORAGE: Uses SQLite (sqliteCache) as single source of truth.
 * (Eliminated AsyncStorage for library data to prevent divergence - P1 Fix)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { apiClient } from '@/core/api';
import type { CommunityManifestV2 } from '@/core/api/apiClient';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { searchIndex } from './searchIndex';
import { normalizeForSearch } from '@/features/search/utils/fuzzySearch';
import { createLogger } from '@/shared/utils/logger';
import { useSpineCacheStore } from '@/shared/spine';
import { sqliteCache } from '@/core/services/sqliteCache';
import { getErrorMessage } from '@/shared/utils/errorUtils';

const log = createLogger('LibraryCache');

// Type guard for book media
function _isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media && !('episodes' in media);
}

// Extended metadata interface with optional narrator field
interface ExtendedBookMetadata extends BookMetadata {
  narratorName?: string;
}

// Helper to get book metadata safely
// Note: We check for metadata directly without requiring audioFiles,
// since library cache items may not include audioFiles to save space
function getBookMetadataTyped(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// API author response type (from audiobookshelf server)
interface ApiAuthor {
  id: string;
  name: string;
  numBooks?: number;
  imagePath?: string;
  description?: string;
}

const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

interface AuthorInfo {
  id?: string;  // Author ID from API (if available)
  name: string;
  bookCount: number;
  books: LibraryItem[];
  imagePath?: string;  // Author image path from API
  description?: string;  // Author description from API
}

interface NarratorInfo {
  name: string;
  bookCount: number;
  books: LibraryItem[];
}

interface SeriesInfo {
  name: string;
  bookCount: number;
  books: LibraryItem[];
}

interface GenreInfo {
  name: string;
  bookCount: number;
  books: LibraryItem[];
  totalDuration: number;  // Pre-computed for instant display
}

interface LibraryCacheState {
  // Data
  items: LibraryItem[];
  isLoaded: boolean;
  isLoading: boolean;
  lastUpdated: number | null;
  lastRefreshed: number | null;  // Timestamp of last manual refresh (for cache busting)
  error: string | null;
  currentLibraryId: string | null;

  // Derived data (computed once on load)
  authors: Map<string, AuthorInfo>;
  narrators: Map<string, NarratorInfo>;
  series: Map<string, SeriesInfo>;
  genres: string[];
  genresWithBooks: Map<string, GenreInfo>;
  itemsById: Map<string, LibraryItem>;

  // Spine manifests (pre-flight check for spine images)
  booksWithServerSpines: Set<string>;
  booksWithCommunitySpines: Set<string>;
  spineManifestVersion: number | null;

  // Actions
  loadCache: (libraryId: string, forceRefresh?: boolean) => Promise<void>;
  refreshCache: (libraryId?: string) => Promise<void>;
  getItem: (id: string) => LibraryItem | undefined;
  getAuthor: (name: string) => AuthorInfo | undefined;
  getNarrator: (name: string) => NarratorInfo | undefined;
  getSeries: (name: string) => SeriesInfo | undefined;
  getGenre: (name: string) => GenreInfo | undefined;
  searchItems: (query: string) => LibraryItem[];
  filterItems: (filters: FilterOptions) => LibraryItem[];
  clearCache: (skipSqlite?: boolean) => Promise<void>;
  loadSpineManifest: (forceRefresh?: boolean) => Promise<void>;
  hasServerSpine: (bookId: string) => boolean;
}

export interface FilterOptions {
  query?: string;
  genres?: string[];
  authors?: string[];
  narrators?: string[];
  series?: string[];
  minDuration?: number; // in hours
  maxDuration?: number; // in hours
  hasProgress?: boolean;
  isFinished?: boolean;
  sortBy?: 'title' | 'author' | 'dateAdded' | 'duration' | 'progress';
  sortOrder?: 'asc' | 'desc';
}

// Helper to extract metadata safely (returns empty object if not available)
function getMetadata(item: LibraryItem): ExtendedBookMetadata {
  return getBookMetadataTyped(item) || ({} as ExtendedBookMetadata);
}

// Build derived indexes from items
function buildIndexes(items: LibraryItem[]) {
  const authors = new Map<string, AuthorInfo>();
  const narrators = new Map<string, NarratorInfo>();
  const series = new Map<string, SeriesInfo>();
  const genresWithBooks = new Map<string, GenreInfo>();
  const itemsById = new Map<string, LibraryItem>();

  for (const item of items) {
    itemsById.set(item.id, item);
    const metadata = getMetadata(item);

    // Index by author
    const authorName = metadata.authorName || '';
    if (authorName) {
      const existing = authors.get(authorName.toLowerCase());
      if (existing) {
        existing.bookCount++;
        existing.books.push(item);
      } else {
        authors.set(authorName.toLowerCase(), {
          name: authorName,
          bookCount: 1,
          books: [item],
        });
      }
    }

    // Index by narrator
    let narratorName = metadata.narratorName || '';
    narratorName = narratorName.replace(/^Narrated by\s*/i, '').trim();
    if (narratorName) {
      // Handle multiple narrators separated by comma
      const narratorNames = narratorName.split(',').map((n: string) => n.trim()).filter(Boolean);
      for (const narrator of narratorNames) {
        const existing = narrators.get(narrator.toLowerCase());
        if (existing) {
          existing.bookCount++;
          existing.books.push(item);
        } else {
          narrators.set(narrator.toLowerCase(), {
            name: narrator,
            bookCount: 1,
            books: [item],
          });
        }
      }
    }

    // Index by series
    // Check both seriesName and series[0].name - AudiobookShelf uses both formats
    let seriesName = metadata.seriesName || '';
    if (!seriesName && metadata.series?.length > 0) {
      // Fallback to series array if seriesName not set
      const primarySeries = metadata.series[0];
      seriesName = typeof primarySeries === 'string' ? primarySeries : primarySeries?.name || '';
    }
    if (seriesName) {
      // Remove sequence number for grouping
      const cleanSeriesName = seriesName.replace(/\s*#[\d.]+$/, '').trim();
      const existing = series.get(cleanSeriesName.toLowerCase());
      if (existing) {
        existing.bookCount++;
        existing.books.push(item);
      } else {
        series.set(cleanSeriesName.toLowerCase(), {
          name: cleanSeriesName,
          bookCount: 1,
          books: [item],
        });
      }
    }

    // Index by genre (each book can have multiple genres)
    const bookDuration = item.media?.duration || 0;
    for (const genre of (metadata.genres || [])) {
      const existing = genresWithBooks.get(genre.toLowerCase());
      if (existing) {
        existing.bookCount++;
        existing.books.push(item);
        existing.totalDuration += bookDuration;
      } else {
        genresWithBooks.set(genre.toLowerCase(), {
          name: genre,
          bookCount: 1,
          books: [item],
          totalDuration: bookDuration,
        });
      }
    }
  }

  // Sort books within series by sequence
  // Helper to get sequence from metadata (checks series array first, then seriesName)
  const getBookSequence = (item: LibraryItem): number => {
    const metadata = getMetadata(item);
    // First check series array (preferred - has explicit sequence)
    if (metadata.series?.length > 0) {
      const primarySeries = metadata.series[0];
      if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
        const parsed = parseFloat(primarySeries.sequence);
        if (!isNaN(parsed)) return parsed;
      }
    }
    // Fallback: check seriesName for #N pattern
    const match = metadata.seriesName?.match(/#([\d.]+)/);
    return match ? parseFloat(match[1]) : 999;
  };

  for (const seriesInfo of series.values()) {
    seriesInfo.books.sort((a, b) => getBookSequence(a) - getBookSequence(b));
  }

  // Pre-sort books within genres by title (eliminates sort on every genre page visit)
  for (const genreInfo of genresWithBooks.values()) {
    genreInfo.books.sort((a, b) => {
      const titleA = (getMetadata(a).title || '').toLowerCase();
      const titleB = (getMetadata(b).title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  }

  return {
    authors,
    narrators,
    series,
    genres: Array.from(genresWithBooks.values()).map(g => g.name).sort(),
    genresWithBooks,
    itemsById,
  };
}

// Track last community manifest fetch to throttle refetches (1 hour TTL)
let _lastCommunityManifestFetchAt: number | null = null;

// Pre-fetched community manifest (populated by prefetchCommunityManifest during app init)
let _prefetchedCommunityManifest: CommunityManifestV2 | null = null;

/**
 * Pre-fetch the community spine manifest during app initialization.
 * Call this early (e.g., appInitializer) so the manifest is already in memory
 * by the time loadSpineManifest() runs after library cache loads.
 * This eliminates the flash of procedural spines on first login.
 */
export async function prefetchCommunityManifest(): Promise<void> {
  try {
    const { useCommunitySpines } = useSpineCacheStore.getState();
    if (!useCommunitySpines) return;

    const COMMUNITY_URL = 'https://spines.mysecretlibrary.com';
    const manifest = await apiClient.getCommunityManifestV2(COMMUNITY_URL);
    if (manifest.books.length > 0) {
      _prefetchedCommunityManifest = manifest;
      _lastCommunityManifestFetchAt = Date.now();
      log.debug(`Pre-fetched community manifest: ${manifest.books.length} books`);
    }
  } catch (err) {
    log.warn('Community manifest pre-fetch failed (non-blocking):', err);
  }
}

export const useLibraryCache = create<LibraryCacheState>()(subscribeWithSelector((set, get) => ({
  items: [],
  isLoaded: false,
  isLoading: false,
  lastUpdated: null,
  lastRefreshed: null,
  error: null,
  currentLibraryId: null,
  authors: new Map(),
  narrators: new Map(),
  series: new Map(),
  genres: [],
  genresWithBooks: new Map(),
  itemsById: new Map(),
  // Pre-populate from persisted manifest in spineCache (avoids flash of generative spines)
  booksWithServerSpines: new Set(useSpineCacheStore.getState().cachedManifestBookIds || []),
  booksWithCommunitySpines: new Set(useSpineCacheStore.getState().cachedCommunityBookIds || []),
  spineManifestVersion: null,

  loadCache: async (libraryId: string, forceRefresh = false) => {
    const { isLoading, isLoaded } = get();
    if (isLoading) return;
    if (isLoaded && !forceRefresh) return;

    set({ isLoading: true, error: null });

    try {
      // Try to load from SQLite first (single source of truth - P1 Fix)
      if (!forceRefresh) {
        const lastSyncTime = await sqliteCache.getLastSyncTime(libraryId);
        if (lastSyncTime) {
          const age = Date.now() - lastSyncTime;

          // Check if cache is still valid (not expired)
          if (age < CACHE_TTL_MS) {
            const cachedItems = await sqliteCache.getLibraryItems(libraryId);
            if (cachedItems.length > 0) {
              log.debug(`Using SQLite cached data (${Math.round(age / 1000 / 60)} min old, ${cachedItems.length} items)`);
              const indexes = buildIndexes(cachedItems);

              // NOTE: Skipping background author fetch during initial cache load
              // The App.tsx boot sequence will trigger a full refresh immediately after,
              // which fetches authors synchronously. This prevents a flash/re-render
              // when the background fetch would complete and update state separately.
              // Author data will be fetched during the full refresh instead.

              // Queue search index for lazy build (P2 Fix - defer until first search)
              searchIndex.queueBuild(cachedItems);

              // Set library as loaded IMMEDIATELY — don't block on spine operations.
              // booksWithServerSpines is pre-populated from persisted manifest (line 284),
              // so server spines render correctly even before the network refresh completes.
              // CRITICAL: Blocking here was causing a ~50% playback failure rate on iOS
              // cold start because session prefetch and book preload couldn't run until
              // the spine manifest network fetch + spine population completed.
              set({
                items: cachedItems,
                isLoaded: true,
                isLoading: false,
                lastUpdated: lastSyncTime,
                currentLibraryId: libraryId,
                ...indexes,
              });

              // BACKGROUND: Spine operations (fire-and-forget, don't block startup)
              useSpineCacheStore.getState().populateFromLibrary(cachedItems, libraryId)
                .catch(err => log.warn('Background spine population failed:', err));
              // Load manifests via dedicated function (handles community + server independently)
              get().loadSpineManifest();

              return;
            }
          }
        }
      }

      // Fetch fresh data from API - items, authors, and spine manifest in parallel
      log.debug('Fetching fresh library data for library:', libraryId);
      const [itemsResponse, authorsResponse] = await Promise.all([
        apiClient.getLibraryItems(libraryId, { limit: 100000 }),  // Large limit to fetch all books
        apiClient.getLibraryAuthors(libraryId).catch((e) => { log.debug('[LibraryCache] getLibraryAuthors failed', e); return [] as ApiAuthor[]; }),
      ]);
      const apiAuthors = authorsResponse as ApiAuthor[];

      // Load spine manifests in background (handles community + server independently)
      get().loadSpineManifest();
      const items = itemsResponse?.results || [];

      // Build indexes from items
      const indexes = buildIndexes(items);

      // Merge API author data (which has accurate book counts) with local data
      if (apiAuthors && apiAuthors.length > 0) {
        log.debug(`Merging ${apiAuthors.length} authors from API`);
        for (const apiAuthor of apiAuthors) {
          const key = apiAuthor.name.toLowerCase();
          const existing = indexes.authors.get(key);
          if (existing) {
            // Update with API data (which has correct book count)
            existing.id = apiAuthor.id;
            existing.bookCount = apiAuthor.numBooks || existing.bookCount;
            existing.imagePath = apiAuthor.imagePath;
            existing.description = apiAuthor.description;
          } else {
            // Author exists in API but we don't have any of their books cached
            indexes.authors.set(key, {
              id: apiAuthor.id,
              name: apiAuthor.name,
              bookCount: apiAuthor.numBooks || 0,
              books: [],
              imagePath: apiAuthor.imagePath,
              description: apiAuthor.description,
            });
          }
        }
      }

      // Save to SQLite (single source of truth - no size limit like AsyncStorage)
      await sqliteCache.setLibraryItems(libraryId, items);
      log.debug(`Cached ${items.length} items to SQLite, ${indexes.authors.size} authors`);

      // Queue search index for lazy build (P2 Fix - defer until first search)
      searchIndex.queueBuild(items);

      // Set library as loaded IMMEDIATELY — spine population runs in background
      set({
        items,
        isLoaded: true,
        isLoading: false,
        lastUpdated: Date.now(),
        currentLibraryId: libraryId,
        ...indexes,
      });

      // BACKGROUND: Populate spine cache (don't block library loading)
      useSpineCacheStore.getState().populateFromLibrary(items, libraryId)
        .catch(err => log.warn('Background spine population failed:', err));
    } catch (error) {
      log.error('Failed to load:', error);
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
    }
  },

  refreshCache: async (libraryId?: string) => {
    const id = libraryId || get().currentLibraryId;
    if (!id) {
      // Silently ignore - this can happen during startup before library is selected
      return;
    }
    log.debug('Refreshing cache for library:', id);
    await get().loadCache(id, true);
    // Set lastRefreshed to bust image caches
    const now = Date.now();
    set({ lastRefreshed: now });
    // Also bump apiClient's cache version so all cover URLs get new version
    apiClient.bumpCoverCacheVersion();
    log.debug('Cache refresh complete, image caches will be busted');
  },

  getItem: (id: string) => {
    return get().itemsById.get(id);
  },

  getAuthor: (name: string) => {
    if (!name) return undefined;
    return get().authors.get(name.toLowerCase());
  },

  getNarrator: (name: string) => {
    if (!name) return undefined;
    return get().narrators.get(name.toLowerCase());
  },

  getSeries: (name: string) => {
    if (!name) return undefined;
    // Try exact match first
    let series = get().series.get(name.toLowerCase());
    if (series) return series;

    // Try without sequence number
    const cleanName = name.replace(/\s*#[\d.]+$/, '').trim();
    return get().series.get(cleanName.toLowerCase());
  },

  getGenre: (name: string) => {
    if (!name) return undefined;
    return get().genresWithBooks.get(name.toLowerCase());
  },

  searchItems: (query: string) => {
    const { items } = get();
    if (!query.trim()) return items;

    // Use trigram-based search index for better performance
    if (searchIndex.ready) {
      const results = searchIndex.search(query, 100);
      return results.map(r => r.item);
    }

    // Fallback to linear search if index not built
    const lowerQuery = query.toLowerCase();
    return items.filter((item) => {
      const metadata = getMetadata(item);
      const title = (metadata.title || '').toLowerCase();
      const author = (metadata.authorName || '').toLowerCase();
      const narrator = (metadata.narratorName || '').toLowerCase();
      const series = (metadata.seriesName || '').toLowerCase();

      return (
        title.includes(lowerQuery) ||
        author.includes(lowerQuery) ||
        narrator.includes(lowerQuery) ||
        series.includes(lowerQuery)
      );
    });
  },

  filterItems: (filters: FilterOptions) => {
    let { items, isLoaded } = get();
    log.debug(`filterItems called. Items: ${items.length}, isLoaded: ${isLoaded}`);

    // Text search - optimized for performance
    if (filters.query?.trim()) {
      const lowerQuery = filters.query.trim().toLowerCase();
      const beforeCount = items.length;

      // Pre-compute normalized query ONCE (strips spaces, punctuation, accents)
      // e.g., "earth sea" -> "earthsea", "Carré" -> "carre"
      const queryNorm = normalizeForSearch(lowerQuery);
      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
      const hasMultipleWords = queryWords.length > 1;
      // FIX 4: Only use significant words (>2 chars) for multi-word matching
      const significantWords = queryWords.filter(w => w.length > 2);

      items = items.filter((item) => {
        const metadata = getMetadata(item);
        const title = (metadata.title || '').toLowerCase();
        const author = (metadata.authorName || '').toLowerCase();
        const narrator = (metadata.narratorName || '').toLowerCase();
        const series = (metadata.seriesName || '').toLowerCase();
        // Genres + DNA tags (e.g., "slow burn", "unreliable narrator")
        const genres = (metadata.genres || []).map((g: string) => g.toLowerCase()).join(' ');
        const tags = ((item.media as BookMedia)?.tags || []).map((t: string) => t.toLowerCase()).join(' ');

        // Fast path 1: Simple substring match (handles 95%+ of searches)
        if (
          title.includes(lowerQuery) ||
          author.includes(lowerQuery) ||
          narrator.includes(lowerQuery) ||
          series.includes(lowerQuery) ||
          genres.includes(lowerQuery) ||
          tags.includes(lowerQuery)
        ) {
          return true;
        }

        // Fast path 2: Word prefix matches
        // FIX 5: Include author and narrator (e.g., "sand" matches "Sanderson")
        if (
          title.split(/\s+/).some((w: string) => w.startsWith(lowerQuery)) ||
          author.split(/\s+/).some((w: string) => w.startsWith(lowerQuery)) ||
          narrator.split(/\s+/).some((w: string) => w.startsWith(lowerQuery)) ||
          series.split(/\s+/).some((w: string) => w.startsWith(lowerQuery)) ||
          genres.split(/\s+/).some((w: string) => w.startsWith(lowerQuery)) ||
          tags.split(/\s+/).some((w: string) => w.startsWith(lowerQuery))
        ) {
          return true;
        }

        // Fast path 3: Space-insensitive + accent-normalized matching
        if (queryNorm.length >= 3) {
          const titleNorm = normalizeForSearch(title);
          const authorNorm = normalizeForSearch(author);
          const narratorNorm = normalizeForSearch(narrator);
          const seriesNorm = normalizeForSearch(series);
          const genresNorm = normalizeForSearch(genres);
          const tagsNorm = normalizeForSearch(tags);
          if (
            titleNorm.includes(queryNorm) ||
            authorNorm.includes(queryNorm) ||
            narratorNorm.includes(queryNorm) ||
            seriesNorm.includes(queryNorm) ||
            genresNorm.includes(queryNorm) ||
            tagsNorm.includes(queryNorm)
          ) {
            return true;
          }
        }

        // Fast path 4: Multi-word search - all significant words must appear
        if (hasMultipleWords && significantWords.length > 0) {
          const combined = `${title} ${author} ${series} ${genres} ${tags}`;
          if (significantWords.every(word => combined.includes(word))) {
            return true;
          }
        }

        return false;
      });
      log.debug(`Text search "${filters.query}": ${beforeCount} -> ${items.length} items`);
    }

    // Genre filter
    if (filters.genres?.length) {
      const genreSet = new Set(filters.genres.map(g => g.toLowerCase()));
      items = items.filter((item) => {
        const genres = getMetadata(item).genres || [];
        return genres.some((g: string) => genreSet.has(g.toLowerCase()));
      });
    }

    // Author filter
    if (filters.authors?.length) {
      const authorSet = new Set(filters.authors.map(a => a.toLowerCase()));
      items = items.filter((item) => {
        const author = (getMetadata(item).authorName || '').toLowerCase();
        return authorSet.has(author);
      });
    }

    // Narrator filter
    if (filters.narrators?.length) {
      const narratorSet = new Set(filters.narrators.map(n => n.toLowerCase()));
      items = items.filter((item) => {
        const narrator = (getMetadata(item).narratorName || '').toLowerCase().replace(/^narrated by\s*/i, '');
        return narratorSet.has(narrator);
      });
    }

    // Series filter
    if (filters.series?.length) {
      const seriesSet = new Set(filters.series.map(s => s.toLowerCase().replace(/\s*#[\d.]+$/, '')));
      items = items.filter((item) => {
        const series = (getMetadata(item).seriesName || '').toLowerCase().replace(/\s*#[\d.]+$/, '');
        return seriesSet.has(series);
      });
    }

    // Duration filter
    if (filters.minDuration !== undefined) {
      const minSeconds = filters.minDuration * 3600;
      items = items.filter((item) => (item.media?.duration || 0) >= minSeconds);
    }
    if (filters.maxDuration !== undefined) {
      const maxSeconds = filters.maxDuration * 3600;
      items = items.filter((item) => (item.media?.duration || 0) <= maxSeconds);
    }

    // Progress filters
    if (filters.hasProgress === true) {
      items = items.filter((item) => (item.userMediaProgress?.progress || 0) > 0);
    }
    if (filters.isFinished === true) {
      items = items.filter((item) => (item.userMediaProgress?.progress || 0) >= 0.95);
    } else if (filters.isFinished === false) {
      items = items.filter((item) => (item.userMediaProgress?.progress || 0) < 0.95);
    }

    // Sorting
    if (filters.sortBy) {
      const order = filters.sortOrder === 'desc' ? -1 : 1;
      items = [...items].sort((a, b) => {
        switch (filters.sortBy) {
          case 'title':
            return order * (getMetadata(a).title || '').localeCompare(getMetadata(b).title || '');
          case 'author':
            return order * (getMetadata(a).authorName || '').localeCompare(getMetadata(b).authorName || '');
          case 'dateAdded':
            return order * ((a.addedAt || 0) - (b.addedAt || 0));
          case 'duration':
            return order * ((a.media?.duration || 0) - (b.media?.duration || 0));
          case 'progress':
            return order * ((a.userMediaProgress?.progress || 0) - (b.userMediaProgress?.progress || 0));
          default:
            return 0;
        }
      });
    }

    return items;
  },

  loadSpineManifest: async (forceRefresh = false) => {
    const { spineServerUrl, useCommunitySpines, useServerSpines } = useSpineCacheStore.getState();

    // Load community manifest v2 (multi-key matching for universal compatibility)
    // Throttle to once per hour unless forced — manifest rarely changes
    const COMMUNITY_MANIFEST_TTL_MS = 60 * 60 * 1000; // 1 hour
    if (useCommunitySpines) {
      const now = Date.now();
      const lastFetch = _lastCommunityManifestFetchAt;
      const hasCachedData = get().booksWithCommunitySpines.size > 0;
      const shouldFetch = forceRefresh || !hasCachedData || !lastFetch || (now - lastFetch) >= COMMUNITY_MANIFEST_TTL_MS;

      if (!shouldFetch) {
        log.debug(`Community manifest: using cached data (${get().booksWithCommunitySpines.size} books, age ${Math.round((now - lastFetch!) / 60000)}m)`);
      } else {
        try {
          // Use pre-fetched manifest if available (from prefetchCommunityManifest)
          let manifest: CommunityManifestV2;
          if (_prefetchedCommunityManifest) {
            manifest = _prefetchedCommunityManifest;
            _prefetchedCommunityManifest = null; // Consume it — next call fetches fresh
            log.debug('Using pre-fetched community manifest');
          } else {
            const COMMUNITY_URL = 'https://spines.mysecretlibrary.com';
            manifest = await apiClient.getCommunityManifestV2(COMMUNITY_URL);
          }
          _lastCommunityManifestFetchAt = Date.now();

          if (manifest.books.length > 0) {
            // Build reverse lookup indexes from community manifest
            const asinMap = new Map<string, { id: string; w: number; h: number }>();
            const isbnMap = new Map<string, { id: string; w: number; h: number }>();
            const hashMap = new Map<string, { id: string; w: number; h: number }>();

            for (const book of manifest.books) {
              const entry = { id: book.id, w: book.w || 0, h: book.h || 0 };
              if (book.asin) asinMap.set(book.asin, entry);
              if (book.isbn) isbnMap.set(book.isbn, entry);
              if (book.hash) hashMap.set(book.hash, entry);
            }

            // Match local books against community manifest
            const localItems = get().items;
            const communityBookMap: Record<string, string> = {};
            const matchedLocalIds: string[] = [];
            const dimensions: Record<string, [number, number]> = {};

            // Import hash function lazily to avoid circular deps
            const { titleAuthorHash } = require('@/shared/utils/titleAuthorHash');

            // Pre-compute hashes for all local books that weren't matched by ASIN/ISBN
            const needsHash: { id: string; title: string; author: string }[] = [];

            for (const item of localItems) {
              const metadata = getBookMetadataTyped(item);
              if (!metadata) continue;

              // Priority 1: ASIN match
              if (metadata.asin) {
                const match = asinMap.get(metadata.asin);
                if (match) {
                  communityBookMap[item.id] = match.id;
                  matchedLocalIds.push(item.id);
                  if (match.w && match.h) dimensions[item.id] = [match.w, match.h];
                  continue;
                }
              }

              // Priority 2: ISBN match
              if (metadata.isbn) {
                const cleanIsbn = metadata.isbn.replace(/[^0-9X]/gi, '').toUpperCase();
                const match = isbnMap.get(cleanIsbn);
                if (match) {
                  communityBookMap[item.id] = match.id;
                  matchedLocalIds.push(item.id);
                  if (match.w && match.h) dimensions[item.id] = [match.w, match.h];
                  continue;
                }
              }

              // Queue for hash matching
              const title = metadata.title || '';
              const author = metadata.authorName || '';
              if (title) {
                needsHash.push({ id: item.id, title, author });
              }
            }

            // Priority 3: Fuzzy title+author hash (async due to crypto)
            if (needsHash.length > 0 && hashMap.size > 0) {
              const { batchTitleAuthorHash } = require('@/shared/utils/titleAuthorHash');
              const hashResults: Map<string, string> = await batchTitleAuthorHash(needsHash);

              for (const [localId, hash] of hashResults) {
                const match = hashMap.get(hash);
                if (match) {
                  communityBookMap[localId] = match.id;
                  matchedLocalIds.push(localId);
                  if (match.w && match.h) dimensions[localId] = [match.w, match.h];
                }
              }
            }

            // Update state
            const communitySet = new Set(matchedLocalIds);
            set({ booksWithCommunitySpines: communitySet });
            useSpineCacheStore.getState().setCachedCommunityBookIds(matchedLocalIds);
            useSpineCacheStore.getState().setCommunityBookMap(communityBookMap);

            // Pre-populate spine dimensions
            if (Object.keys(dimensions).length > 0) {
              useSpineCacheStore.getState().batchSetServerSpineDimensions(dimensions);
            }

            log.debug(`Community manifest v2: ${manifest.books.length} available, ${matchedLocalIds.length} matched locally`);
          }
        } catch (err) {
          log.warn('Failed to load community spine manifest:', err);
        }
      }
    }

    // Load server manifest (independent — uses abs_uuid, same instance)
    if (useServerSpines) {
      try {
        const customSpineUrl = spineServerUrl || undefined;
        const manifest = await apiClient.getSpineManifest(customSpineUrl);
        const serverSet = new Set(manifest.items);
        set({
          booksWithServerSpines: serverSet,
          spineManifestVersion: manifest.version,
        });
        useSpineCacheStore.getState().setCachedManifestBookIds(manifest.items);
        log.debug(`Server spine manifest: ${serverSet.size} books`);
      } catch (err) {
        log.warn('Failed to load server spine manifest:', err);
      }
    }
  },

  hasServerSpine: (bookId: string) => {
    return get().booksWithServerSpines.has(bookId);
  },

  clearCache: async (skipSqlite?: boolean) => {
    // Save libraryId before clearing so we can reload
    const libraryId = get().currentLibraryId;

    // Clear SQLite cache (single source of truth - P1 Fix)
    // Skip if caller already cleared SQLite (e.g. logout via clearAllUserData)
    if (!skipSqlite) {
      await sqliteCache.clearAllCache();
    }
    // Clear spine cache as well
    useSpineCacheStore.getState().clearCache();
    // Bump cover cache version so images refresh
    apiClient.bumpCoverCacheVersion();

    set({
      items: [],
      isLoaded: false,
      lastUpdated: null,
      lastRefreshed: null,
      authors: new Map(),
      narrators: new Map(),
      series: new Map(),
      genres: [],
      genresWithBooks: new Map(),
      itemsById: new Map(),
      booksWithServerSpines: new Set(),
      booksWithCommunitySpines: new Set(),
      spineManifestVersion: null,
      // Keep currentLibraryId so we know which library to reload
    });

    // Load spine manifest immediately (don't wait for full cache reload)
    // This prevents black spines during the reload delay
    get().loadSpineManifest();

    // Automatically reload library data from server
    if (libraryId) {
      // loadCache is already async and checks isLoading to avoid re-entrancy,
      // so we can call it directly without a fragile setTimeout delay.
      get().loadCache(libraryId, true);
    }
  },
})));

// Export helper for getting all unique values
export function getAllAuthors(): AuthorInfo[] {
  const { authors } = useLibraryCache.getState();
  return Array.from(authors.values()).sort((a, b) => b.bookCount - a.bookCount);
}

export function getAllNarrators(): NarratorInfo[] {
  const { narrators } = useLibraryCache.getState();
  return Array.from(narrators.values()).sort((a, b) => b.bookCount - a.bookCount);
}

export function getAllSeries(): SeriesInfo[] {
  const { series } = useLibraryCache.getState();
  return Array.from(series.values()).sort((a, b) => b.bookCount - a.bookCount);
}

export function getAllGenres(): string[] {
  return useLibraryCache.getState().genres;
}

/**
 * Get genres sorted by book count (most popular first)
 * Uses pre-computed genresWithBooks map for O(n log n) instead of O(n*m)
 */
export function getGenresByPopularity(): GenreInfo[] {
  const { genresWithBooks } = useLibraryCache.getState();

  // Use pre-computed map and sort by count descending
  return Array.from(genresWithBooks.values())
    .sort((a, b) => b.bookCount - a.bookCount);
}

/**
 * Get series navigation info for a book
 * Returns null if the book is not in a series
 */
export function getSeriesNavigationInfo(currentBook: LibraryItem): {
  seriesName: string;
  currentSequence: number;
  totalBooks: number;
  previousBook: LibraryItem | null;
  nextBook: LibraryItem | null;
} | null {
  const metadata = getMetadata(currentBook);

  let cleanSeriesName = '';
  let currentSeq = 0;

  // Try series array first (expanded API data format)
  // e.g., series: [{ name: "Discworld", sequence: "12" }]
  if (metadata.series?.length > 0) {
    const seriesEntry = metadata.series[0];
    const name = typeof seriesEntry === 'string' ? seriesEntry : seriesEntry?.name;
    const seq = seriesEntry?.sequence;
    if (name && typeof name === 'string') {
      cleanSeriesName = name;
      currentSeq = seq ? parseFloat(seq) : 1;
    }
  }

  // Fallback to seriesName string format (e.g., "Discworld #12")
  if (!cleanSeriesName) {
    const seriesNameRaw = metadata.seriesName || '';
    if (!seriesNameRaw) return null;

    const seqMatch = seriesNameRaw.match(/#([\d.]+)/);
    if (!seqMatch) return null;

    currentSeq = parseFloat(seqMatch[1]);
    cleanSeriesName = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
  }

  if (!cleanSeriesName) return null;

  const seriesInfo = useLibraryCache.getState().getSeries(cleanSeriesName);
  if (!seriesInfo || seriesInfo.books.length === 0) return null;

  // Find current book index
  const currentIndex = seriesInfo.books.findIndex(book => book.id === currentBook.id);

  let previousBook: LibraryItem | null = null;
  let nextBook: LibraryItem | null = null;

  if (currentIndex > 0) {
    previousBook = seriesInfo.books[currentIndex - 1];
  }
  if (currentIndex >= 0 && currentIndex < seriesInfo.books.length - 1) {
    nextBook = seriesInfo.books[currentIndex + 1];
  }

  return {
    seriesName: cleanSeriesName,
    currentSequence: currentSeq,
    totalBooks: seriesInfo.books.length,
    previousBook,
    nextBook,
  };
}

/**
 * Get the next book in a series based on the current book
 * Returns null if the book is not in a series or there's no next book
 */
export function getNextBookInSeries(currentBook: LibraryItem): LibraryItem | null {
  const metadata = getMetadata(currentBook);
  const seriesName = metadata.seriesName || '';

  log.debug('[getNextBookInSeries] Input seriesName:', seriesName);

  if (!seriesName) {
    log.debug('[getNextBookInSeries] No series name, returning null');
    return null;
  }

  // Extract current sequence number
  const seqMatch = seriesName.match(/#([\d.]+)/);
  if (!seqMatch) {
    log.debug('[getNextBookInSeries] No sequence number found in:', seriesName);
    return null;
  }
  const currentSeq = parseFloat(seqMatch[1]);
  log.debug('[getNextBookInSeries] Current sequence:', currentSeq);

  // Get the series from cache
  const cleanSeriesName = seriesName.replace(/\s*#[\d.]+$/, '').trim();
  log.debug('[getNextBookInSeries] Clean series name:', cleanSeriesName);

  const seriesInfo = useLibraryCache.getState().getSeries(cleanSeriesName);
  log.debug('[getNextBookInSeries] Series info:', seriesInfo ? `${seriesInfo.books.length} books` : 'null');

  if (!seriesInfo || seriesInfo.books.length === 0) {
    log.debug('[getNextBookInSeries] No series info found');
    return null;
  }

  // Find the current book's index in the sorted series
  const currentIndex = seriesInfo.books.findIndex(book => book.id === currentBook.id);
  log.debug('[getNextBookInSeries] Current index:', currentIndex, 'of', seriesInfo.books.length);

  // Return the next book if it exists
  if (currentIndex >= 0 && currentIndex < seriesInfo.books.length - 1) {
    const nextBook = seriesInfo.books[currentIndex + 1];
    log.debug('[getNextBookInSeries] Found next book by index:', getMetadata(nextBook).title);
    return nextBook;
  }

  // Fallback: find next by sequence number if book wasn't found by ID
  for (const book of seriesInfo.books) {
    const bookMetadata = getMetadata(book);
    const bookSeriesName = bookMetadata.seriesName || '';
    const bookSeqMatch = bookSeriesName.match(/#([\d.]+)/);
    if (bookSeqMatch) {
      const bookSeq = parseFloat(bookSeqMatch[1]);
      if (bookSeq > currentSeq) {
        log.debug('[getNextBookInSeries] Found next book by sequence:', bookMetadata.title);
        return book;
      }
    }
  }

  log.debug('[getNextBookInSeries] No next book found');
  return null;
}
