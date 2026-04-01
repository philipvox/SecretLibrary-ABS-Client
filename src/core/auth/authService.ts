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
 * SECURITY NOTE: On native platforms (iOS/Android), sensitive credentials
 * (auth tokens, server URL) are stored in expo-secure-store which uses
 * the OS keychain/keystore. On web or when SecureStore is unavailable,
 * we fall back to AsyncStorage which is NOT encrypted — this is a known
 * limitation of React Native. User preferences and non-secret Zustand
 * stores also use AsyncStorage (unencrypted) by design since they contain
 * no credentials.
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
   * Store authentication token securely (in SecureStore + AsyncStorage fallback)
   * Android KeyStore can fail to read on cold start, so we store in both locations.
   */
  async storeToken(token: string): Promise<void> {
    try {
      await Promise.all([
        storage.setSecureItem(TOKEN_KEY, token),
        storage.setItem(`${TOKEN_KEY}_fallback`, token),
      ]);
    } catch (error) {
      log.error('Failed to store token:', error);
      throw new Error('Failed to store authentication token');
    }
  }

  /**
   * Get stored authentication token (from SecureStore, with AsyncStorage fallback)
   * Android KeyStore can be slow/unreliable on cold start.
   */
  async getStoredToken(): Promise<string | null> {
    try {
      const token = await storage.getSecureItem(TOKEN_KEY);
      if (token) return token;

      // Fallback: try AsyncStorage if SecureStore failed
      log.warn('SecureStore returned null for token, trying AsyncStorage fallback');
      const fallback = await storage.getItem(`${TOKEN_KEY}_fallback`);
      if (fallback) {
        // Re-store in SecureStore for next time
        storage.setSecureItem(TOKEN_KEY, fallback).catch(() => {});
        return fallback;
      }
      return null;
    } catch (error) {
      log.error('Failed to get stored token:', error);
      // Last resort: try AsyncStorage fallback
      try {
        return await storage.getItem(`${TOKEN_KEY}_fallback`);
      } catch {
        return null;
      }
    }
  }

  /**
   * Store server URL (in SecureStore + AsyncStorage fallback)
   */
  async storeServerUrl(url: string): Promise<void> {
    try {
      await Promise.all([
        storage.setSecureItem(SERVER_URL_KEY, url),
        storage.setItem(`${SERVER_URL_KEY}_fallback`, url),
      ]);
    } catch (error) {
      log.error('Failed to store server URL:', error);
      throw new Error('Failed to store server URL');
    }
  }

  /**
   * Get stored server URL (from SecureStore, with AsyncStorage fallback)
   */
  async getStoredServerUrl(): Promise<string | null> {
    try {
      const url = await storage.getSecureItem(SERVER_URL_KEY);
      if (url) return url;

      log.warn('SecureStore returned null for server URL, trying AsyncStorage fallback');
      const fallback = await storage.getItem(`${SERVER_URL_KEY}_fallback`);
      if (fallback) {
        storage.setSecureItem(SERVER_URL_KEY, fallback).catch(() => {});
        return fallback;
      }
      return null;
    } catch (error) {
      log.error('Failed to get stored server URL:', error);
      try {
        return await storage.getItem(`${SERVER_URL_KEY}_fallback`);
      } catch {
        return null;
      }
    }
  }

  /**
   * Store user data (in AsyncStorage - can be large due to mediaProgress/bookmarks)
   */
  async storeUser(user: User): Promise<void> {
    try {
      // Strip token before persisting — token is stored separately in SecureStore
      const { token: _token, ...userWithoutToken } = user;
      await storage.setItem(USER_KEY, JSON.stringify(userWithoutToken));
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

      // 1. Clear secure storage (auth tokens) + AsyncStorage fallbacks
      await storage.deleteSecureItem(TOKEN_KEY);
      await storage.deleteSecureItem(SERVER_URL_KEY);
      await storage.deleteItem(`${TOKEN_KEY}_fallback`);
      await storage.deleteItem(`${SERVER_URL_KEY}_fallback`);

      // 2. Clear AsyncStorage items (user data)
      await storage.deleteItem(USER_KEY);

      // 3. Clear SQLite user data (all tables with user-specific data)
      // This deletes from ALL tables (library_items, authors, series, user_books, etc.)
      await sqliteCache.clearAllUserData();

      // 4. Clear React Query cache (in-memory server state)
      queryClient.clear();

      // 5. Reset Zustand stores (in-memory app state)
      // Pass skipSqlite=true since clearAllUserData already cleared the DB.
      // Calling clearCache() without this causes a nested transaction error
      // ("cannot start a transaction within a transaction").
      useLibraryCache.getState().clearCache(true);

      // 5b. Reset ALL user-specific Zustand stores to prevent data leaking
      // between accounts. Each require uses a static string (Metro requirement).
      // Individual try/catch so one failure doesn't block others.
      // Skip in test environment — native modules crash Jest workers.
      //
      // ────────────────────────────────────────────────────────────────────
      // STORE RESET REFERENCE — expected exports and property names
      //
      // When editing these lines, verify the export name and property names
      // against the actual store file. Three bugs were previously caused by
      // wrong property names in setState() calls.
      //
      // Store                              Export                          Method / Properties
      // ──────────────────────────────────  ──────────────────────────────  ────────────────────────────────────────────
      // playerStore                        usePlayerStore                  .cleanup()
      // sleepTimerStore                    useSleepTimerStore              .clearSleepTimer()
      // seekingStore                       useSeekingStore                 .resetSeekingState()
      // bookmarksStore                     useBookmarksStore               .clearBookmarks()
      // speedStore                         useSpeedStore                   { bookSpeedMap, playbackRate, globalDefaultRate }
      // completionStore                    useCompletionStore              { completedBooks }
      // completionSheetStore               useCompletionSheetStore         { showCompletionSheet, completionSheetBook }
      // myLibraryStore                     useMyLibraryStore               { libraryIds, favoriteSeriesNames }
      // progressStore                      useProgressStore                { progressMap, librarySet, version }
      // queueStore                         useQueueStore                   { queue, autoplayEnabled, autoSeriesBookId }
      // dismissedItemsStore                useDismissedItemsStore          .clearAllDismissals()
      // starPositionStore                  useStarPositionStore            { positions }
      // librarySyncStore                   useLibrarySyncStore             .reset()
      // syncStatusStore                    useSyncStatusStore              { pendingCount, lastSyncedAt, isSyncing, lastError }
      // recommendationsCacheStore          useRecommendationsCacheStore    .invalidateCache()
      // spineCache                         useSpineCacheStore              { serverSpineDimensions, accentColors, cachedManifestBookIds }
      // preferencesStore                   usePreferencesStore             .resetPreferences()
      // contentFilterStore                 useContentFilterStore           .reset()
      // playlistSettingsStore              usePlaylistSettingsStore        { visiblePlaylistIds, playlistOrder }
      // castStore                          useCastStore                    .cleanup() + { isConnected, deviceName, sessionId, position, duration, isPlaying }
      // ────────────────────────────────────────────────────────────────────
      if (process.env.NODE_ENV !== 'test') {
        try { require('@/features/player/stores/playerStore').usePlayerStore.getState().cleanup?.(); } catch (e) { log.debug('[Auth] Reset playerStore failed', e); }
        try { require('@/features/player/stores/sleepTimerStore').useSleepTimerStore.getState().clearSleepTimer?.(); } catch (e) { log.debug('[Auth] Reset sleepTimerStore failed', e); }
        try { require('@/features/player/stores/seekingStore').useSeekingStore.getState().resetSeekingState?.(); } catch (e) { log.debug('[Auth] Reset seekingStore failed', e); }
        try { require('@/features/player/stores/bookmarksStore').useBookmarksStore.getState().clearBookmarks?.(); } catch (e) { log.debug('[Auth] Reset bookmarksStore failed', e); }
        try { require('@/features/player/stores/speedStore').useSpeedStore.setState({ bookSpeedMap: {}, playbackRate: 1, globalDefaultRate: 1 }); } catch (e) { log.debug('[Auth] Reset speedStore failed', e); }
        try { require('@/features/completion/stores/completionStore').useCompletionStore.setState({ completedBooks: new Map() }); } catch (e) { log.debug('[Auth] Reset completionStore failed', e); }
        try { require('@/features/player/stores/completionSheetStore').useCompletionSheetStore.setState({ showCompletionSheet: false, completionSheetBook: null }); } catch (e) { log.debug('[Auth] Reset completionSheetStore failed', e); }
        try { require('@/shared/stores/myLibraryStore').useMyLibraryStore.setState({ libraryIds: [], favoriteSeriesNames: [] }); } catch (e) { log.debug('[Auth] Reset myLibraryStore failed', e); }
        try { require('@/core/stores/progressStore').useProgressStore.setState({ progressMap: new Map(), librarySet: new Set(), version: 0 }); } catch (e) { log.debug('[Auth] Reset progressStore failed', e); }
        try { require('@/features/queue/stores/queueStore').useQueueStore.setState({ queue: [], autoplayEnabled: true, autoSeriesBookId: null }); } catch (e) { log.debug('[Auth] Reset queueStore failed', e); }
        try { require('@/features/recommendations/stores/dismissedItemsStore').useDismissedItemsStore.getState().clearAllDismissals?.(); } catch (e) { log.debug('[Auth] Reset dismissedItemsStore failed', e); }
        try { require('@/features/book-detail/stores/starPositionStore').useStarPositionStore.setState({ positions: {} }); } catch (e) { log.debug('[Auth] Reset starPositionStore failed', e); }
        try { require('@/shared/stores/librarySyncStore').useLibrarySyncStore.getState().reset?.(); } catch (e) { log.debug('[Auth] Reset librarySyncStore failed', e); }
        try { require('@/core/stores/syncStatusStore').useSyncStatusStore.setState({ pendingCount: 0, lastSyncedAt: null, isSyncing: false, lastError: null }); } catch (e) { log.debug('[Auth] Reset syncStatusStore failed', e); }
        try { require('@/features/recommendations/stores/recommendationsCacheStore').useRecommendationsCacheStore.getState().invalidateCache?.(); } catch (e) { log.debug('[Auth] Reset recommendationsCacheStore failed', e); }
        try { require('@/features/home/stores/spineCache').useSpineCacheStore.setState({ serverSpineDimensions: {}, accentColors: {}, cachedManifestBookIds: [] }); } catch (e) { log.debug('[Auth] Reset spineCacheStore failed', e); }
        try { require('@/features/recommendations/stores/preferencesStore').usePreferencesStore.getState().resetPreferences?.(); } catch (e) { log.debug('[Auth] Reset preferencesStore failed', e); }
        try { require('@/features/browse/stores/contentFilterStore').useContentFilterStore.getState().reset?.(); } catch (e) { log.debug('[Auth] Reset contentFilterStore failed', e); }
        try { require('@/features/playlists/stores/playlistSettingsStore').usePlaylistSettingsStore.setState({ visiblePlaylistIds: [], playlistOrder: [] }); } catch (e) { log.debug('[Auth] Reset playlistSettingsStore failed', e); }
        try {
          const castStore = require('@/features/chromecast/stores/castStore').useCastStore;
          castStore.getState().cleanup?.();
          castStore.setState({ isConnected: false, deviceName: null, sessionId: null, position: 0, duration: 0, isPlaying: false });
        } catch (e) { log.debug('[Auth] Reset castStore failed', e); }
        log.info('All Zustand stores reset');
      }

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
      // Note: apiClient.login() internally calls setAuthToken() on success
      const response = await apiClient.login(username, password);

      if (!response.user) {
        throw new Error('Invalid response from server');
      }

      const user = response.user;

      // Clear the token that apiClient.login() set prematurely.
      // We must persist credentials to storage BEFORE setting the in-memory
      // token, so that a storage failure doesn't leave the user appearing
      // logged in for this session but with no persisted session for restart.
      apiClient.clearAuthToken();

      // Persist all credentials to storage first
      try {
        await this.storeToken(user.token);
        await this.storeServerUrl(serverUrl);
        await this.storeUser(user);
      } catch (storageError) {
        // Storage failed — clean up any partially-stored data
        log.error('Failed to persist credentials, cleaning up:', storageError);
        try {
          await storage.deleteSecureItem(TOKEN_KEY);
          await storage.deleteSecureItem(SERVER_URL_KEY);
          await storage.deleteItem(`${TOKEN_KEY}_fallback`);
          await storage.deleteItem(`${SERVER_URL_KEY}_fallback`);
          await storage.deleteItem(USER_KEY);
        } catch (cleanupError) {
          log.error('Cleanup after storage failure also failed:', cleanupError);
        }
        throw new Error('Failed to save login credentials. Please try again.');
      }

      // Storage succeeded — now set the in-memory auth token
      apiClient.setAuthToken(user.token);

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
   * Login with a pre-obtained token (e.g. from OAuth/SSO callback).
   * Configures apiClient, fetches user data via GET /api/me, stores session.
   */
  async loginWithToken(serverUrl: string, token: string): Promise<User> {
    try {
      // Configure API client with server URL and token so we can verify the token
      apiClient.configure({ baseURL: serverUrl, token });

      // Fetch user data to verify token and get full user object
      const user = await apiClient.getCurrentUser();

      if (!user) {
        throw new Error('Invalid response from server');
      }

      // Attach token to user object (same shape as login response)
      const userWithToken: User = { ...user, token };

      // Clear the token before persisting. We must store credentials to disk
      // BEFORE setting the in-memory token, so that a storage failure doesn't
      // leave the user appearing logged in with no persisted session.
      apiClient.clearAuthToken();

      // Persist all credentials to storage first
      try {
        await this.storeToken(token);
        await this.storeServerUrl(serverUrl);
        await this.storeUser(userWithToken);
      } catch (storageError) {
        // Storage failed — clean up any partially-stored data
        log.error('Failed to persist credentials, cleaning up:', storageError);
        try {
          await storage.deleteSecureItem(TOKEN_KEY);
          await storage.deleteSecureItem(SERVER_URL_KEY);
          await storage.deleteItem(`${TOKEN_KEY}_fallback`);
          await storage.deleteItem(`${SERVER_URL_KEY}_fallback`);
          await storage.deleteItem(USER_KEY);
        } catch (cleanupError) {
          log.error('Cleanup after storage failure also failed:', cleanupError);
        }
        throw new Error('Failed to save login credentials. Please try again.');
      }

      // Storage succeeded — now set the in-memory auth token
      apiClient.setAuthToken(token);

      return userWithToken;
    } catch (error) {
      log.error('Token login failed:', error);

      const errorMessage = getErrorMessage(error).toLowerCase();

      if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        throw new Error('SSO token is invalid or expired. Please try again.');
      }

      if (errorMessage.includes('network error') || errorMessage.includes('timeout')) {
        throw new Error('Cannot connect to server. Check your connection.');
      }

      throw new Error(getErrorMessage(error) || 'SSO login failed. Please try again.');
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
          token: token,
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
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 200;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        log.debug(`Restoring session (attempt ${attempt}/${MAX_RETRIES})...`);

        // Use fallback-aware getters that try SecureStore first, then AsyncStorage.
        // CRITICAL FIX: Previously used storage.getSecureItem() directly, which meant
        // Android KeyStore cold-start failures returned null for token/serverUrl,
        // causing "partial data" detection → 3 retries (all hitting SecureStore) → wipe.
        // Now getStoredToken()/getStoredServerUrl() automatically fall back to AsyncStorage.
        const [token, serverUrl, user] = await Promise.all([
          this.getStoredToken(),
          this.getStoredServerUrl(),
          this.getStoredUser(),
        ]);

        log.debug('Storage read complete:', {
          hasToken: !!token,
          hasServerUrl: !!serverUrl,
          hasUser: !!user,
        });

        if (token && serverUrl && user) {
          // Configure API client with stored credentials
          apiClient.configure({
            baseURL: serverUrl,
            token: token,
          });

          log.info(`Session restored for user: ${user.username}`);
          return { user, serverUrl };
        }

        // Values missing - this is not a failure, user may not be logged in
        if (!token && !serverUrl && !user) {
          log.debug('No stored session found (user not logged in)');
          return { user: null, serverUrl: null };
        }

        // Partial values - retry with delay (Android KeyStore can be slow)
        log.warn(`Partial session data (attempt ${attempt}/${MAX_RETRIES}):`, {
          hasToken: !!token,
          hasServerUrl: !!serverUrl,
          hasUser: !!user,
        });

        if (attempt >= MAX_RETRIES) {
          // All retries exhausted with partial data.
          // DO NOT clear storage — the data may still be valid but one reader
          // is intermittently failing. Clearing would make the problem permanent.
          // Instead, return null and let the user log in again. Their stored
          // credentials will survive for the next startup attempt.
          log.error('Partial session data persists after retries — returning null (storage preserved)');
          return { user: null, serverUrl: null };
        }

        // Wait before retry (gives Android KeyStore time to initialize)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
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
    } catch (error: any) {
      // Only treat explicit 401 as invalid token.
      // Network errors, timeouts, 5xx etc. should NOT invalidate —
      // the token may still be valid, we just can't reach the server.
      const status = error?.response?.status;
      if (status === 401) {
        log.error('Token verification failed: 401 Unauthorized');
        return false;
      }

      log.warn('Token verification inconclusive (network/server error), assuming valid:', error?.message || error);
      return true;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();