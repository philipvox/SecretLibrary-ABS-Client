/**
 * src/core/api/endpoints/items.ts
 *
 * Library item API endpoints
 */

import { apiClient } from '../apiClient';
import { LibraryItem } from '@/core/types/library';

/**
 * Items API
 */
export const itemsApi = {
  /**
   * Get a library item by ID
   */
  getById: async (
    itemId: string,
    options?: { include?: string }
  ): Promise<LibraryItem> => {
    return apiClient.getItem(itemId, options?.include);
  },

  /**
   * Get item with full details including progress
   */
  getWithProgress: async (itemId: string): Promise<LibraryItem> => {
    return apiClient.getItem(itemId, 'progress');
  },

  /**
   * Get item with RSS feed info
   */
  getWithRssFeed: async (itemId: string): Promise<LibraryItem> => {
    return apiClient.getItem(itemId, 'rssfeed');
  },

  /**
   * Get item cover URL
   */
  getCoverUrl: (itemId: string): string => {
    return apiClient.getItemCoverUrl(itemId);
  },

  /**
   * Get multiple items by IDs
   */
  getByIds: async (
    itemIds: string[],
    options?: { include?: string }
  ): Promise<LibraryItem[]> => {
    const results = await Promise.all(
      itemIds.map((id) => apiClient.getItem(id, options?.include))
    );
    return results;
  },
};
