// src/features/narrator/hooks/useNarrators.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { SortOption } from '@/shared/components/FilterSortBar';

export interface NarratorInfo {
  id: string;
  name: string;
  bookCount: number;
  books: LibraryItem[];
}

interface UseNarratorsOptions {
  sortBy?: SortOption;
  searchQuery?: string;
}

interface UseNarratorsResult {
  narrators: NarratorInfo[];
  narratorCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function extractNarratorsFromItems(items: LibraryItem[]): NarratorInfo[] {
  const narratorMap = new Map<string, NarratorInfo>();
  
  items.forEach((item) => {
    const metadata = item.media?.metadata as any;
    
    // Get narrator string - could be in narrators array or narratorName string
    let narratorNames: string[] = [];
    
    if (metadata?.narrators?.length > 0) {
      narratorNames = metadata.narrators;
    } else if (metadata?.narratorName) {
      // Parse narratorName string: "Narrated by Name1, Name2, Name3"
      let nameStr = metadata.narratorName as string;
      
      // Remove "Narrated by " prefix
      if (nameStr.toLowerCase().startsWith('narrated by ')) {
        nameStr = nameStr.substring(12);
      }
      
      // Split by comma and clean up
      narratorNames = nameStr.split(',').map((n: string) => n.trim()).filter(Boolean);
    }
    
    narratorNames.forEach((name: string) => {
      if (!name || typeof name !== 'string') return;
      const trimmed = name.trim();
      if (!trimmed) return;
      
      const id = trimmed.toLowerCase().replace(/\s+/g, '-');
      const existing = narratorMap.get(id);
      
      if (existing) {
        existing.bookCount++;
        existing.books.push(item);
      } else {
        narratorMap.set(id, { id, name: trimmed, bookCount: 1, books: [item] });
      }
    });
  });
  
  return Array.from(narratorMap.values());
}

export function useNarrators(
  libraryId: string,
  options: UseNarratorsOptions = {}
): UseNarratorsResult {
  const { sortBy = 'name-asc', searchQuery = '' } = options;

  const { data, isLoading, error, refetch } = useQuery<NarratorInfo[]>({
    queryKey: ['narrators', libraryId],
    queryFn: async () => {
      const items: LibraryItem[] = [];
      let page = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await apiClient.getLibraryItems(libraryId, {
          limit,
          page,
          include: 'progress',
        });
        items.push(...response.results);
        hasMore = items.length < response.total;
        page++;
      }
      
      return extractNarratorsFromItems(items);
    },
    enabled: !!libraryId,
    staleTime: 10 * 60 * 1000,
  });

  const narrators = useMemo(() => {
    if (!data?.length) return [];

    let result = [...data];

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter((n) => n.name.toLowerCase().includes(lower));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'bookCount-desc': return b.bookCount - a.bookCount;
        case 'bookCount-asc': return a.bookCount - b.bookCount;
        default: return 0;
      }
    });

    return result;
  }, [data, sortBy, searchQuery]);

  return {
    narrators,
    narratorCount: narrators.length,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}