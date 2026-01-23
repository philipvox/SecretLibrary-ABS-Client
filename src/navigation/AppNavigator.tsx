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
import { CassetteTestScreen } from '@/features/home/screens/CassetteTestScreen';
import { SpineTemplatePreviewScreen } from '@/features/home/screens/SpineTemplatePreviewScreen';
import { SearchScreen } from '@/features/search';
import { SecretLibraryBrowseScreen, DurationFilterScreen } from '@/features/browse';
import { SecretLibrarySeriesDetailScreen } from '@/features/series';
import { SecretLibraryAuthorDetailScreen } from '@/features/author';
import { SecretLibraryNarratorDetailScreen } from '@/features/narrator';
import { CollectionDetailScreen } from '@/features/collections';
import { SecretLibraryBookDetailScreen } from '@/features/book-detail';
import { ProfileScreen, PlaybackSettingsScreen, StorageSettingsScreen, JoystickSeekSettingsScreen, HapticSettingsScreen, ChapterCleaningSettingsScreen, HiddenItemsScreen, KidModeSettingsScreen, AppearanceSettingsScreen } from '@/features/profile';
import { PreferencesScreen, PreferencesOnboardingScreen } from '@/features/recommendations';
import { MoodDiscoveryScreen, MoodResultsScreen } from '@/features/mood-discovery';
import { SecretLibraryPlayerScreen, BookCompletionSheet } from '@/features/player';
import { MarkBooksScreen, ReadingHistoryScreen } from '@/features/reading-history-wizard';
import { QueueScreen, useQueueStore } from '@/features/queue';
import { DownloadsScreen } from '@/features/downloads/screens/DownloadsScreen';
import { StatsScreen } from '@/features/stats';
import { WishlistScreen, ManualAddScreen } from '@/features/wishlist';
import { DebugStressTestScreen } from '@/features/debug';
import { downloadManager } from '@/core/services/downloadManager';
import { networkMonitor } from '@/core/services/networkMonitor';
import { navigationMonitor } from '@/utils/runtimeMonitor';
import { NavigationBar } from './components/NavigationBar';
import { GlobalMiniPlayer } from './components/GlobalMiniPlayer';
import { NetworkStatusBar, ToastContainer } from '@/shared/components';
import { ErrorBoundary } from '@/core/errors/ErrorBoundary';
import { logger } from '@/shared/utils/logger';

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

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
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
      audioService?.ensureSetup?.().catch((err: any) => {
        logger.warn('[AppNavigator] Audio service pre-init failed:', err);
      });

      // Load player settings (control mode, progress mode, playback rate)
      const { usePlayerStore } = require('@/features/player/stores/playerStore');
      usePlayerStore.getState().loadPlayerSettings?.().catch((err: any) => {
        logger.warn('[AppNavigator] Player settings load failed:', err);
      });
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
    // Use InteractionManager + small delay to ensure network monitor is ready
    const task = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(() => {
        downloadManager.init().catch((err: any) => {
          logger.warn('[AppNavigator] Download manager init failed:', err);
        });
      }, 100);
      return () => clearTimeout(timer);
    });
    return () => task.cancel();
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
    <NavigationContainer
      ref={navigationRef}
      onStateChange={onNavigationStateChange}
      theme={AppTheme}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Search" component={SearchScreenWithBoundary} />
        <Stack.Screen name="SeriesList" component={SeriesListScreen} />
        <Stack.Screen name="AuthorsList" component={AuthorsListScreen} />
        <Stack.Screen name="NarratorsList" component={NarratorsListScreen} />
        <Stack.Screen name="GenresList" component={GenresListScreen} />
        <Stack.Screen name="GenreDetail" component={GenreDetailScreen} />
        <Stack.Screen name="FilteredBooks" component={FilteredBooksScreen} />
        <Stack.Screen name="AllBooks" component={AllBooksScreen} />
        <Stack.Screen name="DurationFilter" component={DurationFilterScreen} />
        <Stack.Screen name="BrowsePage" component={SecretLibraryBrowseScreen} />
        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreenWithBoundary} />
        <Stack.Screen name="AuthorDetail" component={AuthorDetailScreenWithBoundary} />
        <Stack.Screen name="NarratorDetail" component={NarratorDetailScreenWithBoundary} />
        <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
        <Stack.Screen
          name="BookDetail"
          component={BookDetailScreenWithBoundary}
          options={({ route }) => ({
            // No animation for series carousel - we handle it ourselves
            animation: (route.params as any)?.animationDirection ? 'none' : 'default',
          })}
        />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="QueueScreen" component={QueueScreen} />
        <Stack.Screen name="Downloads" component={DownloadsScreen} />
        <Stack.Screen name="Stats" component={StatsScreen} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} />
        <Stack.Screen name="ManualAdd" component={ManualAddScreen} />
        <Stack.Screen name="PlaybackSettings" component={PlaybackSettingsScreen} />
        <Stack.Screen name="StorageSettings" component={StorageSettingsScreen} />
        <Stack.Screen name="JoystickSeekSettings" component={JoystickSeekSettingsScreen} />
        <Stack.Screen name="HapticSettings" component={HapticSettingsScreen} />
        <Stack.Screen name="ChapterCleaningSettings" component={ChapterCleaningSettingsScreen} />
        <Stack.Screen name="HiddenItems" component={HiddenItemsScreen} />
        <Stack.Screen name="KidModeSettings" component={KidModeSettingsScreen} />
        <Stack.Screen name="AppearanceSettings" component={AppearanceSettingsScreen} />
        <Stack.Screen name="CassetteTest" component={CassetteTestScreen} />
        <Stack.Screen name="SpineTemplatePreview" component={SpineTemplatePreviewScreen} />
        {__DEV__ && (
          <Stack.Screen name="DebugStressTest" component={DebugStressTestScreen} />
        )}
        <Stack.Screen
          name="PreferencesOnboarding"
          component={PreferencesOnboardingScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="MoodDiscovery"
          component={MoodDiscoveryScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="MoodResults"
          component={MoodResultsScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="ReadingHistoryWizard"
          component={MarkBooksScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="ReadingHistory"
          component={ReadingHistoryScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
      {/* Wrap overlay components in stable View to prevent Android SafeAreaProvider crash */}
      {/* The View always renders; children can conditionally return null inside */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SecretLibraryPlayerScreen />
        <GlobalMiniPlayer />
        {/* <NavigationBar /> */}
        <NetworkStatusBar />
        <BookCompletionSheet />
        <ToastContainer />
      </View>
    </NavigationContainer>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

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

// Styles removed - no longer using CacheLoadingScreen
const styles = StyleSheet.create({});