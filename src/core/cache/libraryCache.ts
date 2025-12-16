/**
 * src/core/cache/libraryCache.ts
 *
 * Persistent library cache with 30-day TTL
 * Caches entire library on startup for instant navigation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

const CACHE_KEY = 'library_cache_v1';
const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
const DEBUG = __DEV__;

interface CachedLibrary {
  items: LibraryItem[];
  timestamp: number;
  libraryId: string;
}

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
  itemsById: Map<string, LibraryItem>;

  // Actions
  loadCache: (libraryId: string, forceRefresh?: boolean) => Promise<void>;
  refreshCache: (libraryId?: string) => Promise<void>;
  getItem: (id: string) => LibraryItem | undefined;
  getAuthor: (name: string) => AuthorInfo | undefined;
  getNarrator: (name: string) => NarratorInfo | undefined;
  getSeries: (name: string) => SeriesInfo | undefined;
  searchItems: (query: string) => LibraryItem[];
  filterItems: (filters: FilterOptions) => LibraryItem[];
  clearCache: () => Promise<void>;
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

// Helper to extract metadata safely
function getMetadata(item: LibraryItem): any {
  return (item.media?.metadata as any) || {};
}

// Build derived indexes from items
function buildIndexes(items: LibraryItem[]) {
  const authors = new Map<string, AuthorInfo>();
  const narrators = new Map<string, NarratorInfo>();
  const series = new Map<string, SeriesInfo>();
  const genresSet = new Set<string>();
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
    const seriesName = metadata.seriesName || '';
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

    // Collect genres
    for (const genre of (metadata.genres || [])) {
      genresSet.add(genre);
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

  return {
    authors,
    narrators,
    series,
    genres: Array.from(genresSet).sort(),
    itemsById,
  };
}

export const useLibraryCache = create<LibraryCacheState>((set, get) => ({
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
  itemsById: new Map(),

  loadCache: async (libraryId: string, forceRefresh = false) => {
    const { isLoading, isLoaded } = get();
    if (isLoading) return;
    if (isLoaded && !forceRefresh) return;

    set({ isLoading: true, error: null });

    try {
      // Try to load from AsyncStorage first
      if (!forceRefresh) {
        let cached: string | null = null;
        try {
          cached = await AsyncStorage.getItem(CACHE_KEY);
        } catch (cacheReadError: any) {
          // Handle "Row too big" error on Android - cache is corrupted/too large
          console.warn('[LibraryCache] Cache read failed (likely too large), clearing:', cacheReadError.message);
          try {
            await AsyncStorage.removeItem(CACHE_KEY);
          } catch {}
          // Continue to fetch fresh data
        }
        if (cached) {
          const parsed: CachedLibrary = JSON.parse(cached);
          const age = Date.now() - parsed.timestamp;

          // Check if cache is still valid (same library, not expired)
          if (parsed.libraryId === libraryId && age < CACHE_TTL_MS) {
            DEBUG && console.log(`[LibraryCache] Using cached data (${Math.round(age / 1000 / 60)} min old)`);
            const indexes = buildIndexes(parsed.items);

            // Fetch authors from API in background to get accurate book counts
            apiClient.getLibraryAuthors(libraryId).then((apiAuthors) => {
              if (apiAuthors && apiAuthors.length > 0) {
                DEBUG && console.log(`[LibraryCache] Merging ${apiAuthors.length} authors from API (background)`);
                for (const apiAuthor of apiAuthors) {
                  const key = apiAuthor.name.toLowerCase();
                  const existing = indexes.authors.get(key);
                  if (existing) {
                    existing.id = apiAuthor.id;
                    existing.bookCount = (apiAuthor as any).numBooks || existing.bookCount;
                    existing.imagePath = apiAuthor.imagePath;
                    existing.description = apiAuthor.description;
                  } else {
                    indexes.authors.set(key, {
                      id: apiAuthor.id,
                      name: apiAuthor.name,
                      bookCount: (apiAuthor as any).numBooks || 0,
                      books: [],
                      imagePath: apiAuthor.imagePath,
                      description: apiAuthor.description,
                    });
                  }
                }
                // Update state with merged authors
                set({ authors: indexes.authors });
              }
            }).catch(() => {
              // Silently fail - will use local counts
            });

            set({
              items: parsed.items,
              isLoaded: true,
              isLoading: false,
              lastUpdated: parsed.timestamp,
              currentLibraryId: libraryId,
              ...indexes,
            });
            return;
          }
        }
      }

      // Fetch fresh data from API - items and authors in parallel
      DEBUG && console.log('[LibraryCache] Fetching fresh library data for library:', libraryId);
      const [itemsResponse, apiAuthors] = await Promise.all([
        apiClient.getLibraryItems(libraryId, { limit: 100000 }),  // Large limit to fetch all books
        apiClient.getLibraryAuthors(libraryId).catch(() => [] as any[]),
      ]);
      const items = itemsResponse?.results || [];

      // Build indexes from items
      const indexes = buildIndexes(items);

      // Merge API author data (which has accurate book counts) with local data
      if (apiAuthors && apiAuthors.length > 0) {
        DEBUG && console.log(`[LibraryCache] Merging ${apiAuthors.length} authors from API`);
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

      // Save to AsyncStorage (skip if data is too large to prevent CursorWindow errors)
      const cacheData: CachedLibrary = {
        items,
        timestamp: Date.now(),
        libraryId,
      };
      const cacheJson = JSON.stringify(cacheData);
      // Android CursorWindow limit is 2MB, stay well under to be safe
      if (cacheJson.length < 1.5 * 1024 * 1024) {
        try {
          await AsyncStorage.setItem(CACHE_KEY, cacheJson);
        } catch (writeError: any) {
          console.warn('[LibraryCache] Failed to save cache (too large?):', writeError.message);
        }
      } else {
        console.warn(`[LibraryCache] Cache too large to persist (${(cacheJson.length / 1024 / 1024).toFixed(1)}MB), using in-memory only`);
      }

      DEBUG && console.log(`[LibraryCache] Cached ${items.length} items, ${indexes.authors.size} authors`);

      set({
        items,
        isLoaded: true,
        isLoading: false,
        lastUpdated: Date.now(),
        currentLibraryId: libraryId,
        ...indexes,
      });
    } catch (error: any) {
      console.error('[LibraryCache] Failed to load:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to load library',
      });
    }
  },

  refreshCache: async (libraryId?: string) => {
    const id = libraryId || get().currentLibraryId;
    if (!id) {
      // Silently ignore - this can happen during startup before library is selected
      return;
    }
    DEBUG && console.log('[LibraryCache] Refreshing cache for library:', id);
    await get().loadCache(id, true);
    // Set lastRefreshed to bust image caches
    const now = Date.now();
    set({ lastRefreshed: now });
    // Also bump apiClient's cache version so all cover URLs get new version
    apiClient.bumpCoverCacheVersion();
    DEBUG && console.log('[LibraryCache] Cache refresh complete, image caches will be busted');
  },

  getItem: (id: string) => {
    return get().itemsById.get(id);
  },

  getAuthor: (name: string) => {
    return get().authors.get(name.toLowerCase());
  },

  getNarrator: (name: string) => {
    return get().narrators.get(name.toLowerCase());
  },

  getSeries: (name: string) => {
    // Try exact match first
    let series = get().series.get(name.toLowerCase());
    if (series) return series;

    // Try without sequence number
    const cleanName = name.replace(/\s*#[\d.]+$/, '').trim();
    return get().series.get(cleanName.toLowerCase());
  },

  searchItems: (query: string) => {
    const { items } = get();
    if (!query.trim()) return items;

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
    DEBUG && console.log(`[LibraryCache] filterItems called. Items: ${items.length}, isLoaded: ${isLoaded}`);

    // Text search
    if (filters.query?.trim()) {
      const lowerQuery = filters.query.toLowerCase();
      const beforeCount = items.length;
      items = items.filter((item) => {
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
      DEBUG && console.log(`[LibraryCache] Text search "${filters.query}": ${beforeCount} -> ${items.length} items`);
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

  clearCache: async () => {
    await AsyncStorage.removeItem(CACHE_KEY);
    set({
      items: [],
      isLoaded: false,
      lastUpdated: null,
      authors: new Map(),
      narrators: new Map(),
      series: new Map(),
      genres: [],
      itemsById: new Map(),
    });
  },
}));

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
  const metadata = (currentBook.media?.metadata as any) || {};
  const seriesNameRaw = metadata.seriesName || '';

  if (!seriesNameRaw) return null;

  // Extract sequence number
  const seqMatch = seriesNameRaw.match(/#([\d.]+)/);
  if (!seqMatch) return null;

  const currentSeq = parseFloat(seqMatch[1]);
  const cleanSeriesName = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();

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
  const metadata = (currentBook.media?.metadata as any) || {};
  const seriesName = metadata.seriesName || '';

  DEBUG && console.log('[getNextBookInSeries] Input seriesName:', seriesName);

  if (!seriesName) {
    DEBUG && console.log('[getNextBookInSeries] No series name, returning null');
    return null;
  }

  // Extract current sequence number
  const seqMatch = seriesName.match(/#([\d.]+)/);
  if (!seqMatch) {
    DEBUG && console.log('[getNextBookInSeries] No sequence number found in:', seriesName);
    return null;
  }
  const currentSeq = parseFloat(seqMatch[1]);
  DEBUG && console.log('[getNextBookInSeries] Current sequence:', currentSeq);

  // Get the series from cache
  const cleanSeriesName = seriesName.replace(/\s*#[\d.]+$/, '').trim();
  DEBUG && console.log('[getNextBookInSeries] Clean series name:', cleanSeriesName);

  const seriesInfo = useLibraryCache.getState().getSeries(cleanSeriesName);
  DEBUG && console.log('[getNextBookInSeries] Series info:', seriesInfo ? `${seriesInfo.books.length} books` : 'null');

  if (!seriesInfo || seriesInfo.books.length === 0) {
    DEBUG && console.log('[getNextBookInSeries] No series info found');
    return null;
  }

  // Find the current book's index in the sorted series
  const currentIndex = seriesInfo.books.findIndex(book => book.id === currentBook.id);
  DEBUG && console.log('[getNextBookInSeries] Current index:', currentIndex, 'of', seriesInfo.books.length);

  // Return the next book if it exists
  if (currentIndex >= 0 && currentIndex < seriesInfo.books.length - 1) {
    const nextBook = seriesInfo.books[currentIndex + 1];
    DEBUG && console.log('[getNextBookInSeries] Found next book by index:', (nextBook.media?.metadata as any)?.title);
    return nextBook;
  }

  // Fallback: find next by sequence number if book wasn't found by ID
  for (const book of seriesInfo.books) {
    const bookMetadata = (book.media?.metadata as any) || {};
    const bookSeriesName = bookMetadata.seriesName || '';
    const bookSeqMatch = bookSeriesName.match(/#([\d.]+)/);
    if (bookSeqMatch) {
      const bookSeq = parseFloat(bookSeqMatch[1]);
      if (bookSeq > currentSeq) {
        DEBUG && console.log('[getNextBookInSeries] Found next book by sequence:', bookMetadata.title);
        return book;
      }
    }
  }

  DEBUG && console.log('[getNextBookInSeries] No next book found');
  return null;
}
