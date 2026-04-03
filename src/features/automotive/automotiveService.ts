/**
 * src/features/automotive/automotiveService.ts
 *
 * Central service for CarPlay and Android Auto integration.
 * Provides a unified API for automotive platforms.
 *
 * NOTE: CarPlay requires:
 * 1. Apple CarPlay Audio entitlement (com.apple.developer.carplay-audio)
 * 2. react-native-carplay package installed
 * 3. Native iOS scene delegate configuration
 *
 * Android Auto requires:
 * 1. MediaBrowserService implementation in native code
 * 2. automotive_app_desc.xml configuration
 */

import { Platform, NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import {
  AutomotiveConnectionState,
  AutomotivePlatform,
  AutomotiveNowPlaying,
  AutomotiveCallbacks,
  AutomotiveConfig,
  BrowseSection,
  BrowseItem,
  DEFAULT_AUTOMOTIVE_CONFIG,
} from './types';
import { audioLog } from '@/shared/utils/audioDebug';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { getErrorMessage } from '@/shared/utils/errorUtils';
import { audioService } from '@/features/player/services/audioService';
import { shallow } from 'zustand/shallow';

// PERF: Pre-import player store to avoid dynamic import latency on first command
// Dynamic imports can take 100-300ms on first invocation
import { usePlayerStore, useSpeedStore } from '@/shared/stores/playerFacade';

// Extended metadata interface
interface ExtendedBookMetadata extends BookMetadata {
  narratorName?: string;
}

// Helper to get book metadata safely
// Note: Does NOT require audioFiles - works with cache items that only have metadata
function getBookMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration in seconds
function getBookDuration(item: LibraryItem | null | undefined): number {
  if (!item?.media) return 0;
  return (item.media as BookMedia).duration || 0;
}

// Format duration as "Xh Ym" for display
// Handles short books (< 1 min) by showing seconds
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  // Very short content (< 1 min)
  return `${Math.floor(seconds)}s`;
}

// Format time remaining as "Xh Ym left"
function formatTimeRemaining(durationSeconds: number, progress: number): string {
  if (!durationSeconds || durationSeconds <= 0 || progress >= 1) return '';
  const remaining = durationSeconds * (1 - progress);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.ceil((remaining % 3600) / 60); // ceil so "45s left" shows as "1m left"
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
  }
  if (minutes > 0) {
    return `${minutes}m left`;
  }
  return 'almost done';
}

// Format subtitle with author and time info
// For in-progress: "Author • 45% • 3h 21m left"
// For not started: "Author • 12h 30m"
// For finished: "Author • 12h 30m • Finished"
function formatSubtitle(author: string, durationSeconds: number, progress?: number): string {
  const parts: string[] = [author];
  const durationStr = formatDuration(durationSeconds);

  if (progress !== undefined && progress >= 0.95) {
    // Finished: show total duration + finished badge
    if (durationStr) {
      parts.push(durationStr);
    }
    parts.push('Finished');
  } else if (progress !== undefined && progress > 0) {
    // In-progress: show percentage and time remaining
    parts.push(`${Math.round(progress * 100)}%`);
    const remaining = formatTimeRemaining(durationSeconds, progress);
    if (remaining) {
      parts.push(remaining);
    }
  } else {
    // Not started (progress === 0 or undefined): show total duration
    if (durationStr) {
      parts.push(durationStr);
    }
  }

  return parts.join(' • ');
}

const log = (...args: any[]) => audioLog.audio('[Automotive]', ...args);

/**
 * Get cover URL with auth token appended as query parameter.
 * Native Glide doesn't have access to the Bearer token header,
 * so we pass authentication via the URL query string instead.
 * ABS accepts ?token=xxx as an alternative to Authorization header.
 */
function getAuthenticatedCoverUrl(itemId: string): string {
  const { apiClient } = require('@/core/api');
  const url = apiClient.getItemCoverUrl(itemId);
  const token = apiClient.getAuthToken();
  if (token) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
  return url;
}

/**
 * Automotive service - manages CarPlay and Android Auto connections
 */
class AutomotiveService {
  private config: AutomotiveConfig = DEFAULT_AUTOMOTIVE_CONFIG;
  private connectionState: AutomotiveConnectionState = 'disconnected';
  private connectedPlatform: AutomotivePlatform = 'none';
  private callbacks: AutomotiveCallbacks | null = null;
  private isInitialized = false;

  // CarPlay-specific state (when react-native-carplay is installed)
  private carPlayModule: any = null;
  private continueListeningTemplate: any = null;
  private libraryTemplate: any = null;
  private authorsTemplate: any = null;
  private downloadsTemplate: any = null;
  private libraryCacheUnsubscribe: (() => void) | null = null;

  // CarPlay data cache — mutable arrays that onItemSelect closures reference.
  // Updated by both setupCarPlayTemplates and updateCarPlayLists so tap
  // handlers always see current data (no stale closure problem).
  private carPlayContinueItemIds: string[] = [];
  private carPlayLibraryItemIds: string[] = [];
  private carPlayAuthors: { name: string; bookIds: string[] }[] = [];
  private carPlayDownloadItemIds: string[] = [];
  private carPlayDownloadedIds: Set<string> = new Set();

  // Deduplication for playItem to prevent double playback
  private lastPlayedItemId: string | null = null;
  private lastPlayedTime: number = 0;
  private static PLAY_DEBOUNCE_MS = 2000; // Ignore duplicate play requests within 2 seconds

  // Android Auto event subscription
  private androidAutoSubscription: EmitterSubscription | null = null;

  // Player state subscription for Android Auto sync
  private playerStoreUnsubscribe: (() => void) | null = null;

  // Command execution lock to prevent concurrent commands from racing
  private isCommandExecuting: boolean = false;
  private commandQueue: { command: string; param?: string }[] = [];

  // Callback set by setupPlayerStateSync to notify command cooldown
  private _notifyCommandExecuted: (() => void) | null = null;

  // Initialization lock to prevent concurrent init from both Android Auto and main app
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the automotive service
   * Fix: Handle concurrent init calls from both Android Auto and main app
   */
  async init(config?: Partial<AutomotiveConfig>): Promise<void> {
    if (this.isInitialized) {
      log('Already initialized');
      return;
    }

    // Fix: If already initializing, wait for that to complete
    if (this.isInitializing && this.initPromise) {
      log('Init already in progress, waiting...');
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this._doInit(config);

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async _doInit(config?: Partial<AutomotiveConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    log('Initializing automotive service...');
    log('Config:', JSON.stringify(this.config, null, 2));

    // Try to load CarPlay module (iOS only)
    if (Platform.OS === 'ios' && this.config.enableCarPlay) {
      await this.initCarPlay();
    }

    // Try to load Android Auto module (Android only)
    if (Platform.OS === 'android' && this.config.enableAndroidAuto) {
      await this.initAndroidAuto();
    }

    this.isInitialized = true;
    log('Automotive service initialized');
  }

  /**
   * Initialize CarPlay integration
   */
  private async initCarPlay(): Promise<void> {
    try {
      // First check if the native module exists before requiring the package
      const { NativeModules: RNModules } = require('react-native');
      log('Available native modules:', Object.keys(RNModules).filter(k => k.toLowerCase().includes('car') || k.toLowerCase().includes('rncar')).join(', ') || 'none matching car*');
      if (!RNModules.RNCarPlay) {
        log('CarPlay native module not linked - skipping CarPlay init');
        return;
      }

      // Try to require react-native-carplay
      this.carPlayModule = require('react-native-carplay');
      log('CarPlay module loaded successfully');

      // Guard against duplicate setupCarPlayTemplates calls.
      // CarPlayInterface constructor already calls checkForConnection() which
      // can fire didConnect immediately — our registerOnConnect could then fire
      // a second time if the native side also emits.
      let carPlayTemplatesSetUp = false;

      // Set up connection listener
      this.carPlayModule.CarPlay.registerOnConnect(() => {
        log('CarPlay connected');
        this.connectionState = 'connected';
        this.connectedPlatform = 'carplay';
        this.callbacks?.onConnect('carplay');
        if (!carPlayTemplatesSetUp) {
          carPlayTemplatesSetUp = true;
          this.setupCarPlayTemplates();
        }
      });

      this.carPlayModule.CarPlay.registerOnDisconnect(() => {
        log('CarPlay disconnected');
        this.connectionState = 'disconnected';
        this.connectedPlatform = 'none';
        carPlayTemplatesSetUp = false; // Allow re-setup on reconnect
        this.callbacks?.onDisconnect();
      });

      // NOTE: CarPlayInterface constructor already calls checkForConnection()
      // when we require('react-native-carplay') above. That handles the case
      // where CarPlay connected before JS was ready. No need to call it again.

      // Subscribe to library cache changes to refresh lists
      this.setupLibraryCacheListener();

    } catch (error) {
      log('CarPlay module not available:', getErrorMessage(error));
      log('To enable CarPlay:');
      log('1. Get CarPlay entitlement from Apple');
      log('2. Install: npm install react-native-carplay');
      log('3. Configure iOS scene delegate');
    }
  }

  /**
   * Set up listener for library cache changes
   */
  private async setupLibraryCacheListener(): Promise<void> {
    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');

      // Unsubscribe from previous listener if any
      if (this.libraryCacheUnsubscribe) {
        this.libraryCacheUnsubscribe();
      }

      // PERF: Subscribe only to items changes (not loading/error state)
      // using subscribeWithSelector to avoid unnecessary callback invocations
      this.libraryCacheUnsubscribe = useLibraryCache.subscribe(
        (state) => state.items,
        (items) => {
          log('Library changed, refreshing automotive data');

          // Refresh CarPlay lists when library changes
          if (this.isConnected() && this.connectedPlatform === 'carplay') {
            this.updateCarPlayLists();
          }

          // Refresh Android Auto browse data when library changes
          if (Platform.OS === 'android') {
            // Reset retry count — library just loaded, fresh sync should succeed
            this.browseSyncRetryCount = 0;
            this.syncBrowseDataToAndroidAuto(true); // Immediate — don't debounce on library load
          }
        }
      );

      // Initial sync for Android Auto (immediate — retry logic handles load delay)
      if (Platform.OS === 'android') {
        this.syncBrowseDataToAndroidAuto(true);
      }

      log('Library cache listener set up');
    } catch (error) {
      log('Failed to set up library cache listener:', error);
    }
  }

  /**
   * Sync browse data to Android Auto native MediaBrowserService.
   * Serializes all browse sections as JSON and writes to file via native module.
   * The native service reads this file in onLoadChildren().
   *
   * Debounced: multiple rapid calls collapse into a single sync after 500ms.
   */
  private browseSyncDebounceTimer: NodeJS.Timeout | null = null;
  private browseSyncInProgress = false;
  private hasCompletedInitialSync = false;

  /**
   * Handle playFromMediaId from ExoPlayer's MediaSession callback.
   * Called by audioService.android.ts when Android Auto sends a play command.
   */
  async handlePlayFromMediaId(mediaId: string): Promise<void> {
    log('handlePlayFromMediaId:', mediaId);
    if (mediaId.startsWith('chapter:')) {
      await this.playChapter(mediaId);
    } else {
      await this.playItem(mediaId);
    }
  }

  /**
   * Handle playFromSearch from ExoPlayer's MediaSession callback (voice search via Auto).
   */
  async handlePlayFromSearch(query: string): Promise<void> {
    log('handlePlayFromSearch:', query || '(empty - resume recent)');
    await this.handleSearch(query);
  }

  syncBrowseDataToAndroidAuto(immediate = false): void {
    if (Platform.OS !== 'android') return;

    // First sync is immediate (no debounce) — Android Auto may already be waiting
    if (immediate || !this.hasCompletedInitialSync) {
      if (this.browseSyncDebounceTimer) {
        clearTimeout(this.browseSyncDebounceTimer);
        this.browseSyncDebounceTimer = null;
      }
      this.performBrowseSync();
      return;
    }

    // Debounce: collapse rapid calls into one
    if (this.browseSyncDebounceTimer) {
      clearTimeout(this.browseSyncDebounceTimer);
    }
    this.browseSyncDebounceTimer = setTimeout(() => {
      this.browseSyncDebounceTimer = null;
      this.performBrowseSync();
    }, 500);
  }

  private browseSyncRetryTimer: NodeJS.Timeout | null = null;
  private browseSyncRetryCount = 0;
  private static readonly BROWSE_SYNC_MAX_RETRIES = 30;
  private static readonly BROWSE_SYNC_RETRY_INTERVAL_MS = 2000;

  private async performBrowseSync(): Promise<void> {
    // Lock: skip if already syncing
    if (this.browseSyncInProgress) {
      log('Browse sync already in progress, skipping');
      return;
    }
    this.browseSyncInProgress = true;

    try {
      const { AndroidAutoModule } = NativeModules;
      if (!AndroidAutoModule || !AndroidAutoModule.writeBrowseData) {
        log('AndroidAutoModule.writeBrowseData not available');
        return;
      }

      // Check auth state — if not signed in, write sign-in placeholder immediately
      // (DR-3: must load content within 10 seconds)
      const { apiClient: client } = await import('@/core/api');
      const authToken = client.getAuthToken();
      if (!authToken) {
        log('User not authenticated — writing sign-in placeholder immediately');
        const placeholder = [{
          id: 'sign-in',
          title: 'Open Secret Library to get started',
          items: [{
            id: 'sign-in-prompt',
            title: 'Sign in to your server',
            subtitle: 'Open the app and connect to your AudiobookShelf server',
            imageUrl: null,
            isPlayable: false,
            isBrowsable: false,
            progress: 0,
            durationMs: 0,
          }],
        }];
        try {
          await AndroidAutoModule.writeBrowseData(JSON.stringify(placeholder));
          log('Wrote sign-in placeholder to browse data');
        } catch (err) {
          log('Failed to write sign-in placeholder:', err);
        }
        return;
      }

      // Check if library data is available
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      const libraryItems = useLibraryCache.getState().items;
      if (libraryItems.length === 0) {
        // Library not loaded yet — schedule retry with backoff
        if (this.browseSyncRetryCount < AutomotiveService.BROWSE_SYNC_MAX_RETRIES) {
          this.browseSyncRetryCount++;
          log(`Library not loaded yet, retry ${this.browseSyncRetryCount}/${AutomotiveService.BROWSE_SYNC_MAX_RETRIES} in ${AutomotiveService.BROWSE_SYNC_RETRY_INTERVAL_MS}ms`);
          if (this.browseSyncRetryTimer) clearTimeout(this.browseSyncRetryTimer);
          this.browseSyncRetryTimer = setTimeout(() => {
            this.browseSyncRetryTimer = null;
            this.performBrowseSync();
          }, AutomotiveService.BROWSE_SYNC_RETRY_INTERVAL_MS);
        } else {
          // Write an empty-but-valid browse tree so native stops showing "Loading..."
          // and shows the sign-in placeholder instead of hanging forever
          log('Library not loaded after max retries — writing empty browse data to unblock native');
          try {
            await AndroidAutoModule.writeBrowseData(JSON.stringify([]));
          } catch (err) {
            log('Failed to write empty browse data:', err);
          }
        }
        return;
      }

      const sections = await this.getBrowseSections();
      log('Syncing browse data to Android Auto:', sections.length, 'sections');

      // Serialize sections to JSON and write to file via native module
      const jsonData = JSON.stringify(sections);
      try {
        await AndroidAutoModule.writeBrowseData(jsonData);
        this.hasCompletedInitialSync = true;
        this.browseSyncRetryCount = 0;
        log(`Browse data written: ${sections.length} sections, ${jsonData.length} chars`);
      } catch (err) {
        log('Failed to write browse data:', err);
      }
    } catch (error) {
      log('Failed to sync browse data to Android Auto:', error);
    } finally {
      this.browseSyncInProgress = false;
    }
  }

  /**
   * Initialize Android Auto integration
   */
  private async initAndroidAuto(): Promise<void> {
    log('Initializing Android Auto support...');

    const { AndroidAutoModule } = NativeModules;

    if (!AndroidAutoModule) {
      log('AndroidAutoModule not available - native module not linked');
      return;
    }

    try {
      // Fix: Remove any existing subscription before adding new one
      // This prevents listener stacking when both Android Auto and main app init simultaneously
      if (this.androidAutoSubscription) {
        log('Removing existing Android Auto subscription before re-init');
        this.androidAutoSubscription.remove();
        this.androidAutoSubscription = null;
      }

      // Set up event listener for commands from native MediaBrowserService
      const eventEmitter = new NativeEventEmitter(AndroidAutoModule);
      this.androidAutoSubscription = eventEmitter.addListener(
        AndroidAutoModule.EVENT_NAME || 'AndroidAutoCommand',
        this.handleAndroidAutoCommand.bind(this)
      );
      log('Android Auto event listener set up');

      // Set up library cache listener (also triggers initial browse sync for Android)
      this.setupLibraryCacheListener();

      // Subscribe to player state changes for MediaSession sync
      await this.setupPlayerStateSync();

      // NOTE: Don't call syncBrowseDataToAndroidAuto here — setupLibraryCacheListener
      // already triggers an immediate initial sync (line 328). Calling it twice causes
      // duplicate concurrent syncs that race against each other.

      // Periodic browse sync every 30 min to refresh auth tokens in cover URLs
      // and update recently played list while app is open
      if (this.periodicSyncInterval) {
        clearInterval(this.periodicSyncInterval);
      }
      this.periodicSyncInterval = setInterval(() => {
        log('Periodic browse sync (30 min)');
        this.syncBrowseDataToAndroidAuto();
      }, 30 * 60 * 1000);

      log('Android Auto initialized successfully');

    } catch (error) {
      log('Error initializing Android Auto:', error);
      // setupLibraryCacheListener already called above — don't call again
      // to avoid duplicate subscriptions causing redundant browse syncs
    }
  }

  /**
   * Handle commands received from native Android Auto
   * Uses a lock to prevent concurrent commands from racing
   */
  private async handleAndroidAutoCommand(event: { command: string; param?: string }): Promise<void> {
    log('Received Android Auto command:', event);

    // If a command is already executing, queue this one (except for duplicate play/pause)
    if (this.isCommandExecuting) {
      // Don't queue duplicate consecutive commands
      const lastQueued = this.commandQueue[this.commandQueue.length - 1];
      if (lastQueued?.command === event.command) {
        log('Ignoring duplicate queued command:', event.command);
        return;
      }
      log('Command queued (another in progress):', event.command);
      this.commandQueue.push(event);
      return;
    }

    this.isCommandExecuting = true;

    try {
      await this.executeCommand(event);
      // Signal command cooldown to suppress syncState subscription
      // This prevents the subscription from re-syncing state that AA already
      // knows about, which would renegotiate audio focus and cause stuttering
      this._notifyCommandExecuted?.();
    } finally {
      this.isCommandExecuting = false;

      // Process any queued commands
      if (this.commandQueue.length > 0) {
        const nextCommand = this.commandQueue.shift();
        if (nextCommand) {
          // PERF: Reduced delay from 50ms to 10ms for faster command processing
          setTimeout(() => this.handleAndroidAutoCommand(nextCommand), 10);
        }
      }
    }
  }

  /**
   * Execute a single Android Auto command
   */
  private async executeCommand(event: { command: string; param?: string }): Promise<void> {
    switch (event.command) {
      case 'playFromMediaId':
        if (event.param) {
          // Check if this is a chapter navigation request
          if (event.param.startsWith('chapter:')) {
            await this.playChapter(event.param);
          } else {
            await this.playItem(event.param);
          }
        }
        break;

      case 'play':
        {
          // PERF: Use pre-imported store (no dynamic import latency)
          const state = usePlayerStore.getState();

          // Guard: Don't auto-play if no book is loaded (prevents unwanted playback
          // when Android Auto connects and auto-triggers onPlay on the MediaSession)
          if (!state.currentBook) {
            log('Play command ignored — no book loaded');
            break;
          }

          // Guard: If already playing, don't call play() again. Calling play() when
          // already playing triggers audio focus renegotiation which causes the
          // play-stop-play-stop stuttering on Android Auto reconnection.
          // DO NOT call forceAndroidAutoSync() here — it calls updatePlaybackState()
          // which renegotiates audio focus, causing the same thrashing we're avoiding.
          // The subscription-based syncState handles ongoing state sync.
          if (state.isPlaying) {
            log('Already playing, skipping redundant play command');
            break;
          }

          state.play();  // Fire-and-forget for instant response
          log('Play command executed');

          // Don't send immediate updatePlaybackState here — let the syncState
          // subscription handle it. Sending it here AND in syncState causes both
          // MediaSessions (phone + Android Auto) to fight over audio focus,
          // resulting in the phone losing focus and going silent.

          // Ensure browse data is synced after play starts (in case it was empty)
          setTimeout(() => this.syncBrowseDataToAndroidAuto(), 500);
        }
        break;

      case 'pause':
        {
          // PERF: Use pre-imported store (no dynamic import latency)
          const state = usePlayerStore.getState();
          state.pause();  // Fire-and-forget for instant response
          log('Pause command executed');

          // Don't send immediate updatePlaybackState here — let the syncState
          // subscription handle it. Same audio focus conflict as play above.

          // Refresh browse data after pause so Recently Played reflects latest progress
          setTimeout(() => this.syncBrowseDataToAndroidAuto(), 1000);
        }
        break;

      case 'skipNext':
      case 'skipToNext':
        {
          const state = usePlayerStore.getState();
          await state.nextChapter();
          // Trust the native player to resume after seek (per playerStore convention).
          // Calling audioService.play() directly bypasses playerStore state,
          // causing isPlaying mismatch that makes AA show paused while audio plays.
          log('Skip next (next chapter) executed');
        }
        break;

      case 'skipPrevious':
      case 'skipToPrevious':
        {
          const state = usePlayerStore.getState();
          await state.prevChapter();
          log('Skip previous (previous chapter) executed');
        }
        break;

      case 'stop':
        // PERF: Use pre-imported store
        usePlayerStore.getState().pause();  // Fire-and-forget for instant response
        log('Stop command executed (paused)');
        break;

      case 'fastForward':
        {
          // PERF: Use pre-imported store
          const state = usePlayerStore.getState();
          await state.skipForward(30);
          log('Fast forward 30s executed');
          // Position feedback handled by syncState subscription (>10s jump detection)
        }
        break;

      case 'rewind':
        {
          // PERF: Use pre-imported store
          const state = usePlayerStore.getState();
          await state.skipBackward(30);
          log('Rewind 30s executed');
          // Position feedback handled by syncState subscription (>10s jump detection)
        }
        break;

      case 'seekTo':
        if (event.param) {
          const position = parseInt(event.param, 10);
          if (!isNaN(position)) {
            // PERF: Use pre-imported store
            const state = usePlayerStore.getState();
            const wasPlaying = state.isPlaying;
            const positionSec = position / 1000; // Convert ms to seconds
            await state.seekTo(positionSec);
            // FIX: Resume via playerStore.play() instead of audioService.play()
            // Direct audioService.play() bypasses playerStore state causing isPlaying mismatch
            if (wasPlaying && !audioService.getIsPlaying()) {
              await usePlayerStore.getState().play();
            }
            log('SeekTo executed:', positionSec);
            // Position feedback handled by syncState subscription (>10s jump detection)
          }
        }
        break;

      case 'search':
      case 'playFromSearch':
        // Note: empty string is valid (resume most recent), so check for undefined
        if (event.param !== undefined) {
          await this.handleSearch(event.param);
        }
        break;

      case 'speedUp':
        await this.handleSpeedChange('up');
        break;

      case 'speedDown':
        await this.handleSpeedChange('down');
        break;

      case 'addBookmark':
        await this.handleAddBookmark();
        break;

      case 'showChapters':
        log('Show chapters requested - not yet implemented');
        break;

      case 'customAction':
        log('Custom action received:', event.param);
        break;

      case 'connected':
        // Android Auto client (re)connected — force full metadata + state re-sync
        // Without this, reconnection shows stale/empty Now Playing because the JS
        // subscription's prev values already match current state and won't re-fire.
        log('Android Auto (re)connected, forcing full state re-sync');
        this.forceAndroidAutoSync();
        // Also ensure browse data is fresh (immediate — AA is waiting)
        this.syncBrowseDataToAndroidAuto(true);
        break;

      case 'requestBrowseData':
        // Native service is requesting browse data (likely just started or resumed)
        log('Browse data requested by native service');
        this.syncBrowseDataToAndroidAuto();
        break;

      default:
        log('Unknown Android Auto command:', event.command);
    }
  }

  /**
   * Handle speed change from Android Auto
   */
  private async handleSpeedChange(direction: 'up' | 'down'): Promise<void> {
    try {
      // PERF: Use pre-imported stores
      const state = usePlayerStore.getState();
      const speedState = useSpeedStore.getState();
      const bookId = state.currentBook?.id;
      // Get current speed from bookSpeedMap (per-book) or fall back to globalDefaultRate
      const currentSpeed = (bookId && speedState.bookSpeedMap[bookId]) || speedState.globalDefaultRate || 1.0;

      const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
      let currentIndex = speeds.findIndex(s => Math.abs(s - currentSpeed) < 0.01);

      // If current speed isn't in the preset list, find the nearest one
      if (currentIndex === -1) {
        currentIndex = speeds.reduce((best, s, i) =>
          Math.abs(s - currentSpeed) < Math.abs(speeds[best] - currentSpeed) ? i : best, 0);
      }

      let newSpeed: number;
      if (direction === 'up') {
        newSpeed = currentIndex < speeds.length - 1 ? speeds[currentIndex + 1] : speeds[speeds.length - 1];
      } else {
        newSpeed = currentIndex > 0 ? speeds[currentIndex - 1] : speeds[0];
      }

      await state.setPlaybackRate(newSpeed);
      log(`Speed changed from ${currentSpeed}x to ${newSpeed}x`);
    } catch (error) {
      log('Failed to change speed:', error);
    }
  }

  /**
   * Handle bookmark creation from Android Auto
   */
  private async handleAddBookmark(): Promise<void> {
    try {
      // PERF: Use pre-imported store
      const state = usePlayerStore.getState();

      if (!state.currentBook) {
        log('No book playing, cannot add bookmark');
        return;
      }

      const position = state.position;
      const bookId = state.currentBook.id;
      const bookTitle = getBookMetadata(state.currentBook)?.title || 'Unknown';

      // Try to add bookmark via the bookmark store/API
      try {
        const { useBookmarksStore } = await import('@/features/player/stores/bookmarksStore');
        useBookmarksStore.getState().setCurrentBookId(bookId);
        await useBookmarksStore.getState().addBookmark({
          title: `Bookmark at ${this.formatTime(position)}`,
          note: null,
          time: position,
          chapterTitle: null,
        });
        log(`Bookmark added at ${position}s for "${bookTitle}"`);
      } catch {
        // Fallback: just log that we would add a bookmark
        log(`Would add bookmark at ${position}s for "${bookTitle}" (store not available)`);
      }
    } catch (error) {
      log('Failed to add bookmark:', error);
    }
  }

  /**
   * Format time in HH:MM:SS format
   */
  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Handle voice search from Android Auto
   * Searches library for matching book and plays it
   * Empty query = play most recently listened book
   */
  private async handleSearch(query: string): Promise<void> {
    log('Handling search:', query || '(empty - resume recent)');

    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      // PERF: Use pre-imported player store

      const libraryItems = useLibraryCache.getState().items;
      const queryLower = query.toLowerCase().trim();

      let match: typeof libraryItems[0] | undefined;

      if (!queryLower) {
        // Empty query - find most recently listened book with progress
        match = libraryItems
          .filter(item => {
            const progress = item.userMediaProgress?.progress || 0;
            return progress > 0 && progress < 1;
          })
          .sort((a, b) => {
            const aTime = a.userMediaProgress?.lastUpdate || 0;
            const bTime = b.userMediaProgress?.lastUpdate || 0;
            return bTime - aTime;
          })[0];

        if (!match) {
          // No in-progress books, try most recently added
          match = [...libraryItems].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0];
        }

        log('Empty search - resuming:', getBookMetadata(match)?.title);
      } else {
        // Search for matching book by title, author, series, or narrator
        match = libraryItems.find(item => {
          const metadata = getBookMetadata(item);
          const title = (metadata?.title || '').toLowerCase();
          const author = (metadata?.authorName || metadata?.authors?.[0]?.name || '').toLowerCase();
          const series = (metadata?.seriesName || '').toLowerCase();
          const narrator = (metadata?.narratorName || '').toLowerCase();

          return (
            title.includes(queryLower) ||
            author.includes(queryLower) ||
            series.includes(queryLower) ||
            narrator.includes(queryLower)
          );
        });

        // If no exact match, try fuzzy matching on title
        if (!match) {
          match = libraryItems.find(item => {
            const metadata = getBookMetadata(item);
            const title = (metadata?.title || '').toLowerCase();
            // Check if query words appear in title
            const queryWords = queryLower.split(/\s+/);
            return queryWords.every(word => title.includes(word));
          });
        }
      }

      if (match) {
        log('Found match for search:', getBookMetadata(match)?.title);
        await usePlayerStore.getState().loadBook(match, {
          autoPlay: true,
          showPlayer: false,
        });
      } else {
        log('No match found for search query:', query);
        // Could show a toast or notification here
      }
    } catch (error) {
      log('Search failed:', error);
    }
  }

  // Periodic sync interval for Android Auto position updates
  private periodicSyncInterval: ReturnType<typeof setInterval> | null = null;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Set up player state synchronization for Android Auto MediaSession
   * This ensures the Now Playing screen shows correct info
   */
  private async setupPlayerStateSync(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      // PERF: Use pre-imported player store
      const { AndroidAutoModule } = NativeModules;

      if (!AndroidAutoModule) {
        log('AndroidAutoModule not available for player sync');
        return;
      }

      // Unsubscribe from previous listener if any
      if (this.playerStoreUnsubscribe) {
        this.playerStoreUnsubscribe();
      }

      // Clear any existing periodic sync
      if (this.periodicSyncInterval) {
        clearInterval(this.periodicSyncInterval);
        this.periodicSyncInterval = null;
      }

      // Track previous values to detect changes
      let prevIsPlaying = false;
      let prevPosition = 0;
      let prevBookId = '';
      let prevChapterTitle: string | null = null;

      // Debounce timer to collapse rapid state changes into one native call.
      // This prevents audio focus renegotiation storms when play/pause/seek
      // fire multiple store updates in quick succession.
      const SYNC_DEBOUNCE_MS = 300;

      // Command cooldown — after handling an AA command, suppress syncState
      // for a brief period to prevent the subscription from immediately
      // re-syncing state that AA already knows about (which renegotiates
      // audio focus and can cause play-then-pause stuttering).
      let lastCommandTime = 0;
      const COMMAND_COOLDOWN_MS = 800;

      // Expose a way for executeCommand to signal a command was just processed
      this._notifyCommandExecuted = () => {
        lastCommandTime = Date.now();
      };

      // Helper to sync playback state to Android Auto (debounced)
      const syncPlaybackState = (isPlaying: boolean, position: number, speed: number) => {
        // Clear any pending debounced sync
        if (this.syncDebounceTimer) {
          clearTimeout(this.syncDebounceTimer);
        }
        this.syncDebounceTimer = setTimeout(() => {
          this.syncDebounceTimer = null;
          try {
            const result = AndroidAutoModule.updatePlaybackState(
              isPlaying,
              position, // seconds - Kotlin converts to ms
              speed
            );
            // Handle both Promise and non-Promise returns
            if (result && typeof result.catch === 'function') {
              result.catch((err: any) => log('Failed to update playback state:', err));
            }
          } catch (err) {
            log('Failed to update playback state:', err);
          }
        }, SYNC_DEBOUNCE_MS);
      };

      // Helper to sync current state to Android Auto.
      // Called when the selector slice changes (book, isPlaying, chapter, speed,
      // duration, or position crossing a 10s boundary).  Reads precise position
      // from getState() so the native side gets an accurate value.
      const syncState = async () => {
        const state = usePlayerStore.getState();
        const isPlaying = state.isPlaying;
        const position = state.position;
        const book = state.currentBook;
        const speed = useSpeedStore.getState().playbackRate || 1.0;
        const duration = state.duration || 0;

        // IMPORTANT: Only sync on meaningful state changes, NOT on a timer.
        // Every syncPlaybackState() call triggers mediaSession.setPlaybackState()
        // on the native side, which renegotiates audio focus. Doing this frequently
        // causes the Android Auto MediaSession to steal audio focus from expo-av,
        // resulting in silent playback even when no car is connected.
        //
        // Android Auto can interpolate position using the playback speed we set
        // in setState(), so we only need to sync on:
        // 1. Play/pause changes
        // 2. Significant position jumps (seeks, chapter changes)

        // Skip sync during command cooldown — the command handler already updated
        // the native state, and re-syncing immediately causes audio focus fights
        if (Date.now() - lastCommandTime < COMMAND_COOLDOWN_MS) {
          // Still track state so we don't miss changes after cooldown
          prevIsPlaying = isPlaying;
          prevPosition = position;
          return;
        }

        // Sync on play/pause changes
        if (isPlaying !== prevIsPlaying) {
          log('Play/pause state changed, syncing:', isPlaying ? 'PLAYING' : 'PAUSED');
          prevIsPlaying = isPlaying;
          prevPosition = position;
          syncPlaybackState(isPlaying, position, speed);
        }
        // Sync on significant position jumps (seeks, chapter changes — >10s jump)
        else if (Math.abs(position - prevPosition) > 10) {
          prevPosition = position;
          syncPlaybackState(isPlaying, position, speed);
        }

        // Sync metadata when book changes or chapter changes
        const currentChapter = state.getCurrentChapter();
        const chapterTitle = currentChapter?.title || null;

        if (book && (book.id !== prevBookId || chapterTitle !== prevChapterTitle)) {
          prevBookId = book.id;
          prevChapterTitle = chapterTitle;

          const metadata = getBookMetadata(book);
          const title = metadata?.title || 'Unknown Title';
          const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
          const seriesName = metadata?.seriesName || metadata?.series?.[0]?.name || null;
          const bookProgress = book.userMediaProgress?.progress || 0;

          // Get cover URL with auth token for native Glide
          const coverUrl = getAuthenticatedCoverUrl(book.id);

          // Use extended metadata if available
          // Note: Kotlin handles seconds-to-ms conversion for duration
          try {
            if (AndroidAutoModule.updateMetadataExtended) {
              const result = AndroidAutoModule.updateMetadataExtended(
                title,
                author,
                duration, // seconds - Kotlin converts to ms
                coverUrl,
                chapterTitle,
                seriesName,
                speed,
                bookProgress
              );
              if (result && typeof result.catch === 'function') {
                result.catch((err: any) => log('Failed to update extended metadata:', err));
              }
            } else {
              // Fallback to basic metadata
              const result = AndroidAutoModule.updateMetadata(
                title,
                author,
                duration, // seconds - Kotlin converts to ms
                coverUrl
              );
              if (result && typeof result.catch === 'function') {
                result.catch((err: any) => log('Failed to update metadata:', err));
              }
            }
          } catch (err) {
            log('Failed to update metadata:', err);
          }

          log('Synced metadata to Android Auto:', { title, author, duration, chapterTitle, seriesName });
        }
      };

      // Immediate sync of current state
      const currentState = usePlayerStore.getState();
      if (currentState.currentBook) {
        log('Syncing initial player state to Android Auto');
        // Force initial sync by resetting prev values
        prevBookId = '';
        prevIsPlaying = !currentState.isPlaying; // Force mismatch
        syncState();
      }

      // PERF: Subscribe to player state changes using selector to avoid ~10Hz
      // position-update spam. The selector picks only the fields we care about
      // and quantizes position to 10s buckets so normal playback (small increments)
      // doesn't trigger the callback. Seeks (>10s jumps) cross bucket boundaries
      // and do trigger. The callback reads precise position via getState().
      this.playerStoreUnsubscribe = usePlayerStore.subscribe(
        (state) => ({
          bookId: state.currentBook?.id ?? null,
          isPlaying: state.isPlaying,
          chapterTitle: state.getCurrentChapter()?.title ?? null,
          duration: state.duration,
          // Quantize position to 10s buckets — fires only when crossing a boundary
          positionBucket: Math.floor((state.position ?? 0) / 10),
        }),
        () => { syncState(); },
        { equalityFn: shallow }
      );

      // NOTE: No periodic interval here. Every updatePlaybackState() call triggers
      // mediaSession.setPlaybackState() on the native side, which renegotiates audio
      // focus via Android's MediaSession framework. Running this on a timer (even at
      // 3s intervals) was causing the phone to lose audio focus — the Android Auto
      // MediaSession would steal it from expo-av's player, resulting in silent playback
      // even when no car was connected (the MediaBrowserService runs at all times).
      //
      // Instead, we rely solely on the subscription above which fires on actual state
      // changes (play/pause, seeks, chapter jumps). Android Auto interpolates position
      // between these syncs using the playback speed we provide in setState().

      log('Player state sync set up for Android Auto (subscription only, no periodic interval)');
    } catch (error) {
      log('Failed to set up player state sync:', error);
    }
  }

  /**
   * Set up CarPlay templates when connected.
   *
   * Tab layout:
   *  1. Continue  – current book + recently played (with progress bars)
   *  2. Library   – all books A-Z, grouped by first letter
   *  3. Authors   – browse by author → drill into their books
   *  4. Downloads – offline books only
   */
  private async setupCarPlayTemplates(): Promise<void> {
    if (!this.carPlayModule) return;

    const { TabBarTemplate, ListTemplate, CarPlay } = this.carPlayModule;

    // -----------------------------------------------------------
    // Gather data
    // -----------------------------------------------------------
    const { useLibraryCache } = await import('@/core/cache/libraryCache');
    const { sqliteCache } = await import('@/core/services/sqliteCache');
    const libraryItems = useLibraryCache.getState().items;
    const playerState = usePlayerStore.getState();

    log('Setting up CarPlay templates, library size:', libraryItems.length);

    // ----- Gather all data and store itemIds on the instance -----
    // onItemSelect closures reference `this.carPlay*ItemIds` (not local vars)
    // so they always see current data even after updateCarPlayLists refreshes them.
    const continueItems = await this.getCarPlayContinueItems(libraryItems, playerState, sqliteCache);
    this.carPlayContinueItemIds = continueItems.itemIds;

    const librarySections = this.getCarPlayLibrarySections(libraryItems);
    this.carPlayLibraryItemIds = librarySections.itemIds;

    this.getCarPlayAuthorSections(libraryItems); // populates this.carPlayAuthors

    const downloadSections = await this.getCarPlayDownloadSections(libraryItems, sqliteCache);
    this.carPlayDownloadItemIds = downloadSections.itemIds;

    // -----------------------------------------------------------
    // 1. Continue Listening tab
    // -----------------------------------------------------------
    this.continueListeningTemplate = new ListTemplate({
      title: 'Continue',
      tabTitle: 'Continue',
      tabSystemImageName: 'book.fill',
      emptyViewTitleVariants: ['No Books In Progress'],
      emptyViewSubtitleVariants: ['Start listening to see your books here'],
      sections: continueItems.sections,
      onItemSelect: async ({ index }: { index: number }) => {
        const itemId = this.carPlayContinueItemIds[index];
        if (itemId) {
          const currentBookId = usePlayerStore.getState().currentBook?.id;
          if (itemId === currentBookId) {
            this.pushChapterList(itemId);
          } else {
            await this.playItem(itemId);
          }
        }
      },
    });

    // -----------------------------------------------------------
    // 2. Library tab (A-Z)
    // -----------------------------------------------------------
    this.libraryTemplate = new ListTemplate({
      title: 'Library',
      tabTitle: 'Library',
      tabSystemImageName: 'books.vertical.fill',
      emptyViewTitleVariants: ['Library Empty'],
      emptyViewSubtitleVariants: ['Connect to your server to browse books'],
      sections: librarySections.sections,
      onItemSelect: async ({ index }: { index: number }) => {
        const itemId = this.carPlayLibraryItemIds[index];
        if (itemId) await this.playItem(itemId);
      },
    });

    // -----------------------------------------------------------
    // 3. Authors tab
    // -----------------------------------------------------------
    this.authorsTemplate = new ListTemplate({
      title: 'Authors',
      tabTitle: 'Authors',
      tabSystemImageName: 'person.2.fill',
      emptyViewTitleVariants: ['No Authors'],
      sections: this.getCarPlayAuthorSections(libraryItems).sections,
      onItemSelect: async ({ index }: { index: number }) => {
        // Read current library at tap time, not stale captured reference
        const { useLibraryCache: libCache } = await import('@/core/cache/libraryCache');
        const currentItems = libCache.getState().items;
        const author = this.carPlayAuthors[index];
        if (author) this.pushAuthorBookList(author.name, author.bookIds, currentItems);
      },
    });

    // -----------------------------------------------------------
    // 4. Downloads tab
    // -----------------------------------------------------------
    this.downloadsTemplate = new ListTemplate({
      title: 'Downloads',
      tabTitle: 'Downloads',
      tabSystemImageName: 'arrow.down.circle.fill',
      emptyViewTitleVariants: ['No Downloads'],
      emptyViewSubtitleVariants: ['Downloaded books appear here for offline listening'],
      sections: downloadSections.sections,
      onItemSelect: async ({ index }: { index: number }) => {
        const itemId = this.carPlayDownloadItemIds[index];
        if (itemId) await this.playItem(itemId);
      },
    });

    // -----------------------------------------------------------
    // Tab Bar (root)
    // -----------------------------------------------------------
    const tabBarTemplate = new TabBarTemplate({
      title: this.config.appName,
      templates: [
        this.continueListeningTemplate,
        this.libraryTemplate,
        this.authorsTemplate,
        this.downloadsTemplate,
      ],
      onTemplateSelect: () => {},
    });

    CarPlay.setRootTemplate(tabBarTemplate);

    // Enable Now Playing (system now-playing screen with playback controls)
    try {
      CarPlay.enableNowPlaying(true);
      log('CarPlay Now Playing enabled');
    } catch (e) {
      log('Failed to enable Now Playing:', e);
    }

    log(`CarPlay templates set up: continue=${this.carPlayContinueItemIds.length}, library=${librarySections.sections.length} sections, authors=${this.carPlayAuthors.length}, downloads=${this.carPlayDownloadItemIds.length}`);
  }

  // ---------------------------------------------------------------
  // CarPlay data builders
  // ---------------------------------------------------------------

  /**
   * Build Continue Listening items: current book + recently played.
   * Returns flat itemIds array matching the visual order across all sections.
   */
  private async getCarPlayContinueItems(
    libraryItems: LibraryItem[],
    playerState: any,
    sqliteCache: any,
  ): Promise<{ sections: any[]; itemIds: string[] }> {
    const sections: any[] = [];
    const itemIds: string[] = [];

    // Current book (if any)
    if (playerState.currentBook) {
      const book = playerState.currentBook;
      const meta = getBookMetadata(book);
      const progress = book.userMediaProgress?.progress || 0;
      const chapter = playerState.getCurrentChapter?.()?.title;
      sections.push({
        header: 'Now Playing',
        items: [{
          text: meta?.title || 'Unknown',
          detailText: chapter || meta?.authorName || meta?.authors?.[0]?.name || '',
          playbackProgress: progress,
          isPlaying: playerState.isPlaying,
          showsDisclosureIndicator: true, // chapters drill-in
        }],
      });
      itemIds.push(book.id);
    }

    // Recently played (up to 15, excluding current)
    try {
      const recentBooks = await sqliteCache.getInProgressUserBooks();
      const currentBookId = playerState.currentBook?.id;
      const recentItems: any[] = [];

      for (const userBook of recentBooks.slice(0, 15)) {
        if (userBook.bookId === currentBookId) continue;
        const item = libraryItems.find(i => i.id === userBook.bookId);
        if (!item) continue;
        const meta = getBookMetadata(item);
        // Use SQLite progress (accurate) instead of library cache progress (stale)
        const progress = userBook.progress;
        recentItems.push({
          text: meta?.title || 'Unknown',
          detailText: meta?.authorName || meta?.authors?.[0]?.name || '',
          playbackProgress: progress,
          showsDisclosureIndicator: false,
        });
        itemIds.push(item.id);
      }

      if (recentItems.length > 0) {
        sections.push({ header: 'Recently Played', items: recentItems });
      }
    } catch (err) {
      log('Error loading recent books for CarPlay:', err);
    }

    return { sections, itemIds };
  }

  /**
   * Build Library sections grouped by first letter (A-Z + #).
   * Returns sections and a flat itemIds array in matching order.
   */
  private getCarPlayLibrarySections(
    libraryItems: LibraryItem[],
  ): { sections: any[]; itemIds: string[] } {
    const sections: any[] = [];
    const itemIds: string[] = [];

    const sorted = [...libraryItems].sort((a, b) => {
      const aTitle = getBookMetadata(a)?.title || '';
      const bTitle = getBookMetadata(b)?.title || '';
      return aTitle.localeCompare(bTitle);
    });

    // Group by first letter
    const groups = new Map<string, { item: LibraryItem; meta: any }[]>();
    for (const item of sorted) {
      const meta = getBookMetadata(item);
      const title = meta?.title || '';
      const firstChar = title.charAt(0).toUpperCase();
      const key = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ item, meta });
    }

    // Build sections in alphabetical order
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      const books = groups.get(key)!;
      sections.push({
        header: key,
        items: books.map(({ item, meta }) => {
          const progress = item.userMediaProgress?.progress || 0;
          const author = meta?.authorName || meta?.authors?.[0]?.name || '';
          itemIds.push(item.id);
          return {
            text: meta?.title || 'Unknown',
            detailText: author,
            playbackProgress: progress > 0 ? progress : undefined,
            showsDisclosureIndicator: false,
          };
        }),
      });
    }

    return { sections, itemIds };
  }

  /**
   * Build Authors sections: one list item per author, sorted A-Z.
   * Tapping an author pushes a detail list of their books.
   */
  private getCarPlayAuthorSections(
    libraryItems: LibraryItem[],
  ): { sections: any[] } {
    // Build author → book mapping
    const authorMap = new Map<string, string[]>();
    for (const item of libraryItems) {
      const meta = getBookMetadata(item);
      const authorName = meta?.authorName || meta?.authors?.[0]?.name;
      if (!authorName) continue;
      if (!authorMap.has(authorName)) authorMap.set(authorName, []);
      authorMap.get(authorName)!.push(item.id);
    }

    // Sort authors alphabetically
    const sortedAuthors = [...authorMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    // Cache for use in onItemSelect
    this.carPlayAuthors = sortedAuthors.map(([name, bookIds]) => ({ name, bookIds }));

    const items = sortedAuthors.map(([name, bookIds]) => ({
      text: name,
      detailText: `${bookIds.length} book${bookIds.length !== 1 ? 's' : ''}`,
      showsDisclosureIndicator: true,
    }));

    return { sections: items.length > 0 ? [{ header: 'All Authors', items }] : [] };
  }

  /**
   * Build Downloads section from completed downloads in SQLite.
   */
  private async getCarPlayDownloadSections(
    libraryItems: LibraryItem[],
    sqliteCache: any,
  ): Promise<{ sections: any[]; itemIds: string[] }> {
    const itemIds: string[] = [];
    try {
      const downloads = await sqliteCache.getAllDownloads();
      const completedIds = new Set<string>(
        downloads.filter((d: any) => d.status === 'complete').map((d: any) => d.itemId)
      );
      this.carPlayDownloadedIds = completedIds;

      const downloadedBooks = libraryItems
        .filter(item => completedIds.has(item.id))
        .sort((a, b) => {
          const aTitle = getBookMetadata(a)?.title || '';
          const bTitle = getBookMetadata(b)?.title || '';
          return aTitle.localeCompare(bTitle);
        });

      const items = downloadedBooks.map(item => {
        const meta = getBookMetadata(item);
        const progress = item.userMediaProgress?.progress || 0;
        itemIds.push(item.id);
        return {
          text: meta?.title || 'Unknown',
          detailText: meta?.authorName || meta?.authors?.[0]?.name || '',
          playbackProgress: progress > 0 ? progress : undefined,
          showsDisclosureIndicator: false,
        };
      });

      return {
        sections: items.length > 0 ? [{ header: 'Available Offline', items }] : [],
        itemIds,
      };
    } catch (err) {
      log('Error loading downloads for CarPlay:', err);
      return { sections: [], itemIds };
    }
  }

  // ---------------------------------------------------------------
  // CarPlay drill-in screens
  // ---------------------------------------------------------------

  /**
   * Push a chapter list for the given book onto the CarPlay nav stack.
   */
  private pushChapterList(bookId: string): void {
    if (!this.carPlayModule) return;

    const { ListTemplate, CarPlay } = this.carPlayModule;
    const state = usePlayerStore.getState();
    const chapters = state.chapters || [];
    const position = state.position || 0;
    const currentChapterIndex = chapters.findIndex(
      (ch: any) => position >= ch.start && position < ch.end
    );

    if (chapters.length === 0) {
      log('No chapters available for book:', bookId);
      return;
    }

    const chapterTemplate = new ListTemplate({
      title: 'Chapters',
      backButtonHidden: false,
      sections: [{
        header: `${chapters.length} Chapters`,
        items: chapters.map((ch: any, idx: number) => ({
          text: ch.title || `Chapter ${idx + 1}`,
          detailText: this.formatTime(ch.start || 0),
          isPlaying: idx === currentChapterIndex,
          showsDisclosureIndicator: false,
        })),
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        await this.playChapter(`chapter:${bookId}:${index}`);
        CarPlay.popTemplate(true);
      },
    });

    CarPlay.pushTemplate(chapterTemplate, true);
    log('Pushed chapter list for book:', bookId, 'chapters:', chapters.length);
  }

  /**
   * Push a list of books by a specific author onto the CarPlay nav stack.
   */
  private pushAuthorBookList(authorName: string, bookIds: string[], libraryItems: LibraryItem[]): void {
    if (!this.carPlayModule) return;

    const { ListTemplate, CarPlay } = this.carPlayModule;

    const books = bookIds
      .map(id => libraryItems.find(i => i.id === id))
      .filter((i): i is LibraryItem => !!i)
      .sort((a, b) => {
        const aTitle = getBookMetadata(a)?.title || '';
        const bTitle = getBookMetadata(b)?.title || '';
        return aTitle.localeCompare(bTitle);
      });

    const bookItemIds: string[] = [];
    const items = books.map(item => {
      const meta = getBookMetadata(item);
      const progress = item.userMediaProgress?.progress || 0;
      const duration = getBookDuration(item);
      bookItemIds.push(item.id);
      return {
        text: meta?.title || 'Unknown',
        detailText: formatSubtitle('', duration, progress > 0 ? progress : undefined),
        playbackProgress: progress > 0 ? progress : undefined,
        showsDisclosureIndicator: false,
      };
    });

    const authorTemplate = new ListTemplate({
      title: authorName,
      backButtonHidden: false,
      sections: [{ header: `${books.length} Book${books.length !== 1 ? 's' : ''}`, items }],
      onItemSelect: async ({ index }: { index: number }) => {
        const itemId = bookItemIds[index];
        if (itemId) await this.playItem(itemId);
      },
    });

    CarPlay.pushTemplate(authorTemplate, true);
    log('Pushed author book list:', authorName, 'books:', books.length);
  }

  /**
   * Play a specific chapter in the current book
   * @param chapterId Format: "chapter:{bookId}:{chapterIndex}"
   */
  private async playChapter(chapterId: string): Promise<void> {
    log('Playing chapter:', chapterId);

    try {
      const parts = chapterId.split(':');
      if (parts.length !== 3 || parts[0] !== 'chapter') {
        log('Invalid chapter ID format:', chapterId);
        return;
      }

      const bookId = parts[1];
      const chapterIndex = parseInt(parts[2], 10);

      if (isNaN(chapterIndex)) {
        log('Invalid chapter index:', parts[2]);
        return;
      }

      // PERF: Use pre-imported player store
      const state = usePlayerStore.getState();

      // Verify the book is loaded
      if (!state.currentBook || state.currentBook.id !== bookId) {
        log('Chapter book does not match current book, loading book first');
        // Try to load the book first
        const { useLibraryCache } = await import('@/core/cache/libraryCache');
        const book = useLibraryCache.getState().items.find(i => i.id === bookId);
        if (book) {
          await state.loadBook(book, { autoPlay: false, showPlayer: false });
        } else {
          log('Book not found in library:', bookId);
          return;
        }
      }

      // Validate chapter index is within bounds
      const chapters = usePlayerStore.getState().chapters || [];
      if (chapterIndex < 0 || chapterIndex >= chapters.length) {
        log('Chapter index out of bounds:', chapterIndex, 'total:', chapters.length);
        return;
      }

      // Jump to the chapter and start playback
      await usePlayerStore.getState().jumpToChapter(chapterIndex);
      await usePlayerStore.getState().play();
      log('Jumped to chapter', chapterIndex, 'and started playback');
    } catch (error) {
      log('Failed to play chapter:', error);
    }
  }

  /**
   * Play a library item (with deduplication to prevent double playback)
   */
  private async playItem(itemId: string): Promise<void> {
    const now = Date.now();

    // Deduplication: Skip if same item requested within debounce window
    if (
      this.lastPlayedItemId === itemId &&
      now - this.lastPlayedTime < AutomotiveService.PLAY_DEBOUNCE_MS
    ) {
      log('Ignoring duplicate play request for:', itemId, '(within debounce window)');
      return;
    }

    // Update deduplication tracking
    this.lastPlayedItemId = itemId;
    this.lastPlayedTime = now;

    log('Playing item:', itemId);

    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      // PERF: Use pre-imported player store

      const item = useLibraryCache.getState().items.find(i => i.id === itemId);
      if (!item) {
        log('Item not found in library cache:', itemId);
        return;
      }

      await usePlayerStore.getState().loadBook(item, {
        autoPlay: true,
        showPlayer: false, // Don't show phone player when in car
      });

      log('Item started playing:', getBookMetadata(item)?.title);

      // FIX: Force immediate sync to Android Auto after playback starts
      // This ensures the correct resume position is sent to MediaSession
      if (Platform.OS === 'android') {
        setTimeout(() => this.forceAndroidAutoSync(), 500);
      }

      // Also notify callbacks if set
      this.callbacks?.onAction({
        type: 'playItem',
        itemId,
      });
    } catch (error) {
      log('Failed to play item:', error);
    }
  }

  /**
   * Force sync current player state to Android Auto
   * Used after playback starts or Android Auto reconnects to ensure
   * the Now Playing screen shows correct title, cover, and position.
   */
  private async forceAndroidAutoSync(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const { AndroidAutoModule } = NativeModules;
      if (!AndroidAutoModule) return;

      const state = usePlayerStore.getState();
      const book = state.currentBook;
      if (!book) return;

      const metadata = getBookMetadata(book);
      const title = metadata?.title || 'Unknown Title';
      const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
      const seriesName = metadata?.seriesName || metadata?.series?.[0]?.name || null;
      const duration = state.duration || 0;
      const position = state.position || 0;
      const speed = state.getBookSpeed(book.id) || 1.0;
      const isPlaying = state.isPlaying;
      const bookProgress = book.userMediaProgress?.progress || 0;
      const chapterTitle = state.getCurrentChapter()?.title || null;

      const coverUrl = getAuthenticatedCoverUrl(book.id);

      log('Forcing Android Auto sync:', { title, position, duration, isPlaying, chapterTitle });

      // Update metadata (use extended version for chapter/series info)
      try {
        if (AndroidAutoModule.updateMetadataExtended) {
          AndroidAutoModule.updateMetadataExtended(
            title,
            author,
            duration,
            coverUrl,
            chapterTitle,
            seriesName,
            speed,
            bookProgress
          );
        } else {
          AndroidAutoModule.updateMetadata(title, author, duration, coverUrl);
        }
      } catch (err) {
        log('Failed to force metadata sync:', err);
      }

      // Update playback state with current position
      try {
        AndroidAutoModule.updatePlaybackState(isPlaying, position, speed);
        // Notify the sync subscription to suppress for cooldown period
        // (prevents audio focus thrashing from duplicate updatePlaybackState calls)
        if (this._notifyCommandExecuted) {
          this._notifyCommandExecuted();
        }
      } catch (err) {
        log('Failed to force playback state sync:', err);
      }
    } catch (error) {
      log('Failed to force Android Auto sync:', error);
    }
  }

  /**
   * Update all CarPlay list templates with current data.
   */
  private async updateCarPlayLists(): Promise<void> {
    if (!this.carPlayModule || this.connectedPlatform !== 'carplay') return;

    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const libraryItems = useLibraryCache.getState().items;
      const playerState = usePlayerStore.getState();

      // Update Continue Listening (sections + itemIds)
      if (this.continueListeningTemplate) {
        const continueData = await this.getCarPlayContinueItems(libraryItems, playerState, sqliteCache);
        this.carPlayContinueItemIds = continueData.itemIds;
        this.continueListeningTemplate.updateSections(continueData.sections);
      }

      // Update Library (sections + itemIds)
      if (this.libraryTemplate) {
        const libraryData = this.getCarPlayLibrarySections(libraryItems);
        this.carPlayLibraryItemIds = libraryData.itemIds;
        this.libraryTemplate.updateSections(libraryData.sections);
      }

      // Update Authors (sections + carPlayAuthors)
      if (this.authorsTemplate) {
        const authorData = this.getCarPlayAuthorSections(libraryItems);
        this.authorsTemplate.updateSections(authorData.sections);
      }

      // Update Downloads (sections + itemIds)
      if (this.downloadsTemplate) {
        const downloadData = await this.getCarPlayDownloadSections(libraryItems, sqliteCache);
        this.carPlayDownloadItemIds = downloadData.itemIds;
        this.downloadsTemplate.updateSections(downloadData.sections);
      }

      log('Updated all CarPlay lists');
    } catch (error) {
      log('Error updating CarPlay lists:', error);
    }
  }

  /**
   * Set callbacks for automotive events
   */
  setCallbacks(callbacks: AutomotiveCallbacks): void {
    // Preserve any existing action handler set by setActionHandler
    const existingAction = this.callbacks?.onAction;
    this.callbacks = {
      ...callbacks,
      onAction: callbacks.onAction || existingAction || (() => {}),
    };
  }

  /**
   * Set only the action handler without overwriting connection callbacks.
   * This allows updating the action handler independently.
   */
  setActionHandler(handler: AutomotiveCallbacks['onAction']): void {
    if (this.callbacks) {
      this.callbacks.onAction = handler;
    } else {
      // If no callbacks set yet, create with defaults
      this.callbacks = {
        onConnect: () => {},
        onDisconnect: () => {},
        onAction: handler,
      };
    }
  }

  /**
   * Update now playing information for automotive displays
   */
  async updateNowPlaying(_nowPlaying: AutomotiveNowPlaying): Promise<void> {
    if (this.connectionState !== 'connected') return;

    // CarPlay Now Playing is automatically handled by MPNowPlayingInfoCenter
    // which is already updated by our audioService/expo-media-control
    // So we don't need to do anything extra here for CarPlay

    // For Android Auto, the MediaSession is also already updated
    log('Now Playing updated for automotive');
  }

  /**
   * Helper to create a BrowseItem from a LibraryItem
   */
  private createBrowseItem(
    item: LibraryItem,
    options?: {
      showProgress?: boolean;
      progressOverride?: number; // Use SQLite progress instead of stale library cache
      localCoverPath?: string;
      sequence?: number;
    }
  ): BrowseItem {
    const metadata = getBookMetadata(item);
    const duration = getBookDuration(item);
    // Prefer SQLite progress (progressOverride) over library cache progress —
    // the cache is from the last API fetch and may be hours stale
    const progress = options?.progressOverride ?? (item.userMediaProgress?.progress || 0);
    const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';

    return {
      id: item.id,
      title: metadata?.title || 'Unknown Title',
      subtitle: formatSubtitle(author, duration, options?.showProgress ? progress : undefined),
      imageUrl: options?.localCoverPath || getAuthenticatedCoverUrl(item.id),
      isPlayable: true,
      isBrowsable: false,
      progress: options?.showProgress ? progress : undefined,
      durationMs: Math.round(duration * 1000),
      sequence: options?.sequence,
    };
  }

  /**
   * Get browse sections for library display
   * Simplified for stability: Last Played + Library only.
   * Fewer sections = fewer notifyChildrenChanged() calls = no flashing/crashing.
   */
  async getBrowseSections(): Promise<BrowseSection[]> {
    const sections: BrowseSection[] = [];

    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      const { sqliteCache } = await import('@/core/services/sqliteCache');

      const libraryItems = useLibraryCache.getState().items;
      const playerState = usePlayerStore.getState();

      // =================================================================
      // CONTINUE LISTENING - Current book for quick resume
      // =================================================================
      if (playerState.currentBook) {
        const liveProgress = playerState.duration > 0 ? playerState.position / playerState.duration : undefined;
        const continueItem = this.createBrowseItem(playerState.currentBook, { showProgress: true, progressOverride: liveProgress });
        sections.push({
          id: 'continue-listening',
          title: 'Continue Listening',
          items: [continueItem],
        });
      }

      // =================================================================
      // RECENTLY PLAYED - From SQLite, sorted by last_played_at DESC
      // =================================================================
      try {
        const recentBooks = await sqliteCache.getInProgressUserBooks();
        if (recentBooks.length > 0) {
          const recentItems: BrowseItem[] = [];
          const currentBookId = playerState.currentBook?.id;

          for (const userBook of recentBooks.slice(0, 20)) {
            // Skip the current book — it's already in "Continue Listening"
            if (userBook.bookId === currentBookId) continue;

            const item = libraryItems.find(i => i.id === userBook.bookId);
            if (item) {
              // Use SQLite progress (accurate) instead of library cache progress (stale)
              recentItems.push(this.createBrowseItem(item, {
                showProgress: true,
                progressOverride: userBook.progress,
              }));
            }
          }

          if (recentItems.length > 0) {
            sections.push({
              id: 'recently-played',
              title: 'Recently Played',
              items: recentItems,
            });
          }
        }
      } catch (err) {
        log('Error loading recently played books:', err);
      }

      // =================================================================
      // LIBRARY - All books alphabetically
      // =================================================================
      const libraryBookItems = [...libraryItems]
        .sort((a, b) => {
          const aTitle = getBookMetadata(a)?.title || '';
          const bTitle = getBookMetadata(b)?.title || '';
          return aTitle.localeCompare(bTitle);
        })
        .map(item => this.createBrowseItem(item, { showProgress: true }));

      if (libraryBookItems.length > 0) {
        sections.push({
          id: 'library',
          title: 'Library',
          items: libraryBookItems,
        });
      }

    } catch (error) {
      log('Error getting browse sections:', error);
    }

    return sections;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): AutomotiveConnectionState {
    return this.connectionState;
  }

  /**
   * Get connected platform
   */
  getConnectedPlatform(): AutomotivePlatform {
    return this.connectedPlatform;
  }

  /**
   * Check if connected to any automotive platform
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutomotiveConfig>): void {
    this.config = { ...this.config, ...config };
    log('Config updated');
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from library cache
    if (this.libraryCacheUnsubscribe) {
      this.libraryCacheUnsubscribe();
      this.libraryCacheUnsubscribe = null;
    }

    // Unsubscribe from player state
    if (this.playerStoreUnsubscribe) {
      this.playerStoreUnsubscribe();
      this.playerStoreUnsubscribe = null;
    }

    // Clear periodic sync interval
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }

    // Clear debounce timer to prevent stale native calls after teardown
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }

    // Remove Android Auto event subscription
    if (this.androidAutoSubscription) {
      this.androidAutoSubscription.remove();
      this.androidAutoSubscription = null;
    }

    // Remove native module listeners
    if (Platform.OS === 'android') {
      try {
        const { AndroidAutoModule } = NativeModules;
        if (AndroidAutoModule?.removeListeners) {
          AndroidAutoModule.removeListeners(1);
        }
      } catch (error) {
        log('Error removing Android Auto listeners:', error);
      }
    }

    // Clear browse sync timers
    if (this.browseSyncDebounceTimer) {
      clearTimeout(this.browseSyncDebounceTimer);
      this.browseSyncDebounceTimer = null;
    }
    if (this.browseSyncRetryTimer) {
      clearTimeout(this.browseSyncRetryTimer);
      this.browseSyncRetryTimer = null;
    }

    // Clear template references and command queue
    this.continueListeningTemplate = null;
    this.libraryTemplate = null;
    this.authorsTemplate = null;
    this.downloadsTemplate = null;
    this.carPlayContinueItemIds = [];
    this.carPlayLibraryItemIds = [];
    this.carPlayAuthors = [];
    this.carPlayDownloadItemIds = [];
    this.carPlayDownloadedIds = new Set();
    this.commandQueue = [];

    this.connectionState = 'disconnected';
    this.connectedPlatform = 'none';
    this.isInitialized = false;
    log('Automotive service cleaned up');
  }
}

// Export singleton
export const automotiveService = new AutomotiveService();
