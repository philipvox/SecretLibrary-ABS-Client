/**
 * src/features/downloads/stores/downloadStore.ts
 */

import { create } from 'zustand';
import {
  downloadService,
  DownloadedBook,
  DownloadProgress,
} from '../services/downloadService';
import { LibraryItem } from '@/core/types';

interface DownloadState {
  downloads: DownloadedBook[];
  activeDownloads: Map<string, DownloadProgress>;
  totalStorageUsed: number;
  isLoading: boolean;

  loadDownloads: () => Promise<void>;
  startDownload: (item: LibraryItem, serverUrl: string, token: string) => Promise<void>;
  cancelDownload: (libraryItemId: string) => Promise<void>;
  deleteDownload: (libraryItemId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  isDownloaded: (libraryItemId: string) => boolean;
  isDownloading: (libraryItemId: string) => boolean;
  getDownloadProgress: (libraryItemId: string) => DownloadProgress | undefined;
  getLocalAudioPath: (libraryItemId: string) => string | undefined;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],
  activeDownloads: new Map(),
  totalStorageUsed: 0,
  isLoading: false,

  loadDownloads: async () => {
    set({ isLoading: true });
    try {
      const downloads = await downloadService.getDownloadedBooks();
      const totalStorageUsed = await downloadService.getTotalStorageUsed();
      set({ downloads, totalStorageUsed, isLoading: false });
    } catch (error) {
      console.error('Failed to load downloads:', error);
      set({ isLoading: false });
    }
  },

  startDownload: async (item: LibraryItem, serverUrl: string, token: string) => {
    const libraryItemId = item.id;

    set((state) => ({
      activeDownloads: new Map(state.activeDownloads).set(libraryItemId, {
        libraryItemId,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        status: 'pending',
      }),
    }));

    try {
      await downloadService.downloadBook(item, serverUrl, token, (progress) => {
        set((state) => ({
          activeDownloads: new Map(state.activeDownloads).set(libraryItemId, progress),
        }));
      });

      const downloads = await downloadService.getDownloadedBooks();
      const totalStorageUsed = await downloadService.getTotalStorageUsed();

      set((state) => {
        const activeDownloads = new Map(state.activeDownloads);
        activeDownloads.delete(libraryItemId);
        return { downloads, totalStorageUsed, activeDownloads };
      });
    } catch (error) {
      set((state) => {
        const activeDownloads = new Map(state.activeDownloads);
        activeDownloads.delete(libraryItemId);
        return { activeDownloads };
      });
      throw error;
    }
  },

  cancelDownload: async (libraryItemId: string) => {
    await downloadService.cancelDownload(libraryItemId);
    set((state) => {
      const activeDownloads = new Map(state.activeDownloads);
      activeDownloads.delete(libraryItemId);
      return { activeDownloads };
    });
  },

  deleteDownload: async (libraryItemId: string) => {
    await downloadService.deleteDownload(libraryItemId);
    const downloads = await downloadService.getDownloadedBooks();
    const totalStorageUsed = await downloadService.getTotalStorageUsed();
    set({ downloads, totalStorageUsed });
  },

  clearAllDownloads: async () => {
    await downloadService.clearAllDownloads();
    set({ downloads: [], totalStorageUsed: 0, activeDownloads: new Map() });
  },

  isDownloaded: (libraryItemId: string) => {
    return get().downloads.some((d) => d.libraryItemId === libraryItemId);
  },

  isDownloading: (libraryItemId: string) => {
    return get().activeDownloads.has(libraryItemId);
  },

  getDownloadProgress: (libraryItemId: string) => {
    return get().activeDownloads.get(libraryItemId);
  },

  getLocalAudioPath: (libraryItemId: string) => {
    const download = get().downloads.find((d) => d.libraryItemId === libraryItemId);
    return download?.localAudioPath;
  },
}));