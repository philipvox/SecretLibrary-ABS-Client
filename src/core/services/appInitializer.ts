/**
 * src/core/services/appInitializer.ts
 *
 * Central initialization orchestrator for app startup.
 * Runs all critical initialization tasks in parallel to minimize launch time.
 * Controls native splash screen visibility.
 *
 * Safety features:
 * - Global timeout prevents infinite splash screen
 * - Individual step timeouts for non-critical operations
 * - Error logging and fallback behavior
 */

import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { User } from '@/core/types';
import { createLogger } from '@/shared/utils/logger';
import { logInitTimings } from '@/shared/utils/loadingDebug';
import {
  INIT_GLOBAL_TIMEOUT_MS,
  INIT_STEP_TIMEOUT_MS,
} from '@/constants/loading';

const log = createLogger('AppInit');

// Note: Native splash is hidden immediately in App.tsx when JS loads
// AnimatedSplash component handles the loading UI from that point

export interface InitResult {
  user: User | null;
  serverUrl: string | null;
  fontsLoaded: boolean;
  /** Set to true if init completed with errors/timeouts */
  hadErrors?: boolean;
  /** List of steps that failed during initialization */
  failedSteps?: string[];
  /** Per-step timing data for profiling */
  stepTimings?: StepTiming[];
  /** Total initialization time in ms */
  totalTime?: number;
}

/**
 * Timing data for a single initialization step.
 */
export interface StepTiming {
  step: string;
  duration: number;
  status: 'success' | 'timeout' | 'error';
}

const TIMEOUT_SENTINEL = Symbol('timeout');

/**
 * Wraps a promise with a timeout.
 * Returns { value, timedOut } to distinguish void results from timeouts.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stepName: string
): Promise<{ value: T | undefined; timedOut: boolean }> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    timeoutId = setTimeout(() => {
      log.warn(`${stepName} timed out after ${timeoutMs}ms`);
      resolve(TIMEOUT_SENTINEL);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    if (result === TIMEOUT_SENTINEL) {
      return { value: undefined, timedOut: true };
    }
    return { value: result as T, timedOut: false };
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

class AppInitializer {
  private initPromise: Promise<InitResult> | null = null;
  private isReady = false;
  private failedSteps: string[] = [];
  private stepTimings: Map<string, StepTiming> = new Map();

  /**
   * Initialize all critical resources in parallel.
   * Returns when app is ready to render content.
   *
   * Safety: Has global timeout to prevent infinite splash screen.
   */
  async initialize(): Promise<InitResult> {
    if (this.initPromise) return this.initPromise;

    // Wrap initialization with global timeout
    const initWithTimeout = Promise.race([
      this._initialize(),
      new Promise<InitResult>((resolve) => {
        setTimeout(() => {
          // Only log error if init hasn't actually completed
          if (!this.isReady) {
            log.error(`CRITICAL: Init timed out after ${INIT_GLOBAL_TIMEOUT_MS}ms`);
            log.error('Failed steps:', this.failedSteps);
            resolve({
              user: null,
              serverUrl: null,
              fontsLoaded: false,
              hadErrors: true,
              failedSteps: [...this.failedSteps, 'global_timeout'],
            });
          }
        }, INIT_GLOBAL_TIMEOUT_MS);
      }),
    ]);

    this.initPromise = initWithTimeout;
    return this.initPromise;
  }

  /**
   * Track a failed initialization step.
   */
  private trackFailure(stepName: string, error?: unknown): void {
    this.failedSteps.push(stepName);
    log.error(`Init step failed: ${stepName}`, error instanceof Error ? error.message : error);
  }

  /**
   * Execute an initialization step with timing measurement.
   * Wraps with timeout and records duration regardless of outcome.
   */
  private async timedStep<T>(
    stepName: string,
    task: () => Promise<T>,
    timeoutMs: number
  ): Promise<T | undefined> {
    const startTime = Date.now();

    try {
      const { value, timedOut } = await withTimeout(task(), timeoutMs, stepName);
      const duration = Date.now() - startTime;

      const status = timedOut ? 'timeout' : 'success';
      this.stepTimings.set(stepName, { step: stepName, duration, status });

      if (timedOut) {
        this.failedSteps.push(stepName);
      }

      return value;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.stepTimings.set(stepName, { step: stepName, duration, status: 'error' });
      this.trackFailure(stepName, err);
      return undefined;
    }
  }

  /**
   * Get formatted timing log for all steps.
   */
  private getTimingLog(): string {
    const lines: string[] = [];
    for (const [, timing] of this.stepTimings) {
      const icon = timing.status === 'success' ? '✓' : timing.status === 'timeout' ? '⏱' : '✗';
      lines.push(`  ${timing.step}: ${timing.duration}ms ${icon}`);
    }
    return lines.join('\n');
  }

  private async _initialize(): Promise<InitResult> {
    const startTime = Date.now();
    log.info('Starting parallel initialization...');
    this.failedSteps = []; // Reset for fresh init
    this.stepTimings.clear(); // Reset timings

    // Import auth service lazily to avoid circular dependencies
    const { authService } = await import('@/core/auth/authService');

    // BLOCKING: Wait for fonts, auth, and book state (progress/completion/migration)
    // so the UI shows correct finished/in-progress states immediately
    const [fontResult, authResult] = await Promise.all([
      this.timedStep('fonts', () => this.loadFonts(), INIT_STEP_TIMEOUT_MS),
      this.timedStep('auth', () => this.restoreSession(authService), INIT_STEP_TIMEOUT_MS),
      this.timedStep('completion', () => this.hydrateCompletionStore(), INIT_STEP_TIMEOUT_MS),
      this.timedStep('migration', () => this.migrateUserBooks(), INIT_STEP_TIMEOUT_MS),
      this.timedStep('progress', () => this.loadProgressStore(), INIT_STEP_TIMEOUT_MS),
    ]);

    // NON-CRITICAL: Fire and forget - don't block startup
    Promise.all([
      this.timedStep('recentSync', () => this.syncRecentProgress(), INIT_STEP_TIMEOUT_MS),
      this.timedStep('audio', () => this.preInitAudio(), INIT_STEP_TIMEOUT_MS),
    ]).catch(err => log.warn('Non-critical init steps error:', err));

    const elapsed = Date.now() - startTime;

    // Collect step timings for result
    const stepTimingsArray = Array.from(this.stepTimings.values());

    const result: InitResult = {
      user: authResult?.user || null,
      serverUrl: authResult?.serverUrl || null,
      fontsLoaded: fontResult ?? false,
      hadErrors: this.failedSteps.length > 0,
      failedSteps: this.failedSteps.length > 0 ? [...this.failedSteps] : undefined,
      stepTimings: stepTimingsArray,
      totalTime: elapsed,
    };

    // Log detailed timing breakdown
    log.info(`Init complete: ${elapsed}ms total`);
    logInitTimings(stepTimingsArray, elapsed);
    log.info('Init result', {
      fontsLoaded: result.fontsLoaded,
      hasUser: !!result.user,
      failedSteps: result.failedSteps,
    });

    this.isReady = true;

    // Initialize event listeners and lifecycle handlers
    // These don't block startup but need to be ready ASAP
    this.initEventSystem();

    // Initialize automotive (CarPlay/Android Auto) in background
    // Don't await - this doesn't need to block app startup
    this.initAutomotive();

    // Connect WebSocket if user is authenticated
    // Don't await - this runs in background
    if (result.user) {
      this.connectWebSocket();
      // Sync finished books with server
      this.syncFinishedBooks();
      // Sync My Library with linked collection
      this.syncLibrary();
      // Preload recommendations cache (speeds up Browse screen)
      this.preloadRecommendationsCache();
    }

    return result;
  }

  private async loadFonts(): Promise<boolean> {
    try {
      // Core fonts (always required)
      await Font.loadAsync({
        // Existing pixel font
        PixelOperator: require('@/assets/fonts/PixelOperator.ttf'),

        // Base typography fonts
        'BebasNeue-Regular': require('@/assets/fonts/BebasNeue-Regular.ttf'),
        'Oswald-Regular': require('@/assets/fonts/Oswald-Regular.ttf'),
        'Oswald-Bold': require('@/assets/fonts/Oswald-Bold.ttf'),
        'Lora-Regular': require('@/assets/fonts/Lora-Regular.ttf'),
        'Lora-Bold': require('@/assets/fonts/Lora-Bold.ttf'),
        'PlayfairDisplay-Regular': require('@/assets/fonts/PlayfairDisplay-Regular.ttf'),
        'PlayfairDisplay-Bold': require('@/assets/fonts/PlayfairDisplay-Bold.ttf'),
      });

      // Genre-specific fonts (optional - load if available)
      try {
        await Font.loadAsync({
          // Fantasy (Tolkien, Earthsea)
          'MacondoSwashCaps-Regular': require('@/assets/fonts/MacondoSwashCaps-Regular.ttf'),
          'UncialAntiqua-Regular': require('@/assets/fonts/UncialAntiqua-Regular.ttf'),
          // European Classics (Grenze Gotisch)
          'GrenzeGotisch-Regular': require('@/assets/fonts/GrenzeGotisch-Regular.ttf'),
          // Romance (Pride and Prejudice)
          'FleurDeLeah-Regular': require('@/assets/fonts/FleurDeLeah-Regular.ttf'),
          // Elegant script (romance/poetry replacement)
          'Charm-Regular': require('@/assets/fonts/Charm-Regular.ttf'),
          // Sci-Fi
          'Orbitron-Regular': require('@/assets/fonts/Orbitron-Regular.ttf'),
          // Tech/Computer
          'Silkscreen-Regular': require('@/assets/fonts/Silkscreen-Regular.ttf'),
          // Western/Crime/Deco
          'Notable-Regular': require('@/assets/fonts/Notable-Regular.ttf'),
          'Federo-Regular': require('@/assets/fonts/Federo-Regular.ttf'),
          // NEW FONTS (2026-01-14) - Additional variety
          'GravitasOne-Regular': require('@/assets/fonts/GravitasOne-Regular.ttf'),
          'NotoSerif-Regular': require('@/assets/fonts/NotoSerif-Regular.ttf'),
          'NotoSerif-Bold': require('@/assets/fonts/NotoSerif-Bold.ttf'),
          'LibreBaskerville-Regular': require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
          'LibreBaskerville-Bold': require('@/assets/fonts/LibreBaskerville-Bold.ttf'),
          'AlfaSlabOne-Regular': require('@/assets/fonts/AlfaSlabOne-Regular.ttf'),
          'AlmendraSC-Regular': require('@/assets/fonts/AlmendraSC-Regular.ttf'),
          'ZenDots-Regular': require('@/assets/fonts/ZenDots-Regular.ttf'),
          'Eater-Regular': require('@/assets/fonts/Eater-Regular.ttf'),
          'RubikBeastly-Regular': require('@/assets/fonts/RubikBeastly-Regular.ttf'),
          'Barriecito-Regular': require('@/assets/fonts/Barriecito-Regular.ttf'),
          // Decorative drop cap font (woodcut initials)
          // Note: Font name must match internal TTF name exactly for Android
          'TypographerWoodcutInitialsOne': require('@/assets/fonts/TypographerWoodcut01.ttf'),
        });
        log.info('All genre-specific fonts loaded');
      } catch {
        log.debug('Genre-specific fonts not available (optional)');
      }

      log.info('Custom fonts loaded');
      return true;
    } catch (err) {
      log.warn('Font loading failed:', err);
      return false;
    }
  }

  private async restoreSession(authService: any): Promise<{
    user: User | null;
    serverUrl: string | null;
  }> {
    try {
      // Use optimized parallel session restore if available, otherwise fallback
      if (authService.restoreSessionOptimized) {
        return await authService.restoreSessionOptimized();
      }
      return await authService.restoreSession();
    } catch (err) {
      log.warn('Session restoration failed:', err);
      return { user: null, serverUrl: null };
    }
  }

  private async hydrateCompletionStore(): Promise<void> {
    try {
      const { useCompletionStore } = await import('@/features/completion');
      await useCompletionStore.getState().hydrate();
      log.debug('Completion store hydrated');
    } catch (err) {
      log.warn('Completion store hydration failed:', err);
    }
  }

  /**
   * Load progress store from SQLite and set up subscribers.
   * This is the unified source of truth for all progress data.
   */
  private async loadProgressStore(): Promise<void> {
    try {
      const { useProgressStore, setupProgressSubscribers } = await import('@/core/stores/progressStore');

      // Load all progress from SQLite into memory
      await useProgressStore.getState().loadFromDatabase();

      // Set up subscribers (spineCache, etc.) after initial load
      setupProgressSubscribers();

      log.debug('Progress store loaded and subscribers set up');
    } catch (err) {
      log.warn('Progress store initialization failed:', err);
    }
  }

  /**
   * Sync recent progress from server (fast - just 5 books).
   * Runs during initialization so player can resume immediately.
   */
  private async syncRecentProgress(): Promise<void> {
    try {
      const { finishedBooksSync } = await import('@/core/services/finishedBooksSync');
      const synced = await finishedBooksSync.importRecentProgress();
      if (synced > 0) {
        log.info(`Quick sync: ${synced} recent books synced`);
        // Reload progressStore so the in-memory Map reflects server-imported data
        const { useProgressStore } = await import('@/core/stores/progressStore');
        await useProgressStore.getState().loadFromDatabase();
      }
    } catch (err) {
      log.warn('Recent progress sync failed:', err);
    }
  }

  /**
   * Pre-initialize audio system during app startup.
   * This eliminates the audio setup delay when user hits play.
   */
  private async preInitAudio(): Promise<void> {
    try {
      const { audioService } = await import('@/features/player/services/audioService');
      const { playbackCache } = await import('@/core/services/playbackCache');

      await audioService.ensureSetup();
      playbackCache.setAudioInitialized(true);

      log.info('Audio system pre-initialized');
    } catch (err) {
      log.warn('Audio pre-init failed:', err);
    }
  }

  private async migrateUserBooks(): Promise<void> {
    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const result = await sqliteCache.migrateToUserBooks();
      if (result.migrated > 0) {
        log.info(`Migrated ${result.migrated} records to user_books`);
      }

      // One-time migration from galleryStore.markedBooks to user_books
      await this.migrateGalleryStoreToUserBooks();
    } catch (err) {
      log.warn('user_books migration failed:', err);
    }
  }

  /**
   * Migrate galleryStore.markedBooks to user_books (one-time migration)
   * NOTE: markedBooks was removed from galleryStore in v0.6.23.
   * This migration only runs if there's legacy data in AsyncStorage.
   */
  private async migrateGalleryStoreToUserBooks(): Promise<void> {
    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');

      // Check if migration already completed
      const migrationKey = 'gallery_to_user_books_v1';
      const migrationDone = await sqliteCache.getSyncMetadata(migrationKey);
      if (migrationDone === 'done') {
        return; // Already migrated
      }

      // Try to read legacy markedBooks from AsyncStorage directly
      // (galleryStore no longer has markedBooks property)
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const storedData = await AsyncStorage.getItem('reading-history-gallery-storage');

      if (storedData) {
        const parsed = JSON.parse(storedData);
        const legacyMarkedBooks = parsed?.state?.markedBooks;

        if (Array.isArray(legacyMarkedBooks) && legacyMarkedBooks.length > 0) {
          // Convert array format back to Map for migration
          // Zustand persist serializes Maps as [[key, value], ...] tuples OR [{bookId, ...}, ...]
          type MarkedBookEntry = { bookId: string; markedAt: number; source: string; synced: boolean };
          const markedBooksMap = new Map<string, MarkedBookEntry>();
          for (const entry of legacyMarkedBooks) {
            if (Array.isArray(entry) && entry.length === 2) {
              // Tuple format: [bookId, {bookId, markedAt, ...}]
              markedBooksMap.set(entry[0], entry[1]);
            } else if (entry && typeof entry === 'object' && entry.bookId) {
              // Object format: {bookId, markedAt, ...}
              markedBooksMap.set(entry.bookId, entry);
            }
          }
          log.info(`Migrating ${markedBooksMap.size} books from legacy galleryStore...`);
          const result = await sqliteCache.migrateGalleryStoreToUserBooks(markedBooksMap);
          log.info(`Gallery migration: ${result.migrated} migrated, ${result.skipped} skipped`);
        }
      }

      // Mark migration as complete
      await sqliteCache.setSyncMetadata(migrationKey, 'done');
    } catch (err) {
      log.warn('galleryStore migration failed:', err);
    }
  }

  private async initAutomotive(): Promise<void> {
    try {
      const { automotiveService } = await import('@/features/automotive');
      await automotiveService.init({
        appName: 'Secret Library',
        enableCarPlay: true,
        enableAndroidAuto: true,
      });
      log.debug('Automotive service initialized');
    } catch (err) {
      log.warn('Automotive initialization failed:', err);
    }
  }

  private async initEventSystem(): Promise<void> {
    try {
      // Initialize app-wide event listeners (analytics, monitoring)
      const { initializeEventListeners } = await import('@/core/events');
      initializeEventListeners();

      // Initialize app state listener (foreground/background detection, refetch)
      const { initializeAppStateListener } = await import('@/core/lifecycle');
      initializeAppStateListener();

      // Initialize memory pressure monitoring
      await this.initMemoryPressureMonitoring();

      // Initialize background task completion service
      await this.initBackgroundTaskService();

      log.debug('Event system initialized');
    } catch (err) {
      log.warn('Event system initialization failed:', err);
    }
  }

  /**
   * Initialize background task completion service.
   * Ensures critical tasks complete when app goes to background.
   */
  private async initBackgroundTaskService(): Promise<void> {
    try {
      const { backgroundTaskService, TaskPriority } = await import('@/core/services/backgroundTaskService');
      const { useProgressStore } = await import('@/core/stores/progressStore');

      // Start the background task service
      backgroundTaskService.start();

      // Register critical task: sync unsynced progress to server
      backgroundTaskService.registerTask({
        id: 'sync-progress',
        name: 'Sync Progress',
        priority: TaskPriority.CRITICAL,
        timeoutMs: 3000,
        execute: async () => {
          const { sqliteCache } = await import('@/core/services/sqliteCache');
          const unsynced = await sqliteCache.getUnsyncedProgress();

          if (unsynced.length === 0) return;

          // Full sync handles both importing server state and pushing local changes
          const { finishedBooksSync } = await import('@/core/services/finishedBooksSync');
          await finishedBooksSync.fullSync();
        },
      });

      // Note: Download state is already persisted in SQLite via downloadManager
      // No additional background task needed for downloads

      log.debug('Background task service initialized');
    } catch (err) {
      log.warn('Background task service initialization failed:', err);
    }
  }

  /**
   * Initialize memory pressure monitoring service.
   * Registers cleanup callbacks to free memory when system is under pressure.
   *
   * NOTE: We do NOT clear the library cache on memory pressure because:
   * 1. Library item data (titles, metadata) is essential for the app to function
   * 2. The data is relatively small compared to images
   * 3. Clearing it causes the Browse screen to show 0 books
   */
  private async initMemoryPressureMonitoring(): Promise<void> {
    try {
      const { memoryPressureService } = await import('@/core/services/memoryPressureService');
      const { networkOptimizer } = await import('@/core/api/networkOptimizer');

      // Register cleanup callback for network cache only
      // Library cache is NOT cleared - it's essential for app functionality
      memoryPressureService.registerCleanupCallback(async () => {
        log.debug('Memory pressure: clearing network cache');
        networkOptimizer.cache.clear();
      });

      // Start memory monitoring
      memoryPressureService.start();

      log.debug('Memory pressure monitoring initialized');
    } catch (err) {
      log.warn('Memory pressure monitoring failed to initialize:', err);
    }
  }

  /**
   * Connect WebSocket for real-time sync.
   * Call this after user is authenticated.
   */
  async connectWebSocket(): Promise<void> {
    try {
      const { websocketService } = await import('@/core/services/websocketService');
      await websocketService.connect();
      log.debug('WebSocket connected');
    } catch (err) {
      log.warn('WebSocket connection failed:', err);
    }
  }

  /**
   * Sync finished books with server.
   * Note: Recent progress sync happens during initialization (syncRecentProgress).
   *
   * OPTIMIZED: Only syncs recent books (items in progress) instead of full library.
   * Full sync was causing slowness by fetching and processing all 200+ items.
   */
  async syncFinishedBooks(): Promise<void> {
    try {
      const { finishedBooksSync } = await import('@/core/services/finishedBooksSync');

      // Preload most recent book into player store (shows correct progress on UI)
      // Note: importRecentProgress already runs during init (syncRecentProgress) — skip duplicate call

      // Sync any unsynced local changes to server (fast - only unsynced items)
      const { synced, failed } = await finishedBooksSync.syncToServer();
      if (synced > 0 || failed > 0) {
        log.info(`Synced ${synced} local changes to server (${failed} failed)`);
      }

      // Fetch items in progress ONCE and share with preload + prefetch
      const { apiClient: api } = await import('@/core/api');
      const itemsInProgress = await api.getItemsInProgress();

      // Preload most recent book (uses shared data)
      await finishedBooksSync.preloadMostRecentBook(itemsInProgress);

      // BACKGROUND: Full import from server (includes finished books)
      // This runs after quick sync so UI is responsive, but finished books show up soon
      finishedBooksSync.importFromServer().then(async (finishedImported) => {
        if (finishedImported > 0) {
          log.info(`Background sync: ${finishedImported} finished books imported from server`);
          // Reload progressStore so the in-memory Map reflects ALL server-imported data
          const { useProgressStore } = await import('@/core/stores/progressStore');
          await useProgressStore.getState().loadFromDatabase();
        }
      }).catch((err) => {
        log.warn('Background finished books sync failed:', err);
      });

      // BACKGROUND: Prefetch sessions for recent books (uses shared data)
      // This caches audioTracks with MOOV data so play() doesn't need network calls
      finishedBooksSync.prefetchSessions(itemsInProgress).then((prefetched) => {
        if (prefetched > 0) {
          log.info(`Prefetched ${prefetched} sessions for instant playback`);
        }
      }).catch((err) => {
        log.warn('Session prefetch failed:', err);
      });
    } catch (err) {
      log.warn('Finished books sync failed:', err);
    }
  }

  /**
   * Preload recommendations cache in background.
   * This speeds up the Browse screen by loading SQLite data early.
   */
  async preloadRecommendationsCache(): Promise<void> {
    try {
      const { useRecommendationsCacheStore } = await import('@/features/recommendations');
      await useRecommendationsCacheStore.getState().loadCache();
      log.debug('Recommendations cache preloaded');
    } catch (err) {
      log.warn('Recommendations cache preload failed:', err);
    }
  }

  /**
   * Sync My Library with linked ABS collection.
   * Runs in background after auth - doesn't block startup.
   */
  async syncLibrary(): Promise<void> {
    try {
      const { useMyLibraryStore } = await import('@/shared/stores/myLibraryStore');
      const { useLibrarySyncStore } = await import('@/shared/stores/librarySyncStore');
      const { apiClient } = await import('@/core/api');
      const { playlistsApi } = await import('@/core/api/endpoints/playlists');
      const syncStore = useLibrarySyncStore.getState();

      // Get library ID
      const libraries = await apiClient.getLibraries();
      const libraryId = libraries?.[0]?.id;
      if (!libraryId) return;

      // Fetch all playlists once for both lookups
      let allPlaylists: Awaited<ReturnType<typeof playlistsApi.getAll>> | null = null;

      // Auto-find or create BOOK library playlist
      if (!syncStore.libraryPlaylistId) {
        allPlaylists = await playlistsApi.getAll();
        log.debug(`Found ${allPlaylists.length} playlists, looking for "__sl_my_library"`);

        // Search by name only - the playlist name is unique per user
        const existingLibrary = allPlaylists.find(
          (p) => p.name === '__sl_my_library'
        );

        if (existingLibrary) {
          syncStore.setLibraryPlaylistId(existingLibrary.id);
          log.debug('Found existing My Library playlist:', existingLibrary.id, 'libraryId:', existingLibrary.libraryId);
        } else {
          const libraryIds = useMyLibraryStore.getState().libraryIds;
          const newPlaylist = await playlistsApi.create({
            libraryId,
            name: '__sl_my_library',
            items: libraryIds.map(id => ({ libraryItemId: id })),
          });
          syncStore.setLibraryPlaylistId(newPlaylist.id);
          log.debug('Auto-created My Library playlist:', newPlaylist.id);
        }
      }

      // Auto-find or create SERIES favorites playlist
      if (!syncStore.seriesPlaylistId) {
        // Reuse the playlists array if already fetched, otherwise fetch now
        if (!allPlaylists) {
          allPlaylists = await playlistsApi.getAll();
        }

        // Search by name only - the playlist name is unique per user
        const existingSeries = allPlaylists.find(
          (p) => p.name === '__sl_favorite_series'
        );

        if (existingSeries) {
          syncStore.setSeriesPlaylistId(existingSeries.id);
          log.debug('Found existing Favorite Series playlist:', existingSeries.id);
        } else {
          const favoriteSeriesNames = useMyLibraryStore.getState().favoriteSeriesNames;
          const newPlaylist = await playlistsApi.create({
            libraryId,
            name: '__sl_favorite_series',
            description: JSON.stringify({ seriesNames: favoriteSeriesNames }),
          });
          syncStore.setSeriesPlaylistId(newPlaylist.id);
          log.debug('Auto-created Favorite Series playlist:', newPlaylist.id);
        }
      }

      const { librarySyncService } = await import('./librarySyncService');
      await librarySyncService.fullSync();
    } catch (err) {
      log.warn('Library sync failed:', err);
    }
  }

  /**
   * Disconnect WebSocket (e.g., on logout).
   */
  async disconnectWebSocket(): Promise<void> {
    try {
      const { websocketService } = await import('@/core/services/websocketService');
      websocketService.disconnect('manual');
      log.debug('WebSocket disconnected');
    } catch (err) {
      log.warn('WebSocket disconnect failed:', err);
    }
  }

  /**
   * Hide native splash screen.
   * Call this after animated splash is ready to take over.
   */
  async hideSplash(): Promise<void> {
    try {
      await SplashScreen.hideAsync();
    } catch (err) {
      // Already hidden or not available
    }
  }

  getIsReady(): boolean {
    return this.isReady;
  }
}

export const appInitializer = new AppInitializer();
