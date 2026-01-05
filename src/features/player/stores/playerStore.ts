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
import { useShallow } from 'zustand/react/shallow';
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

// Import smart rewind utility
import { calculateSmartRewindSeconds } from '../utils/smartRewindCalculator';

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
import { REWIND_STEP, REWIND_INTERVAL, FF_STEP } from '../constants';

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
import { useBookmarksStore } from './bookmarksStore';

// Import sleep timer store (Phase 4 refactor)
import { useSleepTimerStore } from './sleepTimerStore';

// Import speed store (Phase 5 refactor)
import { useSpeedStore } from './speedStore';

// Import completion store (Phase 6 refactor)
import { useCompletionStore } from './completionStore';

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

export interface Bookmark {
  id: string;
  title: string;
  note: string | null;
  time: number;
  chapterTitle: string | null;
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

  // ---------------------------------------------------------------------------
  // Per-Book Speed Memory
  // ---------------------------------------------------------------------------
  bookSpeedMap: Record<string, number>;  // bookId → playback speed
  globalDefaultRate: number;              // Default speed for new books

  // ---------------------------------------------------------------------------
  // Shake to Extend Sleep Timer
  // ---------------------------------------------------------------------------
  shakeToExtendEnabled: boolean;          // User preference
  isShakeDetectionActive: boolean;        // Currently listening for shakes

  // ---------------------------------------------------------------------------
  // Skip Intervals (persisted)
  // ---------------------------------------------------------------------------
  skipForwardInterval: number;            // Seconds to skip forward (default 30)
  skipBackInterval: number;               // Seconds to skip back (default 15)

  // ---------------------------------------------------------------------------
  // Player Appearance (persisted)
  // ---------------------------------------------------------------------------
  discAnimationEnabled: boolean;          // Whether CD spins during playback (default true)
  useStandardPlayer: boolean;             // Show static cover instead of disc UI (default true)

  // ---------------------------------------------------------------------------
  // Smart Rewind (persisted)
  // ---------------------------------------------------------------------------
  smartRewindEnabled: boolean;            // Auto-rewind on resume based on pause duration (default true)
  smartRewindMaxSeconds: number;          // Maximum rewind amount in seconds (default 30)

  // ---------------------------------------------------------------------------
  // Book Completion (persisted)
  // ---------------------------------------------------------------------------
  showCompletionPrompt: boolean;          // Show prompt when book ends (default true)
  autoMarkFinished: boolean;              // Auto-mark books finished when prompt disabled (default false)
  showCompletionSheet: boolean;           // Currently showing completion sheet (transient)
  completionSheetBook: LibraryItem | null; // Book that just finished (for completion sheet)
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
const SMART_REWIND_ENABLED_KEY = 'playerSmartRewindEnabled';
const SMART_REWIND_MAX_SECONDS_KEY = 'playerSmartRewindMaxSeconds';
const LAST_PLAYED_BOOK_ID_KEY = 'playerLastPlayedBookId';
const ACTIVE_PLAYBACK_RATE_KEY = 'playerActivePlaybackRate';
const SMART_REWIND_PAUSE_TIMESTAMP_KEY = 'smartRewindPauseTimestamp';
const SMART_REWIND_PAUSE_BOOK_ID_KEY = 'smartRewindPauseBookId';
const SMART_REWIND_PAUSE_POSITION_KEY = 'smartRewindPausePosition';
// SHOW_COMPLETION_PROMPT_KEY and AUTO_MARK_FINISHED_KEY moved to completionStore (Phase 6)
const PROGRESS_SAVE_INTERVAL = 30000; // Save progress every 30 seconds
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
let seekInterval: NodeJS.Timeout | null = null;

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

    // Per-book speed memory
    bookSpeedMap: {},
    globalDefaultRate: 1.0,

    // Shake to extend
    shakeToExtendEnabled: true,  // Default enabled
    isShakeDetectionActive: false,

    // Skip intervals
    skipForwardInterval: 30,
    skipBackInterval: 15,

    // Player appearance
    discAnimationEnabled: true,
    useStandardPlayer: true,

    // Smart rewind
    smartRewindEnabled: true,
    smartRewindMaxSeconds: 30,

    // Book completion
    showCompletionPrompt: true,   // Show prompt when book ends
    autoMarkFinished: false,      // Auto-mark when prompt is disabled
    showCompletionSheet: false,   // Currently showing completion sheet
    completionSheetBook: null,    // Book that just finished

    // =========================================================================
    // LIFECYCLE
    // =========================================================================

    loadBook: async (book: LibraryItem, options?: { startPosition?: number; autoPlay?: boolean; showPlayer?: boolean }) => {
      const { startPosition, autoPlay = true, showPlayer = true } = options || {};
      const { currentBook, position: prevPosition, isLoading, isPlaying } = get();

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
        // Reset seeking state
        isSeeking: false,
        seekPosition: 0,
        seekStartPosition: 0,
        seekDirection: null,
      });
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
          ).catch(() => {});
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
        useBookmarksStore.getState().loadBookmarks(book.id).catch(() => {});

        if (isOffline && localPath) {
          // =================================================================
          // OFFLINE PLAYBACK - FAST PATH (no network blocking!)
          // FIX 2: Race session against 2s timeout to avoid jarring seek
          // =================================================================
          cleanupDownloadCompletionListener();
          chapters = extractChaptersFromBook(book);
          log('OFFLINE PLAYBACK MODE (fast path)');
          timing('Offline mode start');

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

          // Start audio setup and get local progress in parallel
          const setupPromise = audioService.ensureSetup();
          const localDataPromise = progressService.getProgressData(book.id);

          // Race session against timeout while also getting local data
          const [sessionResult, localData] = await Promise.all([
            Promise.race([sessionPromise, timeoutPromise]),
            localDataPromise,
          ]);

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
                const actualWaitTime = Date.now() - timeoutStartTime + SESSION_TIMEOUT_MS;
                log(`Background session connected after ${actualWaitTime}ms total (sync only, no position change)`);
                log(`Server position was: ${session.currentTime?.toFixed(1)}s, we used: ${resumePosition.toFixed(1)}s`);
                sessionService.startAutoSync(() => get().position);
                // Note: We do NOT seek here - that would cause jarring UX
                // The position was already resolved before playback started
              }
            }).catch(() => {});
          }

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

          // Ensure audio is ready (local progress was already fetched above)
          await setupPromise;
          timing('Offline data ready');
        } else {
          // =================================================================
          // ONLINE PLAYBACK - Need session for streaming URLs
          // =================================================================
          log('ONLINE PLAYBACK MODE');
          timing('Starting session request');

          // Start audio setup in parallel with session request
          const [session] = await Promise.all([
            sessionService.startSession(book.id).catch((err) => {
              log('Session start failed:', err.message);
              return null;
            }),
            audioService.ensureSetup(),
          ]);
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

          chapters = mapSessionChapters(session.chapters || []);
          if (session.duration > 0) totalDuration = session.duration;

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
              resolution: resolution.reason,
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

          // Set up listener to detect when this book's download completes
          // so we can seamlessly switch to local playback
          setupDownloadCompletionListener(
            book.id,
            () => ({
              currentBook: get().currentBook,
              position: get().position,
              isPlaying: get().isPlaying,
              isLoading: get().isLoading,
              isSeeking: get().isSeeking,
              isPlayerVisible: get().isPlayerVisible,
            }),
            get().loadBook,
            audioService,
            log,
            logError
          );
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

        // SAFEGUARD: Clamp position to prevent loading at or near end of book
        // If position is within 5 seconds of duration, reset to 0
        // This prevents the stream from immediately signaling completion
        if (totalDuration > 0 && resumePosition >= totalDuration - 5) {
          log(`[POSITION_CLAMP] Position ${resumePosition.toFixed(1)}s is near end (${totalDuration.toFixed(1)}s), resetting to 0`);
          resumePosition = 0;
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
        }

        if (loadId !== currentLoadId) return;

        // Get metadata for lock screen
        const metadata = book.media?.metadata as any;
        const title = metadata?.title || 'Audiobook';
        const author = metadata?.authorName ||
                       metadata?.authors?.[0]?.name ||
                       'Unknown Author';
        const coverUrl = apiClient.getItemCoverUrl(book.id);

        // Set up status callback BEFORE loading audio
        audioService.setStatusUpdateCallback((state) => {
          get().updatePlaybackState(state);
        });

        // Set up remote command callback for chapter navigation
        audioService.setRemoteCommandCallback((command) => {
          if (command === 'nextChapter') {
            get().nextChapter();
          } else if (command === 'prevChapter') {
            get().prevChapter();
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

        // Apply per-book playback rate (falls back to global default for new books)
        const bookSpeed = get().getBookSpeed(book.id);
        log('Applying playback rate for book:', bookSpeed);
        set({ playbackRate: bookSpeed });
        if (bookSpeed !== 1.0) {
          audioService.setPlaybackRate(bookSpeed).catch(() => {});
        }

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
          const bookMetadata = book.media?.metadata as any;
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

      } catch (error: any) {
        if (loadId === currentLoadId) {
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

      // Clear download completion listener
      cleanupDownloadCompletionListener();

      // Clear seeking interval
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }

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

      // Close session
      await sessionService.closeSession(position);

      // Release audio
      await audioService.unloadAudio();

      // Clear bookmarks via bookmarks store (Phase 3)
      useBookmarksStore.getState().clearBookmarks();

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
        bookmarks: [], // Keep for backward compatibility (will be synced from bookmarksStore)
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

      const {
        currentBook,
        position,
        chapters,
        smartRewindEnabled,
        smartRewindMaxSeconds,
      } = get();

      // INSTANT: Update UI and start playback immediately
      set({
        isPlaying: true,
        lastPlayedBookId: currentBook?.id || null,
      });

      // Fire play command (don't block on it)
      audioService.play().catch(() => {});

      // STUCK DETECTION: Verify audio actually starts playing
      // If after 3 seconds we think we're playing but audio isn't, try to recover
      setTimeout(async () => {
        const state = get();
        if (!state.isPlaying || !state.currentBook) return; // User paused or unloaded

        // Check if audio is actually playing
        const isAudioPlaying = audioService.getIsPlaying();
        const isBuffering = state.isBuffering;

        if (!isAudioPlaying && !isBuffering) {
          log('[STUCK_DETECTION] Audio stuck - isPlaying=true but audio not playing, attempting recovery');

          // Try to restart playback
          try {
            await audioService.play();

            // If still not playing after 1 second, hard reset
            setTimeout(() => {
              const newState = get();
              if (newState.isPlaying && !audioService.getIsPlaying() && !newState.isBuffering) {
                log('[STUCK_DETECTION] Recovery failed - performing hard reset');
                // Reload the book at current position
                const { currentBook, position } = newState;
                if (currentBook) {
                  newState.loadBook(currentBook, {
                    startPosition: position,
                    autoPlay: true,
                    showPlayer: true,
                  }).catch(() => {});
                }
              }
            }, 1000);
          } catch (err) {
            log('[STUCK_DETECTION] Recovery attempt failed:', err);
          }
        }
      }, 3000);

      // Emit book resumed event
      if (currentBook) {
        eventBus.emit('book:resumed', {
          bookId: currentBook.id,
          position,
        });
      }

      // Persist lastPlayedBookId for app restart recovery (fire and forget)
      if (currentBook) {
        AsyncStorage.setItem(LAST_PLAYED_BOOK_ID_KEY, currentBook.id).catch(() => {});
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

          // Clear smart rewind state - MUST succeed to prevent re-application
          try {
            await clearSmartRewindState();
          } catch (clearErr) {
            log('[SmartRewind] Failed to clear state:', clearErr);
          }
        })();
      }
    },

    pause: async () => {
      // INSTANT: Use store position and don't block on async operations
      // Store position is kept in sync by polling, good enough for pause
      const { position: storePosition, currentBook, duration, smartRewindEnabled } = get();

      // Update UI state immediately - don't wait for audioService
      set({ isPlaying: false });

      // Fire pause command (don't await - let it happen in background)
      audioService.pause().catch(() => {});

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

      // Sync progress on pause (fire and forget)
      const session = sessionService.getCurrentSession();
      backgroundSyncService.saveProgress(
        currentBook.id,
        storePosition,
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

      // Ensure audio is at final position - audioService owns position
      await audioService.seekTo(seekPosition);

      // Exit seeking mode (position will be synced via audioService callback)
      set({
        isSeeking: false,
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

      // Return to original position - audioService owns position
      await audioService.seekTo(seekStartPosition);

      // Exit seeking mode (position will be synced via audioService callback)
      set({
        isSeeking: false,
        seekDirection: null,
      });
    },

    seekTo: async (position: number) => {
      const { duration, currentBook } = get();
      const clampedPosition = Math.max(0, Math.min(duration, position));

      log(`seekTo: ${clampedPosition.toFixed(1)}`);

      // INSTANT: Update store position immediately for responsive UI
      set({ position: clampedPosition });

      // Fire seek command (don't block - audio will catch up)
      audioService.seekTo(clampedPosition).catch(() => {});

      // Save position locally only - server sync happens on pause
      if (currentBook) {
        backgroundSyncService.saveProgressLocal(
          currentBook.id,
          clampedPosition,
          duration
        ).catch(() => {});
      }
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
    // SPEED (delegated to speedStore - Phase 5 refactor)
    // =========================================================================

    setPlaybackRate: async (rate: number) => {
      const { currentBook } = get();

      // Delegate to speedStore
      await useSpeedStore.getState().setPlaybackRate(rate, currentBook?.id);

      // Sync to local state for backward compatibility
      const speedState = useSpeedStore.getState();
      set({
        playbackRate: speedState.playbackRate,
        bookSpeedMap: speedState.bookSpeedMap,
      });
    },

    setGlobalDefaultRate: async (rate: number) => {
      await useSpeedStore.getState().setGlobalDefaultRate(rate);

      // Sync to local state for backward compatibility
      set({ globalDefaultRate: rate });
    },

    getBookSpeed: (bookId: string) => {
      return useSpeedStore.getState().getBookSpeed(bookId);
    },

    // =========================================================================
    // SLEEP TIMER (delegated to sleepTimerStore - Phase 4 refactor)
    // =========================================================================

    setSleepTimer: (minutes: number) => {
      // Delegate to sleepTimerStore with pause callback
      useSleepTimerStore.getState().setSleepTimer(minutes, () => {
        get().pause();
      });

      // Sync to local state for backward compatibility
      const timerState = useSleepTimerStore.getState();
      set({
        sleepTimer: timerState.sleepTimer,
        sleepTimerInterval: timerState.sleepTimerInterval,
        isShakeDetectionActive: timerState.isShakeDetectionActive,
      });
    },

    extendSleepTimer: (minutes: number) => {
      useSleepTimerStore.getState().extendSleepTimer(minutes);

      // Sync to local state for backward compatibility
      const timerState = useSleepTimerStore.getState();
      set({
        sleepTimer: timerState.sleepTimer,
        isShakeDetectionActive: timerState.isShakeDetectionActive,
      });
    },

    clearSleepTimer: () => {
      useSleepTimerStore.getState().clearSleepTimer();

      // Sync to local state for backward compatibility
      set({ sleepTimer: null, sleepTimerInterval: null, isShakeDetectionActive: false });
    },

    setShakeToExtendEnabled: async (enabled: boolean) => {
      await useSleepTimerStore.getState().setShakeToExtendEnabled(enabled);

      // Sync to local state for backward compatibility
      set({
        shakeToExtendEnabled: enabled,
        isShakeDetectionActive: useSleepTimerStore.getState().isShakeDetectionActive,
      });
    },

    // =========================================================================
    // SETTINGS (delegated to playerSettingsStore - Phase 2 refactor)
    // =========================================================================

    setSkipForwardInterval: async (seconds: number) => {
      await usePlayerSettingsStore.getState().setSkipForwardInterval(seconds);
      set({ skipForwardInterval: seconds }); // Keep local state in sync
    },

    setSkipBackInterval: async (seconds: number) => {
      await usePlayerSettingsStore.getState().setSkipBackInterval(seconds);
      set({ skipBackInterval: seconds }); // Keep local state in sync
    },

    setControlMode: (mode: 'rewind' | 'chapter') => {
      usePlayerSettingsStore.getState().setControlMode(mode);
      set({ controlMode: mode }); // Keep local state in sync
    },

    setProgressMode: (mode: 'bar' | 'chapters') => {
      usePlayerSettingsStore.getState().setProgressMode(mode);
      set({ progressMode: mode }); // Keep local state in sync
    },

    setDiscAnimationEnabled: async (enabled: boolean) => {
      await usePlayerSettingsStore.getState().setDiscAnimationEnabled(enabled);
      set({ discAnimationEnabled: enabled }); // Keep local state in sync
    },

    setUseStandardPlayer: async (enabled: boolean) => {
      await usePlayerSettingsStore.getState().setUseStandardPlayer(enabled);
      set({ useStandardPlayer: enabled }); // Keep local state in sync
    },

    setSmartRewindEnabled: async (enabled: boolean) => {
      await usePlayerSettingsStore.getState().setSmartRewindEnabled(enabled);
      set({ smartRewindEnabled: enabled }); // Keep local state in sync
    },

    setSmartRewindMaxSeconds: async (seconds: number) => {
      await usePlayerSettingsStore.getState().setSmartRewindMaxSeconds(seconds);
      set({ smartRewindMaxSeconds: seconds }); // Keep local state in sync
    },

    clearSmartRewind: () => {
      // Clear smart rewind state - call when user starts scrubbing
      // This prevents old pause state from triggering rewind on resume
      clearSmartRewindState().catch(() => {});
    },

    loadPlayerSettings: async () => {
      try {
        // Phase 2: Load settings from dedicated settings store first
        await usePlayerSettingsStore.getState().loadSettings();
        const settingsState = usePlayerSettingsStore.getState();

        // Phase 4: Load sleep timer settings
        await useSleepTimerStore.getState().loadShakeToExtendSetting();
        const sleepTimerState = useSleepTimerStore.getState();

        // Phase 5: Load speed settings
        await useSpeedStore.getState().loadSpeedSettings();
        const speedState = useSpeedStore.getState();

        // Phase 6: Load completion settings
        await useCompletionStore.getState().loadCompletionSettings();
        const completionState = useCompletionStore.getState();

        // Load remaining settings not yet extracted to separate stores
        const lastPlayedBookIdStr = await AsyncStorage.getItem(LAST_PLAYED_BOOK_ID_KEY);
        const lastPlayedBookId = lastPlayedBookIdStr || null;

        set({
          // Settings from playerSettingsStore (keep local state in sync)
          controlMode: settingsState.controlMode,
          progressMode: settingsState.progressMode,
          skipForwardInterval: settingsState.skipForwardInterval,
          skipBackInterval: settingsState.skipBackInterval,
          discAnimationEnabled: settingsState.discAnimationEnabled,
          useStandardPlayer: settingsState.useStandardPlayer,
          smartRewindEnabled: settingsState.smartRewindEnabled,
          smartRewindMaxSeconds: settingsState.smartRewindMaxSeconds,
          // Settings from sleepTimerStore (Phase 4)
          shakeToExtendEnabled: sleepTimerState.shakeToExtendEnabled,
          // Settings from speedStore (Phase 5)
          playbackRate: speedState.playbackRate,
          bookSpeedMap: speedState.bookSpeedMap,
          globalDefaultRate: speedState.globalDefaultRate,
          // Settings from completionStore (Phase 6)
          showCompletionPrompt: completionState.showCompletionPrompt,
          autoMarkFinished: completionState.autoMarkFinished,
          // Settings still managed locally (to be extracted in later phases)
          lastPlayedBookId,
        });
      } catch (error) {
        log('[loadPlayerSettings] Error loading settings:', error);
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
      // SINGLE SOURCE OF TRUTH: audioService owns position
      // audioService.lastKnownGoodPosition is THE position. It provides the
      // correct cached position during scrubbing, track switches, and normal playback.
      // EXCEPT during seeking - when isSeeking is true, the seek operation controls
      // position and we should not let audio callbacks overwrite it.
      // =====================================================================

      // Don't flip from playing to not-playing due to buffering
      const newIsPlaying = state.isBuffering ? wasPlaying : state.isPlaying;

      // CRITICAL: Skip position updates during seeking operations.
      // When isSeeking is true (e.g., during endScrub), the seek operation sets
      // the position and we must not let audio callbacks overwrite it with stale values.
      const { isSeeking } = get();
      if (isSeeking) {
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

      set({
        isPlaying: newIsPlaying,
        position: state.position,
        ...(shouldUpdateDuration && { duration: displayDuration }),
        isBuffering: state.isBuffering,
      });

      // Periodic progress save - LOCAL ONLY for performance
      // Server sync happens at key moments (pause, background, finish)
      const now = Date.now();

      if (currentBook && newIsPlaying && state.position > 0 && now - lastProgressSave > PROGRESS_SAVE_INTERVAL) {
        lastProgressSave = now;
        // Use local-only save during playback - no network overhead
        backgroundSyncService.saveProgressLocal(
          currentBook.id,
          state.position,
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
          const finishedMetadata = currentBook.media?.metadata as any;
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
          const completionState = useCompletionStore.getState();

          if (completionState.showCompletionPrompt) {
            // Show completion sheet for user to decide
            log('BOOK FINISHED - showing completion sheet');
            useCompletionStore.getState().showCompletionForBook(currentBook);
            // Sync to local state for backward compatibility
            set({
              showCompletionSheet: true,
              completionSheetBook: currentBook,
            });
            // Don't auto-play next book - let user decide via sheet
          } else if (completionState.autoMarkFinished) {
            // Auto-mark as finished when prompt is disabled
            log('BOOK FINISHED - auto-marking as finished');
            get().markBookFinished(currentBook.id);
            // Queue will play next if available (markBookFinished handles queue removal)
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
          } else {
            // Neither prompt nor auto-mark - just add to reading history and check queue
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

      // Delegate to bookmarksStore
      await useBookmarksStore.getState().addBookmark(bookmarkData);

      // Sync to local state for backward compatibility
      set({ bookmarks: useBookmarksStore.getState().bookmarks });
    },

    updateBookmark: async (bookmarkId: string, updates: { title?: string; note?: string | null }) => {
      // Delegate to bookmarksStore
      await useBookmarksStore.getState().updateBookmark(bookmarkId, updates);

      // Sync to local state for backward compatibility
      set({ bookmarks: useBookmarksStore.getState().bookmarks });
    },

    removeBookmark: async (bookmarkId: string) => {
      // Delegate to bookmarksStore
      await useBookmarksStore.getState().removeBookmark(bookmarkId);

      // Sync to local state for backward compatibility
      set({ bookmarks: useBookmarksStore.getState().bookmarks });
    },

    loadBookmarks: async () => {
      const { currentBook } = get();
      if (!currentBook) return;

      // Delegate to bookmarksStore
      await useBookmarksStore.getState().loadBookmarks(currentBook.id);

      // Sync to local state for backward compatibility
      set({ bookmarks: useBookmarksStore.getState().bookmarks });
    },

    // =========================================================================
    // BOOK COMPLETION
    // =========================================================================

    // Phase 6: Completion actions delegate to completionStore
    setShowCompletionPrompt: async (enabled: boolean) => {
      await useCompletionStore.getState().setShowCompletionPrompt(enabled);
      // Sync to local state for backward compatibility
      set({ showCompletionPrompt: enabled });
    },

    setAutoMarkFinished: async (enabled: boolean) => {
      await useCompletionStore.getState().setAutoMarkFinished(enabled);
      // Sync to local state for backward compatibility
      set({ autoMarkFinished: enabled });
    },

    markBookFinished: async (bookId?: string) => {
      const { currentBook, duration } = get();
      const targetBookId = bookId || currentBook?.id;

      if (!targetBookId) {
        log('[Completion] No book ID provided and no current book');
        return;
      }

      // Delegate to completionStore
      await useCompletionStore.getState().markBookFinished(targetBookId, duration, currentBook);

      // Sync completion sheet state for backward compatibility
      const completionState = useCompletionStore.getState();
      set({
        showCompletionSheet: completionState.showCompletionSheet,
        completionSheetBook: completionState.completionSheetBook,
      });
    },

    dismissCompletionSheet: () => {
      useCompletionStore.getState().dismissCompletionSheet();
      // Sync to local state for backward compatibility
      set({ showCompletionSheet: false, completionSheetBook: null });
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

/**
 * Returns whether shake detection is currently active.
 */
export const useIsShakeDetectionActive = () =>
  usePlayerStore((s) => s.isShakeDetectionActive);

/**
 * Returns the sleep timer state with shake detection info.
 * Uses useShallow to prevent unnecessary re-renders from object reference changes.
 */
export function useSleepTimerState() {
  return usePlayerStore(
    useShallow((s) => ({
      sleepTimer: s.sleepTimer,
      isShakeDetectionActive: s.isShakeDetectionActive,
      shakeToExtendEnabled: s.shakeToExtendEnabled,
    }))
  );
}
