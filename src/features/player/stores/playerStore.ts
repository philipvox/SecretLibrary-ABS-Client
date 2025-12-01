/**
 * src/features/player/stores/playerStore.ts
 * 
 * Player store using session-based streaming API
 * Updated to use autoDownloadService for offline playback
 */

import { create } from 'zustand';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { sessionService, SessionChapter } from '../services/sessionService';
import { progressService } from '../services/progressService';
import { backgroundSyncService } from '../services/backgroundSyncService';
import { sqliteCache } from '@/core/services/sqliteCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import audioService directly (not from barrel) to avoid circular dependency
import { audioService, PlaybackState, AudioTrackInfo } from '@/features/player/services/audioService';

// Import debug utilities
import {
  audioLog,
  createTimer,
  logSection,
  logPositionSources,
  logDurationSources,
  logChapters,
  logTracks,
  validateUrl,
} from '@/shared/utils/audioDebug';

const DEBUG = __DEV__;
const log = (msg: string, ...args: any[]) => audioLog.store(msg, ...args);
const logError = (msg: string, ...args: any[]) => audioLog.error(msg, ...args);

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
const CHAPTER_ADVANCE_COOLDOWN = 3000; // Don't auto-advance again within 3 seconds
let currentLoadId = 0;
let lastProgressSave = 0;
let isHandlingTrackFinish = false; // Guard against multiple didJustFinish triggers
let lastChapterAdvanceTime = 0; // Debounce rapid auto-advance attempts

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
    const timing = createTimer('loadBook');

    // Reset track finish guards for fresh book load
    isHandlingTrackFinish = false;
    lastChapterAdvanceTime = 0;

    logSection('LOAD BOOK START');
    log('Book ID:', book.id);
    log('Title:', book.media?.metadata?.title);
    log('Author:', book.media?.metadata?.authorName || book.media?.metadata?.authors?.[0]?.name);
    log('Options:', JSON.stringify(options));
    log('Duration from metadata:', book.media?.duration);
    log('Audio files count:', book.media?.audioFiles?.length);
    log('Chapters count:', book.media?.chapters?.length);
    timing('Start');

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

      let streamUrl: string = '';
      let chapters: Chapter[] = [];
      let resumePosition = startPosition ?? 0;
      let totalDuration = getBookDuration(book);
      let audioTrackInfos: AudioTrackInfo[] = [];

      if (isOffline && localPath) {
        // OFFLINE PLAYBACK - instant
        streamUrl = localPath;
        chapters = extractChaptersFromBook(book);
        log('OFFLINE PLAYBACK MODE');
        log('Local path:', localPath);
        validateUrl(localPath, 'Offline path');

        if (!startPosition) {
          const localProgress = await progressService.getLocalProgress(book.id);
          logPositionSources({
            localProgress,
            finalPosition: localProgress > 0 ? localProgress : 0,
          });
          if (localProgress > 0) {
            resumePosition = localProgress;
          }
        }
      } else {
        // ONLINE PLAYBACK - session API
        log('ONLINE PLAYBACK MODE');
        timing('Before session start');

        const session = await sessionService.startSession(book.id);
        timing('After session start');

        if (thisLoadId !== currentLoadId) return;

        log('Session response:');
        log('  Session ID:', session.id);
        log('  Audio tracks:', session.audioTracks?.length);
        log('  Chapters:', session.chapters?.length);
        log('  Duration:', session.duration);
        log('  Current time (resume):', session.currentTime);

        chapters = mapSessionChapters(session.chapters || []);
        if (session.duration > 0) totalDuration = session.duration;

        // Log position sources for debugging
        logPositionSources({
          session: session.currentTime,
          finalPosition: !startPosition && session.currentTime > 0 ? session.currentTime : startPosition ?? 0,
        });

        if (!startPosition && session.currentTime > 0) resumePosition = session.currentTime;

        // Build track info for multi-file audiobooks
        const audioTracks = session.audioTracks || [];
        if (audioTracks.length > 1) {
          // Multi-file book - build track URLs
          log('MULTI-FILE AUDIOBOOK');
          const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');
          const token = (apiClient as any).getAuthToken?.() || (apiClient as any).authToken || '';
          log('  Base URL:', baseUrl);
          log('  Auth token present:', !!token);

          audioTrackInfos = audioTracks.map((track) => {
            let trackUrl = `${baseUrl}${track.contentUrl}`;
            if (!track.contentUrl.includes('token=')) {
              const separator = track.contentUrl.includes('?') ? '&' : '?';
              trackUrl = `${trackUrl}${separator}token=${token}`;
            }
            return {
              url: trackUrl,
              title: track.title,
              startOffset: track.startOffset,
              duration: track.duration,
            };
          });
          log(`  Total tracks: ${audioTrackInfos.length}`);
          logTracks(audioTrackInfos);
        } else {
          // Single-file book - use stream URL
          log('SINGLE-FILE AUDIOBOOK');
          const url = sessionService.getStreamUrl();
          if (!url) {
            logError('No stream URL returned from session!');
            throw new Error('No stream URL');
          }
          streamUrl = url;
          validateUrl(streamUrl, 'Stream URL');
          log('Stream URL preview:', streamUrl.substring(0, 80) + '...');
        }

        sessionService.startAutoSync(() => get().position);
      }

      // Initialize and start background sync service
      await backgroundSyncService.init();
      backgroundSyncService.start();

      // Log chapters and duration sources
      if (chapters.length > 0) {
        logChapters(chapters);
      }
      logDurationSources({
        metadata: book.media?.duration,
        session: totalDuration,
        finalDuration: totalDuration,
      });

      // Update state with chapters/duration before loading audio
      log('Setting initial state:');
      log('  Resume position:', resumePosition.toFixed(1) + 's');
      log('  Total duration:', totalDuration.toFixed(1) + 's');
      log('  Chapters:', chapters.length);
      log('  Is offline:', isOffline);

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
      log('Metadata for lock screen:', { title, author, coverUrl: coverUrl?.substring(0, 50) + '...' });

      // CRITICAL: Set up status callback BEFORE loading audio
      // This ensures we capture all playback state changes during loading
      audioService.setStatusUpdateCallback((state) => {
        get().updatePlaybackState(state);
      });

      // Load audio with metadata
      timing('Before loadAudio');

      if (audioTrackInfos.length > 0) {
        // Multi-file book - load all tracks into queue
        await audioService.loadTracks(
          audioTrackInfos,
          resumePosition,
          {
            title,
            artist: author,
            artwork: coverUrl,
          },
          autoPlay
        );
      } else {
        // Single-file book - load single track
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
      }
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
      timing('Audio loaded');
      if (autoPlay) {
        set({ isLoading: false, isBuffering: true, isPlaying: true });
        logSection('LOAD BOOK SUCCESS');
        log('Playback started');
      } else {
        set({ isLoading: false, isBuffering: false, isPlaying: false });
        logSection('LOAD BOOK SUCCESS');
        log('Book loaded (paused)');
      }

    } catch (error: any) {
      if (thisLoadId === currentLoadId) {
        logSection('LOAD BOOK FAILED');
        logError('Error:', error.message);
        logError('Stack:', error.stack);
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
    const { currentBook, duration: storeDuration, isLoading, isPlaying: wasPlaying, position: prevPosition } = get();

    // For display/UI, prefer track duration if available, but fallback to store duration
    const displayDuration = state.duration > 0 ? state.duration : storeDuration;

    // For "book finished" detection, ALWAYS use storeDuration (total book duration from session)
    // state.duration from TrackPlayer can be unreliable for streams (may report segment duration)
    const totalBookDuration = storeDuration > 0 ? storeDuration : state.duration;

    // Log significant state changes (every 10 seconds or state transitions)
    const positionDiff = Math.abs(state.position - prevPosition);
    const shouldLogPosition = Math.floor(state.position) % 10 === 0 && positionDiff >= 1;
    const stateChanged = state.isPlaying !== wasPlaying || state.isBuffering !== get().isBuffering;

    if (stateChanged) {
      audioLog.state(
        wasPlaying ? 'playing' : 'paused',
        state.isPlaying ? 'playing' : 'paused',
        state.isBuffering ? 'buffering' : undefined
      );
    }

    if (shouldLogPosition && state.isPlaying) {
      audioLog.progress(
        `Position: ${state.position.toFixed(1)}s / ${displayDuration.toFixed(1)}s (${((state.position / displayDuration) * 100).toFixed(1)}%)`
      );
    }

    // Don't update isPlaying while loading
    if (isLoading) {
      set({
        position: state.position,
        duration: displayDuration,
        isBuffering: state.isBuffering,
      });
      return;
    }

    // Don't flip from playing to not-playing due to buffering
    const newIsPlaying = state.isBuffering ? wasPlaying : state.isPlaying;

    set({
      isPlaying: newIsPlaying,
      position: state.position,
      duration: displayDuration,
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
        totalBookDuration,
        session?.id
      ).catch(() => {});
    }

    // Handle track finished (didJustFinish from audioService)
    // This fires when TrackPlayer reports State.Ended
    // For streaming audiobooks, this may fire at end of buffer/segment, not end of book
    if (state.didJustFinish && !isHandlingTrackFinish) {
      const timeSinceLastAdvance = now - lastChapterAdvanceTime;

      if (timeSinceLastAdvance < CHAPTER_ADVANCE_COOLDOWN) {
        log('Ignoring didJustFinish - cooldown active (' + timeSinceLastAdvance + 'ms since last)');
        return;
      }

      isHandlingTrackFinish = true;
      const endPosition = state.position;

      logSection('TRACK FINISHED EVENT');
      log('Position at finish:', endPosition.toFixed(1) + 's');
      log('Total book duration:', totalBookDuration.toFixed(1) + 's');
      log('Distance from end:', (totalBookDuration - endPosition).toFixed(1) + 's');

      // Check if this is truly the end of the book
      // Use totalBookDuration (from session) NOT track duration
      // Position must be within 5 seconds of total book duration
      const isNearEnd = totalBookDuration > 0 && endPosition >= totalBookDuration - 5;

      if (isNearEnd) {
        log('BOOK FINISHED - reached end of audio');
        set({ isPlaying: false });

        if (currentBook) {
          const session = sessionService.getCurrentSession();
          log('Saving final progress for book:', currentBook.id);
          backgroundSyncService.saveProgress(
            currentBook.id,
            state.position,
            totalBookDuration,
            session?.id
          ).catch(() => {});

          const metadata = currentBook.media?.metadata as any;
          if (metadata) {
            log('Adding to read history');
            sqliteCache.addToReadHistory({
              itemId: currentBook.id,
              title: metadata.title || 'Unknown Title',
              authorName: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
              narratorName: metadata.narratorName || metadata.narrators?.[0]?.name,
              genres: metadata.genres || [],
            }).catch(() => {});
          }
        }
      } else {
        // Not at end of book - this is likely end of a stream segment
        // The stream should continue automatically, just log it
        log('NOT at book end - this may be a stream segment end');
        log('Expected: finish near ' + totalBookDuration.toFixed(1) + 's, actual: ' + endPosition.toFixed(1) + 's');
      }

      isHandlingTrackFinish = false;
    }
  },

  cleanup: async () => {
    const { currentBook, position, duration, sleepTimerInterval } = get();

    // Reset track finish guards
    isHandlingTrackFinish = false;
    lastChapterAdvanceTime = 0;

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