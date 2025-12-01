/**
 * src/navigation/AppNavigator.tsx
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/core/auth';
import { useLibraryCache } from '@/core/cache';
import { useDefaultLibrary } from '@/features/library';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { MyLibraryScreen } from '@/features/library';
import { HomeScreen } from '@/features/home';
import { SearchScreen } from '@/features/search';
import { BrowseScreen } from '@/features/browse';
import { SeriesDetailScreen } from '@/features/series';
import { AuthorDetailScreen } from '@/features/author';
import { NarratorDetailScreen } from '@/features/narrator';
import { CollectionDetailScreen } from '@/features/collections';
import { ProfileScreen } from '@/features/profile';
import { PreferencesScreen, PreferencesOnboardingScreen } from '@/features/recommendations';
import { MiniPlayer, PlayerScreen, audioService } from '@/features/player';
import { SplashScreen } from '@/shared/components/SplashScreen';
import { FloatingTabBar } from './components/FloatingTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const BG_COLOR = '#1a1a1a';
const ACCENT = '#CCFF00';

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
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

// Loading screen while caching library
function CacheLoadingScreen({ progress }: { progress: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.cacheLoading, { paddingTop: insets.top }]}>
      <View style={styles.cacheContent}>
        <Text style={styles.cacheEmoji}>📚</Text>
        <Text style={styles.cacheTitle}>Loading Library</Text>
        <Text style={styles.cacheSubtitle}>{progress}</Text>
        <ActivityIndicator size="large" color={ACCENT} style={styles.cacheSpinner} />
      </View>
    </View>
  );
}

// Wrapper that loads cache before showing main content
function AuthenticatedApp() {
  const { library } = useDefaultLibrary();
  const { loadCache, isLoaded, isLoading, items, error } = useLibraryCache();
  const [cacheProgress, setCacheProgress] = useState('Connecting...');

  // Pre-initialize audio service at app startup for faster playback
  useEffect(() => {
    audioService.ensureSetup().catch((err) => {
      console.warn('[AppNavigator] Audio service pre-init failed:', err);
    });
  }, []);

  useEffect(() => {
    if (library?.id) {
      setCacheProgress('Loading your audiobooks...');
      loadCache(library.id).then(() => {
        setCacheProgress('Ready!');
      });
    }
  }, [library?.id, loadCache]);

  // Show loading while cache is loading
  if (!isLoaded && isLoading) {
    return <CacheLoadingScreen progress={cacheProgress} />;
  }

  // If cache failed but we can still proceed
  if (error && !isLoaded) {
    console.warn('[AppNavigator] Cache error, proceeding anyway:', error);
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
        <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} />
        <Stack.Screen name="NarratorDetail" component={NarratorDetailScreen} />
        <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen
          name="PreferencesOnboarding"
          component={PreferencesOnboardingScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
      <MiniPlayer />
      <PlayerScreen />
    </NavigationContainer>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

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

const styles = StyleSheet.create({
  cacheLoading: {
    flex: 1,
    backgroundColor: BG_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cacheContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  cacheEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  cacheTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cacheSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  cacheSpinner: {
    marginTop: 8,
  },
});
