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

interface CachedLibrary {
  items: LibraryItem[];
  timestamp: number;
  libraryId: string;
}

interface AuthorInfo {
  name: string;
  bookCount: number;
  books: LibraryItem[];
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
  error: string | null;

  // Derived data (computed once on load)
  authors: Map<string, AuthorInfo>;
  narrators: Map<string, NarratorInfo>;
  series: Map<string, SeriesInfo>;
  genres: string[];
  itemsById: Map<string, LibraryItem>;

  // Actions
  loadCache: (libraryId: string, forceRefresh?: boolean) => Promise<void>;
  refreshCache: (libraryId: string) => Promise<void>;
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
  for (const seriesInfo of series.values()) {
    seriesInfo.books.sort((a, b) => {
      const aSeq = parseFloat(getMetadata(a).seriesName?.match(/#([\d.]+)/)?.[1] || '999');
      const bSeq = parseFloat(getMetadata(b).seriesName?.match(/#([\d.]+)/)?.[1] || '999');
      return aSeq - bSeq;
    });
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
  error: null,
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
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: CachedLibrary = JSON.parse(cached);
          const age = Date.now() - parsed.timestamp;

          // Check if cache is still valid (same library, not expired)
          if (parsed.libraryId === libraryId && age < CACHE_TTL_MS) {
            console.log(`[LibraryCache] Using cached data (${Math.round(age / 1000 / 60)} min old)`);
            const indexes = buildIndexes(parsed.items);
            set({
              items: parsed.items,
              isLoaded: true,
              isLoading: false,
              lastUpdated: parsed.timestamp,
              ...indexes,
            });
            return;
          }
        }
      }

      // Fetch fresh data from API
      console.log('[LibraryCache] Fetching fresh library data for library:', libraryId);
      const response = await apiClient.getLibraryItems(libraryId, { limit: 1000 });
      const items = response?.results || [];

      // Build indexes
      const indexes = buildIndexes(items);

      // Save to AsyncStorage
      const cacheData: CachedLibrary = {
        items,
        timestamp: Date.now(),
        libraryId,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      console.log(`[LibraryCache] Cached ${items.length} items`);

      set({
        items,
        isLoaded: true,
        isLoading: false,
        lastUpdated: Date.now(),
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

  refreshCache: async (libraryId: string) => {
    await get().loadCache(libraryId, true);
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
    let { items } = get();

    // Text search
    if (filters.query?.trim()) {
      const lowerQuery = filters.query.toLowerCase();
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
