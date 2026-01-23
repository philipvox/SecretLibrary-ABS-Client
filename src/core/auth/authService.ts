/**
 * src/core/auth/authService.ts
 *
 * Authentication service with cross-platform storage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// Import directly to avoid circular dependency with ../api
import { apiClient } from '../api/apiClient';
import { User } from '../types/user';
import { authLogger as log } from '@/shared/utils/logger';
import { getErrorMessage } from '@/shared/utils/errorUtils';
import { sqliteCache } from '../services/sqliteCache';
import { queryClient } from '../queryClient';
import { useLibraryCache } from '../cache/libraryCache';

// Storage keys
const TOKEN_KEY = 'auth_token';
const SERVER_URL_KEY = 'server_url';
const USER_KEY = 'user_data';

/**
 * Cross-platform secure storage wrapper
 *
 * IMPORTANT: SecureStore has a 2048 byte limit on iOS.
 * Only store sensitive credentials (tokens) in SecureStore.
 * User data with large arrays should use AsyncStorage.
 */
class Storage {
  /**
   * Check if we can use SecureStore (native only)
   */
  private canUseSecureStore(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Save value to SecureStore (for sensitive data like tokens)
   * Note: Has 2048 byte limit on iOS
   */
  async setSecureItem(key: string, value: string): Promise<void> {
    if (this.canUseSecureStore()) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  }

  /**
   * Get value from SecureStore
   */
  async getSecureItem(key: string): Promise<string | null> {
    if (this.canUseSecureStore()) {
      return await SecureStore.getItemAsync(key);
    } else {
      return await AsyncStorage.getItem(key);
    }
  }

  /**
   * Delete value from SecureStore
   */
  async deleteSecureItem(key: string): Promise<void> {
    if (this.canUseSecureStore()) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  /**
   * Save value to AsyncStorage (for larger, non-sensitive data)
   */
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  /**
   * Get value from AsyncStorage
   */
  async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  /**
   * Delete value from AsyncStorage
   */
  async deleteItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}

const storage = new Storage();

// Re-export User type for backward compatibility
export { User };

/**
 * Authentication service
 */
class AuthService {
  /**
   * Store authentication token securely (in SecureStore)
   */
  async storeToken(token: string): Promise<void> {
    try {
      await storage.setSecureItem(TOKEN_KEY, token);
    } catch (error) {
      log.error('Failed to store token:', error);
      throw new Error('Failed to store authentication token');
    }
  }

  /**
   * Get stored authentication token (from SecureStore)
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await storage.getSecureItem(TOKEN_KEY);
    } catch (error) {
      log.error('Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Store server URL (in SecureStore - small and somewhat sensitive)
   */
  async storeServerUrl(url: string): Promise<void> {
    try {
      await storage.setSecureItem(SERVER_URL_KEY, url);
    } catch (error) {
      log.error('Failed to store server URL:', error);
      throw new Error('Failed to store server URL');
    }
  }

  /**
   * Get stored server URL (from SecureStore)
   */
  async getStoredServerUrl(): Promise<string | null> {
    try {
      return await storage.getSecureItem(SERVER_URL_KEY);
    } catch (error) {
      log.error('Failed to get stored server URL:', error);
      return null;
    }
  }

  /**
   * Store user data (in AsyncStorage - can be large due to mediaProgress/bookmarks)
   */
  async storeUser(user: User): Promise<void> {
    try {
      await storage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      log.error('Failed to store user:', error);
      throw new Error('Failed to store user data');
    }
  }

  /**
   * Get stored user data (from AsyncStorage)
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userJson = await storage.getItem(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      log.error('Failed to get stored user:', error);
      return null;
    }
  }

  /**
   * Clear all stored authentication and user data (P0 Critical - Privacy)
   *
   * This method clears ALL user data on logout to prevent the next user
   * from seeing the previous user's library, progress, history, etc.
   */
  async clearStorage(): Promise<void> {
    try {
      log.info('Clearing all user data on logout...');

      // 1. Clear secure storage (auth tokens)
      await storage.deleteSecureItem(TOKEN_KEY);
      await storage.deleteSecureItem(SERVER_URL_KEY);

      // 2. Clear AsyncStorage items (user data)
      await storage.deleteItem(USER_KEY);

      // 3. Clear SQLite user data (all tables with user-specific data)
      await sqliteCache.clearAllUserData();

      // 4. Clear React Query cache (in-memory server state)
      queryClient.clear();

      // 5. Reset Zustand stores (in-memory app state)
      useLibraryCache.getState().clearCache();

      // 6. Reset network optimizer cache (prevents stale API responses/covers)
      apiClient.resetNetwork();

      // 7. Reset cover cache version (prevents old cover URLs being reused)
      apiClient.resetCoverCacheVersion();

      log.info('All user data cleared successfully');
    } catch (error) {
      log.error('Failed to clear storage:', error);
      // Don't throw - best effort cleanup, user should still be logged out
    }
  }

  /**
   * Login with username and password
   */
  async login(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<User> {
    try {
      // Configure API client with server URL
      apiClient.configure({ baseURL: serverUrl });

      // Make login request using the API client's login method
      const response = await apiClient.login(username, password);

      if (!response.user) {
        throw new Error('Invalid response from server');
      }

      const user = response.user;

      // Store credentials
      await this.storeToken(user.token);
      await this.storeServerUrl(serverUrl);
      await this.storeUser(user);

      return user;
    } catch (error) {
      log.error('Login failed:', error);

      // Provide user-friendly error messages based on the error type
      const errorMessage = getErrorMessage(error).toLowerCase();

      // Check for authentication failures (401)
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        throw new Error('Invalid username or password');
      }

      // Check for forbidden (403) - account locked/disabled
      if (errorMessage.includes('forbidden') || errorMessage.includes('403')) {
        throw new Error('Account is locked or disabled');
      }

      // Check for network errors
      if (errorMessage.includes('network error') || errorMessage.includes('timeout')) {
        throw new Error('Cannot connect to server. Check your connection and server URL.');
      }

      // Check for server not found / connection refused
      if (errorMessage.includes('econnrefused') || errorMessage.includes('not found')) {
        throw new Error('Server not found. Please verify the server URL.');
      }

      // Check for invalid server response
      if (errorMessage.includes('invalid response')) {
        throw new Error('Invalid server response. Is this an AudiobookShelf server?');
      }

      // Generic fallback with original message
      throw new Error(getErrorMessage(error) || 'Login failed. Please try again.');
    }
  }

  /**
   * Restore session from stored credentials
   * Token and server URL are in SecureStore, user data is in AsyncStorage.
   */
  async restoreSession(): Promise<{
    user: User | null;
    serverUrl: string | null;
  }> {
    try {
      // Use the individual getter methods which use correct storage types
      const token = await this.getStoredToken();
      const serverUrl = await this.getStoredServerUrl();
      const user = await this.getStoredUser();

      if (token && serverUrl && user) {
        // Configure API client with stored credentials
        apiClient.configure({
          baseURL: serverUrl,
          token: token
        });

        return { user, serverUrl };
      }

      return { user: null, serverUrl: null };
    } catch (error) {
      log.error('Failed to restore session:', error);
      return { user: null, serverUrl: null };
    }
  }

  /**
   * Optimized session restore - reads all storage keys in parallel.
   * Reduces latency from ~150ms (3 sequential reads) to ~50ms (1 parallel read).
   * Includes retry logic for SecureStore reliability on Android.
   *
   * Token and server URL are in SecureStore, user data is in AsyncStorage.
   */
  async restoreSessionOptimized(): Promise<{
    user: User | null;
    serverUrl: string | null;
  }> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 100;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        log.debug(`Restoring session (attempt ${attempt}/${MAX_RETRIES})...`);

        // Read all three values in parallel (token/serverUrl from SecureStore, user from AsyncStorage)
        const [token, serverUrl, userJson] = await Promise.all([
          storage.getSecureItem(TOKEN_KEY),
          storage.getSecureItem(SERVER_URL_KEY),
          storage.getItem(USER_KEY),
        ]);

        log.debug('Storage read complete:', {
          hasToken: !!token,
          hasServerUrl: !!serverUrl,
          hasUserJson: !!userJson,
        });

        if (token && serverUrl && userJson) {
          const user = JSON.parse(userJson) as User;

          // Configure API client with stored credentials
          apiClient.configure({
            baseURL: serverUrl,
            token: token,
          });

          log.info(`Session restored for user: ${user.username}`);
          return { user, serverUrl };
        }

        // Values missing - this is not a failure, user may not be logged in
        if (!token && !serverUrl && !userJson) {
          log.debug('No stored session found (user not logged in)');
          return { user: null, serverUrl: null };
        }

        // Partial values - something might be corrupted
        log.warn('Partial session data found, clearing:', {
          hasToken: !!token,
          hasServerUrl: !!serverUrl,
          hasUserJson: !!userJson,
        });

        // Clear corrupted data and return null
        await this.clearStorage();
        return { user: null, serverUrl: null };
      } catch (error) {
        log.error(`Session restore attempt ${attempt} failed:`, getErrorMessage(error));

        if (attempt < MAX_RETRIES) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        } else {
          log.error('All session restore attempts failed');
          return { user: null, serverUrl: null };
        }
      }
    }

    return { user: null, serverUrl: null };
  }

  /**
   * Logout and clear stored credentials
   */
  async logout(): Promise<void> {
    try {
      // Try to notify server (best effort)
      try {
        await apiClient.logout();
      } catch (err) {
        log.warn('Failed to notify server of logout:', err);
      }

      // Clear API client token
      apiClient.clearAuthToken();

      // Clear stored data
      await this.clearStorage();
    } catch (error) {
      log.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Verify if current token is still valid
   */
  async verifyToken(): Promise<boolean> {
    try {
      const token = await this.getStoredToken();
      if (!token) {
        return false;
      }

      // Try to fetch current user as token verification
      await apiClient.getCurrentUser();
      return true;
    } catch (error) {
      log.error('Token verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();