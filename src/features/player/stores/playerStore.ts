/**
 * src/features/player/stores/playerStore.ts
 * 
 * Player store using direct file streaming
 */

import { create } from 'zustand';
import { LibraryItem } from '@/core/types';
import { audioService, PlaybackState } from '../services/audioService';
import { progressService } from '../services/progressService';
import { apiClient } from '@/core/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG = true;
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
let currentLoadId = 0; // Track current load to cancel stale ones

async function getAuthToken(): Promise<string | null> {
  try {
    const { authService } = await import('@/core/auth');
    return await authService.getStoredToken();
  } catch (error) {
    logError('Failed to get auth token:', error);
    return null;
  }
}

async function getServerUrl(): Promise<string | null> {
  try {
    const { authService } = await import('@/core/auth');
    if (typeof authService.getStoredServerUrl === 'function') {
      const url = await authService.getStoredServerUrl();
      if (url) return url.replace(/\/+$/, '');
    }
    
    const stored = await AsyncStorage.getItem('auth_data');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.serverUrl) return data.serverUrl.replace(/\/+$/, '');
    }
    
    return null;
  } catch (error) {
    logError('Failed to get server URL:', error);
    return null;
  }
}

async function getDownloadPath(bookId: string): Promise<string | null> {
  try {
    const { downloadService } = await import('@/features/downloads');
    
    if (downloadService.isDownloading(bookId)) {
      log('Book still downloading');
      return null;
    }
    
    const book = await downloadService.getDownloadedBook(bookId);
    if (!book?.localAudioPath) return null;

    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(book.localAudioPath);
    
    if (!info.exists || ((info as any).size || 0) < 10000) {
      log('Downloaded file missing or corrupt, cleaning up');
      await downloadService.deleteDownload(bookId);
      return null;
    }

    return book.localAudioPath;
  } catch (error) {
    logError('Failed to verify download:', error);
    return null;
  }
}

function extractChapters(book: LibraryItem): Chapter[] {
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
    const { currentBook, position: prevPosition, isOffline: wasOffline } = get();
    
    // Increment load ID to cancel any in-progress loads
    const thisLoadId = ++currentLoadId;
    
    log('=== loadBook ===');
    log('Book:', book.id, '-', book.media?.metadata?.title);

    // Same book? Just show player
    if (currentBook?.id === book.id && audioService.getIsLoaded()) {
      log('Same book already loaded');
      set({ isPlayerVisible: true });
      if (!get().isPlaying) {
        await get().play();
      }
      return;
    }

    set({ isLoading: true, isPlayerVisible: true });

    try {
      // Save previous book progress (don't await - fire and forget)
      if (currentBook && currentBook.id !== book.id) {
        log('Saving progress for previous book');
        const progressData = {
          itemId: currentBook.id,
          currentTime: prevPosition,
          duration: get().duration,
          progress: get().duration > 0 ? prevPosition / get().duration : 0,
          isFinished: false,
        };
        
        if (wasOffline) {
          progressService.saveLocalOnly(progressData).catch(() => {});
        } else {
          progressService.syncOnPause(progressData).catch(() => {});
        }
      }

      // Unload previous audio
      await audioService.unloadAudio();
      
      // Check if this load was cancelled
      if (thisLoadId !== currentLoadId) {
        log('Load cancelled - newer load started');
        return;
      }

      // Check for offline download
      const localPath = await getDownloadPath(book.id);
      
      // Check if cancelled
      if (thisLoadId !== currentLoadId) {
        log('Load cancelled after download check');
        return;
      }
      
      const isOffline = !!localPath;
      log('Offline mode:', isOffline);

      // Extract chapters and duration
      const chapters = extractChapters(book);
      const totalDuration = getBookDuration(book);
      log('Chapters:', chapters.length, 'Duration:', totalDuration);

      // Determine start position
      let targetPosition = startPosition;
      if (targetPosition === undefined) {
        const localProgress = await progressService.getLocalProgress(book.id);
        const serverProgress = book.userMediaProgress?.currentTime || 0;
        targetPosition = Math.max(localProgress, serverProgress);
        log('Resuming at:', targetPosition);
      }

      // Clamp position
      if (totalDuration > 0 && targetPosition >= totalDuration) {
        log('Position exceeds duration, resetting to 0');
        targetPosition = 0;
      }
      targetPosition = Math.max(0, targetPosition);

      // Build audio URL
      let audioUrl: string;
      
      if (isOffline) {
        audioUrl = localPath!;
        log('Using offline path');
      } else {
        // Debug: log book structure to find audio files
        log('Book structure:', JSON.stringify({
          id: book.id,
          mediaType: book.mediaType,
          hasMedia: !!book.media,
          mediaKeys: book.media ? Object.keys(book.media) : [],
          audioFilesCount: book.media?.audioFiles?.length,
          tracksCount: (book.media as any)?.tracks?.length,
        }));
        
        // Try multiple locations for audio files
        let audioFiles = book.media?.audioFiles || (book.media as any)?.tracks;
        
        // If no audio files, try fetching the full book data
        if (!audioFiles?.length) {
          log('No audio files in book object, fetching expanded data...');
          try {
            const expandedBook = await apiClient.get<LibraryItem>(
              `/api/items/${book.id}?expanded=1&include=chapters`
            );
            audioFiles = expandedBook.media?.audioFiles || (expandedBook.media as any)?.tracks;
            
            // Also update chapters if we got them
            if (expandedBook.media?.chapters?.length) {
              const newChapters = extractChapters(expandedBook);
              set({ chapters: newChapters });
            }
            
            log('Fetched expanded book, audioFiles:', audioFiles?.length);
          } catch (fetchError) {
            logError('Failed to fetch expanded book:', fetchError);
          }
        }
        
        if (!audioFiles?.length) {
          logError('No audio files found after fetch');
          throw new Error('No audio files available');
        }
        
        const token = await getAuthToken();
        if (!token) throw new Error('No authentication token');

        const rawServerUrl = await getServerUrl();
        if (!rawServerUrl) throw new Error('No server URL configured');
        const serverUrl = rawServerUrl.replace(/\/+$/, '');
        
        const audioFile = audioFiles[0];
        
        // Handle different audio file structures
        const fileId = audioFile.ino || audioFile.id || audioFile.index;
        if (!fileId) {
          log('Audio file structure:', JSON.stringify(audioFile));
          throw new Error('Cannot determine audio file ID');
        }
        
        audioUrl = `${serverUrl}/api/items/${book.id}/file/${fileId}?token=${token}`.replace(/([^:]\/)\/+/g, '$1');
        log('Streaming URL:', audioUrl.substring(0, 80) + '...');
      }

      // Set state before loading audio
      set({
        currentBook: book,
        chapters,
        duration: totalDuration,
        position: targetPosition,
        isOffline,
        isPlaying: false,
        isBuffering: false,
      });

      // Check if cancelled before loading
      if (thisLoadId !== currentLoadId) {
        log('Load cancelled before audio load');
        return;
      }

      // Load audio
      await audioService.loadAudio(audioUrl, targetPosition);
      
      // Check if cancelled after loading
      if (thisLoadId !== currentLoadId) {
        log('Load cancelled after audio load');
        return;
      }

      // Set up status callback
      audioService.setStatusUpdateCallback((state) => {
        get().updatePlaybackState(state);
      });

      // Apply playback rate
      const { playbackRate } = get();
      if (playbackRate !== 1.0) {
        await audioService.setPlaybackRate(playbackRate);
      }

      // Load bookmarks
      await get().loadBookmarks();

      set({ isLoading: false });

      // Auto-play
      log('Starting playback');
      await get().play();

    } catch (error: any) {
      // Only handle error if this is still the current load
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

    const { currentBook, position, duration, isOffline } = get();
    if (!currentBook) return;

    const progressData = {
      itemId: currentBook.id,
      currentTime: position,
      duration,
      progress: duration > 0 ? position / duration : 0,
      isFinished: false,
    };

    try {
      if (isOffline) {
        await progressService.saveLocalOnly(progressData);
      } else {
        await progressService.syncOnPause(progressData);
      }
    } catch (e) {
      logError('Failed to save progress:', e);
    }
  },

  seekTo: async (position: number) => {
    const { duration } = get();
    const clampedPosition = Math.max(0, Math.min(position, duration));
    await audioService.seekTo(clampedPosition);
    set({ position: clampedPosition });
  },

  skipForward: async (seconds: number = 30) => {
    const { position, duration } = get();
    await get().seekTo(Math.min(position + seconds, duration));
  },

  skipBackward: async (seconds: number = 30) => {
    const { position } = get();
    await get().seekTo(Math.max(position - seconds, 0));
  },

  setPlaybackRate: async (rate: number) => {
    await audioService.setPlaybackRate(rate);
    set({ playbackRate: rate });
  },

  jumpToChapter: async (chapterIndex: number) => {
    const { chapters } = get();
    const chapter = chapters[chapterIndex];
    if (chapter) {
      log('Jumping to chapter:', chapter.title, 'at', chapter.start);
      await get().seekTo(chapter.start);
    }
  },

  nextChapter: async () => {
    const { chapters, position } = get();
    if (!chapters.length) return;

    const currentIdx = chapters.findIndex((ch, idx) => {
      const nextStart = chapters[idx + 1]?.start ?? Infinity;
      return position >= ch.start && position < nextStart;
    });

    if (currentIdx >= 0 && currentIdx < chapters.length - 1) {
      await get().jumpToChapter(currentIdx + 1);
    }
  },

  prevChapter: async () => {
    const { chapters, position } = get();
    if (!chapters.length) return;

    const currentIdx = chapters.findIndex((ch, idx) => {
      const nextStart = chapters[idx + 1]?.start ?? Infinity;
      return position >= ch.start && position < nextStart;
    });

    if (currentIdx > 0) {
      const currentChapter = chapters[currentIdx];
      if (position - currentChapter.start > 3) {
        await get().jumpToChapter(currentIdx);
      } else {
        await get().jumpToChapter(currentIdx - 1);
      }
    } else if (currentIdx === 0) {
      await get().seekTo(0);
    }
  },

  getCurrentChapter: () => {
    const { chapters, position } = get();
    if (!chapters.length) return null;

    for (let i = chapters.length - 1; i >= 0; i--) {
      if (position >= chapters[i].start) {
        return chapters[i];
      }
    }
    return null;
  },

  togglePlayer: () => set((s) => ({ isPlayerVisible: !s.isPlayerVisible })),
  closePlayer: () => set({ isPlayerVisible: false }),

  updatePlaybackState: (state: PlaybackState) => {
    const { sleepTimer, duration: bookDuration } = get();

    set({
      isPlaying: state.isPlaying,
      position: state.position,
      duration: bookDuration > 0 ? bookDuration : state.duration,
      isBuffering: state.isBuffering,
    });

    // End-of-chapter sleep timer
    if (sleepTimer === -1 && state.isPlaying) {
      const chapter = get().getCurrentChapter();
      if (chapter && state.position >= chapter.end - 2) {
        get().pause();
        get().clearSleepTimer();
      }
    }
  },

  cleanup: async () => {
    const { currentBook, position, duration, isOffline } = get();

    get().clearSleepTimer();

    if (currentBook) {
      const progressData = {
        itemId: currentBook.id,
        currentTime: position,
        duration,
        progress: duration > 0 ? position / duration : 0,
        isFinished: false,
      };

      try {
        if (isOffline) {
          await progressService.saveLocalOnly(progressData);
        } else {
          await progressService.syncOnPause(progressData);
        }
      } catch {}
    }

    await audioService.unloadAudio();

    set({
      currentBook: null,
      chapters: [],
      isPlaying: false,
      position: 0,
      duration: 0,
      isPlayerVisible: false,
      isOffline: false,
      bookmarks: [],
    });
  },

  setSleepTimer: (minutes: number) => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);

    if (minutes === -1) {
      set({ sleepTimer: -1, sleepTimerInterval: null });
      return;
    }

    const seconds = minutes * 60;
    const interval = setInterval(() => {
      const { sleepTimer, isPlaying } = get();
      if (sleepTimer === null || sleepTimer === -1) {
        clearInterval(interval);
        return;
      }
      if (!isPlaying) return;

      const newTime = sleepTimer - 1;
      if (newTime <= 0) {
        get().pause();
        get().clearSleepTimer();
      } else {
        set({ sleepTimer: newTime });
      }
    }, 1000);

    set({ sleepTimer: seconds, sleepTimerInterval: interval });
  },

  clearSleepTimer: () => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    set({ sleepTimer: null, sleepTimerInterval: null });
  },

  addBookmark: (bookmark: Bookmark) => {
    const { bookmarks, currentBook } = get();
    const newBookmarks = [...bookmarks, bookmark];
    set({ bookmarks: newBookmarks });
    if (currentBook) {
      AsyncStorage.setItem(`${BOOKMARKS_KEY}_${currentBook.id}`, JSON.stringify(newBookmarks));
    }
  },

  removeBookmark: (bookmarkId: string) => {
    const { bookmarks, currentBook } = get();
    const newBookmarks = bookmarks.filter((b) => b.id !== bookmarkId);
    set({ bookmarks: newBookmarks });
    if (currentBook) {
      AsyncStorage.setItem(`${BOOKMARKS_KEY}_${currentBook.id}`, JSON.stringify(newBookmarks));
    }
  },

  loadBookmarks: async () => {
    const { currentBook } = get();
    if (!currentBook) return;

    try {
      const stored = await AsyncStorage.getItem(`${BOOKMARKS_KEY}_${currentBook.id}`);
      set({ bookmarks: stored ? JSON.parse(stored) : [] });
    } catch {
      set({ bookmarks: [] });
    }
  },
}));