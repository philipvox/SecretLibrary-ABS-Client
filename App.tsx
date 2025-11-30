import React from 'react';
import { AuthProvider } from './src/core/auth';
import { AppNavigator } from './src/navigation/AppNavigator';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes - trust cache longer
      gcTime: 60 * 60 * 1000, // 1 hour garbage collection
      refetchOnWindowFocus: false, // Don't refetch when app comes to foreground
      refetchOnReconnect: false, // Don't refetch on network reconnect
      refetchOnMount: false, // Trust cached data
      retry: 1, // Only retry once on failure
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}