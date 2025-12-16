/**
 * src/navigation/AppNavigator.tsx
 *
 * Optimized navigation - no blocking loading states.
 * Shows UI immediately with cached data, loads fresh data in background.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/core/auth';
import { useLibraryCache } from '@/core/cache';
import { useDefaultLibrary } from '@/features/library';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { MyLibraryScreen } from '@/features/library';
import { SeriesListScreen } from '@/features/library/screens/SeriesListScreen';
import { AuthorsListScreen } from '@/features/library/screens/AuthorsListScreen';
import { NarratorsListScreen } from '@/features/library/screens/NarratorsListScreen';
import { GenresListScreen } from '@/features/library/screens/GenresListScreen';
import { GenreDetailScreen } from '@/features/library/screens/GenreDetailScreen';
import { HomeScreen } from '@/features/home';
import { CassetteTestScreen } from '@/features/home/screens/CassetteTestScreen';
import { SearchScreen } from '@/features/search';
import { BrowseScreen } from '@/features/browse';
import { SeriesDetailScreen } from '@/features/series';
import { AuthorDetailScreen } from '@/features/author';
import { NarratorDetailScreen } from '@/features/narrator';
import { CollectionDetailScreen } from '@/features/collections';
import { BookDetailScreen } from '@/features/book-detail';
import { ProfileScreen, PlaybackSettingsScreen, StorageSettingsScreen, JoystickSeekSettingsScreen } from '@/features/profile';
import { PreferencesScreen, PreferencesOnboardingScreen } from '@/features/recommendations';
import { MoodDiscoveryScreen, MoodResultsScreen } from '@/features/mood-discovery';
import { CDPlayerScreen } from '@/features/player';
import { QueueScreen, useQueueStore } from '@/features/queue';
import { DownloadsScreen } from '@/features/downloads/screens/DownloadsScreen';
import { StatsScreen } from '@/features/stats';
import { downloadManager } from '@/core/services/downloadManager';
import { networkMonitor } from '@/core/services/networkMonitor';
import { NavigationBar } from './components/NavigationBar';
import { GlobalMiniPlayer } from './components/GlobalMiniPlayer';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="LibraryTab" component={MyLibraryScreen} />
      <Tab.Screen name="DiscoverTab" component={BrowseScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Wrapper that loads cache in background - no blocking loading states
function AuthenticatedApp() {
  const { library } = useDefaultLibrary();
  const { loadCache } = useLibraryCache();
  const initQueue = useQueueStore((state) => state.init);

  // Pre-initialize audio service at app startup for faster playback
  useEffect(() => {
    // Lazy import to avoid circular dependency
    const { audioService } = require('@/features/player/services/audioService');
    audioService?.ensureSetup?.().catch((err: any) => {
      console.warn('[AppNavigator] Audio service pre-init failed:', err);
    });

    // Load player settings (control mode, progress mode, playback rate)
    const { usePlayerStore } = require('@/features/player/stores/playerStore');
    usePlayerStore.getState().loadPlayerSettings?.().catch((err: any) => {
      console.warn('[AppNavigator] Player settings load failed:', err);
    });
  }, []);

  // Initialize queue store
  useEffect(() => {
    initQueue().catch((err: any) => {
      console.warn('[AppNavigator] Queue init failed:', err);
    });
  }, [initQueue]);

  // Initialize network monitor first (download manager depends on it)
  useEffect(() => {
    networkMonitor.init().catch((err: any) => {
      console.warn('[AppNavigator] Network monitor init failed:', err);
    });
  }, []);

  // Initialize download manager (resumes paused downloads, starts queue processing)
  useEffect(() => {
    // Small delay to ensure network monitor is ready
    const timer = setTimeout(() => {
      downloadManager.init().catch((err: any) => {
        console.warn('[AppNavigator] Download manager init failed:', err);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Load cache in background - don't block UI
  useEffect(() => {
    if (library?.id) {
      loadCache(library.id).catch((err) => {
        console.warn('[AppNavigator] Background cache load failed:', err);
      });
    }
  }, [library?.id, loadCache]);

  // Render immediately - HomeScreen handles empty state gracefully
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="SeriesList" component={SeriesListScreen} />
        <Stack.Screen name="AuthorsList" component={AuthorsListScreen} />
        <Stack.Screen name="NarratorsList" component={NarratorsListScreen} />
        <Stack.Screen name="GenresList" component={GenresListScreen} />
        <Stack.Screen name="GenreDetail" component={GenreDetailScreen} />
        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
        <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} />
        <Stack.Screen name="NarratorDetail" component={NarratorDetailScreen} />
        <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
        <Stack.Screen name="BookDetail" component={BookDetailScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="QueueScreen" component={QueueScreen} />
        <Stack.Screen name="Downloads" component={DownloadsScreen} />
        <Stack.Screen name="Stats" component={StatsScreen} />
        <Stack.Screen name="PlaybackSettings" component={PlaybackSettingsScreen} />
        <Stack.Screen name="StorageSettings" component={StorageSettingsScreen} />
        <Stack.Screen name="JoystickSeekSettings" component={JoystickSeekSettingsScreen} />
        <Stack.Screen name="CassetteTest" component={CassetteTestScreen} />
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
      </Stack.Navigator>
      <CDPlayerScreen />
      <GlobalMiniPlayer />
      <NavigationBar />
    </NavigationContainer>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // No loading state - App.tsx handles splash screen via AnimatedSplash
  // isLoading should be false when using initialSession from AppInitializer

  if (!isAuthenticated) {
    return (
      <NavigationContainer>
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