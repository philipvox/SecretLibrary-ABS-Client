/**
 * src/navigation/AppNavigator.tsx
 * 
 * Main app navigation structure with authentication flow.
 * Shows login screen for unauthenticated users, library for authenticated users.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/core/auth';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { LibraryScreen } from '@/features/library/screens/LibraryScreen';
import { SplashScreen } from '@/shared/components/SplashScreen';

const Stack = createNativeStackNavigator();

/**
 * Main app navigator with authentication flow
 */
export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show splash screen while checking auth status
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        // Authenticated flow - main app screens
        <Stack.Navigator>
          <Stack.Screen
            name="Library"
            component={LibraryScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      ) : (
        // Unauthenticated flow - login screen
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
