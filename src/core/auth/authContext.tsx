/**
 * src/core/auth/authContext.tsx
 * 
 * React context for managing authentication state across the app.
 * Provides useAuth hook for accessing auth state and operations.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authService } from './authService';
import { apiClient } from '../api/apiClient';
import { User } from '../types';
import { prefetchMainTabData } from '../queryClient';
import { appInitializer } from '../services/appInitializer';
import { authLogger as log } from '@/shared/utils/logger';
import { serverVersionService, VersionCheckResult } from '../services/serverVersionService';
import { tokenHealthService } from '../services/tokenHealthService';
import { setUser as setSentryUser } from '../monitoring/sentry';

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
   * Triggers automatic logout
   */
  const handleAuthFailure = useCallback(async () => {
    log.warn('Auth failure detected - logging out');
    try {
      // Clear auth state without calling server (token is already invalid)
      apiClient.clearAuthToken();
      await authService.clearStorage();
      setUser(null);
      setServerUrl(null);
      setError('Your session has expired. Please log in again.');

      // Clear Sentry user context
      setSentryUser(null);
    } catch (err) {
      log.error('Error during auth failure logout:', err);
    }
  }, []);

  /**
   * Wire up API client auth failure callback
   */
  useEffect(() => {
    apiClient.setOnAuthFailure(handleAuthFailure);
    return () => {
      apiClient.setOnAuthFailure(null);
    };
  }, [handleAuthFailure]);

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
        }).catch(() => {});

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

      // Set Sentry user context for error tracking
      setSentryUser({ id: user.id, username: user.username });

      // Check server version compatibility (non-blocking)
      serverVersionService.checkServerVersion().then(result => {
        if (!result.isCompatible) {
          setVersionCheck(result);
          log.warn('Server version mismatch:', result.message);
        }
      }).catch(() => {});

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
   * Logout and clear session
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

      // Clear version cache on logout
      serverVersionService.clearCache();

      setUser(null);
      setServerUrl(null);
      setVersionCheck(null);
      setVersionWarningDismissed(false);

      // Clear Sentry user context
      setSentryUser(null);
    } catch (err: any) {
      log.error('Logout failed:', err);
      const errorMessage = err.message || 'Logout failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
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
