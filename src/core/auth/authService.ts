/**
 * src/core/auth/authService.ts
 * 
 * Authentication service handling login, logout, and secure credential storage.
 * Uses Expo SecureStore for encrypted token storage on device.
 */

import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../api';
import { User } from '../types';

// SecureStore keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  SERVER_URL: 'server_url',
  USER_DATA: 'user_data',
} as const;

/**
 * Authentication service for managing user sessions
 */
class AuthService {
  /**
   * Login with username and password
   * Configures API client and stores credentials on success
   */
  async login(serverUrl: string, username: string, password: string): Promise<User> {
    try {
      // Validate server URL format
      const validatedUrl = this.validateServerUrl(serverUrl);

      // Configure API client with server URL
      apiClient.configure({ baseURL: validatedUrl });

      // Attempt login
      const response = await apiClient.login(username, password);

      // Store credentials securely
      await this.storeCredentials(response.user.token, validatedUrl, response.user);

      return response.user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout and clear all stored credentials
   */
  async logout(): Promise<void> {
    try {
      // Attempt to notify server (best effort, don't fail if it errors)
      try {
        await apiClient.logout();
      } catch (error) {
        console.warn('Server logout failed, continuing with local logout:', error);
      }

      // Clear stored credentials
      await this.clearCredentials();

      // Clear API client token
      apiClient.clearAuthToken();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Get stored authentication token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Get stored server URL
   */
  async getStoredServerUrl(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL);
    } catch (error) {
      console.error('Failed to get stored server URL:', error);
      return null;
    }
  }

  /**
   * Get stored user data
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get stored user:', error);
      return null;
    }
  }

  /**
   * Store credentials securely
   */
  async storeCredentials(token: string, serverUrl: string, user: User): Promise<void> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, serverUrl),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user)),
      ]);
    } catch (error) {
      console.error('Failed to store credentials:', error);
      throw new Error('Failed to save login credentials');
    }
  }

  /**
   * Clear all stored credentials
   */
  async clearCredentials(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_URL),
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA),
      ]);
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      // Don't throw - clearing is best effort
    }
  }

  /**
   * Restore session from stored credentials
   * Returns user data and server URL if valid session exists
   */
  async restoreSession(): Promise<{ user: User; serverUrl: string } | null> {
    try {
      const [token, serverUrl, userData] = await Promise.all([
        this.getStoredToken(),
        this.getStoredServerUrl(),
        this.getStoredUser(),
      ]);

      // All credentials must exist for valid session
      if (!token || !serverUrl || !userData) {
        return null;
      }

      // Configure API client with stored credentials
      apiClient.configure({ baseURL: serverUrl, token });

      // Verify token is still valid by fetching current user
      try {
        const currentUser = await apiClient.getCurrentUser();
        // Update stored user data with fresh data
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
        return { user: currentUser, serverUrl };
      } catch (error) {
        // Token is invalid or expired, clear credentials
        console.warn('Stored token is invalid, clearing session:', error);
        await this.clearCredentials();
        return null;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      return null;
    }
  }

  /**
   * Validate and normalize server URL
   * Ensures URL has proper format: http://server:port or https://server:port
   */
  private validateServerUrl(url: string): string {
    // Remove trailing slash
    let normalized = url.trim().replace(/\/$/, '');

    // Add protocol if missing
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `http://${normalized}`;
    }

    // Validate URL format
    try {
      const urlObj = new URL(normalized);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
      return normalized;
    } catch (error) {
      throw new Error('Invalid server URL format. Use: http://server:port or https://server:port');
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
