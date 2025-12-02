/**
 * src/core/api/endpoints/auth.ts
 *
 * Authentication API endpoints
 */

import { apiClient } from '../apiClient';
import { LoginResponse } from '@/core/types/api';

/**
 * Authentication API
 */
export const authApi = {
  /**
   * Login with username and password
   */
  login: async (username: string, password: string): Promise<LoginResponse> => {
    return apiClient.login(username, password);
  },

  /**
   * Logout current user
   */
  logout: async (): Promise<void> => {
    return apiClient.logout();
  },

  /**
   * Check if server is reachable and authenticated
   */
  ping: async (): Promise<boolean> => {
    try {
      await apiClient.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  },
};
