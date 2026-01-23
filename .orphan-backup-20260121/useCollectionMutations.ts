/**
 * src/features/user/hooks/useCollectionMutations.ts
 *
 * Collection mutation hooks with optimistic updates.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';
import { apiClient } from '@/core/api';
import { syncQueue } from '@/core/services/syncQueue';
import { Collection, LibraryItem } from '@/core/types';

/**
 * Create new collection
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      return apiClient.createCollection({ name });
    },

    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collections.all });

      const previousCollections = queryClient.getQueryData<Collection[]>(
        queryKeys.collections.all
      );

      // Optimistic add with temp ID
      const tempCollection: Collection = {
        id: `temp-${Date.now()}`,
        name,
        description: '',
        books: [],
        libraryId: '',
        userId: '',
        createdAt: Date.now(),
        lastUpdate: Date.now(),
      };

      queryClient.setQueryData<Collection[]>(queryKeys.collections.all, (old = []) => [
        ...old,
        tempCollection,
      ]);

      return { previousCollections, tempId: tempCollection.id };
    },

    onError: (_err, _name, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(queryKeys.collections.all, context.previousCollections);
      }
    },

    onSuccess: (newCollection, _name, context) => {
      // Replace temp collection with real one
      queryClient.setQueryData<Collection[]>(queryKeys.collections.all, (old = []) =>
        old.map((c) => (c.id === context?.tempId ? newCollection : c))
      );
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

/**
 * Add item to collection
 */
export function useAddToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionId,
      itemId,
    }: {
      collectionId: string;
      itemId: string;
    }) => {
      // Queue for offline sync
      await syncQueue.enqueue('add_to_collection', { collectionId, itemId });

      // Try API call
      const collection = await apiClient.getCollection(collectionId);
      const updatedBooks = [...(collection.books || []), { id: itemId }];
      return apiClient.updateCollection(collectionId, { books: updatedBooks as any });
    },

    onMutate: async ({ collectionId, itemId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collections.all });
      await queryClient.cancelQueries({
        queryKey: queryKeys.collections.detail(collectionId),
      });

      const previousCollections = queryClient.getQueryData<Collection[]>(
        queryKeys.collections.all
      );

      // Optimistic add to collection list
      queryClient.setQueryData<Collection[]>(queryKeys.collections.all, (old = []) =>
        old.map((collection) => {
          if (collection.id === collectionId) {
            return {
              ...collection,
              books: [...(collection.books || []), { id: itemId } as LibraryItem],
            };
          }
          return collection;
        })
      );

      return { previousCollections };
    },

    onError: (_err, { collectionId }, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(queryKeys.collections.all, context.previousCollections);
      }
    },

    onSettled: (_data, _error, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.collections.detail(collectionId),
      });
    },
  });
}

/**
 * Remove item from collection
 */
export function useRemoveFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionId,
      itemId,
    }: {
      collectionId: string;
      itemId: string;
    }) => {
      // Queue for offline sync
      await syncQueue.enqueue('remove_from_collection', { collectionId, itemId });

      // Try API call
      const collection = await apiClient.getCollection(collectionId);
      const updatedBooks = (collection.books || []).filter((b: any) => b.id !== itemId);
      return apiClient.updateCollection(collectionId, { books: updatedBooks as any });
    },

    onMutate: async ({ collectionId, itemId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collections.all });

      const previousCollections = queryClient.getQueryData<Collection[]>(
        queryKeys.collections.all
      );

      // Optimistic remove from collection
      queryClient.setQueryData<Collection[]>(queryKeys.collections.all, (old = []) =>
        old.map((collection) => {
          if (collection.id === collectionId) {
            return {
              ...collection,
              books: (collection.books || []).filter((b: any) => b.id !== itemId),
            };
          }
          return collection;
        })
      );

      return { previousCollections };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(queryKeys.collections.all, context.previousCollections);
      }
    },

    onSettled: (_data, _error, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.collections.detail(collectionId),
      });
    },
  });
}

/**
 * Delete collection
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (collectionId: string) => {
      return apiClient.deleteCollection(collectionId);
    },

    onMutate: async (collectionId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collections.all });

      const previousCollections = queryClient.getQueryData<Collection[]>(
        queryKeys.collections.all
      );

      // Optimistic remove
      queryClient.setQueryData<Collection[]>(queryKeys.collections.all, (old = []) =>
        old.filter((c) => c.id !== collectionId)
      );

      return { previousCollections };
    },

    onError: (_err, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(queryKeys.collections.all, context.previousCollections);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

/**
 * Update collection name/description
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionId,
      updates,
    }: {
      collectionId: string;
      updates: { name?: string; description?: string };
    }) => {
      return apiClient.updateCollection(collectionId, updates);
    },

    onMutate: async ({ collectionId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.collections.all });

      const previousCollections = queryClient.getQueryData<Collection[]>(
        queryKeys.collections.all
      );

      // Optimistic update
      queryClient.setQueryData<Collection[]>(queryKeys.collections.all, (old = []) =>
        old.map((c) => (c.id === collectionId ? { ...c, ...updates } : c))
      );

      return { previousCollections };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(queryKeys.collections.all, context.previousCollections);
      }
    },

    onSettled: (_data, _error, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.collections.detail(collectionId),
      });
    },
  });
}
