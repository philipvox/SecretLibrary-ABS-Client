/**
 * App.tsx
 *
 * Entry point with optimized initialization.
 * Uses AppInitializer for parallel loading and AnimatedSplash for seamless transition.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, NativeModules } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider } from './src/core/auth';
import { AppNavigator } from './src/navigation/AppNavigator';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient } from './src/core/queryClient';
import { appInitializer, InitResult } from './src/core/services/appInitializer';
import { AnimatedSplash } from './src/shared/components/AnimatedSplash';
import { GlobalLoadingOverlay } from './src/shared/components';
import { ErrorProvider } from './src/core/errors';
import { useAppHealthMonitor } from './src/utils/perfDebug';
import { startAllMonitoring, stopAllMonitoring, fpsMonitor, memoryMonitor } from './src/utils/runtimeMonitor';
import { useLibraryCache } from './src/core/cache';
import { useSpineCacheStore, selectIsPopulated } from './src/features/home/stores/spineCache';
import { useAppReadyStore, setAppBootComplete } from './src/core/stores/appReadyStore';
import {
  INIT_SLOW_THRESHOLD_MS,
  INIT_VERY_SLOW_THRESHOLD_MS,
} from './src/constants/loading';

// Reset boot flag immediately on bundle load (before any components render)
setAppBootComplete(false);
import * as SplashScreen from 'expo-splash-screen';

// IMMEDIATELY hide native splash when JS bundle loads
// AnimatedSplash will already be rendering, so transition is seamless
SplashScreen.hideAsync().catch(() => {});

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

  // Slow loading detection
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [isVerySlowLoading, setIsVerySlowLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Check if library and spine caches are ready
  const isLibraryCacheLoaded = useLibraryCache((s) => s.isLoaded);
  const isLibraryCacheLoading = useLibraryCache((s) => s.isLoading);
  const lastRefreshed = useLibraryCache((s) => s.lastRefreshed);
  const refreshCache = useLibraryCache((s) => s.refreshCache);
  const currentLibraryId = useLibraryCache((s) => s.currentLibraryId);
  const isSpineCachePopulated = useSpineCacheStore(selectIsPopulated);

  // Track if initial refresh has completed (prevents library flash on first load)
  const [isInitialRefreshComplete, setIsInitialRefreshComplete] = useState(false);
  const hasTriggeredRefresh = React.useRef(false);
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

    // Case 1: Cache is loaded and we have a user - trigger refresh
    if (isLibraryCacheLoaded && !hasTriggeredRefresh.current && initResult.user) {
      hasTriggeredRefresh.current = true;
      console.log('[App] Triggering initial library refresh...');
      refreshCache().then(() => {
        console.log('[App] Initial library refresh complete, setting boot=true');
        setIsInitialRefreshComplete(true);
        setBootComplete(true);
      }).catch(() => {
        console.log('[App] Refresh error, setting boot=true');
        setIsInitialRefreshComplete(true);
        setBootComplete(true);
      });
    }
    // Case 2: Cache is loaded via AppNavigator (currentLibraryId set) but initResult.user was false
    // This happens when AuthProvider restores session after init returned no user
    else if (isLibraryCacheLoaded && !hasTriggeredRefresh.current && currentLibraryId && !initResult.user) {
      hasTriggeredRefresh.current = true;
      console.log('[App] Library loaded after auth recovery, triggering refresh...');
      refreshCache().then(() => {
        console.log('[App] Post-recovery refresh complete, setting boot=true');
        setIsInitialRefreshComplete(true);
        setBootComplete(true);
      }).catch(() => {
        console.log('[App] Post-recovery refresh error, setting boot=true');
        setIsInitialRefreshComplete(true);
        setBootComplete(true);
      });
    }
    // Case 3: No user and no library being loaded - truly not logged in
    else if (!initResult.user && !currentLibraryId && !isLibraryCacheLoading) {
      console.log('[App] No user and no library loading, setting boot=true');
      setIsInitialRefreshComplete(true);
      setBootComplete(true);
    }
  }, [isLibraryCacheLoaded, isLibraryCacheLoading, currentLibraryId, initResult, refreshCache, setBootComplete]);

  // All conditions for splash to dismiss:
  // 1. Fonts loaded (for spine rendering)
  // 2. Library cache loaded (book data)
  // 3. Spine cache populated (dimensions, colors, typography)
  // 4. Initial refresh complete (prevents library flash)
  const isCacheReady = fontsLoaded && isLibraryCacheLoaded && isSpineCachePopulated && isInitialRefreshComplete;

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

  // Calculate loading progress (0 to 1) and status text
  // 0.0 - 0.2: Initializing (fonts, auth, etc.)
  // 0.2 - 0.4: Loading library cache
  // 0.4 - 0.6: Populating spine cache
  // 0.6 - 1.0: Initial refresh
  const loadingProgress = !isInitialized ? 0 :
    !fontsLoaded ? 0.1 :
    !isLibraryCacheLoaded && !isLibraryCacheLoading ? 0.2 :
    !isLibraryCacheLoaded && isLibraryCacheLoading ? 0.35 :
    isLibraryCacheLoaded && !isSpineCachePopulated ? 0.5 :
    isSpineCachePopulated && !isInitialRefreshComplete ? 0.75 :
    isCacheReady ? 1 : 0.5;

  // Status text based on loading phase (with slow loading messages)
  const getStatusText = (): string => {
    // Priority: Show slow loading messages if applicable
    if (isVerySlowLoading && isOffline) {
      return 'no internet connection...';
    }
    if (isVerySlowLoading) {
      return 'still loading... check connection?';
    }
    if (isSlowLoading) {
      return 'taking longer than usual...';
    }

    // Normal loading phase messages
    if (!isInitialized) return 'initializing...';
    if (!fontsLoaded) return 'loading fonts...';
    if (!isLibraryCacheLoaded && !isLibraryCacheLoading) return 'restoring session...';
    if (!isLibraryCacheLoaded && isLibraryCacheLoading) return 'loading library...';
    if (isLibraryCacheLoaded && !isSpineCachePopulated) return 'preparing bookshelf...';
    if (isSpineCachePopulated && !isInitialRefreshComplete) return 'syncing library...';
    if (isCacheReady) return 'ready';
    return 'loading...';
  };

  const loadingStatusText = getStatusText();

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const result = await appInitializer.initialize();
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

  // Determine if data is ready for splash to dismiss
  // - Not logged in: ready immediately (no caches to load)
  // - Logged in: wait for fonts + library + spine caches
  const isDataReady = !initResult?.user || isCacheReady;

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
