/**
 * src/features/player/stores/playerStore.ts
 *
 * Refactored player store with single source of truth for playback state.
 * Key improvement: Seeking mode that blocks position updates from audioService.
 *
 * Architecture:
 * - playerStore owns ALL playback state
 * - audioService is a dumb service that just plays audio
 * - PlayerScreen reads from store and dispatches actions
 * - Position updates are blocked during seeking operations
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Alert } from 'react-native';
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

// Import constants
import { REWIND_STEP, REWIND_INTERVAL, FF_STEP } from '../constants';

const DEBUG = __DEV__;
const log = (msg: string, ...args: any[]) => audioLog.store(msg, ...args);
const logError = (msg: string, ...args: any[]) => audioLog.error(msg, ...args);

// =============================================================================
// TYPES
// =============================================================================

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

export type SeekDirection = 'backward' | 'forward';

interface PlayerState {
  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------
  currentBook: LibraryItem | null;  // The book whose audio is loaded/playing
  viewingBook: LibraryItem | null;  // The book shown in PlayerScreen (can differ from currentBook)
  viewingChapters: Chapter[];       // Chapters for the viewing book
  chapters: Chapter[];              // Chapters for the playing book

  // ---------------------------------------------------------------------------
  // Playback State (from audioService)
  // ---------------------------------------------------------------------------
  position: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  playbackRate: number;

  // ---------------------------------------------------------------------------
  // Seeking State (THE KEY IMPROVEMENT)
  // ---------------------------------------------------------------------------
  isSeeking: boolean;
  seekPosition: number;       // Position during seek (UI displays this)
  seekStartPosition: number;  // Where seek started (for delta display)
  seekDirection: SeekDirection | null;

  // ---------------------------------------------------------------------------
  // UI State
  // ---------------------------------------------------------------------------
  isPlayerVisible: boolean;
  isOffline: boolean;

  // ---------------------------------------------------------------------------
  // Last Played Tracking (separate from currentBook which is "opened" book)
  // ---------------------------------------------------------------------------
  lastPlayedBookId: string | null;

  // ---------------------------------------------------------------------------
  // Features
  // ---------------------------------------------------------------------------
  sleepTimer: number | null;
  sleepTimerInterval: NodeJS.Timeout | null;
  bookmarks: Bookmark[];

  // ---------------------------------------------------------------------------
  // Player Settings (persisted)
  // ---------------------------------------------------------------------------
  controlMode: 'rewind' | 'chapter';  // Skip buttons mode: time skip or chapter skip
  progressMode: 'bar' | 'chapters';   // Progress display: full book or chapter-based
}

interface PlayerActions {
  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  loadBook: (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean; showPlayer?: boolean }) => Promise<void>;
  cleanup: () => Promise<void>;

  // ---------------------------------------------------------------------------
  // View Book (open player without stopping playback)
  // ---------------------------------------------------------------------------
  /**
   * Opens PlayerScreen for a book without affecting current playback.
   * The viewed book can be different from the playing book.
   */
  viewBook: (book: LibraryItem) => Promise<void>;

  /**
   * Starts playing the currently viewed book (replaces current playback).
   */
  playViewingBook: () => Promise<void>;

  /**
   * Check if viewing a different book than what's playing.
   */
  isViewingDifferentBook: () => boolean;

  // ---------------------------------------------------------------------------
  // Playback Control
  // ---------------------------------------------------------------------------
  play: () => Promise<void>;
  pause: () => Promise<void>;

  // ---------------------------------------------------------------------------
  // Seeking (THE KEY IMPROVEMENT)
  // ---------------------------------------------------------------------------
  /**
   * Start a seek operation. Blocks position updates from audioService.
   * Call this when user starts dragging slider or presses rewind/ff.
   */
  startSeeking: (direction?: SeekDirection) => void;

  /**
   * Update seek position during drag/hold. Updates seekPosition and
   * sends seek command to audio service.
   */
  updateSeekPosition: (position: number) => Promise<void>;

  /**
   * Finalize seek operation. Commits seekPosition to position and
   * resumes normal audioService updates.
   */
  commitSeek: () => Promise<void>;

  /**
   * Cancel seek without committing. Returns to original position.
   */
  cancelSeek: () => Promise<void>;

  /**
   * Convenience: instant seek (start + update + commit in one call)
   * Use this for tap-to-seek or chapter jumps.
   */
  seekTo: (position: number) => Promise<void>;

  // ---------------------------------------------------------------------------
  // Continuous Seeking (Rewind/FastForward buttons)
  // ---------------------------------------------------------------------------
  /**
   * Start continuous seek in direction. Automatically increments/decrements
   * seekPosition on interval until stopContinuousSeeking is called.
   */
  startContinuousSeeking: (direction: SeekDirection) => Promise<void>;

  /**
   * Stop continuous seek and commit final position.
   */
  stopContinuousSeeking: () => Promise<void>;

  // ---------------------------------------------------------------------------
  // Skip (single step)
  // ---------------------------------------------------------------------------
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;

  // ---------------------------------------------------------------------------
  // Chapter Navigation
  // ---------------------------------------------------------------------------
  jumpToChapter: (chapterIndex: number) => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  getCurrentChapter: () => Chapter | null;

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  setPlaybackRate: (rate: number) => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  setControlMode: (mode: 'rewind' | 'chapter') => void;
  setProgressMode: (mode: 'bar' | 'chapters') => void;
  loadPlayerSettings: () => Promise<void>;

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  togglePlayer: () => void;
  closePlayer: () => void;

  // ---------------------------------------------------------------------------
  // Internal (called by audioService)
  // ---------------------------------------------------------------------------
  updatePlaybackState: (state: PlaybackState) => void;

  // ---------------------------------------------------------------------------
  // Bookmarks
  // ---------------------------------------------------------------------------
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  loadBookmarks: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BOOKMARKS_KEY = 'player_bookmarks';
const PROGRESS_SAVE_INTERVAL = 30000; // Save progress every 30 seconds
const PREV_CHAPTER_THRESHOLD = 3;     // Seconds before going to prev vs restart

// =============================================================================
// MODULE-LEVEL STATE (not exposed to components)
// =============================================================================

let currentLoadId = 0;
let lastProgressSave = 0;
let lastFinishedBookId: string | null = null; // Track which book we've already handled finish for
let seekInterval: NodeJS.Timeout | null = null;
let lastLoadTime = 0;
let lastBookFinishTime = 0;
const LOAD_DEBOUNCE_MS = 300;
const TRANSITION_GUARD_MS = 500; // Prevent queue races during book transitions

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getDownloadPath(bookId: string): Promise<string | null> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const { downloadManager } = await import('@/core/services/downloadManager');

    // Check if book is downloaded
    const isDownloaded = await downloadManager.isDownloaded(bookId);
    if (!isDownloaded) {
      log('Book not downloaded');
      return null;
    }

    const localPath = downloadManager.getLocalPath(bookId);
    // downloadManager stores files in a directory, check for any audio files
    const dirInfo = await FileSystem.getInfoAsync(localPath);
    if (dirInfo.exists && dirInfo.isDirectory) {
      log('Found offline directory via downloadManager');
      // Update last played timestamp
      await downloadManager.updateLastPlayed(bookId);
      return localPath;
    }

    log('Download directory not found or invalid');
    return null;
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

// =============================================================================
// STORE
// =============================================================================

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  subscribeWithSelector((set, get) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    // Content
    currentBook: null,
    viewingBook: null,
    viewingChapters: [],
    chapters: [],

    // Playback
    position: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    isBuffering: false,
    playbackRate: 1.0,

    // Seeking (NEW)
    isSeeking: false,
    seekPosition: 0,
    seekStartPosition: 0,
    seekDirection: null,

    // UI
    isPlayerVisible: false,
    isOffline: false,

    // Last played tracking
    lastPlayedBookId: null,

    // Features
    sleepTimer: null,
    sleepTimerInterval: null,
    bookmarks: [],

    // Player settings (persisted)
    controlMode: 'rewind',
    progressMode: 'bar',

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    loadBook: async (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean; showPlayer?: boolean }) => {
      const { startPosition, autoPlay = true, showPlayer = true } = options || {};
      const { currentBook, position: prevPosition, isLoading } = get();

      // Debounce rapid load requests (prevent double-taps)
      const now = Date.now();
      if (now - lastLoadTime < LOAD_DEBOUNCE_MS && currentBook?.id !== book.id) {
        log('Debouncing rapid load request, ignoring');
        return;
      }
      lastLoadTime = now;

      // If already loading a different book, cancel the old load and stop any playback
      if (isLoading) {
        log('Cancelling previous load, unloading audio');
        await audioService.unloadAudio();
      }

      // Increment load ID to invalidate any in-progress loads
      const thisLoadId = ++currentLoadId;
      const timing = createTimer('loadBook');

      // Reset track finish guard for new book
      if (currentBook?.id !== book.id) {
        lastFinishedBookId = null;
      }

      logSection('LOAD BOOK START');
      log('Book ID:', book.id);
      log('Title:', book.media?.metadata?.title);
      timing('Start');

      // Same book already loaded?
      if (currentBook?.id === book.id && audioService.getIsLoaded()) {
        log('Same book already loaded');
        if (showPlayer) {
          set({ isPlayerVisible: true });
        }
        if (autoPlay && !get().isPlaying) {
          await get().play();
        }
        return;
      }

      // Set new book immediately (also sync viewingBook)
      set({
        isLoading: true,
        isPlayerVisible: showPlayer,
        currentBook: book,
        viewingBook: book,  // Sync viewing book when loading
        isPlaying: false,
        isBuffering: true,
        // Reset seeking state
        isSeeking: false,
        seekPosition: 0,
        seekStartPosition: 0,
        seekDirection: null,
      });
      timing('State set');

      try {
        // Save progress for previous book
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

        // OPTIMIZATION: Run download check and session start in PARALLEL
        // This saves ~500ms by not waiting for download check before starting session
        timing('Before parallel fetch');
        const [localPath, session] = await Promise.all([
          getDownloadPath(book.id),
          sessionService.startSession(book.id).catch((err) => {
            // Session may fail if offline - that's OK
            log('Session start failed (may be offline):', err.message);
            return null;
          }),
        ]);
        timing('After parallel fetch');

        if (thisLoadId !== currentLoadId) return;

        const isOffline = !!localPath;
        let streamUrl: string = '';
        let chapters: Chapter[] = [];
        let resumePosition = startPosition ?? 0;
        let totalDuration = getBookDuration(book);
        let audioTrackInfos: AudioTrackInfo[] = [];

        if (isOffline && localPath) {
          // OFFLINE PLAYBACK - use local files
          chapters = extractChaptersFromBook(book);
          log('OFFLINE PLAYBACK MODE');

          // Check if localPath is a directory (multi-file) or single file
          const FileSystem = await import('expo-file-system/legacy');
          const pathInfo = await FileSystem.getInfoAsync(localPath);

          if (pathInfo.isDirectory) {
            // Multi-file audiobook - enumerate audio files in directory
            log('OFFLINE MULTI-FILE AUDIOBOOK');
            const dirContents = await FileSystem.readDirectoryAsync(localPath);
            const audioExtensions = ['.m4b', '.m4a', '.mp3', '.mp4', '.opus', '.ogg', '.flac', '.aac'];
            const audioFileNames = dirContents
              .filter(name => audioExtensions.some(ext => name.toLowerCase().endsWith(ext)))
              .sort(); // Files are named 000_, 001_, etc. so sorting works

            if (audioFileNames.length === 0) {
              throw new Error('No audio files found in downloaded directory');
            }

            // Build track infos from downloaded files and book metadata
            const bookAudioFiles = (book.media as any)?.audioFiles || [];
            let currentOffset = 0;

            audioTrackInfos = audioFileNames.map((fileName, index) => {
              const filePath = `${localPath}${fileName}`;
              // Try to match with book metadata for duration info
              const bookFile = bookAudioFiles[index];
              const duration = bookFile?.duration || 0;
              const trackInfo = {
                url: filePath,
                title: bookFile?.metadata?.filename || fileName,
                startOffset: currentOffset,
                duration: duration,
              };
              currentOffset += duration;
              return trackInfo;
            });

            logTracks(audioTrackInfos);
            totalDuration = currentOffset > 0 ? currentOffset : getBookDuration(book);
          } else {
            // Single file audiobook
            log('OFFLINE SINGLE-FILE AUDIOBOOK');
            streamUrl = localPath;
            validateUrl(localPath, 'Offline path');
          }

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
        } else if (session) {
          // ONLINE PLAYBACK - use session data
          log('ONLINE PLAYBACK MODE');

          log('Session response:');
          log('  Session ID:', session.id);
          log('  Audio tracks:', session.audioTracks?.length);
          log('  Chapters:', session.chapters?.length);
          log('  Duration:', session.duration);
          log('  Current time (resume):', session.currentTime);

          chapters = mapSessionChapters(session.chapters || []);
          if (session.duration > 0) totalDuration = session.duration;

          logPositionSources({
            session: session.currentTime,
            finalPosition: !startPosition && session.currentTime > 0 ? session.currentTime : startPosition ?? 0,
          });

          if (!startPosition && session.currentTime > 0) resumePosition = session.currentTime;

          // Build track info for multi-file audiobooks
          const audioTracks = session.audioTracks || [];
          if (audioTracks.length > 1) {
            log('MULTI-FILE AUDIOBOOK');
            const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');
            const token = apiClient.getAuthToken();

            // Log token status for debugging (don't log the actual token for security)
            if (!token) {
              logError('WARNING: No auth token available for audio streaming!');
            } else {
              log('Auth token present, length:', token.length);
            }

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
            logTracks(audioTrackInfos);
          } else {
            log('SINGLE-FILE AUDIOBOOK');
            const url = sessionService.getStreamUrl();
            if (!url) {
              logError('No stream URL returned from session!');
              throw new Error('No stream URL');
            }
            streamUrl = url;
            validateUrl(streamUrl, 'Stream URL');
          }

          sessionService.startAutoSync(() => get().position);
        } else {
          // Neither offline nor session available
          throw new Error('Cannot play: no local file and session failed');
        }

        // Initialize and start background sync service (NON-BLOCKING)
        backgroundSyncService.init().then(() => backgroundSyncService.start()).catch(() => {});

        // Log chapters and duration sources
        if (chapters.length > 0) {
          logChapters(chapters);
        }
        logDurationSources({
          metadata: book.media?.duration,
          session: totalDuration,
          finalDuration: totalDuration,
        });

        // Update state with chapters/duration
        log('Setting initial state:');
        log('  Resume position:', resumePosition.toFixed(1) + 's');
        log('  Total duration:', totalDuration.toFixed(1) + 's');
        log('  Chapters:', chapters.length);
        log('  Is offline:', isOffline);

        set({
          chapters,
          viewingChapters: chapters,  // Sync viewing chapters
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

        // Set up status callback BEFORE loading audio
        audioService.setStatusUpdateCallback((state) => {
          get().updatePlaybackState(state);
        });

        // Load audio
        timing('Before loadAudio');

        if (audioTrackInfos.length > 0) {
          // Pass known duration to skip duration calculation
          await audioService.loadTracks(
            audioTrackInfos,
            resumePosition,
            { title, artist: author, artwork: coverUrl },
            autoPlay,
            totalDuration > 0 ? totalDuration : undefined
          );
        } else {
          // Pass known duration to skip waiting for duration detection
          await audioService.loadAudio(
            streamUrl,
            resumePosition,
            { title, artist: author, artwork: coverUrl },
            autoPlay,
            totalDuration > 0 ? totalDuration : undefined
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

        // Load bookmarks in BACKGROUND
        get().loadBookmarks().catch(() => {});

        // Set final state
        timing('Audio loaded');
        if (autoPlay) {
          set({
            isLoading: false,
            isBuffering: true,
            isPlaying: true,
            lastPlayedBookId: book.id,  // Track that this book was actually played
          });
          logSection('LOAD BOOK SUCCESS');
          log('Playback started');
        } else {
          set({ isLoading: false, isBuffering: false, isPlaying: false });
          logSection('LOAD BOOK SUCCESS');
          log('Book loaded (paused)');
        }

        // Check if we should auto-add next series book to queue
        // Only do this when actually PLAYING (not just viewing a book)
        if (autoPlay) {
          (async () => {
            try {
              const { useQueueStore } = await import('@/features/queue/stores/queueStore');
              const queueStore = useQueueStore.getState();

              // Ensure queue is initialized
              if (!queueStore.isInitialized) {
                console.log('[PlayerStore] Initializing queue store...');
                await queueStore.init();
              }

              // Skip series check if a book just finished (prevents race condition)
              const timeSinceLastFinish = Date.now() - lastBookFinishTime;
              const shouldCheckSeries = timeSinceLastFinish > TRANSITION_GUARD_MS && queueStore.autoplayEnabled;

              console.log('[PlayerStore] Checking series book, autoplay:', queueStore.autoplayEnabled, 'timeSinceFinish:', timeSinceLastFinish);
              if (shouldCheckSeries) {
                await queueStore.checkAndAddSeriesBook(book);
              } else if (timeSinceLastFinish <= TRANSITION_GUARD_MS) {
                console.log('[PlayerStore] Skipping series check - book just finished, avoiding race');
              }
            } catch (err) {
              console.error('[PlayerStore] Queue series check error:', err);
            }
          })();
        }

      } catch (error: any) {
        if (thisLoadId === currentLoadId) {
          logSection('LOAD BOOK FAILED');
          logError('Error:', error.message);
          logError('Stack:', error.stack);
          set({ isLoading: false, isBuffering: false });

          // Show user-friendly error
          Alert.alert(
            'Playback Error',
            'Could not load this book. Please check your connection and try again.',
            [{ text: 'OK' }]
          );
        }
        // Don't re-throw - handle gracefully
      }
    },

    cleanup: async () => {
      const { currentBook, position, duration, sleepTimerInterval } = get();

      // Reset guards
      lastFinishedBookId = null;

      // Clear seeking interval
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }

      // Clear sleep timer
      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
      }

      // Save final progress
      if (currentBook && position > 0) {
        const session = sessionService.getCurrentSession();
        await backgroundSyncService.saveProgress(
          currentBook.id,
          position,
          duration,
          session?.id
        );
      }

      // Force sync all pending progress
      await backgroundSyncService.forceSyncAll();

      // Close session
      await sessionService.closeSession(position);

      // Release audio
      await audioService.unloadAudio();

      set({
        currentBook: null,
        viewingBook: null,
        viewingChapters: [],
        chapters: [],
        isPlaying: false,
        position: 0,
        duration: 0,
        isPlayerVisible: false,
        sleepTimer: null,
        sleepTimerInterval: null,
        bookmarks: [],
        // Reset seeking state
        isSeeking: false,
        seekPosition: 0,
        seekStartPosition: 0,
        seekDirection: null,
      });
    },

    // =========================================================================
    // VIEW BOOK (open player without stopping playback)
    // =========================================================================

    viewBook: async (book: LibraryItem) => {
      log('viewBook:', book.id, book.media?.metadata?.title);

      // Extract chapters from the book for viewing
      const viewingChapters = extractChaptersFromBook(book);

      // Set viewing book and open player
      set({
        viewingBook: book,
        viewingChapters,
        isPlayerVisible: true,
      });

      // If no book is currently playing, also set as current book (without loading audio)
      const { currentBook } = get();
      if (!currentBook) {
        set({ currentBook: book, chapters: viewingChapters });
      }
    },

    playViewingBook: async () => {
      const { viewingBook } = get();
      if (!viewingBook) {
        logError('playViewingBook: no viewing book');
        return;
      }

      log('playViewingBook:', viewingBook.id);

      // Load the viewing book as the playing book with autoPlay
      await get().loadBook(viewingBook, { autoPlay: true, showPlayer: true });
    },

    isViewingDifferentBook: () => {
      const { currentBook, viewingBook } = get();
      if (!viewingBook || !currentBook) return false;
      return viewingBook.id !== currentBook.id;
    },

    // =========================================================================
    // PLAYBACK CONTROL
    // =========================================================================

    play: async () => {
      if (!audioService.getIsLoaded()) {
        // Silently ignore - this can happen during app startup when iOS
        // tries to resume playback before audio is loaded
        return;
      }
      await audioService.play();
      const { currentBook } = get();
      set({
        isPlaying: true,
        lastPlayedBookId: currentBook?.id || null,
      });
    },

    pause: async () => {
      await audioService.pause();
      set({ isPlaying: false });

      const { currentBook, position, duration } = get();
      if (!currentBook) return;

      // Sync progress on pause
      const session = sessionService.getCurrentSession();
      backgroundSyncService.saveProgress(
        currentBook.id,
        position,
        duration,
        session?.id
      ).catch(() => {});
    },

    // =========================================================================
    // SEEKING - THE CORE FIX
    // =========================================================================

    startSeeking: (direction?: SeekDirection) => {
      const { position } = get();
      log(`startSeeking: position=${position.toFixed(1)}, direction=${direction || 'none'}`);
      set({
        isSeeking: true,
        seekPosition: position,
        seekStartPosition: position,
        seekDirection: direction || null,
      });
    },

    updateSeekPosition: async (newPosition: number) => {
      const { duration, isSeeking } = get();

      if (!isSeeking) {
        log('updateSeekPosition called but not seeking - calling startSeeking first');
        get().startSeeking();
      }

      const clampedPosition = Math.max(0, Math.min(duration, newPosition));
      set({ seekPosition: clampedPosition });

      // Send seek command to audio service
      await audioService.seekTo(clampedPosition);
    },

    commitSeek: async () => {
      const { seekPosition, isSeeking } = get();

      if (!isSeeking) {
        log('commitSeek called but not seeking - ignoring');
        return;
      }

      log(`commitSeek: finalPosition=${seekPosition.toFixed(1)}`);

      // Ensure audio is at final position
      await audioService.seekTo(seekPosition);

      // Exit seeking mode and commit position
      set({
        isSeeking: false,
        position: seekPosition,
        seekDirection: null,
      });
    },

    cancelSeek: async () => {
      const { seekStartPosition, isSeeking } = get();

      if (!isSeeking) {
        log('cancelSeek called but not seeking - ignoring');
        return;
      }

      log(`cancelSeek: returning to ${seekStartPosition.toFixed(1)}`);

      // Return to original position
      await audioService.seekTo(seekStartPosition);

      set({
        isSeeking: false,
        seekPosition: seekStartPosition,
        seekDirection: null,
      });
    },

    seekTo: async (position: number) => {
      const { duration } = get();
      const clampedPosition = Math.max(0, Math.min(duration, position));

      log(`seekTo: ${clampedPosition.toFixed(1)}`);

      // Brief seeking state for instant seek
      set({ isSeeking: true });
      await audioService.seekTo(clampedPosition);
      set({
        isSeeking: false,
        position: clampedPosition,
      });
    },

    // =========================================================================
    // CONTINUOUS SEEKING (Rewind/FF Buttons)
    // =========================================================================

    startContinuousSeeking: async (direction: SeekDirection) => {
      const { position, duration, isPlaying, pause } = get();

      log(`startContinuousSeeking: direction=${direction}, position=${position.toFixed(1)}`);

      // Clear any existing interval
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }

      // Pause playback during continuous seek
      if (isPlaying) {
        await pause();
      }

      // Enter seeking mode
      set({
        isSeeking: true,
        seekPosition: position,
        seekStartPosition: position,
        seekDirection: direction,
      });

      const step = direction === 'backward' ? -REWIND_STEP : FF_STEP;

      // Immediate first step
      const firstNewPosition = Math.max(0, Math.min(duration, position + step));
      set({ seekPosition: firstNewPosition });
      await audioService.seekTo(firstNewPosition);

      // Start interval
      seekInterval = setInterval(async () => {
        const state = get();

        if (!state.isSeeking) {
          // Seeking was stopped externally
          if (seekInterval) {
            clearInterval(seekInterval);
            seekInterval = null;
          }
          return;
        }

        const newPosition = Math.max(0, Math.min(state.duration, state.seekPosition + step));

        // Stop at boundaries
        if ((direction === 'backward' && newPosition <= 0) ||
            (direction === 'forward' && newPosition >= state.duration)) {
          set({ seekPosition: newPosition });
          await audioService.seekTo(newPosition);
          await get().stopContinuousSeeking();
          return;
        }

        set({ seekPosition: newPosition });
        await audioService.seekTo(newPosition);
      }, REWIND_INTERVAL);
    },

    stopContinuousSeeking: async () => {
      log('stopContinuousSeeking');

      // Clear interval
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }

      // Commit final position
      await get().commitSeek();
    },

    // =========================================================================
    // SKIP (single step)
    // =========================================================================

    skipForward: async (seconds = 30) => {
      const { position, duration } = get();
      const newPosition = Math.min(position + seconds, duration);
      await get().seekTo(newPosition);
    },

    skipBackward: async (seconds = 30) => {
      const { position } = get();
      const newPosition = Math.max(position - seconds, 0);
      await get().seekTo(newPosition);
    },

    // =========================================================================
    // CHAPTER NAVIGATION
    // =========================================================================

    jumpToChapter: async (chapterIndex: number) => {
      const { chapters } = get();
      if (chapterIndex >= 0 && chapterIndex < chapters.length) {
        const chapter = chapters[chapterIndex];
        await get().seekTo(chapter.start);
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

      // If more than THRESHOLD seconds into chapter, go to start of current
      // Otherwise, go to previous chapter
      if (currentChapter && position - currentChapter.start > PREV_CHAPTER_THRESHOLD) {
        await get().jumpToChapter(currentIndex);
      } else if (currentIndex > 0) {
        await get().jumpToChapter(currentIndex - 1);
      } else {
        // At start of first chapter, just go to 0
        await get().seekTo(0);
      }
    },

    getCurrentChapter: () => {
      const { chapters, position, isSeeking, seekPosition } = get();
      const effectivePosition = isSeeking ? seekPosition : position;
      const index = findChapterIndex(chapters, effectivePosition);
      return chapters[index] || null;
    },

    // =========================================================================
    // SETTINGS
    // =========================================================================

    setPlaybackRate: async (rate: number) => {
      await audioService.setPlaybackRate(rate);
      set({ playbackRate: rate });

      try {
        await AsyncStorage.setItem('playbackRate', rate.toString());
      } catch {}
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

    setControlMode: (mode: 'rewind' | 'chapter') => {
      set({ controlMode: mode });
      AsyncStorage.setItem('playerControlMode', mode).catch(() => {});
    },

    setProgressMode: (mode: 'bar' | 'chapters') => {
      set({ progressMode: mode });
      AsyncStorage.setItem('playerProgressMode', mode).catch(() => {});
    },

    loadPlayerSettings: async () => {
      try {
        const [controlMode, progressMode, playbackRate] = await Promise.all([
          AsyncStorage.getItem('playerControlMode'),
          AsyncStorage.getItem('playerProgressMode'),
          AsyncStorage.getItem('playbackRate'),
        ]);

        set({
          controlMode: (controlMode as 'rewind' | 'chapter') || 'rewind',
          progressMode: (progressMode as 'bar' | 'chapters') || 'bar',
          playbackRate: playbackRate ? parseFloat(playbackRate) : 1.0,
        });
      } catch {
        // Use defaults
      }
    },

    // =========================================================================
    // UI
    // =========================================================================

    togglePlayer: () => {
      set((state) => ({ isPlayerVisible: !state.isPlayerVisible }));
    },

    closePlayer: () => {
      set({ isPlayerVisible: false });
    },

    // =========================================================================
    // INTERNAL: PLAYBACK STATE UPDATES FROM AUDIO SERVICE
    // =========================================================================

    updatePlaybackState: (state: PlaybackState) => {
      const {
        currentBook,
        duration: storeDuration,
        isLoading,
        isPlaying: wasPlaying,
        position: prevPosition,
        isSeeking,  // THE KEY: Check if we're seeking
      } = get();

      // CRITICAL: Never let audio service's track duration overwrite the total book duration
      // storeDuration is set during loadBook and represents the FULL book duration
      // state.duration is just the current track's duration (can be much smaller)
      const totalBookDuration = storeDuration > 0 ? storeDuration : state.duration;
      // Only update store duration if audio service reports a LARGER value (shouldn't happen normally)
      const shouldUpdateDuration = state.duration > storeDuration;
      const displayDuration = totalBookDuration;

      // Log significant state changes
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

      // =====================================================================
      // CRITICAL: Don't update position while seeking
      // This is the key fix for the rewind/chapter jump bug
      // =====================================================================
      if (isSeeking) {
        // Only update non-position state
        if (!isLoading) {
          const newIsPlaying = state.isBuffering ? wasPlaying : state.isPlaying;
          set({
            isPlaying: newIsPlaying,
            ...(shouldUpdateDuration && { duration: displayDuration }),
            isBuffering: state.isBuffering,
            // DO NOT update position - we're seeking
          });
        } else {
          set({
            ...(shouldUpdateDuration && { duration: displayDuration }),
            isBuffering: state.isBuffering,
          });
        }
        return;
      }

      // Normal update (not seeking)
      if (isLoading) {
        set({
          position: state.position,
          ...(shouldUpdateDuration && { duration: displayDuration }),
          isBuffering: state.isBuffering,
        });
        return;
      }

      // Don't flip from playing to not-playing due to buffering
      const newIsPlaying = state.isBuffering ? wasPlaying : state.isPlaying;

      set({
        isPlaying: newIsPlaying,
        position: state.position,
        ...(shouldUpdateDuration && { duration: displayDuration }),
        isBuffering: state.isBuffering,
      });

      // Periodic progress save
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

      // Handle track finished - only once per book
      const alreadyHandledFinish = currentBook && lastFinishedBookId === currentBook.id;
      if (state.didJustFinish && !alreadyHandledFinish) {
        const endPosition = state.position;

        logSection('TRACK FINISHED EVENT');
        log('Position at finish:', endPosition.toFixed(1) + 's');
        log('Total book duration:', totalBookDuration.toFixed(1) + 's');

        const isNearEnd = totalBookDuration > 0 && endPosition >= totalBookDuration - 5;

        if (isNearEnd && currentBook) {
          // Mark this book as finished to prevent duplicate handling
          lastFinishedBookId = currentBook.id;
          lastBookFinishTime = Date.now();

          log('BOOK FINISHED - reached end of audio');
          set({ isPlaying: false });

          const session = sessionService.getCurrentSession();
          backgroundSyncService.saveProgress(
            currentBook.id,
            state.position,
            totalBookDuration,
            session?.id
          ).catch(() => {});

          const metadata = currentBook.media?.metadata as any;
          if (metadata) {
            sqliteCache.addToReadHistory({
              itemId: currentBook.id,
              title: metadata.title || 'Unknown Title',
              authorName: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
              narratorName: metadata.narratorName || metadata.narrators?.[0]?.name,
              genres: metadata.genres || [],
            }).catch(() => {});
          }

          // Check queue for next book (late import to avoid circular dependency)
          (async () => {
            try {
              const { useQueueStore } = await import('@/features/queue/stores/queueStore');
              const queueStore = useQueueStore.getState();
              if (queueStore.queue.length > 0) {
                log('Queue has items - playing next book');
                const nextBook = await queueStore.playNext();
                if (nextBook) {
                  log('Loading next book from queue:', nextBook.id);
                  get().loadBook(nextBook, { autoPlay: true, showPlayer: false });
                }
              }
            } catch (err) {
              log('Queue check failed:', err);
            }
          })();
        } else if (!isNearEnd) {
          log('NOT at book end - this may be a stream segment end');
        }
      }
    },

    // =========================================================================
    // BOOKMARKS
    // =========================================================================

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
  }))
);

// =============================================================================
// SELECTORS (for derived state)
// =============================================================================

/**
 * Returns the position to display in UI.
 * Uses seekPosition during seeking, otherwise uses position.
 */
export const useDisplayPosition = () =>
  usePlayerStore((s) => s.isSeeking ? s.seekPosition : s.position);

/**
 * Returns the seek delta (difference from start position during seek).
 * Returns 0 when not seeking.
 */
export const useSeekDelta = () =>
  usePlayerStore((s) => s.isSeeking ? s.seekPosition - s.seekStartPosition : 0);

/**
 * Returns the current chapter index based on display position.
 */
export const useCurrentChapterIndex = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    return findChapterIndex(s.chapters, position);
  });

/**
 * Returns the current chapter based on display position.
 */
export const useCurrentChapter = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    const index = findChapterIndex(s.chapters, position);
    return s.chapters[index] || null;
  });

/**
 * Returns the progress within the current chapter (0-1).
 */
export const useChapterProgress = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    const index = findChapterIndex(s.chapters, position);
    const chapter = s.chapters[index];

    if (!chapter) return 0;

    const chapterDuration = chapter.end - chapter.start;
    if (chapterDuration <= 0) return 0;

    return Math.max(0, Math.min(1, (position - chapter.start) / chapterDuration));
  });

/**
 * Returns the overall book progress (0-1).
 */
export const useBookProgress = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    return s.duration > 0 ? position / s.duration : 0;
  });

/**
 * Returns whether the user is currently seeking (for UI state).
 */
export const useIsSeeking = () =>
  usePlayerStore((s) => s.isSeeking);

/**
 * Returns the seek direction if seeking, null otherwise.
 */
export const useSeekDirection = () =>
  usePlayerStore((s) => s.seekDirection);

/**
 * Returns true if viewing a different book than what's playing.
 */
export const useIsViewingDifferentBook = () =>
  usePlayerStore((s) => {
    if (!s.viewingBook || !s.currentBook) return false;
    return s.viewingBook.id !== s.currentBook.id;
  });

/**
 * Returns the viewing book (shown in PlayerScreen).
 */
export const useViewingBook = () =>
  usePlayerStore((s) => s.viewingBook);

/**
 * Returns the playing book (audio loaded).
 */
export const usePlayingBook = () =>
  usePlayerStore((s) => s.currentBook);
