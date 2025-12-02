/**
 * src/core/api/endpoints/libraries.ts
 *
 * Library-related API endpoints
 */

import { apiClient } from '../apiClient';
import { Library, LibraryItem } from '@/core/types/library';
import { Series, Author } from '@/core/types/metadata';
import {
  LibraryItemsQuery,
  PaginatedResponse,
  SearchQuery,
  SearchResults,
  FilterData,
} from '@/core/types/api';

/**
 * Libraries API
 */
export const librariesApi = {
  /**
   * Get all libraries
   */
  getAll: async (): Promise<Library[]> => {
    return apiClient.getLibraries();
  },

  /**
   * Get a specific library by ID
   */
  getById: async (libraryId: string): Promise<Library> => {
    return apiClient.getLibrary(libraryId);
  },

  /**
   * Get items in a library with pagination and filtering
   */
  getItems: async (
    libraryId: string,
    options?: LibraryItemsQuery
  ): Promise<PaginatedResponse<LibraryItem>> => {
    return apiClient.getLibraryItems(libraryId, options);
  },

  /**
   * Get all items in a library (handles pagination internally)
   */
  getAllItems: async (
    libraryId: string,
    options?: Omit<LibraryItemsQuery, 'page' | 'limit'>
  ): Promise<LibraryItem[]> => {
    const allItems: LibraryItem[] = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.getLibraryItems(libraryId, {
        ...options,
        page,
        limit,
      });

      allItems.push(...response.results);
      hasMore = allItems.length < response.total;
      page++;
    }

    return allItems;
  },

  /**
   * Search within a library
   */
  search: async (
    libraryId: string,
    query: SearchQuery
  ): Promise<SearchResults> => {
    return apiClient.searchLibrary(libraryId, query);
  },

  /**
   * Get filter data for a library (authors, genres, tags, etc.)
   */
  getFilterData: async (libraryId: string): Promise<FilterData> => {
    return apiClient.getLibraryFilterData(libraryId);
  },

  /**
   * Get all series in a library
   */
  getSeries: async (libraryId: string): Promise<Series[]> => {
    return apiClient.getLibrarySeries(libraryId);
  },

  /**
   * Get all authors in a library
   */
  getAuthors: async (libraryId: string): Promise<Author[]> => {
    return apiClient.getLibraryAuthors(libraryId);
  },
};
