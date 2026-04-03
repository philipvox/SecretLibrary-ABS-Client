/**
 * src/core/auth/authContext.tsx
 * 
 * React context for managing authentication state across the app.
 * Provides useAuth hook for accessing auth state and operations.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';
import { apiClient } from '../api/apiClient';
import { User } from '../types';
import { prefetchMainTabData } from '../queryClient';
import { appInitializer } from '../services/appInitializer';
import { authLogger as log } from '@/shared/utils/logger';
import { serverVersionService, VersionCheckResult } from '../services/serverVersionService';
import { tokenHealthService } from '../services/tokenHealthService';
import { setUser as setSentryUser } from '../monitoring/sentry';

// Same keys used by LoginScreen — persisted across logout so the form pre-fills
const SAVED_SERVER_URL_KEY = 'login_saved_server_url';
const SAVED_USERNAME_KEY = 'login_saved_username';

/**
 * Authentication context state and operations
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  serverUrl: string | null;
  error: string | null;
  versionCheck: VersionCheckResult | null;  // Server version compatibility
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  loginWithToken: (serverUrl: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  dismissVersionWarning: () => void;  // Dismiss version mismatch warning
}

/**
 * Initial session data (from AppInitializer)
 */
interface InitialSession {
  user: User | null;
  serverUrl: string | null;
}

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: ReactNode;
  initialSession?: InitialSession;
}

// Create context with undefined default (will be set by provider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider component
 * Wraps the app and provides auth state to all children
 */
export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  // If initialSession provided, use it directly (skip redundant restore)
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [serverUrl, setServerUrl] = useState<string | null>(initialSession?.serverUrl ?? null);
  // Not loading if we have initial session (AppInitializer already did the work)
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [error, setError] = useState<string | null>(null);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);
  const [versionWarningDismissed, setVersionWarningDismissed] = useState(false);

  /**
   * Attempt to restore session on mount (only if no initial session provided)
   */
  useEffect(() => {
    if (!initialSession) {
      restoreSession();
    }
  }, [initialSession]);

  /**
   * Handle auth failure from API client (401 after re-auth attempt failed)
   *
   * CRITICAL: Only clears IN-MEMORY state, NOT persistent storage.
   * Previously called authService.clearStorage() which wiped SecureStore +
   * AsyncStorage fallbacks. This meant any transient 401 during a session
   * would destroy credentials, and the next cold start would show login.
   * Persistent storage is only cleared on explicit logout.
   */
  const handleAuthFailure = useCallback(async () => {
    log.warn('Auth failure detected - clearing in-memory auth state');
    try {
      // Clear in-memory token only (persistent storage survives for next startup)
      apiClient.clearAuthToken();

      // Clear in-memory React state → shows login screen
      setUser(null);
      setServerUrl(null);
      setError('Your session has expired. Please log in again.');

      // Stop token health monitoring (no valid session)
      tokenHealthService.stop();

      // Clear Sentry user context
      setSentryUser(null);
    } catch (err) {
      log.error('Error during auth failure handling:', err);
    }
  }, []);

  /**
   * Wire up API client auth failure callback and token health monitoring
   */
  useEffect(() => {
    apiClient.setOnAuthFailure(handleAuthFailure);

    // Wire token health service: if consecutive health checks fail,
    // trigger the same auth failure handler as a 401 response would.
    tokenHealthService.setOnTokenInvalid(() => {
      log.warn('Token health service detected invalid token — triggering re-auth');
      handleAuthFailure();
    });

    return () => {
      apiClient.setOnAuthFailure(null);
      tokenHealthService.setOnTokenInvalid(null);
    };
  }, [handleAuthFailure]);

  /**
   * Persist server URL and username so the LoginScreen pre-fills after logout.
   * Best-effort — failures are non-fatal.
   */
  const saveLoginHint = (url: string, username: string) => {
    AsyncStorage.setItem(SAVED_SERVER_URL_KEY, url).catch(() => {});
    if (username) AsyncStorage.setItem(SAVED_USERNAME_KEY, username).catch(() => {});
  };

  /**
   * Restore session from stored credentials
   */
  const restoreSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const session = await authService.restoreSession();

      if (session) {
        setUser(session.user);
        setServerUrl(session.serverUrl);

        // Ensure login hints are populated for future logouts
        if (session.serverUrl) {
          saveLoginHint(session.serverUrl, session.user?.username || '');
        }

        // Set Sentry user context for error tracking
        if (session.user) {
          setSentryUser({ id: session.user.id, username: session.user.username });
        }

        // Check server version compatibility (non-blocking)
        serverVersionService.checkServerVersion().then(result => {
          if (!result.isCompatible) {
            setVersionCheck(result);
            log.warn('Server version mismatch:', result.message);
          }
        }).catch((err) => {
          log.warn('Server version check failed:', err);
        });

        // Start token health monitoring
        tokenHealthService.start();

        // Prefetch main tab data in background after session restore
        // Don't await - let user see home screen immediately
        prefetchMainTabData();
      }
    } catch (err) {
      log.error('Failed to restore session:', err);
      setError('Failed to restore session');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login with server URL and credentials
   */
  const login = async (
    serverUrl: string,
    username: string,
    password: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setVersionCheck(null);
      setVersionWarningDismissed(false);

      const user = await authService.login(serverUrl, username, password);

      setUser(user);
      setServerUrl(serverUrl);

      // Persist URL/username so LoginScreen pre-fills after future logout
      saveLoginHint(serverUrl, username);

      // Set Sentry user context for error tracking
      setSentryUser({ id: user.id, username: user.username });

      // Check server version compatibility (non-blocking)
      serverVersionService.checkServerVersion().then(result => {
        if (!result.isCompatible) {
          setVersionCheck(result);
          log.warn('Server version mismatch:', result.message);
        }
      }).catch((err) => {
          log.warn('Server version check failed:', err);
        });

      // Start token health monitoring
      tokenHealthService.start();

      // Prefetch main tab data in background after successful login
      // Don't await - let user see home screen immediately
      prefetchMainTabData();

      // Connect WebSocket for real-time sync
      appInitializer.connectWebSocket();

      // Sync finished books and preload recent book (same as app startup)
      // Don't await - runs in background
      appInitializer.syncFinishedBooks();

      // Sync My Library with linked collection (populates librarySet)
      appInitializer.syncLibrary();
    } catch (err: any) {
      log.error('Login failed:', err);
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      throw err; // Re-throw so UI can handle it
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login with a pre-obtained token (from OAuth/SSO callback)
   */
  const loginWithToken = async (
    serverUrl: string,
    token: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setVersionCheck(null);
      setVersionWarningDismissed(false);

      const user = await authService.loginWithToken(serverUrl, token);

      setUser(user);
      setServerUrl(serverUrl);

      // Persist URL so LoginScreen pre-fills after future logout
      saveLoginHint(serverUrl, user.username || '');

      // Set Sentry user context for error tracking
      setSentryUser({ id: user.id, username: user.username });

      // Check server version compatibility (non-blocking)
      serverVersionService.checkServerVersion().then(result => {
        if (!result.isCompatible) {
          setVersionCheck(result);
          log.warn('Server version mismatch:', result.message);
        }
      }).catch((err) => {
        log.warn('Server version check failed:', err);
      });

      // Start token health monitoring
      tokenHealthService.start();

      // Prefetch main tab data in background
      prefetchMainTabData();

      // Connect WebSocket for real-time sync
      appInitializer.connectWebSocket();

      // Sync finished books (background)
      appInitializer.syncFinishedBooks();

      // Sync My Library with linked collection (populates librarySet)
      appInitializer.syncLibrary();
    } catch (err: any) {
      log.error('Token login failed:', err);
      const errorMessage = err.message || 'SSO login failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout and clear session.
   *
   * State is cleared in a finally block so the user always lands on the
   * login screen, even if the server call or storage cleanup times out.
   */
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Disconnect WebSocket before logout
      appInitializer.disconnectWebSocket();

      // Stop token health monitoring
      tokenHealthService.stop();

      await authService.logout();
    } catch (err: any) {
      // Log but don't re-throw — the user must still land on the login screen.
      log.error('Logout cleanup error (non-fatal):', err);
    } finally {
      // Always clear in-memory state so the app navigates to LoginScreen.
      serverVersionService.clearCache();
      setUser(null);
      setServerUrl(null);
      setVersionCheck(null);
      setVersionWarningDismissed(false);
      setSentryUser(null);
      setIsLoading(false);
    }
  };

  /**
   * Clear error message
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Dismiss version warning (user acknowledged)
   */
  const dismissVersionWarning = () => {
    setVersionWarningDismissed(true);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    serverUrl,
    error,
    versionCheck: versionWarningDismissed ? null : versionCheck,  // Hide if dismissed
    login,
    loginWithToken,
    logout,
    clearError,
    dismissVersionWarning,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
