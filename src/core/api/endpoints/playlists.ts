/**
 * src/core/api/endpoints/playlists.ts
 *
 * Playlists API endpoints
 */

import { apiClient } from '../apiClient';
import { Playlist } from '@/core/types/library';

/**
 * Playlists API
 */
export const playlistsApi = {
  /**
   * Get all playlists
   */
  getAll: async (): Promise<Playlist[]> => {
    return apiClient.getPlaylists();
  },

  /**
   * Get a playlist by ID
   */
  getById: async (playlistId: string): Promise<Playlist> => {
    return apiClient.getPlaylist(playlistId);
  },

  /**
   * Create a new playlist
   */
  create: async (data: {
    libraryId: string;
    name: string;
    description?: string;
    items?: Array<{
      libraryItemId: string;
      episodeId?: string;
    }>;
  }): Promise<Playlist> => {
    return apiClient.createPlaylist(data);
  },

  /**
   * Update a playlist
   */
  update: async (
    playlistId: string,
    data: Partial<{
      name: string;
      description: string;
      items: Array<{
        libraryItemId: string;
        episodeId?: string;
      }>;
    }>
  ): Promise<Playlist> => {
    return apiClient.updatePlaylist(playlistId, data);
  },

  /**
   * Delete a playlist
   */
  delete: async (playlistId: string): Promise<void> => {
    return apiClient.deletePlaylist(playlistId);
  },
};
