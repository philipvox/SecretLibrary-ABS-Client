/**
 * src/navigation/AppNavigator.tsx
 *
 * Optimized navigation - no blocking loading states.
 * Shows UI immediately with cached data, loads fresh data in background.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, InteractionManager, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/core/auth';
import { useLibraryCache } from '@/core/cache';
import { useDefaultLibrary } from '@/features/library';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { SeriesListScreen } from '@/features/library/screens/SeriesListScreen';
import { AuthorsListScreen } from '@/features/library/screens/AuthorsListScreen';
import { NarratorsListScreen } from '@/features/library/screens/NarratorsListScreen';
import { GenresListScreen } from '@/features/library/screens/GenresListScreen';
import { GenreDetailScreen } from '@/features/library/screens/GenreDetailScreen';
import { FilteredBooksScreen } from '@/features/library/screens/FilteredBooksScreen';
import { AllBooksScreen } from '@/features/library/screens/AllBooksScreen';
import { LibraryScreen } from '@/features/home';
import { MyLibraryScreen } from '@/features/library';
import { SpinePlaygroundScreen } from '@/features/home/screens/SpinePlaygroundScreen';
import { SearchScreen } from '@/features/search';
import { SecretLibraryBrowseScreen, DurationFilterScreen, CollectionsListScreen } from '@/features/browse';
import { SecretLibrarySeriesDetailScreen } from '@/features/series';
import { SecretLibraryAuthorDetailScreen } from '@/features/author';
import { SecretLibraryNarratorDetailScreen } from '@/features/narrator';
import { CollectionDetailScreen } from '@/features/collections';
import { SecretLibraryBookDetailScreen } from '@/features/book-detail';
import { ProfileScreen, PlaybackSettingsScreen, DataStorageSettingsScreen, HapticSettingsScreen, DisplaySettingsScreen, PlaylistSettingsScreen, DeveloperSettingsScreen, AboutScreen } from '@/features/profile';
import { SecretLibraryPlayerScreen, BookCompletionSheet } from '@/features/player';
import { useQueueStore } from '@/shared/stores/queueFacade';
import { DownloadsScreen } from '@/features/downloads/screens/DownloadsScreen';
import { StatsScreen } from '@/features/stats';
import { DebugStressTestScreen } from '@/features/debug';
import { downloadManager } from '@/core/services/downloadManager';
import { networkMonitor } from '@/core/services/networkMonitor';
import { navigationMonitor } from '@/utils/runtimeMonitor';
import { GlobalMiniPlayer } from './components/GlobalMiniPlayer';
import { NetworkStatusBar, ToastContainer, LocalStorageNoticeModal, BookContextMenuProvider, CoachMarksOverlay } from '@/shared/components';
import { FpsOverlay } from '@/shared/components/FpsOverlay';
import { ErrorBoundary } from '@/core/errors/ErrorBoundary';
import { logger } from '@/shared/utils/logger';
import { withTimeout } from '@/shared/utils/timeout';
import { useLocalStorageNoticeStore } from '@/core/stores/localStorageNoticeStore';
import { useCoachMarksStore } from '@/shared/stores/coachMarksStore';

const INIT_TIMEOUT_MS = 10_000;

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Custom dark theme with pure black background to prevent white flash
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#000000',
  },
};

// Wrap main tab screens with error boundaries for crash prevention
function SecretLibraryScreenWithBoundary() {
  return (
    <ErrorBoundary context="LibraryScreen" level="screen">
      <LibraryScreen />
    </ErrorBoundary>
  );
}

function LibraryScreenWithBoundary() {
  return (
    <ErrorBoundary context="MyLibraryScreen" level="screen">
      <MyLibraryScreen />
    </ErrorBoundary>
  );
}

function BrowseScreenWithBoundary() {
  return (
    <ErrorBoundary context="BrowseScreen" level="screen">
      <SecretLibraryBrowseScreen />
    </ErrorBoundary>
  );
}

function ProfileScreenWithBoundary() {
  return (
    <ErrorBoundary context="ProfileScreen" level="screen">
      <ProfileScreen />
    </ErrorBoundary>
  );
}

// Wrap critical detail/search screens with error boundaries
function SearchScreenWithBoundary() {
  return (
    <ErrorBoundary context="SearchScreen" level="screen">
      <SearchScreen />
    </ErrorBoundary>
  );
}

function BookDetailScreenWithBoundary() {
  return (
    <ErrorBoundary context="BookDetailScreen" level="screen">
      <SecretLibraryBookDetailScreen />
    </ErrorBoundary>
  );
}

function SeriesDetailScreenWithBoundary() {
  return (
    <ErrorBoundary context="SeriesDetailScreen" level="screen">
      <SecretLibrarySeriesDetailScreen />
    </ErrorBoundary>
  );
}

function AuthorDetailScreenWithBoundary() {
  return (
    <ErrorBoundary context="AuthorDetailScreen" level="screen">
      <SecretLibraryAuthorDetailScreen />
    </ErrorBoundary>
  );
}

function NarratorDetailScreenWithBoundary() {
  return (
    <ErrorBoundary context="NarratorDetailScreen" level="screen">
      <SecretLibraryNarratorDetailScreen />
    </ErrorBoundary>
  );
}

function GenreDetailScreenWithBoundary() {
  return (
    <ErrorBoundary context="GenreDetailScreen" level="screen">
      <GenreDetailScreen />
    </ErrorBoundary>
  );
}

function CollectionDetailScreenWithBoundary() {
  return (
    <ErrorBoundary context="CollectionDetailScreen" level="screen">
      <CollectionDetailScreen />
    </ErrorBoundary>
  );
}

function DownloadsScreenWithBoundary() {
  return (
    <ErrorBoundary context="DownloadsScreen" level="screen">
      <DownloadsScreen />
    </ErrorBoundary>
  );
}

function StatsScreenWithBoundary() {
  return (
    <ErrorBoundary context="StatsScreen" level="screen">
      <StatsScreen />
    </ErrorBoundary>
  );
}

function FilteredBooksScreenWithBoundary() {
  return (
    <ErrorBoundary context="FilteredBooksScreen" level="screen">
      <FilteredBooksScreen />
    </ErrorBoundary>
  );
}

function SeriesListScreenWithBoundary() {
  return (
    <ErrorBoundary context="SeriesListScreen" level="screen">
      <SeriesListScreen />
    </ErrorBoundary>
  );
}

function AuthorsListScreenWithBoundary() {
  return (
    <ErrorBoundary context="AuthorsListScreen" level="screen">
      <AuthorsListScreen />
    </ErrorBoundary>
  );
}

function NarratorsListScreenWithBoundary() {
  return (
    <ErrorBoundary context="NarratorsListScreen" level="screen">
      <NarratorsListScreen />
    </ErrorBoundary>
  );
}

function GenresListScreenWithBoundary() {
  return (
    <ErrorBoundary context="GenresListScreen" level="screen">
      <GenresListScreen />
    </ErrorBoundary>
  );
}

function AllBooksScreenWithBoundary() {
  return (
    <ErrorBoundary context="AllBooksScreen" level="screen">
      <AllBooksScreen />
    </ErrorBoundary>
  );
}

function DurationFilterScreenWithBoundary() {
  return (
    <ErrorBoundary context="DurationFilterScreen" level="screen">
      <DurationFilterScreen />
    </ErrorBoundary>
  );
}

function BrowsePageScreenWithBoundary() {
  return (
    <ErrorBoundary context="BrowsePageScreen" level="screen">
      <SecretLibraryBrowseScreen />
    </ErrorBoundary>
  );
}

function CollectionsListScreenWithBoundary() {
  return (
    <ErrorBoundary context="CollectionsListScreen" level="screen">
      <CollectionsListScreen />
    </ErrorBoundary>
  );
}

function PlaybackSettingsScreenWithBoundary() {
  return (
    <ErrorBoundary context="PlaybackSettingsScreen" level="screen">
      <PlaybackSettingsScreen />
    </ErrorBoundary>
  );
}

function DataStorageSettingsScreenWithBoundary() {
  return (
    <ErrorBoundary context="DataStorageSettingsScreen" level="screen">
      <DataStorageSettingsScreen />
    </ErrorBoundary>
  );
}

function HapticSettingsScreenWithBoundary() {
  return (
    <ErrorBoundary context="HapticSettingsScreen" level="screen">
      <HapticSettingsScreen />
    </ErrorBoundary>
  );
}


function DisplaySettingsScreenWithBoundary() {
  return (
    <ErrorBoundary context="DisplaySettingsScreen" level="screen">
      <DisplaySettingsScreen />
    </ErrorBoundary>
  );
}

function PlaylistSettingsScreenWithBoundary() {
  return (
    <ErrorBoundary context="PlaylistSettingsScreen" level="screen">
      <PlaylistSettingsScreen />
    </ErrorBoundary>
  );
}

function AboutScreenWithBoundary() {
  return (
    <ErrorBoundary context="AboutScreen" level="screen">
      <AboutScreen />
    </ErrorBoundary>
  );
}


function SpinePlaygroundScreenWithBoundary() {
  return (
    <ErrorBoundary context="SpinePlaygroundScreen" level="screen">
      <SpinePlaygroundScreen />
    </ErrorBoundary>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        freezeOnBlur: true,
      }}
      initialRouteName="HomeTab"
    >
      <Tab.Screen name="HomeTab" component={SecretLibraryScreenWithBoundary} />
      <Tab.Screen name="LibraryTab" component={LibraryScreenWithBoundary} />
      <Tab.Screen name="DiscoverTab" component={BrowseScreenWithBoundary} />
      <Tab.Screen name="ProfileTab" component={ProfileScreenWithBoundary} />
    </Tab.Navigator>
  );
}

// Wrapper that loads cache in background - no blocking loading states
function AuthenticatedApp() {
  const { library } = useDefaultLibrary();
  const { loadCache } = useLibraryCache();
  const initQueue = useQueueStore((state) => state.init);
  const navigationRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);
  const routeNameRef = useRef<string | undefined>(undefined);

  // Local storage notice modal state
  const shouldShowNotice = useLocalStorageNoticeStore((s) => s.shouldShowNotice);
  const [showLocalStorageNotice, setShowLocalStorageNotice] = React.useState(false);
  const hasCheckedNotice = useRef(false);

  const libraryItems = useLibraryCache((state) => state.items);

  // Coach marks (first-run walkthrough)
  const hasSeenCoachMarks = useCoachMarksStore((s) => s.hasSeenCoachMarks);
  const [showCoachMarks, setShowCoachMarks] = React.useState(false);

  // Check if we should show the notice after initial load
  useEffect(() => {
    if (library?.id && !hasCheckedNotice.current) {
      hasCheckedNotice.current = true;
      // Small delay to let the main UI render first
      const timer = setTimeout(() => {
        if (shouldShowNotice()) {
          setShowLocalStorageNotice(true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [library?.id, shouldShowNotice]);

  // Show coach marks (first-run only)
  useEffect(() => {
    if (!hasSeenCoachMarks && libraryItems.length > 0) {
      const timer = setTimeout(() => setShowCoachMarks(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenCoachMarks, libraryItems.length]);

  // Navigation state tracking for runtime monitoring
  const onNavigationStateChange = () => {
    if (__DEV__) {
      const currentRoute = navigationRef.current?.getCurrentRoute();
      const currentRouteName = currentRoute?.name;

      if (currentRouteName && currentRouteName !== routeNameRef.current) {
        routeNameRef.current = currentRouteName;
        navigationMonitor.recordNavigation(currentRouteName);
      }
    }
  };

  // Pre-initialize audio service at app startup for faster playback
  // Use InteractionManager to defer until after initial render and animations
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Lazy import to avoid circular dependency
      const { audioService } = require('@/features/player/services/audioService');
      const setupPromise = audioService?.ensureSetup?.();
      if (setupPromise) {
        withTimeout(setupPromise, INIT_TIMEOUT_MS, 'Audio service setup').catch((err: any) => {
          logger.warn('[AppNavigator] Audio service pre-init failed:', err);
        });
      }

      // Load player settings (control mode, progress mode, playback rate)
      const { usePlayerStore } = require('@/features/player/stores/playerStore');
      const settingsPromise = usePlayerStore.getState().loadPlayerSettings?.();
      if (settingsPromise) {
        withTimeout(settingsPromise, INIT_TIMEOUT_MS, 'Player settings load').catch((err: any) => {
          logger.warn('[AppNavigator] Player settings load failed:', err);
        });
      }

      // Initialize Chromecast — sets up event listeners, starts discovery,
      // and detects existing sessions (e.g., app restarted while casting)
      try {
        const { useCastStore } = require('@/features/chromecast/stores/castStore');
        const castPromise = useCastStore.getState().initialize();
        if (castPromise && typeof castPromise.then === 'function') {
          withTimeout(castPromise, INIT_TIMEOUT_MS, 'Chromecast init').catch((err: any) => {
            logger.warn('[AppNavigator] Cast init failed:', err);
          });
        }
      } catch (err: any) {
        logger.warn('[AppNavigator] Cast init failed:', err);
      }
    });
    return () => task.cancel();
  }, []);

  // Initialize queue store - defer to prevent transition glitches
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      initQueue().catch((err: any) => {
        logger.warn('[AppNavigator] Queue init failed:', err);
      });
    });
    return () => task.cancel();
  }, [initQueue]);

  // Initialize network monitor first (download manager depends on it)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      networkMonitor.init().catch((err: any) => {
        logger.warn('[AppNavigator] Network monitor init failed:', err);
      });
    });
    return () => task.cancel();
  }, []);

  // Initialize download manager (resumes paused downloads, starts queue processing)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        downloadManager.init().catch((err: any) => {
          logger.warn('[AppNavigator] Download manager init failed:', err);
        });
      }, 100);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Load cache in background - don't block UI
  useEffect(() => {
    if (library?.id) {
      loadCache(library.id).catch((err) => {
        logger.warn('[AppNavigator] Background cache load failed:', err);
      });
    }
  }, [library?.id, loadCache]);

  // Render immediately - LibraryScreen handles empty state gracefully
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={onNavigationStateChange}
        theme={AppTheme}
      >
        <BookContextMenuProvider>
        <Stack.Navigator screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 250,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Search" component={SearchScreenWithBoundary} />
        <Stack.Screen name="SeriesList" component={SeriesListScreenWithBoundary} />
        <Stack.Screen name="AuthorsList" component={AuthorsListScreenWithBoundary} />
        <Stack.Screen name="NarratorsList" component={NarratorsListScreenWithBoundary} />
        <Stack.Screen name="GenresList" component={GenresListScreenWithBoundary} />
        <Stack.Screen name="GenreDetail" component={GenreDetailScreenWithBoundary} />
        <Stack.Screen name="FilteredBooks" component={FilteredBooksScreenWithBoundary} />
        <Stack.Screen name="AllBooks" component={AllBooksScreenWithBoundary} />
        <Stack.Screen name="DurationFilter" component={DurationFilterScreenWithBoundary} />
        <Stack.Screen name="BrowsePage" component={BrowsePageScreenWithBoundary} />
        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreenWithBoundary} />
        <Stack.Screen name="AuthorDetail" component={AuthorDetailScreenWithBoundary} />
        <Stack.Screen name="NarratorDetail" component={NarratorDetailScreenWithBoundary} />
        <Stack.Screen name="CollectionDetail" component={CollectionDetailScreenWithBoundary} />
        <Stack.Screen name="CollectionsList" component={CollectionsListScreenWithBoundary} />
        <Stack.Screen
          name="BookDetail"
          component={BookDetailScreenWithBoundary}
          options={({ route }) => {
            const params = route.params as { id: string; animationDirection?: string } | undefined;
            const dir = params?.animationDirection;
            return {
              animation: dir === 'none' ? 'none' : dir === 'fade' ? 'fade' : 'default',
            };
          }}
        />
        <Stack.Screen name="Downloads" component={DownloadsScreenWithBoundary} />
        <Stack.Screen name="Stats" component={StatsScreenWithBoundary} />
        <Stack.Screen name="PlaybackSettings" component={PlaybackSettingsScreenWithBoundary} />
        <Stack.Screen name="DataStorageSettings" component={DataStorageSettingsScreenWithBoundary} />
        <Stack.Screen name="HapticSettings" component={HapticSettingsScreenWithBoundary} />
        <Stack.Screen name="DisplaySettings" component={DisplaySettingsScreenWithBoundary} />
        <Stack.Screen name="PlaylistSettings" component={PlaylistSettingsScreenWithBoundary} />
        <Stack.Screen name="About" component={AboutScreenWithBoundary} />
        <Stack.Screen name="SpinePlayground" component={SpinePlaygroundScreenWithBoundary} />
        {__DEV__ && (
          <>
            <Stack.Screen name="DeveloperSettings" component={DeveloperSettingsScreen} />
            <Stack.Screen name="DebugStressTest" component={DebugStressTestScreen} />
          </>
        )}
      </Stack.Navigator>
      {/* Wrap overlay components in stable View to prevent Android SafeAreaProvider crash */}
      {/* The View always renders; children can conditionally return null inside */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SecretLibraryPlayerScreen />
        <GlobalMiniPlayer />
        <NetworkStatusBar />
        <BookCompletionSheet />
        <ToastContainer />
        {__DEV__ && <FpsOverlay />}
        <LocalStorageNoticeModal
          visible={showLocalStorageNotice}
          onDismiss={() => setShowLocalStorageNotice(false)}
        />
        {showCoachMarks && (
          <CoachMarksOverlay onComplete={() => setShowCoachMarks(false)} />
        )}
      </View>
    </BookContextMenuProvider>
    </NavigationContainer>
    </View>
  );
}

export function AppNavigator() {
  const { isAuthenticated } = useAuth();

  // No loading state - App.tsx handles splash screen via AnimatedSplash
  // isLoading should be false when using initialSession from AppInitializer

  if (!isAuthenticated) {
    return (
      <NavigationContainer theme={AppTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return <AuthenticatedApp />;
}
