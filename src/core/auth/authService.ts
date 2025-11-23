/**
 * src/core/auth/authService.ts
 * 
 * Authentication service with cross-platform storage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiClient } from '../api';

// Storage keys
const TOKEN_KEY = 'auth_token';
const SERVER_URL_KEY = 'server_url';
const USER_KEY = 'user_data';

/**
 * Cross-platform secure storage wrapper
 */
class Storage {
  /**
   * Check if we can use SecureStore (native only)
   */
  private canUseSecureStore(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Save value
   */
  async setItem(key: string, value: string): Promise<void> {
    if (this.canUseSecureStore()) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  }

  /**
   * Get value
   */
  async getItem(key: string): Promise<string | null> {
    if (this.canUseSecureStore()) {
      return await SecureStore.getItemAsync(key);
    } else {
      return await AsyncStorage.getItem(key);
    }
  }

  /**
   * Delete value
   */
  async deleteItem(key: string): Promise<void> {
    if (this.canUseSecureStore()) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  }
}

const storage = new Storage();

/**
 * User interface
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  type: string;
  token: string;
  mediaProgress?: any[];
  seriesHideFromContinueListening?: string[];
  bookmarks?: any[];
  isActive: boolean;
  isLocked: boolean;
  lastSeen?: number;
  createdAt: number;
  permissions: {
    download: boolean;
    update: boolean;
    delete: boolean;
    upload: boolean;
    accessAllLibraries: boolean;
    accessAllTags: boolean;
    accessExplicitContent: boolean;
  };
  librariesAccessible: string[];
  itemTagsAccessible: string[];
}

/**
 * Authentication service
 */
class AuthService {
  /**
   * Store authentication token securely
   */
  async storeToken(token: string): Promise<void> {
    try {
      await storage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Failed to store token:', error);
      throw new Error('Failed to store authentication token');
    }
  }

  /**
   * Get stored authentication token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await storage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Store server URL
   */
  async storeServerUrl(url: string): Promise<void> {
    try {
      await storage.setItem(SERVER_URL_KEY, url);
    } catch (error) {
      console.error('Failed to store server URL:', error);
      throw new Error('Failed to store server URL');
    }
  }

  /**
   * Get stored server URL
   */
  async getStoredServerUrl(): Promise<string | null> {
    try {
      return await storage.getItem(SERVER_URL_KEY);
    } catch (error) {
      console.error('Failed to get stored server URL:', error);
      return null;
    }
  }

  /**
   * Store user data
   */
  async storeUser(user: User): Promise<void> {
    try {
      await storage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to store user:', error);
      throw new Error('Failed to store user data');
    }
  }

  /**
   * Get stored user data
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userJson = await storage.getItem(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Failed to get stored user:', error);
      return null;
    }
  }

  /**
   * Clear all stored authentication data
   */
  async clearStorage(): Promise<void> {
    try {
      await storage.deleteItem(TOKEN_KEY);
      await storage.deleteItem(SERVER_URL_KEY);
      await storage.deleteItem(USER_KEY);
    } catch (error) {
      console.error('Failed to clear storage:', error);
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
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Restore session from stored credentials
   */
  async restoreSession(): Promise<{
    user: User | null;
    serverUrl: string | null;
  }> {
    try {
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
      console.error('Failed to restore session:', error);
      return { user: null, serverUrl: null };
    }
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
        console.warn('Failed to notify server of logout:', err);
      }

      // Clear API client token
      apiClient.clearAuthToken();

      // Clear stored data
      await this.clearStorage();
    } catch (error) {
      console.error('Logout failed:', error);
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
      console.error('Token verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();