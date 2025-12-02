/**
 * src/core/api/endpoints/series.ts
 *
 * Series API endpoints
 */

import { apiClient } from '../apiClient';
import { Series } from '@/core/types/metadata';

/**
 * Series API
 */
export const seriesApi = {
  /**
   * Get a series by ID
   */
  getById: async (seriesId: string): Promise<Series> => {
    return apiClient.getSeries(seriesId);
  },

  /**
   * Get all series for a library
   */
  getForLibrary: async (libraryId: string): Promise<Series[]> => {
    return apiClient.getLibrarySeries(libraryId);
  },
};
