/**
 * App.tsx
 *
 * Entry point with optimized initialization.
 * Uses AppInitializer for parallel loading and AnimatedSplash for seamless transition.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, NativeModules } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider } from './src/core/auth';
import { AppNavigator } from './src/navigation/AppNavigator';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient } from './src/core/queryClient';
import { appInitializer, InitResult, InitProgressCallback } from './src/core/services/appInitializer';
import { AnimatedSplash } from './src/shared/components/AnimatedSplash';
import { GlobalLoadingOverlay } from './src/shared/components';
import { ErrorProvider } from './src/core/errors';
import { logger } from './src/shared/utils/logger';
import { initI18n } from './src/i18n';
import i18n from 'i18next';


import { useLibraryCache } from './src/core/cache';
import { useSpineCacheStore, selectIsPopulated } from './src/features/home/stores/spineCache';
import { useAppReadyStore, setAppBootComplete, setAppRefreshComplete } from './src/core/stores/appReadyStore';
import {
  INIT_SLOW_THRESHOLD_MS,
  INIT_VERY_SLOW_THRESHOLD_MS,
  CACHE_READY_TIMEOUT_MS,
} from './src/constants/loading';
import * as SplashScreen from 'expo-splash-screen';

// Reset boot flags immediately on bundle load (before any components render)
setAppBootComplete(false);
setAppRefreshComplete(false);


// IMMEDIATELY hide native splash when JS bundle loads
// AnimatedSplash will already be rendering, so transition is seamless
SplashScreen.hideAsync().catch((e) => logger.debug('[App] SplashScreen.hideAsync failed', e));

// Global error handler to catch silent crashes in release builds
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to native Android logcat (works in release builds)
    if (NativeModules.ExceptionsManager) {
      NativeModules.ExceptionsManager.reportException({ message: `[GLOBAL ERROR] ${error?.message || error}`, stack: error?.stack, isFatal });
    }
    // Call original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Note: Native splash is hidden immediately at module load (line 24-26)
// No failsafe timer needed - AnimatedSplash handles the loading UI

export default function App() {
  // Performance monitoring in development
  // DISABLED: Causes excessive logging and potential memory leaks
  // if (__DEV__) {
  //   useAppHealthMonitor();
  // }

  // Runtime monitoring in development
  // DISABLED: Causes excessive logging - enable only when debugging specific issues
  // useEffect(() => {
  //   if (__DEV__) {
  //     startAllMonitoring();
  //
  //     // Instrumentation check after 10 seconds
  //     const checkTimer = setTimeout(() => {
  //       console.log('\n=== INSTRUMENTATION CHECK ===');
  //       console.log('Memory native:', memoryMonitor.isUsingNative());
  //       console.log('Memory stats:', memoryMonitor.getStats());
  //       console.log('FPS contexts:', Object.keys(fpsMonitor.getAllStats()));
  //       console.log('=============================\n');
  //     }, 10000);
  //
  //     return () => {
  //       clearTimeout(checkTimer);
  //       stopAllMonitoring();
  //     };
  //   }
  // }, []);

  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [initResult, setInitResult] = useState<InitResult | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Real init progress from appInitializer callback (0 to 1 = init phase only)
  const [initFraction, setInitFraction] = useState(0);
  const [initStepLabel, setInitStepLabel] = useState('');
  const [i18nReady, setI18nReady] = useState(false);

  // Slow loading detection
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [isVerySlowLoading, setIsVerySlowLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const _startTimeRef = useRef(Date.now());

  // Check if library and spine caches are ready
  const isLibraryCacheLoaded = useLibraryCache((s) => s.isLoaded);
  const isLibraryCacheLoading = useLibraryCache((s) => s.isLoading);
  const libraryCacheError = useLibraryCache((s) => s.error);
  const _lastRefreshed = useLibraryCache((s) => s.lastRefreshed);
  const refreshCache = useLibraryCache((s) => s.refreshCache);
  const currentLibraryId = useLibraryCache((s) => s.currentLibraryId);
  const isSpineCachePopulated = useSpineCacheStore(selectIsPopulated);
  // Community manifest matched — true when loadSpineManifest() has run and matched books
  const communitySpineCount = useLibraryCache((s) => s.booksWithCommunitySpines.size);

  // Track if initial refresh has completed (prevents library flash on first load)
  const [isInitialRefreshComplete, setIsInitialRefreshComplete] = useState(false);
  const hasTriggeredRefresh = React.useRef(false);
  const hasTriggeredSpinePrefetch = React.useRef(false);
  const setBootComplete = useAppReadyStore((s) => s.setBootComplete);

  // Trigger initial refresh after cache is loaded (prevents library flash)
  // This ensures fresh data is fetched before splash dismisses
  //
  // RACE CONDITION FIX: We now also watch currentLibraryId. This handles the case where:
  // 1. Init returns hasUser=false due to network error
  // 2. AuthProvider restores the user session from cache
  // 3. AppNavigator loads the library (sets currentLibraryId)
  // 4. We need to trigger refresh even though initResult.user was false
  useEffect(() => {
    // Wait for initResult to be set before making any decisions
    if (!initResult) return;

    // Case 1: Cache is loaded and we have a user - boot immediately, refresh in background
    if (isLibraryCacheLoaded && !hasTriggeredRefresh.current && initResult.user) {
      hasTriggeredRefresh.current = true;
      // Boot immediately with cached data - don't wait for network refresh
      console.log('[App] Cache loaded, setting boot=true (refresh in background)');
      setIsInitialRefreshComplete(true);
      setBootComplete(true);
      // Refresh in background - UI updates reactively when new data arrives
      refreshCache().then(() => {
        console.log('[App] Background library refresh complete');
        setAppRefreshComplete(true);
      }).catch(() => {
        console.log('[App] Background refresh error (non-blocking)');
        setAppRefreshComplete(true); // Still mark complete so UI doesn't hang
      });
    }
    // Case 2: Cache is loaded via AppNavigator (currentLibraryId set) but initResult.user was false
    // This happens when AuthProvider restores session after init returned no user
    else if (isLibraryCacheLoaded && !hasTriggeredRefresh.current && currentLibraryId && !initResult.user) {
      hasTriggeredRefresh.current = true;
      console.log('[App] Library loaded after auth recovery, setting boot=true (refresh in background)');
      setIsInitialRefreshComplete(true);
      setBootComplete(true);
      refreshCache().then(() => {
        console.log('[App] Post-recovery background refresh complete');
        setAppRefreshComplete(true);
      }).catch(() => {
        console.log('[App] Post-recovery background refresh error (non-blocking)');
        setAppRefreshComplete(true);
      });
    }
    // Case 3: No user and no library being loaded - truly not logged in
    else if (!initResult.user && !currentLibraryId && !isLibraryCacheLoading) {
      console.log('[App] No user and no library loading, setting boot=true');
      setIsInitialRefreshComplete(true);
      setBootComplete(true);
      setAppRefreshComplete(true); // No refresh needed for logged-out state
    }
  }, [isLibraryCacheLoaded, isLibraryCacheLoading, currentLibraryId, initResult, refreshCache, setBootComplete]);

  // SERVER UNREACHABLE: If library cache failed to load (error set, not loading,
  // not loaded) and we have a user, the server is unreachable. Clear the in-memory
  // user so the app falls through to the login screen instead of hanging on splash.
  useEffect(() => {
    if (
      initResult?.user &&
      libraryCacheError &&
      !isLibraryCacheLoaded &&
      !isLibraryCacheLoading
    ) {
      console.log('[App] Server unreachable — library failed to load, showing login');
      setInitResult(prev => prev ? { ...prev, user: null } : null);
    }
  }, [initResult?.user, libraryCacheError, isLibraryCacheLoaded, isLibraryCacheLoading]);

  // Reset cache pipeline when a fresh login triggers cache loading
  // (hasTriggeredRefresh was set true during Case 3 on initial boot with no user)
  useEffect(() => {
    if (currentLibraryId && !isLibraryCacheLoaded && hasTriggeredRefresh.current) {
      console.log('[App] Fresh login detected — resetting cache pipeline');
      hasTriggeredRefresh.current = false;
      setIsInitialRefreshComplete(false);
    }
  }, [currentLibraryId, isLibraryCacheLoaded]);

  // All conditions for splash to dismiss:
  // 1. Fonts loaded (for spine rendering)
  // 2. Library cache loaded (book data)
  // 3. Initial refresh complete (prevents library flash)
  // 4. Spine images prefetched (prevents procedural → real spine flash)
  const [cacheTimedOut, setCacheTimedOut] = useState(false);
  const [isSpinePrefetchDone, setIsSpinePrefetchDone] = useState(false);
  const isCacheReady = cacheTimedOut || (fontsLoaded && isLibraryCacheLoaded && isInitialRefreshComplete && isSpinePrefetchDone);

  // Prefetch spine images once community manifest has matched books.
  // Blocks splash dismissal so the shelf shows real spines immediately.
  // Waits for communitySpineCount > 0 (manifest loaded + matched) before starting.
  // Timeout at 4s — on slow connections, procedural spines are acceptable.
  useEffect(() => {
    if (!isSpineCachePopulated || !isLibraryCacheLoaded || hasTriggeredSpinePrefetch.current) return;
    // Don't start until community manifest has matched at least some books.
    // If community spines are disabled or manifest fails, communitySpineCount stays 0
    // and the 30s global timeout will eventually force-proceed.
    if (communitySpineCount === 0) return;
    hasTriggeredSpinePrefetch.current = true;

    (async () => {
      try {
        const { Image } = await import('expo-image');
        const { getSpineUrl } = await import('./src/core/cache/useSpineUrl');
        const { useProgressStore } = await import('./src/core/stores/progressStore');

        // Only prefetch spines visible on the initial shelf (~first 12 books).
        // getLibraryBookIds() is sorted by most recently played, matching shelf order.
        // Prefetching all 2000+ spines would blow the timeout on fresh installs.
        const VISIBLE_SPINE_COUNT = 12;
        const libraryBookIds = useProgressStore.getState().getLibraryBookIds();
        const visibleIds = libraryBookIds.slice(0, VISIBLE_SPINE_COUNT);

        // Only prefetch books with known community/server spines.
        // getSpineUrl() has a fallback that returns ABS server URLs even for
        // books without spines — those would 404 and waste prefetch time.
        // getSpineUrl() already appends ?h=400 for community spines (~5KB vs ~30KB).
        const { booksWithCommunitySpines, booksWithServerSpines } = useLibraryCache.getState();
        const spineUrls = visibleIds
          .filter(id => booksWithCommunitySpines.has(id) || booksWithServerSpines.has(id))
          .map(id => getSpineUrl(id))
          .filter((url): url is string => !!url);

        if (spineUrls.length > 0) {
          const communityCount = spineUrls.filter(u => u.includes('mysecretlibrary.com')).length;
          console.log(`[App] Prefetching ${spineUrls.length} visible spines (${communityCount} community, ${spineUrls.length - communityCount} server)...`);
          await Promise.race([
            Image.prefetch(spineUrls),
            new Promise(resolve => setTimeout(resolve, 5000)),
          ]);
          console.log(`[App] Spine images prefetched`);
        }
      } catch (err) {
        console.log('[App] Spine prefetch failed (non-blocking):', err);
      } finally {
        setIsSpinePrefetchDone(true);
      }
    })();
  }, [isSpineCachePopulated, isLibraryCacheLoaded, communitySpineCount]);

  // Fallback: if spine prefetch hasn't started after 6s (manifest failed or community
  // spines disabled), mark it done so the splash doesn't hang.
  useEffect(() => {
    if (isSpinePrefetchDone || !isInitialRefreshComplete) return;
    const fallback = setTimeout(() => {
      if (!isSpinePrefetchDone) {
        console.log('[App] Spine prefetch fallback — manifest not ready, proceeding');
        setIsSpinePrefetchDone(true);
      }
    }, 6000);
    return () => clearTimeout(fallback);
  }, [isSpinePrefetchDone, isInitialRefreshComplete]);

  // Absolute timeout: force-proceed if cache conditions stall
  useEffect(() => {
    if (isCacheReady || !initResult?.user) return;

    const timeout = setTimeout(() => {
      console.warn('[App] Cache ready timeout — force-proceeding with available data');
      setCacheTimedOut(true);
      setIsInitialRefreshComplete(true);
      setBootComplete(true);
      setAppRefreshComplete(true); // Force refresh complete on timeout
    }, CACHE_READY_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isCacheReady, initResult?.user, setBootComplete]);

  // Slow loading detection - shows helpful messages if startup takes too long
  useEffect(() => {
    // Don't start timers if already ready
    if (isCacheReady) {
      setIsSlowLoading(false);
      setIsVerySlowLoading(false);
      return;
    }

    // Check network status on mount
    NetInfo.fetch().then((state) => {
      setIsOffline(!state.isConnected);
    });

    // Set up timers for slow loading messages
    const slowTimer = setTimeout(() => {
      if (!isCacheReady) {
        setIsSlowLoading(true);
        console.log('[App] Slow loading detected (>8s)');
      }
    }, INIT_SLOW_THRESHOLD_MS);

    const verySlowTimer = setTimeout(() => {
      if (!isCacheReady) {
        setIsVerySlowLoading(true);
        console.log('[App] Very slow loading detected (>15s)');
        // Re-check network status
        NetInfo.fetch().then((state) => {
          setIsOffline(!state.isConnected);
        });
      }
    }, INIT_VERY_SLOW_THRESHOLD_MS);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(verySlowTimer);
    };
  }, [isCacheReady]);

  // =========================================================================
  // REAL PROGRESS TRACKING
  // =========================================================================
  // Progress bar is split into four phases that map to 0 → 1:
  //   Phase 1 (0.00 → 0.55): appInitializer steps (sqlite, fonts, auth, etc.)
  //   Phase 2 (0.55 → 0.65): i18n init (runs in parallel, may finish anytime)
  //   Phase 3 (0.65 → 0.85): library cache load + sync
  //   Phase 4 (0.85 → 1.00): spine image prefetch
  //
  // Within Phase 1, initFraction (0-1) comes from the appInitializer callback
  // and is scaled to the 0-0.55 range.

  const PHASE1_END = 0.55;
  const PHASE2_END = 0.65;

  const loadingProgress = (() => {
    // Phase 1: init steps
    if (!isInitialized) {
      const i18nBonus = i18nReady ? 0.05 : 0; // i18n can finish during Phase 1
      return Math.min(initFraction * PHASE1_END + i18nBonus, PHASE1_END);
    }
    // Phase 2: i18n + waiting for library to start
    if (!isLibraryCacheLoaded && !isLibraryCacheLoading) {
      return i18nReady ? PHASE2_END : PHASE1_END + 0.03;
    }
    // Phase 3: library cache loading → sync
    if (!isLibraryCacheLoaded && isLibraryCacheLoading) {
      return PHASE2_END + 0.08; // 0.73
    }
    if (!isInitialRefreshComplete) {
      return 0.80;
    }
    // Phase 4: spine image prefetch
    if (!isSpinePrefetchDone) {
      return 0.90;
    }
    if (isCacheReady) return 1;
    return 0.90;
  })();

  // Status text: show what's ACTUALLY happening right now
  const getStatusText = (): string => {
    const t = i18n.t.bind(i18n);

    // Slow loading messages take priority
    if (isVerySlowLoading && isOffline) return t('splash.noInternetConnection');
    if (isVerySlowLoading) return t('splash.stillLoadingCheckConnection');
    if (isSlowLoading) return t('splash.takingLongerThanUsual');

    // During init: use the label from the last completed step
    if (!isInitialized) {
      return initStepLabel || t('splash.preparingDatabase');
    }
    // Post-init phases
    if (libraryCacheError && !isLibraryCacheLoaded) return t('splash.serverUnreachable');
    if (!isLibraryCacheLoaded && !isLibraryCacheLoading) return t('splash.connectingToServer');
    if (!isLibraryCacheLoaded && isLibraryCacheLoading) return t('splash.loadingLibrary');
    if (!isInitialRefreshComplete) return t('splash.syncingLibrary');
    if (!isSpinePrefetchDone) return t('splash.loadingSpines');
    if (isCacheReady) return t('splash.ready');
    return t('splash.loading');
  };

  const loadingStatusText = getStatusText();

  useEffect(() => {
    let mounted = true;

    // Progress callback: appInitializer calls this as each step completes
    const handleInitProgress: InitProgressCallback = (fraction, label) => {
      if (!mounted) return;
      setInitFraction(fraction);
      setInitStepLabel(label);
    };

    async function init() {
      try {
        // Initialize i18n in parallel with app initialization
        const [result] = await Promise.all([
          appInitializer.initialize(handleInitProgress),
          initI18n().then(() => {
            if (mounted) setI18nReady(true);
          }),
        ]);
        if (mounted) {
          setInitResult(result);
          setFontsLoaded(result.fontsLoaded);
          setIsInitialized(true);
        }
      } catch (error) {
        // Error during initialization - app may not load correctly
        console.warn('[App] Initialization error:', error);
        // Still set initialized so app doesn't hang
        if (mounted) {
          setIsInitialized(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Called when animated splash animation completes
  const onSplashReady = useCallback(() => {
    // Just hide the AnimatedSplash overlay
    setShowSplash(false);
  }, []);

  // Detect logout: when library cache transitions from loaded → cleared,
  // clear the stale initResult.user so isDataReady becomes true for login screen.
  // Also immediately dismiss the splash so the login screen shows.
  const prevCacheLoadedRef = useRef(false);
  useEffect(() => {
    if (prevCacheLoadedRef.current && !isLibraryCacheLoaded && !isLibraryCacheLoading) {
      // Cache was loaded but is now cleared (logout) — clear stale user
      console.log('[App] Logout detected — clearing stale initResult.user, dismissing splash');
      setInitResult(prev => prev ? { ...prev, user: null } : null);
      // Force splash off immediately — don't wait for isDataReady to settle
      setShowSplash(false);
    }
    prevCacheLoadedRef.current = isLibraryCacheLoaded;
  }, [isLibraryCacheLoaded, isLibraryCacheLoading]);

  // Determine if data is ready for splash to dismiss
  // - Not logged in AND no library loading: ready immediately
  // - Logged in (or cache loading after fresh login): wait for caches
  const isDataReady = (!initResult?.user && !currentLibraryId && !isLibraryCacheLoading) || isCacheReady;

  // Re-show splash when a fresh login triggers cache loading
  useEffect(() => {
    if (!isDataReady && !showSplash) {
      setShowSplash(true);
    }
  }, [isDataReady, showSplash]);

  // Single consistent component tree - AnimatedSplash is ALWAYS rendered on top
  // This prevents the logo from disappearing during transitions
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider style={{ backgroundColor: '#000' }}>
        {/* Single stable View wrapper to prevent Android SafeAreaProvider null child crash */}
        <View style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            {/* Only render AuthProvider/AppNavigator after initialization */}
            {isInitialized && initResult ? (
              <AuthProvider
                initialSession={{
                  user: initResult.user,
                  serverUrl: initResult.serverUrl,
                }}
              >
                <ErrorProvider subscribeToGlobalErrors={true}>
                  <AppNavigator />
                  {/* Global loading overlay - must be inside same tree as navigator */}
                  <GlobalLoadingOverlay />
                </ErrorProvider>
              </AuthProvider>
            ) : (
              // Empty placeholder during init - splash covers this
              <View style={{ flex: 1, backgroundColor: '#000' }} />
            )}
          </QueryClientProvider>
        </View>
      </SafeAreaProvider>

      {/* AnimatedSplash is ALWAYS at the top level, never unmounts until ready */}
      {showSplash && (
        <AnimatedSplash
          onReady={onSplashReady}
          isDataReady={isInitialized && isDataReady}
          progress={loadingProgress}
          statusText={loadingStatusText}
        />
      )}
    </GestureHandlerRootView>
  );
}
