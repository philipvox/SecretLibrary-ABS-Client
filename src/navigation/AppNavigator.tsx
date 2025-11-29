/**
 * src/navigation/AppNavigator.tsx
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/core/auth';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { MyLibraryScreen } from '@/features/library';
import { HomeScreen } from '@/features/home';
import { BookDetailScreen } from '@/features/book-detail';
import { SearchScreen } from '@/features/search';
import { BrowseScreen } from '@/features/browse';
import { SeriesDetailScreen } from '@/features/series';
import { AuthorDetailScreen } from '@/features/author';
import { NarratorDetailScreen } from '@/features/narrator';
import { CollectionDetailScreen } from '@/features/collections';
import { ProfileScreen } from '@/features/profile';
// import { DownloadsScreen } from '@/features/downloads';
import { PreferencesScreen, PreferencesOnboardingScreen } from '@/features/recommendations';
import { MiniPlayer, PlayerScreen } from '@/features/player';
import { SplashScreen } from '@/shared/components/SplashScreen';
import { FloatingTabBar } from './components/FloatingTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="BookDetail" component={BookDetailScreen} />
              <Stack.Screen name="Search" component={SearchScreen} />
              <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
              <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} />
              <Stack.Screen name="NarratorDetail" component={NarratorDetailScreen} />
              <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
              {/*<Stack.Screen name="Downloads" component={DownloadsScreen} />*/}
              <Stack.Screen name="Preferences" component={PreferencesScreen} />
              <Stack.Screen 
                name="PreferencesOnboarding" 
                component={PreferencesOnboardingScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {isAuthenticated && <MiniPlayer />}
      {isAuthenticated && <PlayerScreen />}
    </>
  );
}