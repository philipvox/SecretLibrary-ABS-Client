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
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { apiClient } from '@/core/api';
import { sessionService, SessionChapter, AudioTrack, PlaybackSession } from '../services/sessionService';
import { chapterCacheService } from '../services/chapterCacheService';
import { progressService } from '../services/progressService';
import { backgroundSyncService } from '../services/backgroundSyncService';
import { sqliteCache } from '@/core/services/sqliteCache';
import { playbackCache } from '@/core/services/playbackCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import audioService directly (not from barrel) to avoid circular dependency
import { audioService, PlaybackState, AudioTrackInfo, AudioError } from '@/features/player/services/audioService';

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
import { getErrorMessage } from '@/shared/utils/errorUtils';

// Import smart rewind utility
import { calculateSmartRewindSeconds } from '../utils/smartRewindCalculator';

// Import position utilities
import { clampPosition } from '../utils/progressCalculator';

// Import centralized logger for structured logging
import { playerLogger } from '@/shared/utils/logger';

// Import position resolver for cross-device sync
import {
  resolvePosition,
  createLocalSource,
  createServerSource,
} from '../utils/positionResolver';

// Import tick cache for pre-generating timeline ticks
import { generateAndCacheTicks, ChapterInput } from '../services/tickCache';

// Import tracking for timeout analytics
import { trackEvent } from '@/core/monitoring';

// Import constants
// REWIND_STEP, REWIND_INTERVAL, FF_STEP moved to seekingStore (Phase 7)
import { isAudioFile } from '@/constants/audio';

// Import haptics for sleep timer feedback
import { haptics } from '@/core/native/haptics';

// Import event bus for cross-store communication
import { eventBus } from '@/core/events';

// Import extracted utilities (Phase 1 refactor)
import {
  persistSmartRewindState,
  restoreSmartRewindState,
  clearSmartRewindState,
  getChapterStartForPosition,
  markSmartRewindApplied,
} from '../utils/smartRewind';
import {
  startListeningSession,
  endListeningSession,
  hasActiveSession,
} from '../utils/listeningSession';
import {
  setupDownloadCompletionListener,
  cleanupDownloadCompletionListener,
  PlayerStateSnapshot,
} from '../utils/downloadListener';
import {
  mapSessionChapters,
  extractChaptersFromBook,
  findChapterIndex,
  getBookDuration,
  getDownloadPath,
  checkAutoDownloadNextInSeries,
} from '../utils/bookLoadingHelpers';

// Import settings store (Phase 2 refactor)
import { usePlayerSettingsStore } from './playerSettingsStore';

// Import bookmarks store (Phase 3 refactor)
import { useBookmarksStore, type Bookmark } from './bookmarksStore';

// Import sleep timer store (Phase 4 refactor)
import { useSleepTimerStore } from './sleepTimerStore';

// Import speed store (Phase 5 refactor)
import { useSpeedStore } from './speedStore';

// Import completion sheet store (Phase 6 refactor, renamed Phase 2 audit)
import { useCompletionSheetStore } from './completionSheetStore';

// Import seeking store (Phase 7 refactor)
import { useSeekingStore, type SeekDirection as SeekDirectionImport } from './seekingStore';

// Import transition progress for continuous mini→full player animation
import { playerTransitionProgress, SPRING_CONFIG } from './playerTransition';
import { withSpring, withTiming } from 'react-native-reanimated';

const DEBUG = __DEV__;
const log = (msg: string, ...args: unknown[]) => audioLog.store(msg, ...args);
const logError = (msg: string, ...args: unknown[]) => audioLog.error(msg, ...args);

// =============================================================================
// TYPE GUARDS
// =============================================================================

function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media && !('episodes' in media);
}

function getBookMetadata(item: LibraryItem | null | undefined): BookMetadata | null {
  if (!item?.media?.metadata) return null;
  if (item.mediaType !== 'book') return null;
  return item.media.metadata as BookMetadata;
}

// =============================================================================
// TYPES
// =============================================================================

// Chapter type is defined in ../types.ts to avoid circular dependencies
// Re-exported here for backwards compatibility
export { Chapter } from '../types';

// Bookmark type re-exported from bookmarksStore (single source of truth)
export type { Bookmark };

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

  // ---------------------------------------------------------------------------
  // UI State
  // ---------------------------------------------------------------------------
  isPlayerVisible: boolean;
  isOffline: boolean;
  playbackError: string | null;  // Error message to show in UI (null = no error)

  // ---------------------------------------------------------------------------
  // Last Played Tracking (separate from currentBook which is "opened" book)
  // ---------------------------------------------------------------------------
  lastPlayedBookId: string | null;

  // ---------------------------------------------------------------------------
  // NOTE: Features moved to dedicated stores (Phase 10 refactor):
  //   sleepTimer/shake → sleepTimerStore
  //   bookmarks → bookmarksStore
  //   speed/bookSpeedMap → speedStore
  //   settings (controlMode, progressMode, skipIntervals, appearance) → playerSettingsStore
  //   completion → completionStore
  //   seeking → seekingStore
  // ---------------------------------------------------------------------------
}

interface PlayerActions {
  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  loadBook: (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean; showPlayer?: boolean }) => Promise<void>;
  cleanup: () => Promise<void>;

  /**
   * Preload book state without starting audio playback.
   * Used during app startup to show correct progress on UI before user hits play.
   * Sets currentBook, position, duration, and chapters from cached data.
   */
  preloadBookState: (book: LibraryItem) => Promise<void>;

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
  setGlobalDefaultRate: (rate: number) => Promise<void>;
  getBookSpeed: (bookId: string) => number;
  setSleepTimer: (minutes: number) => void;
  extendSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  setShakeToExtendEnabled: (enabled: boolean) => Promise<void>;
  setSkipForwardInterval: (seconds: number) => Promise<void>;
  setSkipBackInterval: (seconds: number) => Promise<void>;
  setControlMode: (mode: 'rewind' | 'chapter') => void;
  setProgressMode: (mode: 'bar' | 'chapters') => void;
  setDiscAnimationEnabled: (enabled: boolean) => Promise<void>;
  setUseStandardPlayer: (enabled: boolean) => Promise<void>;
  setSmartRewindEnabled: (enabled: boolean) => Promise<void>;
  setSmartRewindMaxSeconds: (seconds: number) => Promise<void>;
  clearSmartRewind: () => void;  // Clear smart rewind state (call when scrubbing starts)
  loadPlayerSettings: () => Promise<void>;

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  togglePlayer: () => void;
  closePlayer: () => void;
  setPlayerVisible: (visible: boolean) => void;
  clearPlaybackError: () => void;
  handleAudioError: (error: AudioError) => Promise<void>;

  // ---------------------------------------------------------------------------
  // Internal (called by audioService)
  // ---------------------------------------------------------------------------
  updatePlaybackState: (state: PlaybackState) => void;

  // ---------------------------------------------------------------------------
  // Bookmarks
  // ---------------------------------------------------------------------------
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => Promise<void>;
  updateBookmark: (bookmarkId: string, updates: { title?: string; note?: string | null }) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  loadBookmarks: () => Promise<void>;

  // ---------------------------------------------------------------------------
  // Book Completion
  // ---------------------------------------------------------------------------
  setShowCompletionPrompt: (enabled: boolean) => Promise<void>;
  setAutoMarkFinished: (enabled: boolean) => Promise<void>;
  markBookFinished: (bookId?: string) => Promise<void>;
  dismissCompletionSheet: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BOOK_SPEED_MAP_KEY = 'playerBookSpeedMap';
const GLOBAL_DEFAULT_RATE_KEY = 'playerGlobalDefaultRate';
const SHAKE_TO_EXTEND_KEY = 'playerShakeToExtend';
const SKIP_FORWARD_INTERVAL_KEY = 'playerSkipForwardInterval';
const SKIP_BACK_INTERVAL_KEY = 'playerSkipBackInterval';
const DISC_ANIMATION_KEY = 'playerDiscAnimation';
const STANDARD_PLAYER_KEY = 'playerStandardMode';
const LAST_PLAYED_BOOK_ID_KEY = 'playerLastPlayedBookId';
const ACTIVE_PLAYBACK_RATE_KEY = 'playerActivePlaybackRate';
const SMART_REWIND_PAUSE_TIMESTAMP_KEY = 'smartRewindPauseTimestamp';
const SMART_REWIND_PAUSE_BOOK_ID_KEY = 'smartRewindPauseBookId';
const SMART_REWIND_PAUSE_POSITION_KEY = 'smartRewindPausePosition';
// SHOW_COMPLETION_PROMPT_KEY and AUTO_MARK_FINISHED_KEY moved to completionStore (Phase 6)
const PROGRESS_SAVE_INTERVAL = 5000; // Save progress every 5 seconds (SQLite only, no UI updates)
const MIN_PAUSE_FOR_REWIND_MS = 3000; // Minimum pause before smart rewind applies
const PREV_CHAPTER_THRESHOLD = 3;     // Seconds before going to prev vs restart
const SLEEP_TIMER_SHAKE_THRESHOLD = 60; // Start shake detection when < 60 seconds remaining
const SLEEP_TIMER_EXTEND_MINUTES = 15;  // Add 15 minutes on shake
const AUTO_DOWNLOAD_THRESHOLD = 0.8;  // Trigger auto-download at 80% progress

// =============================================================================
// MODULE-LEVEL STATE (not exposed to components)
// =============================================================================

let currentLoadId = 0;
let lastProgressSave = 0;
let lastFinishedBookId: string | null = null; // Track which book we've already handled finish for
// seekInterval moved to seekingStore (Phase 7)

// Track when seek was last committed to prevent stale position updates
// NOTE: With Option C architecture, audioService owns position.
// We no longer need settling period or commit time tracking since
// audioService.lastKnownGoodPosition is the single source of truth.
let lastLoadTime = 0;
let lastBookFinishTime = 0;
const LOAD_DEBOUNCE_MS = 300;
const TRANSITION_GUARD_MS = 500; // Prevent queue races during book transitions

// Track books we've already checked for auto-download to prevent repeated triggers
const autoDownloadCheckedBooks = new Set<string>();

// Fix Bug #1: Track stuck detection timeouts to prevent memory leaks and stale closures
// These are cleared on pause, cleanup, and loadBook to prevent orphaned callbacks
let stuckDetectionTimeout: NodeJS.Timeout | null = null;
let stuckRecoveryTimeout: NodeJS.Timeout | null = null;

/**
 * Clear stuck detection timeouts to prevent memory leaks
 * Called on pause, cleanup, and before starting new playback
 */
function clearStuckDetectionTimeouts(): void {
  if (stuckDetectionTimeout) {
    clearTimeout(stuckDetectionTimeout);
    stuckDetectionTimeout = null;
  }
  if (stuckRecoveryTimeout) {
    clearTimeout(stuckRecoveryTimeout);
    stuckRecoveryTimeout = null;
  }
}

// NOTE: Smart rewind state moved to ../utils/smartRewind.ts
// NOTE: Download listener state moved to ../utils/downloadListener.ts

// =============================================================================
// NOTE: The following functions have been extracted to utility files (Phase 1):
//   - Smart rewind: ../utils/smartRewind.ts
//   - Listening session: ../utils/listeningSession.ts
//   - Download listener: ../utils/downloadListener.ts
//   - Book loading helpers: ../utils/bookLoadingHelpers.ts
// =============================================================================

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

    // UI
    isPlayerVisible: false,
    isOffline: false,
    playbackError: null,

    // Last played tracking
    lastPlayedBookId: null,

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    loadBook: async (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean; showPlayer?: boolean }) => {
      const { startPosition, autoPlay = true, showPlayer = true } = options || {};
      const { currentBook, position: prevPosition, isLoading, isPlaying } = get();

      // Fix Bug #1: Clear stuck detection timeouts from previous playback
      clearStuckDetectionTimeouts();
      // Clear auto-download tracking for this session (allows re-check on replay)
      autoDownloadCheckedBooks.delete(book.id);

      // DEBUG: Log entry point and call stack
      const debugTs = Date.now();
      log(`[LOAD ${debugTs}] Starting load for: ${book.media?.metadata?.title}`);
      log(`[LOAD ${debugTs}] Previous book: ${currentBook?.media?.metadata?.title || 'none'}`);
      log(`[LOAD ${debugTs}] State: isLoading=${isLoading}, isPlaying=${isPlaying}`);
      if (__DEV__) {
        playerLogger.debug(`[LOAD ${debugTs}] Call stack:`, new Error().stack?.split('\n').slice(1, 6).join('\n'));
      }

      // CRITICAL FIX: Prevent double-loading the same book
      // If we're already loading this exact book, don't start another load
      // This prevents race conditions where clicking "Stream" multiple times
      // or slow sync data arriving triggers multiple concurrent audio loads
      if (isLoading && currentBook?.id === book.id) {
        log(`[LOAD ${debugTs}] Already loading this book, ignoring duplicate request`);
        return;
      }

      // Debounce rapid load requests (prevent double-taps)
      // Apply to BOTH same book and different book - any rapid taps should be debounced
      const now = Date.now();
      if (now - lastLoadTime < LOAD_DEBOUNCE_MS) {
        log(`[LOAD ${debugTs}] Debouncing rapid load request (${now - lastLoadTime}ms since last), ignoring`);
        return;
      }
      lastLoadTime = now;

      // CRITICAL FIX: Check if same book is already loaded BEFORE unloading audio
      // This check must happen before unloadAudio(), otherwise the audioService.getIsLoaded()
      // check would always be false since we just unloaded it.
      // Only reload same book if explicit startPosition is provided (e.g., "Play from Beginning")
      const isSameBookAlreadyLoaded = currentBook?.id === book.id && audioService.getIsLoaded();
      if (isSameBookAlreadyLoaded && startPosition === undefined) {
        log(`[LOAD ${debugTs}] Same book already loaded and playing, resuming without reload`);
        if (showPlayer) {
          set({ isPlayerVisible: true });
          playerTransitionProgress.value = withSpring(1, SPRING_CONFIG);
        }
        if (autoPlay && !get().isPlaying) {
          await get().play();
        }
        return;
      }

      // CRITICAL FIX: Always stop existing audio before loading new audio
      // Previously only called unloadAudio if isLoading was true, but this missed
      // the case where audio was playing (isLoading=false, isPlaying=true)
      if (isLoading || isPlaying || audioService.getIsLoaded()) {
        log(`[LOAD] Stopping existing audio before new load`);
        await audioService.unloadAudio();
      }

      // Increment load ID to invalidate any in-progress loads
      const loadId = ++currentLoadId;
      const timing = createTimer('loadBook');

      // Reset track finish guard for new book
      if (currentBook?.id !== book.id) {
        lastFinishedBookId = null;
      }

      logSection('LOAD BOOK START');
      log('Book ID:', book.id);
      log('Title:', book.media?.metadata?.title);
      timing('Start');

      // Try to get saved position early for immediate display
      // This prevents showing stale position from previous book
      let earlyPosition = startPosition ?? 0;
      if (!startPosition) {
        try {
          // Quick local progress lookup - non-blocking, use cached if available
          const localProgress = await progressService.getLocalProgress(book.id);
          if (localProgress > 0) {
            earlyPosition = localProgress;
            log('Early position from local progress:', earlyPosition.toFixed(1));
          }
        } catch {
          // Ignore - will get position later from session
        }
      }

      // Reset seeking state first (Phase 7)
      useSeekingStore.getState().resetSeekingState();

      // Set new book immediately with early position (also sync viewingBook)
      set({
        isLoading: true,
        isPlayerVisible: showPlayer,
        currentBook: book,
        viewingBook: book,  // Sync viewing book when loading
        isPlaying: false,
        isBuffering: true,
        // Set position early to avoid jarring jump from stale/0 to resume position
        position: earlyPosition,
      });
      // Animate transition when showing player
      if (showPlayer) {
        playerTransitionProgress.value = withSpring(1, SPRING_CONFIG);
      }
      // Reset seeking state in seekingStore (single source of truth)
      useSeekingStore.getState().resetSeekingState();
      timing('State set');

      try {
        // Save progress for previous book and end listening session
        if (currentBook && currentBook.id !== book.id && prevPosition > 0) {
          // End listening session for previous book
          await endListeningSession(prevPosition);

          const session = sessionService.getCurrentSession();
          backgroundSyncService.saveProgress(
            currentBook.id,
            prevPosition,
            get().duration,
            session?.id
          ).catch((err) => {
            audioLog.warn('[Player] Save progress failed:', err);
          });
        }

        if (loadId !== currentLoadId) return;

        // =======================================================================
        // OPTIMIZED LOADING PIPELINE
        // Priority: Check local files FIRST, don't block on network
        // =======================================================================
        timing('Before local check');

        // Step 1: Check for local download (FAST - ~10ms)
        const localPath = await getDownloadPath(book.id);
        timing('After local check');

        if (loadId !== currentLoadId) return;

        const isOffline = !!localPath;
        let streamUrl: string = '';
        let chapters: Chapter[] = [];
        let resumePosition = startPosition ?? 0;
        let totalDuration = getBookDuration(book);
        let audioTrackInfos: AudioTrackInfo[] = [];

        // Load bookmarks early (non-blocking) - ready when user needs them
        useBookmarksStore.getState().loadBookmarks(book.id).catch((err) => {
          audioLog.warn('[Player] Load bookmarks failed:', err);
        });

        if (isOffline && localPath) {
          // =================================================================
          // OFFLINE PLAYBACK - FAST PATH (no network blocking!)
          // FIX 2: Race session against 2s timeout to avoid jarring seek
          // =================================================================
          cleanupDownloadCompletionListener();

          // Use chapter cache fallback hierarchy: session -> SQLite cache -> metadata
          const chapterResult = await chapterCacheService.getChaptersWithFallback(book, null);
          chapters = chapterResult.chapters;

          // Log chapter source for debugging
          playerLogger.debug('Chapters loaded for playback', {
            bookId: book.id,
            source: chapterResult.source,
            chapterCount: chapters.length,
            mode: 'offline',
          });

          log('OFFLINE PLAYBACK MODE (fast path)');
          timing('Offline mode start');

          // Check for cached session first (pre-fetched during app startup)
          const cachedSession = playbackCache.getSession(book.id);

          // Start audio setup and get local progress in parallel (instant from memory cache)
          const setupPromise = playbackCache.isAudioInitialized()
            ? Promise.resolve() // Audio already initialized
            : audioService.ensureSetup();
          const localDataPromise = progressService.getProgressData(book.id);

          // NOTE: sessionResult can be either a full PlaybackSession from the server
          // or a CachedSession from playbackCache (which has fewer properties)
          let sessionResult: PlaybackSession | typeof cachedSession | null = null;

          if (cachedSession) {
            // INSTANT: Use cached session (no network call needed!)
            log('Using cached session (instant playback)');
            sessionResult = cachedSession;

            // Get local data while "session" is already available
            const [, localData] = await Promise.all([setupPromise, localDataPromise]);

            // Start auto sync in background
            sessionService.startAutoSync(() => get().position);

            // Use local position (more recent than cached session)
            if (!startPosition && localData && localData.currentTime > 0) {
              resumePosition = localData.currentTime;
              log(`Using local progress: ${resumePosition.toFixed(1)}s`);
            }
          } else {
            // FIX 2: Race session request against 2-second timeout
            // This gives us a chance to get server position WITHOUT blocking playback
            // If timeout, we continue with local progress and connect session in background
            const SESSION_TIMEOUT_MS = 2000;
            const sessionPromise = sessionService.startSession(book.id).catch((err) => {
              log('Session request failed:', err.message);
              return null;
            });
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), SESSION_TIMEOUT_MS)
            );

            // Race session against timeout while also getting local data
            const [raceResult, localData] = await Promise.all([
              Promise.race([sessionPromise, timeoutPromise]),
              localDataPromise,
              setupPromise,
            ]);

            sessionResult = raceResult;

            if (sessionResult) {
              log('Session arrived before timeout - using timestamp-based resolution');
              sessionService.startAutoSync(() => get().position);

              // FIX 3: Use position resolver for cross-device sync
              const serverPosition = sessionResult.currentTime || 0;
              // FIX: If server doesn't provide timestamp, use 0 (not Date.now()) to avoid
              // falsely making server position appear newest. Missing timestamp = unknown age.
              const serverTimestamp = sessionResult.updatedAt || 0;
              if (!sessionResult.updatedAt) {
                playerLogger.warn('[SESSION_TIMESTAMP] Server returned no updatedAt timestamp - using 0 to avoid false priority');
              }

              const localSource = localData
                ? createLocalSource(localData.currentTime, localData.updatedAt || 0)
                : null;
              const serverSource = serverPosition > 0
                ? createServerSource(serverPosition, serverTimestamp)
                : null;

              const resolution = resolvePosition(localSource, serverSource);
              log(`Position resolved: ${resolution.position.toFixed(1)}s (${resolution.reason})`);

              if (!startPosition && resolution.position > 0) {
                resumePosition = resolution.position;
              }
            } else {
              // FIX 2: Enhanced timeout logging for tuning
              const timeoutStartTime = Date.now();
              audioLog.warn(`Session timed out after ${SESSION_TIMEOUT_MS}ms - using local progress`);
              trackEvent('session_timeout', {
                timeout_ms: SESSION_TIMEOUT_MS,
                local_position: localData?.currentTime || 0,
                book_id: book.id,
              }, 'info');

              // Use local progress
              if (!startPosition && localData && localData.currentTime > 0) {
                resumePosition = localData.currentTime;
                log(`Using local progress: ${resumePosition.toFixed(1)}s`);
              }

              // Continue session connection in background for sync only - NO SEEKING after playback starts
              sessionPromise.then((session) => {
                if (session) {
                  // FIX: Check if user has switched books before starting auto-sync
                  // This prevents orphaned sessions from syncing to the wrong book
                  const currentBookId = get().currentBook?.id;
                  if (currentBookId !== book.id) {
                    log(`Background session arrived but user switched books (${book.id} -> ${currentBookId}), closing orphaned session`);
                    sessionService.closeSessionAsync();
                    return;
                  }

                  const actualWaitTime = Date.now() - timeoutStartTime + SESSION_TIMEOUT_MS;
                  log(`Background session connected after ${actualWaitTime}ms total (sync only, no position change)`);
                  log(`Server position was: ${session.currentTime?.toFixed(1)}s, we used: ${resumePosition.toFixed(1)}s`);
                  sessionService.startAutoSync(() => get().position);
                  // Note: We do NOT seek here - that would cause jarring UX
                  // The position was already resolved before playback started
                }
              }).catch(() => {});
            }
          } // End of else block (no cached session)

          // Check if localPath is a directory (multi-file) or single file
          const FileSystem = await import('expo-file-system/legacy');
          const pathInfo = await FileSystem.getInfoAsync(localPath);

          if (pathInfo.isDirectory) {
            // Multi-file audiobook - enumerate audio files in directory
            log('OFFLINE MULTI-FILE AUDIOBOOK');
            const dirContents = await FileSystem.readDirectoryAsync(localPath);
            const audioFileNames = dirContents
              .filter(isAudioFile)
              .sort(); // Files are named 000_, 001_, etc. so sorting works

            if (audioFileNames.length === 0) {
              throw new Error('No audio files found in downloaded directory');
            }

            // Build track infos from downloaded files and book metadata
            // Priority for duration/offset: cached session tracks > book.media.audioFiles
            const bookAudioFiles = isBookMedia(book.media) ? book.media.audioFiles || [] : [];
            const sessionTracks = cachedSession?.audioTracks || [];
            let currentOffset = 0;

            // Log available metadata sources for debugging
            log(`Track metadata: sessionTracks=${sessionTracks.length}, bookAudioFiles=${bookAudioFiles.length}, files=${audioFileNames.length}`);

            audioTrackInfos = audioFileNames.map((fileName, index) => {
              const filePath = `${localPath}${fileName}`;
              // Try to match with cached session tracks first (have accurate duration/offset)
              // Then fall back to book.media.audioFiles
              const sessionTrack = sessionTracks[index];
              const bookFile = bookAudioFiles[index];

              // Use session track duration if available (most reliable for downloaded books)
              const duration = sessionTrack?.duration || bookFile?.duration || 0;
              // Use session track offset if available, otherwise calculate
              const startOffset = sessionTrack?.startOffset ?? currentOffset;

              const trackInfo = {
                url: filePath,
                title: bookFile?.metadata?.filename || sessionTrack?.title || fileName,
                startOffset: startOffset,
                duration: duration,
              };
              currentOffset = startOffset + duration; // Update for next track
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

          // Ensure audio is ready (local progress was already fetched above)
          await setupPromise;
          timing('Offline data ready');
        } else {
          // =================================================================
          // ONLINE PLAYBACK - Need session for streaming URLs
          // =================================================================
          log('ONLINE PLAYBACK MODE');
          timing('Starting session request');

          // Check for cached session first (pre-fetched during app startup)
          let cachedSession = playbackCache.getSession(book.id);

          // NOTE: session can be either a full PlaybackSession from the server
          // or a CachedSession from playbackCache (which has fewer properties)
          let session: PlaybackSession | typeof cachedSession | null;

          let sessionSource: 'cached' | 'fresh' = 'fresh';
          if (cachedSession) {
            // INSTANT: Use cached session (no network call needed!)
            log('Using cached session for streaming (instant)');
            session = cachedSession;
            sessionSource = 'cached';

            // CRITICAL FIX: Adopt the cached session into sessionService so
            // getStreamUrl(), syncProgress(), and auto-sync all work correctly.
            // Without this, sessionService.currentSession is null and single-file
            // books fail with "Could not get stream URL".
            sessionService.adoptSession(cachedSession as PlaybackSession);

            // Ensure audio is ready
            if (!playbackCache.isAudioInitialized()) {
              await audioService.ensureSetup();
            }

            // Start auto sync in background
            sessionService.startAutoSync(() => get().position);
          } else {
            // Start audio setup in parallel with session request
            const [fetchedSession] = await Promise.all([
              sessionService.startSession(book.id).catch((err) => {
                log('Session start failed:', err.message);
                return null;
              }),
              audioService.ensureSetup(),
            ]);
            session = fetchedSession;

            // Retry once if initial session failed (cold server, transient error)
            if (!session) {
              log('Session failed on first attempt, retrying after 1s...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              session = await sessionService.startSession(book.id).catch((err) => {
                log('Session retry also failed:', err.message);
                return null;
              });
            }
            sessionSource = 'fresh';
          }
          timing('Session + setup complete');

          if (!session) {
            throw new Error('Cannot play: no local file and session failed');
          }

          log('Session response:');
          log('  Session ID:', session.id);
          log('  Audio tracks:', session.audioTracks?.length);
          log('  Chapters:', session.chapters?.length);
          log('  Duration:', session.duration);
          log('  Current time (resume):', session.currentTime);

          // Use chapter cache fallback hierarchy: session -> SQLite cache -> metadata
          const chapterResult = await chapterCacheService.getChaptersWithFallback(
            book,
            session.chapters
          );
          chapters = chapterResult.chapters;

          // Log chapter source for debugging
          playerLogger.debug('Chapters loaded for playback', {
            bookId: book.id,
            source: chapterResult.source,
            chapterCount: chapters.length,
            mode: 'streaming',
          });

          // FIX: Get duration from session, or calculate from audioTracks if session.duration is 0
          if (session.duration > 0) {
            totalDuration = session.duration;
          } else if (session.audioTracks?.length) {
            // Calculate total duration from individual track durations
            const trackDuration = session.audioTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
            if (trackDuration > 0) {
              totalDuration = trackDuration;
              log('Duration calculated from audioTracks:', totalDuration.toFixed(1) + 's');
            }
          }

          // FIX 3: Use timestamp-based position resolution for cross-device sync
          // This respects intentional rewinds instead of always using Math.max()
          if (!startPosition) {
            const localData = await progressService.getProgressData(book.id);
            const serverPosition = session.currentTime || 0;
            // FIX: If server doesn't provide timestamp, use 0 (not Date.now()) to avoid
            // falsely making server position appear newest. Missing timestamp = unknown age.
            const serverTimestamp = session.updatedAt || 0;
            if (!session.updatedAt) {
              playerLogger.warn('[SESSION_TIMESTAMP] Server returned no updatedAt timestamp - using 0 to avoid false priority');
            }

            const localSource = localData
              ? createLocalSource(localData.currentTime, localData.updatedAt || 0)
              : null;
            const serverSource = serverPosition > 0
              ? createServerSource(serverPosition, serverTimestamp)
              : null;

            const resolution = resolvePosition(localSource, serverSource);

            logPositionSources({
              session: serverPosition,
              localProgress: localData?.currentTime || 0,
              finalPosition: resolution.position,
            });

            if (resolution.position > 0) {
              resumePosition = resolution.position;
            }

            if (resolution.isConflict) {
              log('Position conflict detected - using', resolution.source, 'position');
            }
          }

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

            audioTrackInfos = audioTracks.map((track: AudioTrack) => {
              // Check if this is a direct file URL that needs /stream endpoint
              // Pattern: /api/items/{item_id}/file/{file_ino}
              let contentUrl = track.contentUrl;
              const fileUrlPattern = /^\/api\/items\/[^/]+\/file\/\d+/;
              if (fileUrlPattern.test(contentUrl)) {
                // Append /stream for moov-at-end M4B support
                const [path, query] = contentUrl.split('?');
                contentUrl = `${path}/stream${query ? '?' + query : ''}`;
              }

              let trackUrl = `${baseUrl}${contentUrl}`;
              if (!contentUrl.includes('token=')) {
                const separator = contentUrl.includes('?') ? '&' : '?';
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
            let url = sessionService.getStreamUrl();

            // Fallback: if sessionService has no session but we have audioTracks
            // on the local session variable, build the URL directly
            if (!url && session?.audioTracks?.length) {
              log('getStreamUrl() returned null — building URL from session audioTracks directly');
              const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');
              const token = apiClient.getAuthToken() || '';
              const track = session.audioTracks[0];
              let contentUrl = track.contentUrl;

              // Append /stream for moov-at-end M4B support
              const fileUrlPattern = /^\/api\/items\/[^/]+\/file\/\d+/;
              if (fileUrlPattern.test(contentUrl)) {
                const [path, query] = contentUrl.split('?');
                contentUrl = `${path}/stream${query ? '?' + query : ''}`;
              }

              if (contentUrl.includes('token=')) {
                url = `${baseUrl}${contentUrl}`;
              } else {
                const separator = contentUrl.includes('?') ? '&' : '?';
                url = `${baseUrl}${contentUrl}${separator}token=${token}`;
              }
              log('Fallback stream URL built successfully');
            }

            if (!url) {
              const currentSession = sessionService.getCurrentSession();
              logError('No stream URL returned from session!');
              logError('Session audio tracks (sessionService):', currentSession?.audioTracks?.length || 0);
              logError('Session audio tracks (local):', session?.audioTracks?.length || 0);
              logError('Book ID:', book.id);
              logError('Session source:', sessionSource);
              const errorMsg = (session?.audioTracks?.length || 0) === 0
                ? 'This book has no audio files. Check the server.'
                : 'Could not get stream URL from server.';
              throw new Error(errorMsg);
            }
            streamUrl = url;
            validateUrl(streamUrl, 'Stream URL');
          }

          sessionService.startAutoSync(() => get().position);

          // Set up listener to detect when this book's download completes
          // so we can seamlessly switch to local playback
          setupDownloadCompletionListener(
            book.id,
            () => ({
              currentBook: get().currentBook,
              position: get().position,
              isPlaying: get().isPlaying,
              isLoading: get().isLoading,
              isPlayerVisible: get().isPlayerVisible,
            }),
            get().loadBook,
            audioService,
            log,
            logError
          );
        }

        // Initialize and start background sync service (NON-BLOCKING)
        backgroundSyncService.init().then(() => backgroundSyncService.start()).catch((err) => {
          audioLog.error('[Player] Background sync init failed:', err);
        });

        // Log chapters and duration sources
        if (chapters.length > 0) {
          logChapters(chapters);
        }
        logDurationSources({
          metadata: book.media?.duration,
          session: totalDuration,
          finalDuration: totalDuration,
        });

        // SAFEGUARD: Clamp position to prevent loading at or near end of book
        // If position is within 5 seconds of duration, rewind proportionally:
        // - Long books (>60s): rewind 30s from end
        // - Short books: rewind 10% of duration (so a 30s book goes to 27s, not 0)
        if (totalDuration > 0 && resumePosition >= totalDuration - 5) {
          const rewindAmount = Math.min(30, totalDuration * 0.1);
          const clampedPosition = Math.max(0, totalDuration - rewindAmount);
          log(`[POSITION_CLAMP] Position ${resumePosition.toFixed(1)}s is near end (${totalDuration.toFixed(1)}s), clamping to ${clampedPosition.toFixed(1)}s`);
          resumePosition = clampedPosition;
        }

        // SMART REWIND: Apply rewind during loadBook so it works on app restart
        // and when iOS evicts audio from memory. Previously, smart rewind only
        // ran in play() which is never reached when loadBook handles autoPlay.
        if (autoPlay && !startPosition && resumePosition > 0) {
          const { smartRewindEnabled, smartRewindMaxSeconds } = usePlayerSettingsStore.getState();
          if (smartRewindEnabled) {
            try {
              const { timestamp: srTimestamp, position: srPausePosition } = await restoreSmartRewindState(book.id, log);
              if (srTimestamp) {
                const pauseDuration = Date.now() - srTimestamp;
                if (pauseDuration >= MIN_PAUSE_FOR_REWIND_MS) {
                  const rewindSeconds = calculateSmartRewindSeconds(pauseDuration, smartRewindMaxSeconds);
                  if (rewindSeconds > 0) {
                    const basePosition = srPausePosition ?? resumePosition;
                    const chapterStart = getChapterStartForPosition(chapters, basePosition);
                    const rewoundPosition = Math.max(chapterStart, basePosition - rewindSeconds);
                    if (basePosition - rewoundPosition >= 0.5) {
                      log(`[SmartRewind] Pause: ${Math.round(pauseDuration / 1000)}s → Rewind: ${rewindSeconds}s (${basePosition.toFixed(1)}s → ${rewoundPosition.toFixed(1)}s)`);
                      resumePosition = rewoundPosition;
                    }
                  }
                }
              }
              // Mark as applied and clear state so play() doesn't double-apply
              markSmartRewindApplied(book.id);
              clearSmartRewindState().catch(() => {});
            } catch (err) {
              log('[SmartRewind] Error in loadBook:', err);
            }
          }
        }

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

        // Pre-generate timeline ticks in background so they're ready when player opens
        // This prevents the "jump" when ticks load after the timeline renders
        if (chapters.length > 0 && totalDuration > 0) {
          const chapterInputs: ChapterInput[] = chapters.map(ch => ({
            start: ch.start,
            end: ch.end,
            displayTitle: ch.title,
          }));
          generateAndCacheTicks(book.id, totalDuration, chapterInputs, true).catch(() => {});
          log('Pre-generating timeline ticks for:', book.id);

          // Cache chapters to SQLite for future fallback (fire and forget)
          chapterCacheService.cacheChapters(book.id, chapters).catch(() => {});
        }

        if (loadId !== currentLoadId) return;

        // Get metadata for lock screen
        const metadata = getBookMetadata(book);
        const title = metadata?.title || 'Audiobook';
        const author = metadata?.authorName ||
                       metadata?.authors?.[0]?.name ||
                       'Unknown Author';
        const coverUrl = apiClient.getItemCoverUrl(book.id);

        // Set up status callback BEFORE loading audio
        audioService.setStatusUpdateCallback((state) => {
          get().updatePlaybackState(state);
        });

        // Set up error callback for session refresh on URL expiration
        audioService.setErrorCallback((error: AudioError) => {
          get().handleAudioError(error);
        });

        // Set current book ID for error reporting
        audioService.setCurrentBookId(book.id);

        // Set up remote command callback for media control delegation
        audioService.setRemoteCommandCallback((command) => {
          if (command === 'nextChapter') {
            get().nextChapter();
          } else if (command === 'prevChapter') {
            get().prevChapter();
          } else if (command === 'skipForward') {
            get().skipForward();
          } else if (command === 'skipBackward') {
            get().skipBackward();
          }
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

        if (loadId !== currentLoadId) {
          log('Load cancelled after audio load');
          return;
        }

        // Apply per-book playback rate (delegated to speedStore - single source of truth)
        const bookSpeed = await useSpeedStore.getState().applyBookSpeed(book.id);
        log('Applied playback rate for book:', bookSpeed);

        // Set final state
        timing('Audio loaded');
        if (autoPlay) {
          set({
            isLoading: false,
            isBuffering: true,
            isPlaying: true,
            lastPlayedBookId: book.id,  // Track that this book was actually played
          });

          // Persist lastPlayedBookId for app restart recovery
          AsyncStorage.setItem(LAST_PLAYED_BOOK_ID_KEY, book.id).catch(() => {});

          // Start listening session tracking for autoplay
          startListeningSession(book, resumePosition);

          logSection('LOAD BOOK SUCCESS');
          log('Playback started');

          // Emit book started event
          const bookMetadata = getBookMetadata(book);
          eventBus.emit('book:started', {
            bookId: book.id,
            title: bookMetadata?.title || 'Unknown',
            seriesId: bookMetadata?.series?.[0]?.id,
            resumePosition,
          });
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
                playerLogger.debug('Initializing queue store...');
                await queueStore.init();
              }

              // Skip series check if a book just finished (prevents race condition)
              const timeSinceLastFinish = Date.now() - lastBookFinishTime;
              const shouldCheckSeries = timeSinceLastFinish > TRANSITION_GUARD_MS && queueStore.autoplayEnabled;

              playerLogger.debug('Checking series book, autoplay:', queueStore.autoplayEnabled, 'timeSinceFinish:', timeSinceLastFinish);
              if (shouldCheckSeries) {
                await queueStore.checkAndAddSeriesBook(book);
              } else if (timeSinceLastFinish <= TRANSITION_GUARD_MS) {
                playerLogger.debug('Skipping series check - book just finished, avoiding race');
              }
            } catch (err) {
              playerLogger.error('Queue series check error:', err);
            }
          })();
        }

      } catch (error) {
        if (loadId === currentLoadId) {
          logSection('LOAD BOOK FAILED');
          const errMsg = getErrorMessage(error);
          logError('Error:', errMsg);
          logError('Stack:', (error instanceof Error ? error.stack : undefined));

          // CRITICAL: Preserve chapters on error - try to recover from cache/metadata
          const currentChapters = get().chapters;
          let preservedChapters = currentChapters;

          if (!currentChapters.length && book) {
            // Log recovery attempt
            playerLogger.info('Attempting chapter recovery after error', {
              bookId: book.id,
              bookTitle: (book.media?.metadata as any)?.title || 'Unknown',
            });

            // Try to recover chapters from cache/metadata fallback
            try {
              const chapterResult = await chapterCacheService.getChaptersWithFallback(book, null);

              if (chapterResult.chapters.length > 0) {
                preservedChapters = chapterResult.chapters;
                // Log successful recovery
                playerLogger.info('Chapters recovered successfully', {
                  bookId: book.id,
                  source: chapterResult.source,
                  chapterCount: preservedChapters.length,
                });
              } else {
                // Log recovery yielded no chapters
                playerLogger.warn('Chapter recovery returned no chapters', {
                  bookId: book.id,
                });
              }
            } catch (recoveryError) {
              // Log recovery failure
              playerLogger.warn('Chapter recovery failed', {
                bookId: book.id,
                error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
              });
            }
          }

          // Reset seeking state on error to prevent UI being stuck
          useSeekingStore.getState().resetSeekingState();

          set({
            isLoading: false,
            isBuffering: false,
            // Preserve chapters on error to prevent disappearance
            chapters: preservedChapters,
            viewingChapters: preservedChapters,
          });

          // Show user-friendly error with specific message
          // Include actual error for debugging Android-specific issues
          let errorMessage = 'Could not load this book. Please check your connection and try again.';
          if (errMsg.includes('no audio files')) {
            errorMessage = errMsg;
          } else if (errMsg.includes('not found') || errMsg.includes('File not found')) {
            errorMessage = 'Audio file not found. Try re-downloading the book.';
          } else if (errMsg) {
            // Include actual error for debugging
            errorMessage = `Playback error: ${errMsg}`;
          }
          Alert.alert(
            'Playback Error',
            errorMessage,
            [{ text: 'OK' }]
          );
        }
        // Don't re-throw - handle gracefully
      }
    },

    cleanup: async () => {
      const { currentBook, position, duration } = get();

      // Reset guards
      lastFinishedBookId = null;

      // Fix Bug #1: Clear stuck detection timeouts to prevent memory leaks
      clearStuckDetectionTimeouts();

      // Clear download completion listener
      cleanupDownloadCompletionListener();

      // Clear seeking state (Phase 7)
      useSeekingStore.getState().resetSeekingState();

      // Clear sleep timer (Phase 4)
      useSleepTimerStore.getState().clearSleepTimer();

      // End any active listening session
      await endListeningSession(position);

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

      // Stop background sync loop to prevent it from running after cleanup
      backgroundSyncService.stop();

      // Close session
      await sessionService.closeSession(position);

      // Release audio
      await audioService.unloadAudio();

      // Clear bookmarks via bookmarks store (Phase 3)
      useBookmarksStore.getState().clearBookmarks();

      // Reset transition to collapsed
      playerTransitionProgress.value = 0;

      set({
        currentBook: null,
        viewingBook: null,
        viewingChapters: [],
        chapters: [],
        isPlaying: false,
        position: 0,
        duration: 0,
        isPlayerVisible: false,
      });
    },

    // =========================================================================
    // PRELOAD BOOK STATE (for UI display without audio playback)
    // =========================================================================

    preloadBookState: async (book: LibraryItem) => {
      log('preloadBookState:', book.id, book.media?.metadata?.title);

      // Don't overwrite if a book is already playing
      const { isPlaying, currentBook } = get();
      if (isPlaying && currentBook) {
        log('Skipping preload - book already playing');
        return;
      }

      // Get chapters using fallback hierarchy (session -> cache -> metadata)
      // This ensures chapters are available even for downloaded books
      const chapterResult = await chapterCacheService.getChaptersWithFallback(book, null);
      const chapters = chapterResult.chapters;
      log(`preloadBookState chapters: ${chapters.length} from ${chapterResult.source}`);

      const bookDuration = getBookDuration(book);

      // Get progress from cache (instant) or SQLite
      const progressData = await progressService.getProgressData(book.id);
      const position = progressData?.currentTime || 0;
      const duration = progressData?.duration || bookDuration;

      log(`Preloaded state: position=${position.toFixed(1)}s, duration=${duration.toFixed(1)}s`);

      // Set player state without loading audio
      set({
        currentBook: book,
        viewingBook: book,
        viewingChapters: chapters,
        chapters,
        position,
        duration,
        isLoading: false,
        isPlaying: false,
        isPlayerVisible: false, // Don't show player
      });
    },

    // =========================================================================
    // VIEW BOOK (open player without stopping playback)
    // =========================================================================

    viewBook: async (book: LibraryItem) => {
      log('viewBook:', book.id, book.media?.metadata?.title);

      // Get chapters using fallback hierarchy (session -> cache -> metadata)
      const chapterResult = await chapterCacheService.getChaptersWithFallback(book, null);
      const viewingChapters = chapterResult.chapters;
      log(`viewBook chapters: ${viewingChapters.length} from ${chapterResult.source}`);

      // Get duration and progress for display
      const bookDuration = getBookDuration(book);
      const progressData = await progressService.getProgressData(book.id);
      const viewDuration = progressData?.duration || bookDuration;
      const viewPosition = progressData?.currentTime || 0;

      // Always set duration/position for the viewed book so the player UI is correct.
      // If audio is actively playing, the status callback will overwrite these values
      // for the playing book. But when no audio is loaded (just browsing), these ensure
      // the time display shows the viewed book's data instead of 00:00:00.
      const isAudioLoaded = audioService.getIsLoaded();

      // Set viewing book and open player
      set({
        viewingBook: book,
        viewingChapters,
        isPlayerVisible: true,
        // Set duration/position when audio isn't actively loaded
        ...(!isAudioLoaded && {
          duration: viewDuration,
          position: viewPosition,
          chapters: viewingChapters,
        }),
      });
      // Animate transition to expanded
      playerTransitionProgress.value = withSpring(1, SPRING_CONFIG);

      // If no book is currently playing, also set as current book (without loading audio)
      const { currentBook } = get();
      if (!currentBook) {
        set({
          currentBook: book,
          chapters: viewingChapters,
          duration: viewDuration,
          position: viewPosition,
        });
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
      const {
        currentBook,
        viewingBook,
        position,
        chapters,
      } = get();
      const { smartRewindEnabled, smartRewindMaxSeconds } = usePlayerSettingsStore.getState();

      // If audio isn't loaded, we need to load the book first
      if (!audioService.getIsLoaded()) {
        // If we have a book to play, load it
        const bookToPlay = viewingBook || currentBook;
        if (bookToPlay) {
          log('play() called but audio not loaded - loading book first');
          await get().loadBook(bookToPlay, { autoPlay: true });
          return; // loadBook will handle playing
        }
        // No book to load - silently ignore (can happen during iOS startup)
        return;
      }

      // INSTANT: Update UI and start playback immediately
      set({
        isPlaying: true,
        lastPlayedBookId: currentBook?.id || null,
      });

      // Fire play command (don't block on it)
      audioService.play().catch((err) => {
        audioLog.warn('[Player] Play command failed:', err);
      });

      // STUCK DETECTION: Verify audio actually starts playing
      // If after 3 seconds we think we're playing but audio isn't, try to recover
      // Fix Bug #1: Track timeouts to prevent memory leaks when user pauses/changes book
      clearStuckDetectionTimeouts();

      const bookIdAtPlayStart = currentBook?.id; // Capture to detect book changes

      stuckDetectionTimeout = setTimeout(async () => {
        stuckDetectionTimeout = null; // Clear ref since we're executing
        const state = get();

        // Fix Bug #1: Validate state hasn't changed (book changed, paused, or recovery already running)
        if (!state.isPlaying || !state.currentBook || state.currentBook.id !== bookIdAtPlayStart) {
          return;
        }

        // Check if audio is actually playing
        const isAudioPlaying = audioService.getIsPlaying();
        const isBuffering = state.isBuffering;

        if (!isAudioPlaying && !isBuffering) {
          log('[STUCK_DETECTION] Audio stuck - isPlaying=true but audio not playing, attempting recovery');

          // Try to restart playback
          try {
            await audioService.play();

            // If still not playing after 1.5 seconds, hard reset
            // Fix Bug #1: Track this timeout too
            stuckRecoveryTimeout = setTimeout(() => {
              stuckRecoveryTimeout = null; // Clear ref since we're executing
              const newState = get();
              // Fix Bug #1: Re-validate state before hard reset
              if (newState.isPlaying && newState.currentBook?.id === bookIdAtPlayStart &&
                  !audioService.getIsPlaying() && !newState.isBuffering) {
                log('[STUCK_DETECTION] Recovery failed - performing hard reset');
                // Reload the book at current position
                const { currentBook: book, position: pos } = newState;
                if (book) {
                  newState.loadBook(book, {
                    startPosition: pos,
                    autoPlay: true,
                    showPlayer: true,
                  }).catch(() => {});
                }
              }
            }, 1500);
          } catch (err) {
            log('[STUCK_DETECTION] Recovery attempt failed:', err);
          }
        }
      }, 3000);

      // Emit book resumed event
      // Fix HIGH TOCTOU: Re-read position from store to get current value after async operations
      if (currentBook) {
        const currentPosition = get().position;
        eventBus.emit('book:resumed', {
          bookId: currentBook.id,
          position: currentPosition,
        });
      }

      // Persist lastPlayedBookId for app restart recovery (fire and forget)
      if (currentBook) {
        AsyncStorage.setItem(LAST_PLAYED_BOOK_ID_KEY, currentBook.id).catch(() => {});
      }

      // Sync progress on play (fire and forget)
      // This updates server's lastUpdate timestamp so "items-in-progress" reflects current book
      // Fix HIGH TOCTOU: Re-read position from store to get current value
      if (currentBook) {
        const session = sessionService.getCurrentSession();
        const currentPosition = get().position;
        backgroundSyncService.saveProgress(
          currentBook.id,
          currentPosition,
          get().duration,
          session?.id
        ).catch((err) => {
          audioLog.warn('[Player] Sync on play failed:', err);
        });
      }

      // Start listening session tracking
      if (currentBook && !hasActiveSession()) {
        startListeningSession(currentBook, position);
      }

      // Apply smart rewind AFTER playback starts (in background)
      // This ensures instant play response - user hears audio immediately
      const skipSmartRewind = audioService.consumeSkipSmartRewind();
      if (skipSmartRewind) {
        log('[SmartRewind] Skipping - just finished scrubbing');
      }
      if (smartRewindEnabled && currentBook?.id && !skipSmartRewind) {
        // Run smart rewind async - don't block play
        (async () => {
          try {
            const { timestamp, position: pausePosition } = await restoreSmartRewindState(currentBook.id);

            if (timestamp) {
              const pauseDuration = Date.now() - timestamp;

              if (pauseDuration >= MIN_PAUSE_FOR_REWIND_MS) {
                const rewindSeconds = calculateSmartRewindSeconds(pauseDuration, smartRewindMaxSeconds);

                if (rewindSeconds > 0) {
                  const basePosition = pausePosition ?? position;
                  const currentActualPosition = await audioService.getPosition();
                  const positionDelta = Math.abs(basePosition - currentActualPosition);
                  const usePosition = positionDelta > 60 ? currentActualPosition : basePosition;

                  if (positionDelta > 60) {
                    log(`[SmartRewind] Stale position detected: stored=${basePosition.toFixed(1)}s, actual=${currentActualPosition.toFixed(1)}s - using actual`);
                  }

                  const chapterStart = getChapterStartForPosition(chapters, usePosition);
                  const newPosition = Math.max(chapterStart, usePosition - rewindSeconds);

                  // Only apply if meaningful change
                  if (usePosition - newPosition >= 0.5) {
                    log(`[SmartRewind] Pause: ${Math.round(pauseDuration / 1000)}s → Rewind: ${rewindSeconds}s`);
                    // Seek and update position - don't use isSeeking flag as it blocks chapter navigation
                    await audioService.seekTo(newPosition);
                    set({ position: newPosition });
                  }
                }
              }
            }
          } catch (err) {
            log('[SmartRewind] Error applying smart rewind:', err);
          }

          // Mark as applied FIRST (in-memory) to prevent re-application
          // even if AsyncStorage clear fails below
          markSmartRewindApplied(currentBook.id);

          // Clear smart rewind state from storage
          try {
            await clearSmartRewindState();
          } catch (clearErr) {
            log('[SmartRewind] Failed to clear state (in-memory flag prevents re-application):', clearErr);
          }
        })();
      }
    },

    pause: async () => {
      // INSTANT: Use store position and don't block on async operations
      // Store position is kept in sync by polling, good enough for pause
      const { position: storePosition, currentBook, duration } = get();
      const { smartRewindEnabled } = usePlayerSettingsStore.getState();

      // Fix Bug #1: Clear stuck detection timeouts to prevent orphaned callbacks
      clearStuckDetectionTimeouts();

      // Update UI state immediately - don't wait for audioService
      set({ isPlaying: false });

      // Fire pause command (don't await - let it happen in background)
      audioService.pause().catch((err) => {
        logError('pause failed:', err);
      });

      if (!currentBook) return;

      // Emit book paused event
      eventBus.emit('book:paused', {
        bookId: currentBook.id,
        position: storePosition,
      });

      // Record pause state for smart rewind (fire and forget)
      // BUT NOT during scrubbing - user is manually seeking, not pausing
      if (smartRewindEnabled && !audioService.getIsScrubbing()) {
        persistSmartRewindState(currentBook.id, storePosition).catch(() => {});
      }

      // End listening session tracking (fire and forget)
      endListeningSession(storePosition).catch(() => {});

      // Save progress locally (fire-and-forget — don't block pause return).
      // Previously awaited, but this blocked the Android Auto command queue
      // for 50-200ms (SQLite write + dynamic import), causing delayed responses
      // and play-pause stuttering. Local save is still durable — it just completes
      // asynchronously now.
      backgroundSyncService.saveProgressLocal(
        currentBook.id,
        storePosition,
        duration
      ).catch(() => {});

      // Queue server sync (fire and forget — local save is already durable)
      const session = sessionService.getCurrentSession();
      backgroundSyncService.saveProgress(
        currentBook.id,
        storePosition,
        duration,
        session?.id
      ).catch(() => {});
    },

    // =========================================================================
    // SEEKING - Phase 7: Delegates to seekingStore
    // =========================================================================

    startSeeking: (direction?: SeekDirection) => {
      const { position } = get();
      // Delegate to seekingStore (single source of truth)
      useSeekingStore.getState().startSeeking(position, direction);
    },

    updateSeekPosition: async (newPosition: number) => {
      const { duration } = get();
      // Delegate to seekingStore (single source of truth)
      await useSeekingStore.getState().updateSeekPosition(newPosition, duration);
    },

    commitSeek: async () => {
      // Delegate to seekingStore (single source of truth)
      await useSeekingStore.getState().commitSeek();
    },

    cancelSeek: async () => {
      // Delegate to seekingStore (single source of truth)
      await useSeekingStore.getState().cancelSeek();
    },

    seekTo: async (position: number) => {
      // Fix 10: Validate position is a finite number
      if (!Number.isFinite(position)) {
        audioLog.warn('[seekTo] Invalid position:', position);
        return;
      }

      const { duration, currentBook } = get();
      const clampedPos = clampPosition(position, duration);

      log(`seekTo: ${clampedPos.toFixed(1)}`);

      // Delegate to seekingStore (single source of truth for seeking)
      // seekTo is an atomic operation - it handles seeking internally
      await useSeekingStore.getState().seekTo(clampedPos, duration, currentBook?.id);
    },

    // =========================================================================
    // CONTINUOUS SEEKING (Rewind/FF Buttons) - Phase 7: Delegates to seekingStore
    // =========================================================================

    startContinuousSeeking: async (direction: SeekDirection) => {
      const { position, duration, isPlaying, pause } = get();

      log(`startContinuousSeeking: direction=${direction}, position=${position.toFixed(1)}`);

      // Delegate to seekingStore (single source of truth) with pause callback
      await useSeekingStore.getState().startContinuousSeeking(
        direction,
        position,
        duration,
        async () => {
          if (isPlaying) await pause();
        }
      );
    },

    stopContinuousSeeking: async () => {
      log('stopContinuousSeeking');
      // Delegate to seekingStore (single source of truth)
      await useSeekingStore.getState().stopContinuousSeeking();
    },

    // =========================================================================
    // SKIP (single step)
    // =========================================================================

    // Fix 4: Simplified - seekTo now handles its own isSeeking protection
    skipForward: async (seconds = 30) => {
      const { position, duration } = get();
      // Guard: don't skip if duration is not yet known
      if (!duration || duration <= 0) {
        audioLog.warn('[skipForward] Duration not available yet');
        return;
      }
      const newPosition = Math.min(position + seconds, duration);

      // seekTo handles seeking flag internally now
      await get().seekTo(newPosition);

      // The native player resumes automatically after seek if it was already playing.
      // Do NOT call audioService.play() here — it races with the native seek completion
      // and causes the glitch where audio plays briefly from the old position, then stops.
    },

    skipBackward: async (seconds = 30) => {
      const { position, duration } = get();
      // Guard: don't skip if duration is not yet known
      if (!duration || duration <= 0) {
        audioLog.warn('[skipBackward] Duration not available yet');
        return;
      }
      const newPosition = Math.max(position - seconds, 0);

      // seekTo handles seeking flag internally now
      await get().seekTo(newPosition);
    },

    // =========================================================================
    // CHAPTER NAVIGATION
    // =========================================================================

    jumpToChapter: async (chapterIndex: number) => {
      const { chapters } = get();
      // Fix Medium #1: Validate chapters array exists and has items
      if (!chapters || chapters.length === 0) {
        log('[jumpToChapter] No chapters available');
        return;
      }
      if (chapterIndex >= 0 && chapterIndex < chapters.length) {
        const chapter = chapters[chapterIndex];
        // Fix Medium #1: Validate chapter exists before accessing start
        if (chapter && typeof chapter.start === 'number') {
          await get().seekTo(chapter.start);
        } else {
          log(`[jumpToChapter] Invalid chapter at index ${chapterIndex}`);
        }
      }
    },

    nextChapter: async () => {
      const { chapters, position } = get();
      // Fix Medium #3: Validate chapters array before use
      if (!chapters || chapters.length === 0) {
        log('[nextChapter] No chapters available');
        return;
      }
      const currentIndex = findChapterIndex(chapters, position);
      if (currentIndex < chapters.length - 1) {
        await get().jumpToChapter(currentIndex + 1);
      }
    },

    prevChapter: async () => {
      const { chapters, position } = get();
      // Fix Medium #2: Validate chapters array before use
      if (!chapters || chapters.length === 0) {
        log('[prevChapter] No chapters available, seeking to start');
        await get().seekTo(0);
        return;
      }
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
      const { chapters, position } = get();
      // Fix Medium #4: Validate chapters array before use
      if (!chapters || chapters.length === 0) {
        return null;
      }
      // Read seeking state from seekingStore (single source of truth)
      const seekState = useSeekingStore.getState();
      const effectivePosition = seekState.isSeeking ? seekState.seekPosition : position;
      const index = findChapterIndex(chapters, effectivePosition);
      return chapters[index] || null;
    },

    // =========================================================================
    // SPEED (delegated to speedStore - Phase 5 refactor)
    // =========================================================================

    setPlaybackRate: async (rate: number) => {
      // Use viewingBook if available (the book shown on player screen)
      // Fall back to currentBook (the book whose audio is loaded)
      const { viewingBook, currentBook } = get();
      const targetBook = viewingBook || currentBook;

      log(`[setPlaybackRate] rate=${rate}, viewingBook=${viewingBook?.id}, currentBook=${currentBook?.id}, target=${targetBook?.id}`);

      // Delegate to speedStore (single source of truth)
      await useSpeedStore.getState().setPlaybackRate(rate, targetBook?.id);
    },

    setGlobalDefaultRate: async (rate: number) => {
      // Delegate to speedStore (single source of truth)
      await useSpeedStore.getState().setGlobalDefaultRate(rate);
    },

    getBookSpeed: (bookId: string) => {
      return useSpeedStore.getState().getBookSpeed(bookId);
    },

    // =========================================================================
    // SLEEP TIMER (delegated to sleepTimerStore - Phase 4 refactor)
    // =========================================================================

    setSleepTimer: (minutes: number) => {
      // Delegate to sleepTimerStore (single source of truth) with pause callback
      useSleepTimerStore.getState().setSleepTimer(minutes, () => {
        log('[SleepTimer] Timer expired - pausing playback');
        get().pause();
      });
    },

    extendSleepTimer: (minutes: number) => {
      // Delegate to sleepTimerStore (single source of truth)
      useSleepTimerStore.getState().extendSleepTimer(minutes);
    },

    clearSleepTimer: () => {
      // Delegate to sleepTimerStore (single source of truth)
      useSleepTimerStore.getState().clearSleepTimer();
    },

    setShakeToExtendEnabled: async (enabled: boolean) => {
      // Delegate to sleepTimerStore (single source of truth)
      await useSleepTimerStore.getState().setShakeToExtendEnabled(enabled);
    },

    // =========================================================================
    // SETTINGS (delegated to playerSettingsStore - Phase 2 refactor)
    // =========================================================================

    setSkipForwardInterval: async (seconds: number) => {
      // Delegate to playerSettingsStore (single source of truth)
      await usePlayerSettingsStore.getState().setSkipForwardInterval(seconds);
    },

    setSkipBackInterval: async (seconds: number) => {
      // Delegate to playerSettingsStore (single source of truth)
      await usePlayerSettingsStore.getState().setSkipBackInterval(seconds);
    },

    setControlMode: (mode: 'rewind' | 'chapter') => {
      // Delegate to playerSettingsStore (single source of truth)
      usePlayerSettingsStore.getState().setControlMode(mode);
    },

    setProgressMode: (mode: 'bar' | 'chapters') => {
      // Delegate to playerSettingsStore (single source of truth)
      usePlayerSettingsStore.getState().setProgressMode(mode);
    },

    setDiscAnimationEnabled: async (enabled: boolean) => {
      // Delegate to playerSettingsStore (single source of truth)
      await usePlayerSettingsStore.getState().setDiscAnimationEnabled(enabled);
    },

    setUseStandardPlayer: async (enabled: boolean) => {
      // Delegate to playerSettingsStore (single source of truth)
      await usePlayerSettingsStore.getState().setUseStandardPlayer(enabled);
    },

    setSmartRewindEnabled: async (enabled: boolean) => {
      // Delegate to playerSettingsStore (single source of truth)
      await usePlayerSettingsStore.getState().setSmartRewindEnabled(enabled);
    },

    setSmartRewindMaxSeconds: async (seconds: number) => {
      // Delegate to playerSettingsStore (single source of truth)
      await usePlayerSettingsStore.getState().setSmartRewindMaxSeconds(seconds);
    },

    clearSmartRewind: () => {
      // Clear smart rewind state - call when user starts scrubbing
      // This prevents old pause state from triggering rewind on resume
      clearSmartRewindState().catch(() => {});
    },

    loadPlayerSettings: async () => {
      try {
        // Load settings from each source store (single source of truth)
        // Components read directly from these stores, no sync needed
        await Promise.all([
          usePlayerSettingsStore.getState().loadSettings(),
          useSleepTimerStore.getState().loadShakeToExtendSetting(),
          useSpeedStore.getState().loadSpeedSettings(),
          useCompletionSheetStore.getState().loadCompletionSettings(),
        ]);

        // Load lastPlayedBookId (still managed by playerStore)
        const lastPlayedBookIdStr = await AsyncStorage.getItem(LAST_PLAYED_BOOK_ID_KEY);
        set({ lastPlayedBookId: lastPlayedBookIdStr || null });
      } catch (error) {
        log('[loadPlayerSettings] Error loading settings:', error);
        // Use defaults - child stores handle their own defaults
      }
    },

    // =========================================================================
    // UI
    // =========================================================================

    togglePlayer: () => {
      const wasVisible = get().isPlayerVisible;
      set({ isPlayerVisible: !wasVisible });
      // Animate transition progress to match
      playerTransitionProgress.value = withSpring(wasVisible ? 0 : 1, SPRING_CONFIG);
    },

    closePlayer: () => {
      // Animate transition to collapsed, then update store
      playerTransitionProgress.value = withTiming(0, { duration: 250 });
      set({ isPlayerVisible: false });
    },

    setPlayerVisible: (visible: boolean) => {
      set({ isPlayerVisible: visible });
    },

    clearPlaybackError: () => {
      set({ playbackError: null });
    },

    /**
     * Handle audio errors from audioService
     * Detects URL expiration and refreshes session automatically
     */
    handleAudioError: async (error: AudioError) => {
      const { currentBook, position } = get();

      playerLogger.warn('[AUDIO_ERROR] Received error from audioService:', {
        type: error.type,
        message: error.message,
        httpStatus: error.httpStatus,
        position: error.position,
        bookId: error.bookId,
      });

      if (error.type === 'URL_EXPIRED') {
        // Session/URL expired - refresh session and reload at same position
        set({ playbackError: 'Session expired - refreshing...' });

        if (currentBook) {
          const resumePosition = error.position ?? position;
          playerLogger.info('[URL_EXPIRED] Refreshing session and reloading audio', {
            bookId: currentBook.id,
            resumePosition,
          });

          try {
            // Clear any cached session to force a fresh one
            playbackCache.clearSession(currentBook.id);

            // Reload the book at the same position with autoPlay
            // (Don't use autoPlay:false + play() — that can trigger double loadBook)
            await get().loadBook(currentBook, { startPosition: resumePosition, autoPlay: true });

            set({ playbackError: null });
            playerLogger.info('[URL_EXPIRED] Session refresh successful');
          } catch (refreshError) {
            playerLogger.error('[URL_EXPIRED] Session refresh failed:', refreshError);
            set({ playbackError: 'Session expired. Tap to retry.' });
          }
        } else {
          set({ playbackError: 'Playback failed. Tap to retry.' });
        }
      } else {
        // Generic error - show message to user
        set({ playbackError: error.message || 'Playback failed. Tap to retry.' });
      }
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
      } = get();

      // STUCK DETECTION: Handle stuck audio (position unchanged for 5+ seconds)
      if (state.isStuck) {
        set({ playbackError: 'Playback stuck - retrying...' });
        audioLog.warn('[Player] Stuck detected - attempting recovery');

        // Attempt recovery by calling play()
        audioService.play().then(() => {
          // Wait 1 second to verify recovery worked
          setTimeout(() => {
            if (!audioService.getIsPlaying()) {
              set({ playbackError: 'Playback failed. Tap to retry.' });
              audioLog.error('[Player] Recovery failed - playback still stuck');
            } else {
              set({ playbackError: null });
              audioLog.store('[Player] Recovery successful');
            }
          }, 1000);
        }).catch((err) => {
          set({ playbackError: 'Playback failed. Tap to retry.' });
          audioLog.error('[Player] Recovery play() failed:', err);
        });
        return; // Don't process normal update while handling stuck
      }

      // CRITICAL: Never let audio service's track duration overwrite the total book duration
      // storeDuration is set during loadBook and represents the FULL book duration
      // state.duration is just the current track's duration (can be much smaller)
      const totalBookDuration = storeDuration > 0 ? storeDuration : state.duration;
      // FIX: Update store duration if:
      // 1. audioService reports a LARGER value (rare case)
      // 2. storeDuration is 0 and audioService has detected a valid duration
      const shouldUpdateDuration = state.duration > storeDuration || (storeDuration === 0 && state.duration > 0);
      const displayDuration = totalBookDuration;

      // Log when duration is detected for the first time (storeDuration was 0)
      if (storeDuration === 0 && state.duration > 0) {
        audioLog.info(`[DURATION_FIX] Duration detected from audio: ${state.duration.toFixed(1)}s`);
      }

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
      // SINGLE SOURCE OF TRUTH: audioService owns position
      // audioService.lastKnownGoodPosition is THE position. It provides the
      // correct cached position during scrubbing, track switches, and normal playback.
      // EXCEPT during seeking - when isSeeking is true, the seek operation controls
      // position and we should not let audio callbacks overwrite it.
      // =====================================================================

      // Don't flip from playing to not-playing due to buffering
      const newIsPlaying = state.isBuffering ? wasPlaying : state.isPlaying;

      // CRITICAL: Skip position updates during seeking operations (Phase 7).
      // When isSeeking is true (e.g., during endScrub), the seek operation sets
      // the position and we must not let audio callbacks overwrite it with stale values.
      // Check seekingStore directly for the authoritative isSeeking state.
      const seekingState = useSeekingStore.getState();
      if (seekingState.isSeeking) {
        // Only update play state, not position
        set({
          isPlaying: newIsPlaying,
          ...(shouldUpdateDuration && { duration: displayDuration }),
          isBuffering: state.isBuffering,
        });
        return;
      }

      // Log significant position changes for debugging (> 30 seconds)
      // Note: We previously had position validation that rejected jumps > 60s,
      // but this blocked legitimate chapter jumps and seeks. Removed in favor
      // of logging only - root cause fixes are in audioService and backgroundSyncService.
      if (positionDiff > 30 && prevPosition > 0) {
        playerLogger.warn(`[POSITION_CHANGE] Large position change (${positionDiff.toFixed(1)}s):`, {
          from: prevPosition.toFixed(1),
          to: state.position.toFixed(1),
          bookId: currentBook?.id,
        });
      }

      // Validate position before setting - reject NaN, Infinity, or negative values
      // This prevents corrupted audio service state from propagating to the UI
      const validatedPosition = (
        Number.isFinite(state.position) && state.position >= 0
      ) ? state.position : prevPosition;

      if (validatedPosition !== state.position) {
        playerLogger.warn(`[POSITION_VALIDATION] Rejected invalid position:`, {
          received: state.position,
          using: validatedPosition,
        });
      }

      set({
        isPlaying: newIsPlaying,
        position: validatedPosition,
        ...(shouldUpdateDuration && { duration: displayDuration }),
        isBuffering: state.isBuffering,
      });

      // Periodic progress save - LOCAL ONLY for performance
      // Server sync happens at key moments (pause, background, finish)
      const now = Date.now();

      // Use validated position for progress save to avoid saving corrupted values
      // Also skip save if seeking just ended (seekingStore.lastSeekTime within 500ms)
      const recentlyFinishedSeeking = seekingState.lastSeekTime && (now - seekingState.lastSeekTime) < 500;
      if (currentBook && newIsPlaying && validatedPosition > 0 &&
          now - lastProgressSave > PROGRESS_SAVE_INTERVAL && !recentlyFinishedSeeking) {
        lastProgressSave = now;
        // Use local-only save during playback - no network overhead
        backgroundSyncService.saveProgressLocal(
          currentBook.id,
          validatedPosition,
          totalBookDuration
        ).catch(() => {});

        // Check for auto-download of next book in series
        const progress = totalBookDuration > 0 ? state.position / totalBookDuration : 0;
        if (progress >= AUTO_DOWNLOAD_THRESHOLD && !autoDownloadCheckedBooks.has(currentBook.id)) {
          autoDownloadCheckedBooks.add(currentBook.id);
          checkAutoDownloadNextInSeries(currentBook);
        }
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

          // Emit book finished event
          const finishedMetadata = getBookMetadata(currentBook);
          eventBus.emit('book:finished', {
            bookId: currentBook.id,
            seriesId: finishedMetadata?.series?.[0]?.id,
            seriesSequence: finishedMetadata?.series?.[0]?.sequence,
          });

          const session = sessionService.getCurrentSession();
          backgroundSyncService.saveProgress(
            currentBook.id,
            state.position,
            totalBookDuration,
            session?.id
          ).catch(() => {});

          // Get completion preferences from completionStore (Phase 6)
          const completionState = useCompletionSheetStore.getState();

          if (completionState.showCompletionPrompt) {
            // Show completion sheet for user to decide (completionStore is single source of truth)
            log('BOOK FINISHED - showing completion sheet');
            useCompletionSheetStore.getState().showCompletionForBook(currentBook);
            // Don't auto-play next book - let user decide via sheet
          } else if (completionState.autoMarkFinished) {
            // Auto-mark as finished when prompt is disabled
            // markBookFinished delegates to completionSheetStore which handles
            // queue removal AND playNext — do NOT call playNext here too
            log('BOOK FINISHED - auto-marking as finished');
            get().markBookFinished(currentBook.id);
          } else {
            // Neither prompt nor auto-mark - just add to reading history and check queue
            const metadata = getBookMetadata(currentBook);
            if (metadata) {
              sqliteCache.addToReadHistory({
                itemId: currentBook.id,
                title: metadata.title || 'Unknown Title',
                authorName: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
                narratorName: metadata.narrators?.[0],
                genres: metadata.genres || [],
              }).catch(() => {});
            }

            // Check queue for next book (late import to avoid circular dependency)
            (async () => {
              try {
                const { useQueueStore } = await import('@/features/queue/stores/queueStore');
                const queueStore = useQueueStore.getState();
                const nextBook = await queueStore.playNext();
                if (nextBook) {
                  log('Loading next book from queue:', nextBook.id);
                  get().loadBook(nextBook, { autoPlay: true, showPlayer: false });
                }
              } catch (err) {
                log('Queue check failed:', err);
              }
            })();
          }
        } else if (!isNearEnd) {
          log('NOT at book end - this may be a stream segment end');
        }
      }
    },

    // =========================================================================
    // BOOKMARKS (delegated to bookmarksStore - Phase 3 refactor)
    // =========================================================================

    addBookmark: async (bookmarkData: Omit<Bookmark, 'id' | 'createdAt'>) => {
      const { currentBook } = get();
      if (!currentBook) return;

      // Ensure bookmarksStore knows the current book
      useBookmarksStore.getState().setCurrentBookId(currentBook.id);

      // Delegate to bookmarksStore (single source of truth)
      await useBookmarksStore.getState().addBookmark(bookmarkData);
    },

    updateBookmark: async (bookmarkId: string, updates: { title?: string; note?: string | null }) => {
      // Delegate to bookmarksStore (single source of truth)
      await useBookmarksStore.getState().updateBookmark(bookmarkId, updates);
    },

    removeBookmark: async (bookmarkId: string) => {
      // Delegate to bookmarksStore (single source of truth)
      await useBookmarksStore.getState().removeBookmark(bookmarkId);
    },

    loadBookmarks: async () => {
      const { currentBook } = get();
      if (!currentBook) return;

      // Delegate to bookmarksStore (single source of truth)
      await useBookmarksStore.getState().loadBookmarks(currentBook.id);
    },

    // =========================================================================
    // BOOK COMPLETION
    // =========================================================================

    // Phase 6: Completion actions delegate to completionStore (single source of truth)
    setShowCompletionPrompt: async (enabled: boolean) => {
      await useCompletionSheetStore.getState().setShowCompletionPrompt(enabled);
    },

    setAutoMarkFinished: async (enabled: boolean) => {
      await useCompletionSheetStore.getState().setAutoMarkFinished(enabled);
    },

    markBookFinished: async (bookId?: string) => {
      const { currentBook, duration } = get();
      const completionState = useCompletionSheetStore.getState();
      const completionBook = completionState.completionSheetBook;
      const targetBookId = bookId || currentBook?.id;

      if (!targetBookId) {
        log('[Completion] No book ID provided and no current book');
        return;
      }

      // Use the completion sheet's book if it matches (it's the book that finished,
      // which may differ from currentBook if user already started a new book)
      const bookForCompletion = completionBook?.id === targetBookId ? completionBook : currentBook;
      const bookDuration = bookForCompletion?.media?.duration || duration;

      // Delegate to completionStore (single source of truth)
      await completionState.markBookFinished(targetBookId, bookDuration, bookForCompletion);
    },

    dismissCompletionSheet: () => {
      // Delegate to completionStore (single source of truth)
      useCompletionSheetStore.getState().dismissCompletionSheet();
    },
  }))
);

// =============================================================================
// SELECTORS moved to playerSelectors.ts (Phase 10 refactor)
// Import from '@/features/player/stores' or './playerSelectors' instead.
