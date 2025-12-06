/**
 * src/navigation/components/NavigationBar.tsx
 *
 * Combined navigation component with:
 * - GlobalMiniPlayer (floating above tabs when audio playing)
 * - BottomTabBar (5-tab navigation)
 *
 * Follows NN/g architecture diagram:
 * ┌────────────────────────────────────────────┐
 * │  🎧 Mini Player                            │
 * ├────────────────────────────────────────────┤
 * │  Home  Downloads  Search  Discover Profile │
 * └────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { BottomTabBar } from './BottomTabBar';
import { GlobalMiniPlayer, GLOBAL_MINI_PLAYER_HEIGHT } from './GlobalMiniPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function NavigationBar() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [currentRouteName, setCurrentRouteName] = useState('HomeTab');

  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlayerVisible = usePlayerStore((s) => s.isPlayerVisible);

  // Show mini player when audio is loaded and full player is not open
  const showMiniPlayer = !!currentBook && !isPlayerVisible;

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

  // Handle mini player press - open full player
  const handleMiniPlayerPress = useCallback(() => {
    usePlayerStore.setState({ isPlayerVisible: true });
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      {/* Mini Player - shown when audio is loaded */}
      {showMiniPlayer && (
        <GlobalMiniPlayer onPress={handleMiniPlayerPress} />
      )}

      {/* Bottom Tab Bar - always visible */}
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
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlayerVisible = usePlayerStore((s) => s.isPlayerVisible);

  const showMiniPlayer = !!currentBook && !isPlayerVisible;
  const tabBarHeight = 56;
  const safeBottom = Math.max(insets.bottom, 16);

  return tabBarHeight + safeBottom + (showMiniPlayer ? GLOBAL_MINI_PLAYER_HEIGHT : 0);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 9999,
    elevation: 9999,
  },
});
