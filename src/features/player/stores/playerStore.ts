/**
 * src/features/player/stores/playerStore.ts
 * 
 * Player store using session-based streaming API
 * Updated to use autoDownloadService for offline playback
 */

import { create } from 'zustand';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { audioService, PlaybackState } from '../services/audioService';
import { sessionService, SessionChapter } from '../services/sessionService';
import { progressService } from '../services/progressService';
import { backgroundSyncService } from '../services/backgroundSyncService';
import { sqliteCache } from '@/core/services/sqliteCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG = __DEV__;
const log = (msg: string, ...args: any[]) => {
  if (DEBUG) console.log(`[Player] ${msg}`, ...args);
};
const logError = (msg: string, ...args: any[]) => {
  console.error(`[Player] ❌ ${msg}`, ...args);
};

export interface Chapter {
  id: number;
  start: number;
  end: number;
  title: string;
}

interface Bookmark {
  id: string;
  title: string;
  time: number;
  createdAt: number;
}

interface PlayerState {
  currentBook: LibraryItem | null;
  chapters: Chapter[];
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  playbackRate: number;
  isBuffering: boolean;
  isPlayerVisible: boolean;
  isOffline: boolean;
  sleepTimer: number | null;
  sleepTimerInterval: NodeJS.Timeout | null;
  bookmarks: Bookmark[];

  loadBook: (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean }) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  jumpToChapter: (chapterIndex: number) => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  getCurrentChapter: () => Chapter | null;
  togglePlayer: () => void;
  closePlayer: () => void;
  updatePlaybackState: (state: PlaybackState) => void;
  cleanup: () => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  loadBookmarks: () => Promise<void>;
}

const BOOKMARKS_KEY = 'player_bookmarks';
const PROGRESS_SAVE_INTERVAL = 30000; // Save progress every 30 seconds
let currentLoadId = 0;
let lastProgressSave = 0;
let isHandlingTrackFinish = false; // Guard against multiple didJustFinish triggers

async function getDownloadPath(bookId: string): Promise<string | null> {
  try {
    // Use autoDownloadService instead of old downloadService
    const { autoDownloadService } = await import('@/features/downloads');
    
    // Check if still downloading
    if (autoDownloadService.isDownloading(bookId)) {
      log('Book still downloading');
      return null;
    }
    
    // Get local path from autoDownloadService
    const localPath = autoDownloadService.getLocalPath(bookId);
    if (!localPath) return null;

    // Verify file exists
    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(localPath);
    
    if (!info.exists || ((info as any).size || 0) < 10000) {
      log('Downloaded file missing or corrupt, cleaning up');
      await autoDownloadService.removeDownload(bookId);
      return null;
    }

    // Update last played timestamp
    autoDownloadService.updateLastPlayed(bookId);

    return localPath;
  } catch (error) {
    logError('Failed to verify download:', error);
    return null;
  }
}

function mapSessionChapters(sessionChapters: SessionChapter[]): Chapter[] {
  return sessionChapters.map((ch, i) => ({
    id: i,
    start: ch.start,
    end: ch.end,
    title: ch.title || `Chapter ${i + 1}`,
  }));
}

function extractChaptersFromBook(book: LibraryItem): Chapter[] {
  const bookChapters = book.media?.chapters;
  if (!bookChapters?.length) return [];
  
  return bookChapters.map((ch, i) => ({
    id: i,
    start: ch.start || 0,
    end: ch.end || bookChapters[i + 1]?.start || book.media?.duration || 0,
    title: ch.title || `Chapter ${i + 1}`,
  }));
}

function getBookDuration(book: LibraryItem): number {
  if (book.media?.duration && book.media.duration > 0) {
    return book.media.duration;
  }
  
  if (book.media?.audioFiles?.length) {
    const sum = book.media.audioFiles.reduce((acc, f) => acc + (f.duration || 0), 0);
    if (sum > 0) return sum;
  }
  
  const chapters = book.media?.chapters;
  if (chapters?.length) {
    const last = chapters[chapters.length - 1];
    if (last.end && last.end > 0) return last.end;
  }
  
  return 0;
}

function findChapterIndex(chapters: Chapter[], position: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (position >= chapters[i].start) {
      return i;
    }
  }
  return 0;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentBook: null,
  chapters: [],
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  playbackRate: 1.0,
  isBuffering: false,
  isPlayerVisible: false,
  isOffline: false,
  sleepTimer: null,
  sleepTimerInterval: null,
  bookmarks: [],

  loadBook: async (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean }) => {
    const { startPosition, autoPlay = true } = options || {};
    const { currentBook, position: prevPosition, isOffline: wasOffline, isLoading } = get();

    // Already loading?
    if (isLoading) {
      log('Already loading a book, skipping');
      return;
    }

    const thisLoadId = ++currentLoadId;
    const t0 = Date.now();
    const timing = (label: string) => log(`⏱ ${label}: ${Date.now() - t0}ms`);

    // Reset track finish guard for fresh book load
    isHandlingTrackFinish = false;

    log('=== loadBook ===');
    log('Book:', book.id, '-', book.media?.metadata?.title, '- autoPlay:', autoPlay);

    // Same book already loaded?
    if (currentBook?.id === book.id && audioService.getIsLoaded()) {
      log('Same book already loaded');
      set({ isPlayerVisible: true });
      if (autoPlay && !get().isPlaying) {
        await get().play();
      }
      return;
    }

    // Set new book immediately to prevent UI flash
    set({ 
      isLoading: true, 
      isPlayerVisible: true,
      currentBook: book,
      isPlaying: false,
      isBuffering: true,
    });
    timing('State set');

    try {
      // Save progress for previous book using background sync service
      if (currentBook && currentBook.id !== book.id && prevPosition > 0) {
        const session = sessionService.getCurrentSession();
        backgroundSyncService.saveProgress(
          currentBook.id,
          prevPosition,
          get().duration,
          session?.id
        ).catch(() => {});
      }

      if (thisLoadId !== currentLoadId) return;

      // Check for offline download
      timing('Before getDownloadPath');
      const localPath = await getDownloadPath(book.id);
      timing('After getDownloadPath');
      const isOffline = !!localPath;

      let streamUrl: string;
      let chapters: Chapter[] = [];
      let resumePosition = startPosition ?? 0;
      let totalDuration = getBookDuration(book);

      if (isOffline && localPath) {
        // OFFLINE PLAYBACK - instant
        streamUrl = localPath;
        chapters = extractChaptersFromBook(book);
        log('Using offline path');
        
        if (!startPosition) {
          const localProgress = await progressService.getLocalProgress(book.id);
          if (localProgress > 0) {
            resumePosition = localProgress;
          }
        }
      } else {
        // ONLINE PLAYBACK - session API
        timing('Before session start');
        
        const session = await sessionService.startSession(book.id);
        timing('After session start');

        if (thisLoadId !== currentLoadId) return;

        const url = sessionService.getStreamUrl();
        if (!url) throw new Error('No stream URL');
        streamUrl = url;
        log('Stream URL:', streamUrl.substring(0, 80));

        chapters = mapSessionChapters(session.chapters || []);
        if (session.duration > 0) totalDuration = session.duration;
        if (!startPosition && session.currentTime > 0) resumePosition = session.currentTime;

        sessionService.startAutoSync(() => get().position);
      }

      // Initialize and start background sync service
      await backgroundSyncService.init();
      backgroundSyncService.start();

      // Update state with chapters/duration before loading audio
      set({
        chapters,
        duration: totalDuration,
        position: resumePosition,
        isOffline,
      });

      if (thisLoadId !== currentLoadId) return;

      // Get metadata for lock screen
      const title = book.media?.metadata?.title || 'Audiobook';
      const author = book.media?.metadata?.authorName ||
                     book.media?.metadata?.authors?.[0]?.name ||
                     'Unknown Author';
      const coverUrl = apiClient.getItemCoverUrl(book.id);

      // CRITICAL: Set up status callback BEFORE loading audio
      // This ensures we capture all playback state changes during loading
      audioService.setStatusUpdateCallback((state) => {
        get().updatePlaybackState(state);
      });

      // Load audio with metadata
      timing('Before loadAudio');
      await audioService.loadAudio(
        streamUrl,
        resumePosition,
        {
          title,
          artist: author,
          artwork: coverUrl,
        },
        autoPlay
      );
      timing('After loadAudio');

      if (thisLoadId !== currentLoadId) {
        log('Load cancelled after audio load');
        return;
      }

      // Apply playback rate
      const { playbackRate } = get();
      if (playbackRate !== 1.0) {
        audioService.setPlaybackRate(playbackRate).catch(() => {});
      }

      // Load bookmarks in BACKGROUND (don't await)
      get().loadBookmarks().catch(() => {});

      // Set final state - only play if autoPlay is true
      if (autoPlay) {
        set({ isLoading: false, isBuffering: true, isPlaying: true });
        log(`✓ Playback started`);
      } else {
        set({ isLoading: false, isBuffering: false, isPlaying: false });
        log(`✓ Book loaded (paused)`);
      }

    } catch (error: any) {
      if (thisLoadId === currentLoadId) {
        logError('Failed to load book:', error.message);
        set({ isLoading: false });
      }
      throw error;
    }
  },

  play: async () => {
    if (!audioService.getIsLoaded()) {
      logError('Cannot play - no audio loaded');
      throw new Error('No audio loaded');
    }
    await audioService.play();
    set({ isPlaying: true });
  },

  pause: async () => {
    await audioService.pause();
    set({ isPlaying: false });

    const { currentBook, position, duration } = get();
    if (!currentBook) return;

    // Sync progress on pause using background sync service
    const session = sessionService.getCurrentSession();
    backgroundSyncService.saveProgress(
      currentBook.id,
      position,
      duration,
      session?.id
    ).catch(() => {});
  },

  seekTo: async (position: number) => {
    await audioService.seekTo(position);
    set({ position });
  },

  skipForward: async (seconds = 30) => {
    const { position, duration } = get();
    const newPosition = Math.min(position + seconds, duration);
    await audioService.seekTo(newPosition);
    set({ position: newPosition });
  },

  skipBackward: async (seconds = 30) => {
    const { position } = get();
    const newPosition = Math.max(position - seconds, 0);
    await audioService.seekTo(newPosition);
    set({ position: newPosition });
  },

  setPlaybackRate: async (rate: number) => {
    await audioService.setPlaybackRate(rate);
    set({ playbackRate: rate });
    
    try {
      await AsyncStorage.setItem('playbackRate', rate.toString());
    } catch {}
  },

  jumpToChapter: async (chapterIndex: number) => {
    const { chapters } = get();
    if (chapterIndex >= 0 && chapterIndex < chapters.length) {
      const chapter = chapters[chapterIndex];
      await audioService.seekTo(chapter.start);
      set({ position: chapter.start });
    }
  },

  nextChapter: async () => {
    const { chapters, position } = get();
    const currentIndex = findChapterIndex(chapters, position);
    if (currentIndex < chapters.length - 1) {
      await get().jumpToChapter(currentIndex + 1);
    }
  },

  prevChapter: async () => {
    const { chapters, position } = get();
    const currentIndex = findChapterIndex(chapters, position);
    const currentChapter = chapters[currentIndex];
    
    // If more than 3 seconds into chapter, go to start of current chapter
    if (currentChapter && position - currentChapter.start > 3) {
      await get().jumpToChapter(currentIndex);
    } else if (currentIndex > 0) {
      await get().jumpToChapter(currentIndex - 1);
    }
  },

  getCurrentChapter: () => {
    const { chapters, position } = get();
    const index = findChapterIndex(chapters, position);
    return chapters[index] || null;
  },

  togglePlayer: () => {
    set((state) => ({ isPlayerVisible: !state.isPlayerVisible }));
  },

  closePlayer: () => {
    set({ isPlayerVisible: false });
  },

  updatePlaybackState: (state: PlaybackState) => {
    const { currentBook, duration: storeDuration, isLoading, isPlaying: wasPlaying } = get();
    const effectiveDuration = state.duration > 0 ? state.duration : storeDuration;

    // Don't update isPlaying while loading
    if (isLoading) {
      set({
        position: state.position,
        duration: effectiveDuration,
        isBuffering: state.isBuffering,
      });
      return;
    }

    // Don't flip from playing to not-playing due to buffering
    const newIsPlaying = state.isBuffering ? wasPlaying : state.isPlaying;

    set({
      isPlaying: newIsPlaying,
      position: state.position,
      duration: effectiveDuration,
      isBuffering: state.isBuffering,
    });

    // Periodic progress save to SQLite (every 30 seconds during playback)
    const now = Date.now();
    if (currentBook && newIsPlaying && state.position > 0 && now - lastProgressSave > PROGRESS_SAVE_INTERVAL) {
      lastProgressSave = now;
      const session = sessionService.getCurrentSession();
      backgroundSyncService.saveProgress(
        currentBook.id,
        state.position,
        effectiveDuration,
        session?.id
      ).catch(() => {});
    }

    // Handle track finished - guard against multiple rapid triggers
    if (state.didJustFinish && !isHandlingTrackFinish) {
      isHandlingTrackFinish = true;
      log('Track finished');

      // Check if there's a next chapter to auto-advance to
      const { chapters, position } = get();
      const currentChapterIndex = findChapterIndex(chapters, position);

      if (chapters.length > 0 && currentChapterIndex < chapters.length - 1) {
        // There's a next chapter - auto-advance and continue playing
        log(`Auto-advancing from chapter ${currentChapterIndex + 1} to ${currentChapterIndex + 2}`);
        const nextChapter = chapters[currentChapterIndex + 1];

        // Seek to next chapter and resume playback
        audioService.seekTo(nextChapter.start).then(() => {
          set({ position: nextChapter.start, isPlaying: true });
          return audioService.play();
        }).then(() => {
          // Reset guard after successful advance
          isHandlingTrackFinish = false;
          log('Successfully advanced to next chapter');
        }).catch((err) => {
          logError('Failed to advance to next chapter:', err);
          isHandlingTrackFinish = false;
        });
        return; // Don't mark as finished or save final progress - we're continuing
      }

      // No more chapters - this is the end of the book
      log('Book finished - no more chapters');
      set({ isPlaying: false });

      // Save final progress
      if (currentBook) {
        const session = sessionService.getCurrentSession();
        backgroundSyncService.saveProgress(
          currentBook.id,
          state.position,
          effectiveDuration,
          session?.id
        ).catch(() => {});

        // Add to read history for recommendations
        const metadata = currentBook.media?.metadata as any;
        if (metadata) {
          sqliteCache.addToReadHistory({
            itemId: currentBook.id,
            title: metadata.title || 'Unknown Title',
            authorName: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
            narratorName: metadata.narratorName || metadata.narrators?.[0]?.name,
            genres: metadata.genres || [],
          }).catch((err) => {
            logError('Failed to add to read history:', err);
          });
        }
      }

      // Reset guard after handling book finish
      isHandlingTrackFinish = false;
    }
  },

  cleanup: async () => {
    const { currentBook, position, duration, sleepTimerInterval } = get();

    // Reset track finish guard
    isHandlingTrackFinish = false;

    // Clear sleep timer
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
    }

    // Save final progress to SQLite + queue for server sync
    if (currentBook && position > 0) {
      const session = sessionService.getCurrentSession();
      await backgroundSyncService.saveProgress(
        currentBook.id,
        position,
        duration,
        session?.id
      );
    }

    // Force sync all pending progress to server
    await backgroundSyncService.forceSyncAll();

    // Close session
    await sessionService.closeSession(position);

    // Release audio
    await audioService.unloadAudio();

    set({
      currentBook: null,
      chapters: [],
      isPlaying: false,
      position: 0,
      duration: 0,
      isPlayerVisible: false,
      sleepTimer: null,
      sleepTimerInterval: null,
      bookmarks: [],
    });
  },

  setSleepTimer: (minutes: number) => {
    const { sleepTimerInterval } = get();

    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      
      if (remaining <= 0) {
        clearInterval(interval);
        get().pause();
        set({ sleepTimer: null, sleepTimerInterval: null });
      } else {
        set({ sleepTimer: remaining });
      }
    }, 1000);

    set({ sleepTimer: minutes * 60, sleepTimerInterval: interval });
  },

  clearSleepTimer: () => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
    }
    set({ sleepTimer: null, sleepTimerInterval: null });
  },

  addBookmark: (bookmark: Bookmark) => {
    const { currentBook, bookmarks } = get();
    if (!currentBook) return;

    const updated = [...bookmarks, bookmark];
    set({ bookmarks: updated });

    AsyncStorage.setItem(
      `${BOOKMARKS_KEY}_${currentBook.id}`,
      JSON.stringify(updated)
    ).catch(() => {});
  },

  removeBookmark: (bookmarkId: string) => {
    const { currentBook, bookmarks } = get();
    if (!currentBook) return;

    const updated = bookmarks.filter((b) => b.id !== bookmarkId);
    set({ bookmarks: updated });

    AsyncStorage.setItem(
      `${BOOKMARKS_KEY}_${currentBook.id}`,
      JSON.stringify(updated)
    ).catch(() => {});
  },

  loadBookmarks: async () => {
    const { currentBook } = get();
    if (!currentBook) return;

    try {
      const data = await AsyncStorage.getItem(`${BOOKMARKS_KEY}_${currentBook.id}`);
      if (data) {
        set({ bookmarks: JSON.parse(data) });
      } else {
        set({ bookmarks: [] });
      }
    } catch {
      set({ bookmarks: [] });
    }
  },
}));