/**
 * src/navigation/components/NavigationBar.tsx
 *
 * Minimal 3-item bottom navigation:
 * - Search | Play/Pause | Home
 * - No separate mini player - play button is in the bar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { BottomTabBar } from './BottomTabBar';

export function NavigationBar() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [currentRouteName, setCurrentRouteName] = useState('HomeTab');

  const isPlayerVisible = usePlayerStore((s) => s.isPlayerVisible);

  // Listen for navigation state changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      try {
        const state = navigation.getState();
        if (state) {
          const route = state.routes[state.index];
          if (route.state) {
            const nestedState = route.state as any;
            setCurrentRouteName(nestedState.routes?.[nestedState.index]?.name || route.name);
          } else {
            setCurrentRouteName(route.name);
          }
        }
      } catch (err) {
        // Navigation may not be ready yet
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Handle tab navigation
  const handleNavigate = useCallback((routeName: string) => {
    // Close player if it's open
    if (isPlayerVisible) {
      usePlayerStore.setState({ isPlayerVisible: false });
    }

    // Navigate to the route
    if (routeName === 'Search') {
      navigation.navigate('Search');
    } else {
      // Tab screens are nested under 'Main'
      navigation.navigate('Main', { screen: routeName });
    }
  }, [navigation, isPlayerVisible]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      <BottomTabBar
        currentRoute={currentRouteName}
        onNavigate={handleNavigate}
      />
    </View>
  );
}

/** Total height of navigation bar (for content padding) */
export function useNavigationBarHeight(): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56;
  const safeBottom = Math.max(insets.bottom, 8);
  return tabBarHeight + safeBottom;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
  },
});
