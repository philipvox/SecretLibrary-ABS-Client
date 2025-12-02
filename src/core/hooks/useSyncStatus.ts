/**
 * src/core/hooks/useSyncStatus.ts
 *
 * Hook for monitoring sync and network status.
 */

import { useState, useEffect, useCallback } from 'react';
import { syncQueue } from '@/core/services/syncQueue';

// Safe NetInfo import - may not be available in Expo Go
let NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo not available
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  error: string | null;
}

export function useSyncStatus() {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
  });

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await syncQueue.getPendingCount();
    setState((prev) => ({
      ...prev,
      pendingCount: count,
    }));
  }, []);

  // Network listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (NetInfo) {
      unsubscribe = NetInfo.addEventListener((netState) => {
        const isOnline = netState.isConnected ?? false;

        setState((prev) => ({
          ...prev,
          isOnline,
          status: isOnline ? (prev.pendingCount > 0 ? 'syncing' : 'idle') : 'offline',
        }));

        // Update pending count when coming online
        if (isOnline) {
          updatePendingCount();
        }
      });

      // Initial state
      NetInfo.fetch().then((netState) => {
        setState((prev) => ({
          ...prev,
          isOnline: netState.isConnected ?? false,
          status: netState.isConnected ? 'idle' : 'offline',
        }));
      });
    }

    // Initial pending count
    updatePendingCount();

    // Poll pending count periodically
    const interval = setInterval(updatePendingCount, 10000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [updatePendingCount]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!state.isOnline) return;

    setState((prev) => ({ ...prev, status: 'syncing', isSyncing: true }));

    try {
      await syncQueue.processQueue();
      await updatePendingCount();

      setState((prev) => ({
        ...prev,
        status: prev.pendingCount > 0 ? 'syncing' : 'idle',
        isSyncing: false,
        lastSyncTime: new Date(),
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, [state.isOnline, updatePendingCount]);

  return {
    ...state,
    triggerSync,
    refreshPendingCount: updatePendingCount,
  };
}
