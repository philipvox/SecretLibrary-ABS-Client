/**
 * src/core/auth/authContext.tsx
 * 
 * React context for managing authentication state across the app.
 * Provides useAuth hook for accessing auth state and operations.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from './authService';
import { User } from '../types';

/**
 * Authentication context state and operations
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  serverUrl: string | null;
  error: string | null;
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

// Create context with undefined default (will be set by provider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider component
 * Wraps the app and provides auth state to all children
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Attempt to restore session on mount
   */
  useEffect(() => {
    restoreSession();
  }, []);

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
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
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

      const user = await authService.login(serverUrl, username, password);

      setUser(user);
      setServerUrl(serverUrl);
    } catch (err: any) {
      console.error('Login failed:', err);
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

      await authService.logout();

      setUser(null);
      setServerUrl(null);
    } catch (err: any) {
      console.error('Logout failed:', err);
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

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    serverUrl,
    error,
    login,
    logout,
    clearError,
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
