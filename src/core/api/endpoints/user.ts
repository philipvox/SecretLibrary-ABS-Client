/**
 * src/core/api/endpoints/user.ts
 *
 * User-related API endpoints
 */

import { apiClient } from '../apiClient';
import { User } from '@/core/types/user';
import { LibraryItem } from '@/core/types/library';
import { MediaProgress } from '@/core/types/media';
import { ProgressUpdateRequest } from '@/core/types/api';

/**
 * User API
 */
export const userApi = {
  /**
   * Get current authenticated user
   */
  getCurrentUser: async (): Promise<User> => {
    return apiClient.getCurrentUser();
  },

  /**
   * Get items currently in progress
   */
  getItemsInProgress: async (): Promise<LibraryItem[]> => {
    return apiClient.getItemsInProgress();
  },

  /**
   * Get media progress for a specific item
   */
  getMediaProgress: async (progressId: string): Promise<MediaProgress> => {
    return apiClient.getMediaProgress(progressId);
  },

  /**
   * Update media progress
   */
  updateProgress: async (
    itemId: string,
    progressData: ProgressUpdateRequest
  ): Promise<MediaProgress> => {
    return apiClient.updateProgress(itemId, progressData);
  },

  /**
   * Mark media as finished
   */
  markAsFinished: async (itemId: string): Promise<MediaProgress> => {
    return apiClient.updateProgress(itemId, {
      isFinished: true,
      currentTime: 0,
    });
  },

  /**
   * Mark media as not started
   */
  markAsNotStarted: async (itemId: string): Promise<MediaProgress> => {
    return apiClient.updateProgress(itemId, {
      isFinished: false,
      currentTime: 0,
      progress: 0,
    });
  },

  /**
   * Hide item from continue listening
   */
  hideFromContinueListening: async (itemId: string): Promise<MediaProgress> => {
    return apiClient.updateProgress(itemId, {
      hideFromContinueListening: true,
      currentTime: 0,
    });
  },
};
