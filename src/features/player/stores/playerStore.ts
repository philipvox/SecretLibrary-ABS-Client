/**
 * src/features/player/stores/playerStore.ts
 * 
 * Player store with:
 * - Checks for local downloaded file first (instant playback)
 * - Falls back to streaming if not downloaded
 * - Proper loading lock to prevent race conditions
 */

import { create } from 'zustand';
import { LibraryItem } from '@/core/types';
import { audioService, PlaybackState } from '../services/audioService';
import { sessionService, SessionChapter } from '../services/sessionService';
import { progressService } from '../services/progressService';
// import { autoDownloadService } from '@/features/downloads/services/autoDownloadService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG = true;
const log = (msg: string, ...args: any[]) => {
  if (DEBUG) console.log(`[Player] ${msg}`, ...args);
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

  loadBook: (book: LibraryItem, startPosition?: number) => Promise<void>;
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
let currentLoadId = 0;
let isLoadingLock = false;

// ========================================
// Helper Functions
// ========================================

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

// ========================================
// Store
// ========================================

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

  loadBook: async (book: LibraryItem, startPosition?: number) => {
    // Prevent concurrent loads
    if (isLoadingLock) {
      log('⚠️ Load already in progress');
      return;
    }
    
    const { currentBook, position: prevPosition, isOffline: wasOffline } = get();
    
    // Same book already loaded?
    if (currentBook?.id === book.id && audioService.getIsLoaded()) {
      log('Same book already loaded');
      set({ isPlayerVisible: true });
      if (!get().isPlaying) {
        try {
          await audioService.play();
          set({ isPlaying: true });
        } catch {}
      }
      return;
    }

    const thisLoadId = ++currentLoadId;
    isLoadingLock = true;
    
    log('=== loadBook ===');
    log('Book:', book.media?.metadata?.title);

    set({ isLoading: true, isPlayerVisible: true });

    try {
      // Save progress for previous book
      if (currentBook && currentBook.id !== book.id && prevPosition > 0) {
        log('Saving progress for previous book');
        if (wasOffline) {
          progressService.saveLocalOnly({
            itemId: currentBook.id,
            currentTime: prevPosition,
            duration: get().duration,
            progress: get().duration > 0 ? prevPosition / get().duration : 0,
            isFinished: false,
          }).catch(() => {});
        } else {
          sessionService.syncProgress(prevPosition).catch(() => {});
        }
      }

      // Release previous audio
      await audioService.unloadAudio();

      if (thisLoadId !== currentLoadId) {
        log('Load cancelled');
        return;
      }

      // ========================================
      // CHECK FOR LOCAL DOWNLOADED FILE
      // ========================================
      const localPath = autoDownloadService.getLocalPath(book.id);
      const isOffline = !!localPath;
      
      log(isOffline ? '📱 LOCAL PLAYBACK' : '☁️ STREAMING');

      let streamUrl: string;
      let chapters: Chapter[] = [];
      let resumePosition = startPosition ?? 0;
      let totalDuration = getBookDuration(book);

      if (isOffline && localPath) {
        // ========================================
        // LOCAL PLAYBACK - Instant!
        // ========================================
        streamUrl = localPath;
        chapters = extractChaptersFromBook(book);
        
        // Get resume position from local progress
        const localProgress = await progressService.getLocalProgress(book.id);
        if (!startPosition && localProgress > 0) {
          resumePosition = localProgress;
          log('Local resume:', resumePosition);
        }

        // Update last played time
        autoDownloadService.updateLastPlayed(book.id);

      } else {
        // ========================================
        // STREAMING
        // ========================================
        log('Starting session...');
        
        const session = await sessionService.startSession(book.id);

        if (thisLoadId !== currentLoadId) {
          log('Load cancelled after session');
          return;
        }

        const url = sessionService.getStreamUrl();
        if (!url) {
          throw new Error('No stream URL');
        }
        streamUrl = url;

        chapters = mapSessionChapters(session.chapters || []);
        
        if (session.duration > 0) {
          totalDuration = session.duration;
        }

        if (!startPosition && session.currentTime > 0) {
          resumePosition = session.currentTime;
          log('Server resume:', resumePosition);
        }

        sessionService.startAutoSync(() => get().position);
      }

      // Set state
      set({
        currentBook: book,
        chapters,
        duration: totalDuration,
        position: resumePosition,
        isOffline,
        isPlaying: false,
        isBuffering: false,
      });

      if (thisLoadId !== currentLoadId) {
        log('Load cancelled before audio');
        return;
      }

      // Load audio
      log('Loading audio...');
      await audioService.loadAudio(streamUrl, resumePosition);

      if (thisLoadId !== currentLoadId) {
        log('Load cancelled after audio');
        return;
      }

      // Status callback
      audioService.setStatusUpdateCallback((state) => {
        get().updatePlaybackState(state);
      });

      // Playback rate
      const { playbackRate } = get();
      if (playbackRate !== 1.0) {
        await audioService.setPlaybackRate(playbackRate);
      }

      // Bookmarks
      await get().loadBookmarks();

      set({ isLoading: false });

      // Auto-play
      log('Starting playback...');
      try {
        await audioService.play();
        set({ isPlaying: true });
        log('✓ Playing');
      } catch (e: any) {
        log('Play failed:', e.message);
        // Retry once
        await new Promise(r => setTimeout(r, 100));
        try {
          await audioService.play();
          set({ isPlaying: true });
        } catch {}
      }

    } catch (error: any) {
      if (thisLoadId === currentLoadId) {
        log('❌ Load failed:', error.message);
        set({ isLoading: false });
      }
      throw error;
    } finally {
      isLoadingLock = false;
    }
  },

  play: async () => {
    if (!audioService.getIsLoaded()) {
      throw new Error('No audio loaded');
    }
    await audioService.play();
    set({ isPlaying: true });
  },

  pause: async () => {
    await audioService.pause();
    set({ isPlaying: false });

    const { currentBook, position, duration, isOffline } = get();
    if (!currentBook) return;

    // Save progress
    if (isOffline) {
      progressService.saveLocalOnly({
        itemId: currentBook.id,
        currentTime: position,
        duration,
        progress: duration > 0 ? position / duration : 0,
        isFinished: false,
      }).catch(() => {});
    } else {
      sessionService.syncProgress(position).catch(() => {});
    }
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
    AsyncStorage.setItem('playbackRate', rate.toString()).catch(() => {});
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
    const { duration: storeDuration } = get();

    set({
      isPlaying: state.isPlaying,
      position: state.position,
      duration: state.duration > 0 ? state.duration : storeDuration,
      isBuffering: state.isBuffering,
    });

    if ((state as any).didJustFinish) {
      log('Track finished');
      set({ isPlaying: false });
    }
  },

  cleanup: async () => {
    const { position, isOffline, sleepTimerInterval } = get();

    isLoadingLock = false;

    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
    }

    if (!isOffline) {
      await sessionService.closeSession(position);
    }

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