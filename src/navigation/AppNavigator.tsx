/**
 * App Navigator - updated with headerShown: false
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

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false, // Hide default headers
          }}
        >
          {!isAuthenticated ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
            />
          ) : (
            <>
              <Stack.Screen
                name="Library"
                component={LibraryItemsScreen}
              />
              <Stack.Screen
                name="BookDetail"
                component={BookDetailScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {isAuthenticated && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}

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