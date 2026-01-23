/**
 * src/core/auth/__tests__/authService.test.ts
 *
 * Unit tests for the authentication service.
 * Tests storage operations and session management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../authService';

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock SQLite cache
jest.mock('../../services/sqliteCache', () => ({
  sqliteCache: {
    clearAllUserData: jest.fn(),
  },
}));

// Mock query client
jest.mock('../../queryClient', () => ({
  queryClient: {
    clear: jest.fn(),
  },
}));

// Mock library cache
jest.mock('../../cache/libraryCache', () => ({
  useLibraryCache: {
    getState: jest.fn(() => ({
      clearCache: jest.fn(),
    })),
  },
}));

// Mock API client
jest.mock('../../api/apiClient', () => ({
  apiClient: {
    configure: jest.fn(),
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    login: jest.fn(),
  },
}));

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  describe('token storage', () => {
    it('should store token in SecureStore', async () => {
      await authService.storeToken('test-token-123');

      const SecureStore = require('expo-secure-store');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'test-token-123');
    });

    it('should retrieve token from SecureStore', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValueOnce('stored-token');

      const token = await authService.getStoredToken();
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_token');
      expect(token).toBe('stored-token');
    });

    it('should return null when no token stored', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const token = await authService.getStoredToken();
      expect(token).toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const token = await authService.getStoredToken();
      expect(token).toBeNull();
    });
  });

  describe('server URL storage', () => {
    it('should store server URL in SecureStore', async () => {
      await authService.storeServerUrl('https://abs.example.com');

      const SecureStore = require('expo-secure-store');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('server_url', 'https://abs.example.com');
    });

    it('should retrieve stored server URL', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValueOnce('https://abs.example.com');

      const url = await authService.getStoredServerUrl();
      expect(url).toBe('https://abs.example.com');
    });

    it('should return null when no server URL stored', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const url = await authService.getStoredServerUrl();
      expect(url).toBeNull();
    });
  });

  describe('user storage', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      type: 'user' as const,
      token: 'test-token',
      mediaProgress: [],
      seriesHideFromContinueListening: [],
      bookmarks: [],
      isActive: true,
      isLocked: false,
      createdAt: Date.now(),
    };

    it('should store user data in AsyncStorage', async () => {
      await authService.storeUser(mockUser);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'user_data',
        expect.stringContaining('user-123')
      );
    });

    it('should retrieve stored user from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockUser));

      const user = await authService.getStoredUser();
      expect(user?.id).toBe('user-123');
      expect(user?.username).toBe('testuser');
    });

    it('should return null when no user stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const user = await authService.getStoredUser();
      expect(user).toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid json');

      const user = await authService.getStoredUser();
      expect(user).toBeNull();
    });
  });

  describe('session restoration', () => {
    it('should return object with null values when no stored data', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const session = await authService.restoreSession();
      expect(session).toEqual({ serverUrl: null, user: null });
    });
  });

  describe('clearStorage', () => {
    it('should clear secure storage on logout', async () => {
      const SecureStore = require('expo-secure-store');

      await authService.clearStorage();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('server_url');
    });

    it('should clear AsyncStorage on logout', async () => {
      await authService.clearStorage();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user_data');
    });

    it('should clear SQLite cache on logout', async () => {
      const { sqliteCache } = require('../../services/sqliteCache');

      await authService.clearStorage();

      expect(sqliteCache.clearAllUserData).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return false when no token stored', async () => {
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(null);

      const isValid = await authService.verifyToken();
      expect(isValid).toBe(false);
    });
  });
});
