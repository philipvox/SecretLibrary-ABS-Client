/**
 * src/features/player/stores/playerStore.ts
 *
 * Zustand store for managing audio player state.
 * Optimized to use the correct AudiobookShelf streaming endpoint.
 */

import { create } from 'zustand';
import { LibraryItem } from '@/core/types';
import { audioService, PlaybackState } from '../services/audioService';
import { progressService } from '../services/progressService';
import { apiClient } from '@/core/api';

/**
 * Player store state
 */
interface PlayerState {
  // Current book being played
  currentBook: LibraryItem | null;
  
  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  position: number; // current position in seconds
  duration: number; // total duration in seconds
  playbackRate: number; // playback speed (0.5 - 2.0)
  isBuffering: boolean;
  
  // UI state
  isPlayerVisible: boolean; // full player modal visibility
  
  // Actions
  loadBook: (book: LibraryItem, startPosition?: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  jumpToChapter: (chapterIndex: number) => Promise<void>;
  togglePlayer: () => void;
  closePlayer: () => void;
  updatePlaybackState: (state: PlaybackState) => void;
  cleanup: () => Promise<void>;
}

/**
 * Get authentication token from stored credentials
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { authService } = await import('@/core/auth');
    return await authService.getStoredToken();
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Create player store with Zustand
 */
export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  currentBook: null,
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  playbackRate: 1.0,
  isBuffering: false,
  isPlayerVisible: false,

  /**
   * Load and prepare book for playback
   */
  loadBook: async (book: LibraryItem, startPosition?: number) => {
    try {
      set({ isLoading: true });

      // Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Check if book has audio files
      if (!book.media.audioFiles || book.media.audioFiles.length === 0) {
        throw new Error('No audio files found in book');
      }

      // Get server URL
      const serverUrl = apiClient.getBaseURL();
      
      // Get first audio file
      const firstAudioFile = book.media.audioFiles[0];
      
      // Build audio URL using the working endpoint format:
      // /api/items/{itemId}/file/{audioFileIno}?token={token}
      const audioUrl = `${serverUrl}/api/items/${book.id}/file/${firstAudioFile.ino}?token=${token}`;
      
      console.log('[PlayerStore] Loading audio from first file:', firstAudioFile.metadata.filename);

      // Get last saved position if not provided
      let position = startPosition;
      if (position === undefined) {
        const savedPosition = await progressService.getLocalProgress(book.id);
        position = savedPosition || book.userMediaProgress?.currentTime || 0;
      }

      // Load audio
      await audioService.loadAudio(audioUrl, position);

      // Set up playback state callback
      audioService.setStatusUpdateCallback((state) => {
        get().updatePlaybackState(state);
      });

      // Update store
      set({
        currentBook: book,
        duration: book.media.duration,
        position: position,
        isLoading: false,
        isPlayerVisible: true,
      });

      // Start auto-sync
      progressService.startAutoSync();

      // Auto-play
      await get().play();
    } catch (error) {
      console.error('[PlayerStore] Failed to load book:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Start playback
   */
  play: async () => {
    try {
      await audioService.play();
      set({ isPlaying: true });
    } catch (error) {
      console.error('[PlayerStore] Failed to play:', error);
      throw error;
    }
  },

  /**
   * Pause playback and sync progress
   */
  pause: async () => {
    try {
      await audioService.pause();
      set({ isPlaying: false });

      // Sync progress on pause
      const { currentBook, position, duration } = get();
      if (currentBook) {
        await progressService.syncOnPause({
          itemId: currentBook.id,
          currentTime: position,
          duration: duration,
          progress: position / duration,
          isFinished: false,
        });
      }
    } catch (error) {
      console.error('[PlayerStore] Failed to pause:', error);
      throw error;
    }
  },

  /**
   * Seek to specific position
   */
  seekTo: async (position: number) => {
    try {
      await audioService.seekTo(position);
      set({ position });

      // Save progress when seeking
      const { currentBook, duration } = get();
      if (currentBook) {
        await progressService.saveProgress({
          itemId: currentBook.id,
          currentTime: position,
          duration: duration,
          progress: position / duration,
          isFinished: false,
        });
      }
    } catch (error) {
      console.error('[PlayerStore] Failed to seek:', error);
      throw error;
    }
  },

  /**
   * Skip forward by seconds (default 30)
   */
  skipForward: async (seconds: number = 30) => {
    try {
      await audioService.skipForward(seconds);
    } catch (error) {
      console.error('[PlayerStore] Failed to skip forward:', error);
      throw error;
    }
  },

  /**
   * Skip backward by seconds (default 30)
   */
  skipBackward: async (seconds: number = 30) => {
    try {
      await audioService.skipBackward(seconds);
    } catch (error) {
      console.error('[PlayerStore] Failed to skip backward:', error);
      throw error;
    }
  },

  /**
   * Set playback rate (0.5x - 2.0x)
   */
  setPlaybackRate: async (rate: number) => {
    try {
      await audioService.setPlaybackRate(rate);
      set({ playbackRate: rate });
    } catch (error) {
      console.error('[PlayerStore] Failed to set playback rate:', error);
      throw error;
    }
  },

  /**
   * Jump to a specific chapter
   */
  jumpToChapter: async (chapterIndex: number) => {
    const { currentBook } = get();
    if (!currentBook || !currentBook.media.chapters) {
      return;
    }

    const chapter = currentBook.media.chapters[chapterIndex];
    if (chapter) {
      await get().seekTo(chapter.start);
    }
  },

  /**
   * Toggle full player visibility
   */
  togglePlayer: () => {
    set((state) => ({ isPlayerVisible: !state.isPlayerVisible }));
  },

  /**
   * Close full player
   */
  closePlayer: () => {
    set({ isPlayerVisible: false });
  },

  /**
   * Update playback state from audio service
   */
  updatePlaybackState: (state: PlaybackState) => {
    set({
      isPlaying: state.isPlaying,
      position: state.position,
      isBuffering: state.isBuffering,
    });

    // Auto-save progress every 30 seconds
    const { currentBook, duration } = get();
    if (currentBook && state.isPlaying) {
      progressService.saveProgress({
        itemId: currentBook.id,
        currentTime: state.position,
        duration: duration,
        progress: state.position / duration,
        isFinished: false,
      });
    }
  },

  /**
   * Cleanup when player is closed
   */
  cleanup: async () => {
    try {
      // Stop auto-sync
      progressService.stopAutoSync();

      // Save final progress
      const { currentBook, position, duration, isPlaying } = get();
      if (currentBook) {
        if (isPlaying) {
          await audioService.pause();
        }

        await progressService.syncOnPause({
          itemId: currentBook.id,
          currentTime: position,
          duration: duration,
          progress: position / duration,
          isFinished: false,
        });
      }

      // Unload audio
      await audioService.unloadAudio();

      // Reset state
      set({
        currentBook: null,
        isPlaying: false,
        position: 0,
        duration: 0,
        isPlayerVisible: false,
      });
    } catch (error) {
      console.error('[PlayerStore] Failed to cleanup player:', error);
    }
  },
}));