/**
 * src/core/hooks/useNetworkStatus.ts
 *
 * React hook for network status monitoring.
 * Provides offline-aware functionality for components.
 */

import { useState, useEffect, useCallback } from 'react';
import { networkMonitor, NetworkState } from '../services/networkMonitor';

/**
 * Hook for monitoring network status
 */
export function useNetworkStatus() {
  const [state, setState] = useState<NetworkState>(() => networkMonitor.getState());

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

/**
 * Hook that returns true if device is offline
 */
export function useIsOffline(): boolean {
  const { isConnected } = useNetworkStatus();
  return !isConnected;
}

/**
 * Hook that returns true if device is on WiFi
 */
export function useIsOnWifi(): boolean {
  const { connectionType } = useNetworkStatus();
  return connectionType === 'wifi';
}

/**
 * Hook that returns whether downloads are allowed
 */
export function useCanDownload(): boolean {
  const { canDownload } = useNetworkStatus();
  return canDownload;
}

/**
 * Hook for offline-aware data fetching
 */
export function useOfflineAware<T>(options: {
  /** Function to fetch data online */
  fetchOnline: () => Promise<T>;
  /** Function to get cached/offline data */
  fetchOffline: () => Promise<T | null>;
  /** Dependencies for refetch */
  deps?: any[];
  /** Whether to prefer offline data when available */
  offlineFirst?: boolean;
}) {
  const { fetchOnline, fetchOffline, deps = [], offlineFirst = false } = options;
  const { isConnected } = useNetworkStatus();

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // If offline-first, try cached data first
      if (offlineFirst) {
        const offlineData = await fetchOffline();
        if (offlineData !== null) {
          setData(offlineData);
          setIsOfflineData(true);
          setIsLoading(false);

          // If online, refresh in background
          if (isConnected) {
            fetchOnline()
              .then((freshData) => {
                setData(freshData);
                setIsOfflineData(false);
              })
              .catch(() => {
                // Keep offline data on failure
              });
          }
          return;
        }
      }

      // If not connected, try offline data
      if (!isConnected) {
        const offlineData = await fetchOffline();
        if (offlineData !== null) {
          setData(offlineData);
          setIsOfflineData(true);
        } else {
          setError(new Error('No offline data available'));
        }
        setIsLoading(false);
        return;
      }

      // Fetch online
      const onlineData = await fetchOnline();
      setData(onlineData);
      setIsOfflineData(false);
    } catch (err) {
      // Try offline fallback on error
      const offlineData = await fetchOffline();
      if (offlineData !== null) {
        setData(offlineData);
        setIsOfflineData(true);
      } else {
        setError(err instanceof Error ? err : new Error('Fetch failed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, fetchOnline, fetchOffline, offlineFirst, ...deps]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refetch = useCallback(() => {
    return fetch();
  }, [fetch]);

  return {
    data,
    isLoading,
    error,
    isOfflineData,
    refetch,
  };
}

/**
 * Hook for executing actions with offline awareness
 */
export function useOfflineAction<T>(options: {
  /** Action to execute when online */
  onlineAction: () => Promise<T>;
  /** Optional offline fallback action */
  offlineAction?: () => Promise<T | void>;
  /** Error handler */
  onError?: (error: Error) => void;
}) {
  const { onlineAction, offlineAction, onError } = options;
  const { isConnected } = useNetworkStatus();

  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<T | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  const execute = useCallback(async (): Promise<T | void> => {
    setIsExecuting(true);
    setLastError(null);

    try {
      if (!isConnected && offlineAction) {
        const result = await offlineAction();
        if (result !== undefined) {
          setLastResult(result as T);
        }
        return result;
      }

      if (!isConnected) {
        throw new Error('Action requires internet connection');
      }

      const result = await onlineAction();
      setLastResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Action failed');
      setLastError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, [isConnected, onlineAction, offlineAction, onError]);

  return {
    execute,
    isExecuting,
    lastResult,
    lastError,
    isOffline: !isConnected,
  };
}
