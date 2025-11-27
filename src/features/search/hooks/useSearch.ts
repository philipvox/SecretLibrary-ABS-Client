/**
 * src/features/search/hooks/useSearch.ts
 */

import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { LibraryItem } from '@/core/types';
import { getTitle, getAuthorName, getNarratorName, getSeriesName } from '@/shared/utils/metadata';

export interface SearchResults {
  books: LibraryItem[];
  series: SeriesResult[];
  authors: AuthorResult[];
  narrators: NarratorResult[];
  totalCount: number;
}

export interface SeriesResult {
  name: string;
  books: LibraryItem[];
}

export interface AuthorResult {
  name: string;
  books: LibraryItem[];
}

export interface NarratorResult {
  name: string;
  books: LibraryItem[];
}

interface SearchableItem {
  item: LibraryItem;
  title: string;
  author: string;
  narrator: string;
  series: string;
  genres: string[];
}

const fuseOptions: Fuse.IFuseOptions<SearchableItem> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'author', weight: 0.25 },
    { name: 'narrator', weight: 0.15 },
    { name: 'series', weight: 0.15 },
    { name: 'genres', weight: 0.05 },
  ],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export function useSearch(items: LibraryItem[]) {
  const [query, setQuery] = useState('');

  const searchableItems = useMemo(() => {
    return items.map((item) => ({
      item,
      title: getTitle(item),
      author: getAuthorName(item),
      narrator: getNarratorName(item),
      series: getSeriesName(item),
      genres: (item.media?.metadata as any)?.genres || [],
    }));
  }, [items]);

  const fuse = useMemo(() => {
    return new Fuse(searchableItems, fuseOptions);
  }, [searchableItems]);

  const results = useMemo((): SearchResults => {
    if (!query.trim() || query.length < 2) {
      return { books: [], series: [], authors: [], narrators: [], totalCount: 0 };
    }

    const searchResults = fuse.search(query);
    const matchedBooks = searchResults.map((r) => r.item.item);

    // Group by series
    const seriesMap = new Map<string, LibraryItem[]>();
    matchedBooks.forEach((book) => {
      const seriesName = getSeriesName(book);
      if (seriesName) {
        const existing = seriesMap.get(seriesName) || [];
        existing.push(book);
        seriesMap.set(seriesName, existing);
      }
    });
    const seriesResults: SeriesResult[] = Array.from(seriesMap.entries())
      .map(([name, books]) => ({ name, books }))
      .sort((a, b) => b.books.length - a.books.length);

    // Group by author
    const authorMap = new Map<string, LibraryItem[]>();
    matchedBooks.forEach((book) => {
      const authorName = getAuthorName(book);
      if (authorName && authorName !== 'Unknown Author') {
        const existing = authorMap.get(authorName) || [];
        existing.push(book);
        authorMap.set(authorName, existing);
      }
    });
    const authorResults: AuthorResult[] = Array.from(authorMap.entries())
      .map(([name, books]) => ({ name, books }))
      .sort((a, b) => b.books.length - a.books.length);

    // Group by narrator
    const narratorMap = new Map<string, LibraryItem[]>();
    matchedBooks.forEach((book) => {
      const narratorName = getNarratorName(book);
      if (narratorName && narratorName !== 'Unknown Narrator') {
        const existing = narratorMap.get(narratorName) || [];
        existing.push(book);
        narratorMap.set(narratorName, existing);
      }
    });
    const narratorResults: NarratorResult[] = Array.from(narratorMap.entries())
      .map(([name, books]) => ({ name, books }))
      .sort((a, b) => b.books.length - a.books.length);

    return {
      books: matchedBooks,
      series: seriesResults,
      authors: authorResults,
      narrators: narratorResults,
      totalCount: matchedBooks.length,
    };
  }, [query, fuse]);

  const isSearching = false;
  const hasSearched = query.length >= 2;

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    clearSearch,
    results,
    isSearching,
    hasSearched,
  };
}