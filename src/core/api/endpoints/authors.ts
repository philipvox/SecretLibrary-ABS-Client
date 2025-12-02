/**
 * src/core/api/endpoints/authors.ts
 *
 * Authors API endpoints
 */

import { apiClient } from '../apiClient';
import { Author } from '@/core/types/metadata';
import { AuthorQuery } from '@/core/types/api';

/**
 * Authors API
 */
export const authorsApi = {
  /**
   * Get an author by ID
   */
  getById: async (
    authorId: string,
    options?: AuthorQuery
  ): Promise<Author> => {
    return apiClient.getAuthor(authorId, options);
  },

  /**
   * Get author with their items
   */
  getWithItems: async (authorId: string): Promise<Author> => {
    return apiClient.getAuthor(authorId, { include: 'items' });
  },

  /**
   * Get author with their series
   */
  getWithSeries: async (authorId: string): Promise<Author> => {
    return apiClient.getAuthor(authorId, { include: 'series' });
  },

  /**
   * Get author with both items and series
   */
  getWithAll: async (authorId: string): Promise<Author> => {
    return apiClient.getAuthor(authorId, { include: 'items,series' });
  },

  /**
   * Get all authors for a library
   */
  getForLibrary: async (libraryId: string): Promise<Author[]> => {
    return apiClient.getLibraryAuthors(libraryId);
  },

  /**
   * Get author image URL
   */
  getImageUrl: (authorId: string): string => {
    return apiClient.getAuthorImageUrl(authorId);
  },
};
