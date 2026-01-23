/**
 * src/features/automotive/useAutomotive.ts
 *
 * React hook for automotive (CarPlay/Android Auto) state and actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { automotiveService } from './automotiveService';
import {
  AutomotiveConnectionState,
  AutomotivePlatform,
  AutomotiveAction,
} from './types';

/**
 * Hook for automotive connection state
 */
export function useAutomotiveConnection() {
  const [state, setState] = useState<AutomotiveConnectionState>('disconnected');
  const [platform, setPlatform] = useState<AutomotivePlatform>('none');

  useEffect(() => {
    // Set up callbacks
    automotiveService.setCallbacks({
      onConnect: (connectedPlatform) => {
        setState('connected');
        setPlatform(connectedPlatform);
      },
      onDisconnect: () => {
        setState('disconnected');
        setPlatform('none');
      },
      onAction: () => {
        // Actions are handled by automotiveService
      },
    });

    // Get initial state
    setState(automotiveService.getConnectionState());
    setPlatform(automotiveService.getConnectedPlatform());
  }, []);

  return {
    connectionState: state,
    connectedPlatform: platform,
    isConnected: state === 'connected',
    isCarPlay: platform === 'carplay',
    isAndroidAuto: platform === 'android-auto',
  };
}

/**
 * Hook for handling automotive actions
 */
export function useAutomotiveActions() {
  const handleAction = useCallback(async (action: AutomotiveAction) => {
    // Get player store lazily to avoid circular dependency
    const { usePlayerStore } = await import('@/features/player/stores/playerStore');
    const store = usePlayerStore.getState();

    switch (action.type) {
      case 'play':
        await store.play();
        break;
      case 'pause':
        await store.pause();
        break;
      case 'skipForward':
        await store.skipForward();
        break;
      case 'skipBackward':
        await store.skipBackward();
        break;
      case 'nextChapter':
        await store.nextChapter();
        break;
      case 'prevChapter':
        await store.prevChapter();
        break;
      case 'seekTo':
        await store.seekTo(action.position);
        break;
      case 'setSpeed':
        await store.setPlaybackRate(action.speed);
        break;
      case 'playItem':
        // Find and load the item
        const { useLibraryCache } = await import('@/core/cache/libraryCache');
        const items = useLibraryCache.getState().items;
        const item = items.find(i => i.id === action.itemId);
        if (item) {
          await store.loadBook(item, { autoPlay: true, showPlayer: false });
        }
        break;
    }
  }, []);

  return { handleAction };
}

/**
 * Combined hook for full automotive functionality
 */
export function useAutomotive() {
  const connection = useAutomotiveConnection();
  const { handleAction } = useAutomotiveActions();

  useEffect(() => {
    // Update only the action handler, preserving connection callbacks
    // Note: useAutomotiveConnection already sets up onConnect/onDisconnect
    automotiveService.setActionHandler(handleAction);
  }, [handleAction]);

  return {
    ...connection,
    handleAction,
  };
}
