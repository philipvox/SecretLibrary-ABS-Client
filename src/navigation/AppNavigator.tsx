/**
 * src/navigation/AppNavigator.tsx
 *
 * Main app navigation structure with authentication flow.
 * Shows splash screen, login screen, or main app based on auth state.
 * Includes MiniPlayer overlay and PlayerScreen modal.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/core/auth';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { LibraryItemsScreen } from '@/features/library';
import { BookDetailScreen } from '@/features/book-detail';
import { MiniPlayer, PlayerScreen } from '@/features/player';
import { SplashScreen } from '@/shared/components/SplashScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show splash screen while checking authentication
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator>
          {!isAuthenticated ? (
            // Auth flow - show login screen
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          ) : (
            // Main app flow
            <>
              <Stack.Screen
                name="Library"
                component={LibraryItemsScreen}
                options={{
                  title: 'My Library',
                  headerShown: true,
                  headerLargeTitle: true,
                }}
              />
              <Stack.Screen
                name="BookDetail"
                component={BookDetailScreen}
                options={{
                  title: 'Book Details',
                  headerShown: true,
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* MiniPlayer - Shows at bottom when playing */}
      {isAuthenticated && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}

      {/* Full Player Modal */}
      {isAuthenticated && <PlayerScreen />}
    </>
  );
}

const styles = StyleSheet.create({
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
