/**
 * src/features/downloads/hooks/useDownloads.ts
 */

import { useEffect, useCallback } from 'react';
import { useDownloadStore } from '../stores/downloadStore';
import { useAuth } from '@/core/auth';
import { LibraryItem } from '@/core/types';

export function useDownloads() {
  const downloads = useDownloadStore((state) => state.downloads);
  const activeDownloads = useDownloadStore((state) => state.activeDownloads);
  const totalStorageUsed = useDownloadStore((state) => state.totalStorageUsed);
  const isLoading = useDownloadStore((state) => state.isLoading);
  const loadDownloads = useDownloadStore((state) => state.loadDownloads);
  const clearAllDownloads = useDownloadStore((state) => state.clearAllDownloads);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  return {
    downloads,
    activeDownloads,
    totalStorageUsed,
    isLoading,
    clearAllDownloads,
    loadDownloads,
    downloadCount: downloads.length,
  };
}

export function useBookDownload(libraryItemId: string) {
  const { serverUrl, user } = useAuth();
  const token = user?.token;
  
  // Subscribe to state slices directly for reactivity
  const downloads = useDownloadStore((state) => state.downloads);
  const activeDownloads = useDownloadStore((state) => state.activeDownloads);
  const startDownload = useDownloadStore((state) => state.startDownload);
  const cancelDownload = useDownloadStore((state) => state.cancelDownload);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);

  // Derive values from state - downloaded takes priority
  const downloaded = downloads.some((d) => d.libraryItemId === libraryItemId);
  const progress = activeDownloads.get(libraryItemId);
  // Only show as downloading if not yet in downloads array and status is pending/downloading
  const downloading = !downloaded && (progress?.status === 'pending' || progress?.status === 'downloading');
  const localPath = downloads.find((d) => d.libraryItemId === libraryItemId)?.localAudioPath;

  const download = useCallback(
    async (item: LibraryItem) => {
      if (!serverUrl || !token) {
        throw new Error('Not authenticated');
      }
      await startDownload(item, serverUrl, token);
    },
    [serverUrl, token, startDownload]
  );

  const cancel = useCallback(() => {
    cancelDownload(libraryItemId);
  }, [libraryItemId, cancelDownload]);

  const remove = useCallback(() => {
    deleteDownload(libraryItemId);
  }, [libraryItemId, deleteDownload]);

  return {
    downloaded,
    downloading,
    progress,
    localPath,
    download,
    cancel,
    remove,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}