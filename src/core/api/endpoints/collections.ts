/**
 * src/core/api/endpoints/collections.ts
 *
 * Collections API endpoints
 */

import { apiClient } from '../apiClient';
import { Collection } from '@/core/types/library';

/**
 * Collection create/update data (uses book IDs, not full items)
 */
interface CollectionData {
  libraryId?: string;
  name?: string;
  description?: string;
  books?: string[];
}

/**
 * Collections API
 */
export const collectionsApi = {
  /**
   * Get all collections
   */
  getAll: async (): Promise<Collection[]> => {
    return apiClient.getCollections();
  },

  /**
   * Get a collection by ID
   */
  getById: async (collectionId: string): Promise<Collection> => {
    return apiClient.getCollection(collectionId);
  },

  /**
   * Create a new collection
   */
  create: async (data: {
    libraryId: string;
    name: string;
    description?: string;
    books?: string[];
  }): Promise<Collection> => {
    return apiClient.createCollection(data as Partial<Collection>);
  },

  /**
   * Update a collection
   */
  update: async (
    collectionId: string,
    data: CollectionData
  ): Promise<Collection> => {
    return apiClient.updateCollection(collectionId, data as Partial<Collection>);
  },

  /**
   * Delete a collection
   */
  delete: async (collectionId: string): Promise<void> => {
    return apiClient.deleteCollection(collectionId);
  },

  /**
   * Add an item to a collection
   */
  addItem: async (collectionId: string, itemId: string): Promise<Collection> => {
    const collection = await apiClient.getCollection(collectionId);
    const currentBookIds = collection.books?.map((b) => b.id) || [];

    if (currentBookIds.indexOf(itemId) === -1) {
      return apiClient.updateCollection(collectionId, {
        books: [...currentBookIds, itemId],
      } as Partial<Collection>);
    }

    return collection;
  },

  /**
   * Remove an item from a collection
   */
  removeItem: async (collectionId: string, itemId: string): Promise<Collection> => {
    const collection = await apiClient.getCollection(collectionId);
    const currentBookIds = collection.books?.map((b) => b.id) || [];

    return apiClient.updateCollection(collectionId, {
      books: currentBookIds.filter((id) => id !== itemId),
    } as Partial<Collection>);
  },
};
