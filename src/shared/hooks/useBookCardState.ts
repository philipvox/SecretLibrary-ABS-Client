/**
 * src/shared/hooks/useBookCardState.ts
 *
 * Unified hook for BookCard state management.
 * Combines download status, queue status, and now playing status.
 */

import { useMemo } from 'react';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { useIsInQueue, useQueueStore } from '@/features/queue/stores/queueStore';
import { usePlayerStore } from '@/features/player';

export type BookCardDisplayState =
  | 'NotDownloaded'
  | 'Downloading'
  | 'DownloadFailed'
  | 'Downloaded'
  | 'InQueue'
  | 'NowPlaying';

export type DownloadState = 'none' | 'downloading' | 'failed' | 'complete';

export interface BookCardState {
  // Display state (resolved from all states)
  displayState: BookCardDisplayState;

  // Download state
  downloadState: DownloadState;
  downloadProgress: number;
  isDownloaded: boolean;
  isDownloading: boolean;

  // Queue state
  isInQueue: boolean;
  queuePosition: number | undefined;

  // Player state
  isNowPlaying: boolean;
}

/**
 * Hook to get unified book card state
 */
export function useBookCardState(bookId: string): BookCardState {
  // Download status
  const {
    isDownloaded,
    isDownloading,
    isPending,
    hasError,
    progress,
  } = useDownloadStatus(bookId);

  // Queue status
  const isInQueue = useIsInQueue(bookId);
  const queue = useQueueStore((state) => state.queue);

  // Now playing status
  const currentBookId = usePlayerStore((state) => state.currentBook?.id);
  const isNowPlaying = currentBookId === bookId;

  // Calculate queue position (1-based for display)
  const queuePosition = useMemo(() => {
    if (!isInQueue) return undefined;
    const index = queue.findIndex((item) => item.bookId === bookId);
    return index >= 0 ? index + 1 : undefined;
  }, [isInQueue, queue, bookId]);

  // Resolve download state
  const downloadState: DownloadState = useMemo(() => {
    if (isDownloaded) return 'complete';
    if (isDownloading || isPending) return 'downloading';
    if (hasError) return 'failed';
    return 'none';
  }, [isDownloaded, isDownloading, isPending, hasError]);

  // Resolve display state (priority order: NowPlaying > InQueue > Download states)
  const displayState: BookCardDisplayState = useMemo(() => {
    if (isNowPlaying) return 'NowPlaying';
    if (isInQueue) return 'InQueue';
    if (isDownloading || isPending) return 'Downloading';
    if (hasError) return 'DownloadFailed';
    if (isDownloaded) return 'Downloaded';
    return 'NotDownloaded';
  }, [isNowPlaying, isInQueue, isDownloading, isPending, hasError, isDownloaded]);

  return {
    displayState,
    downloadState,
    downloadProgress: progress,
    isDownloaded,
    isDownloading: isDownloading || isPending,
    isInQueue,
    queuePosition,
    isNowPlaying,
  };
}

/**
 * Resolve display state from props (for components that pass state directly)
 */
export function resolveDisplayState(
  downloadState: DownloadState,
  isInQueue: boolean,
  isNowPlaying: boolean
): BookCardDisplayState {
  if (isNowPlaying) return 'NowPlaying';
  if (isInQueue) return 'InQueue';
  if (downloadState === 'downloading') return 'Downloading';
  if (downloadState === 'failed') return 'DownloadFailed';
  if (downloadState === 'complete') return 'Downloaded';
  return 'NotDownloaded';
}
