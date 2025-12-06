/**
 * src/navigation/components/BottomTabBar.tsx
 *
 * Minimal 3-item bottom bar:
 * - Search (left)
 * - Play/Pause mini player (center)
 * - Home (right)
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/features/player/stores/playerStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design constants - matching Anima design
const TAB_BAR_HEIGHT = 56;
const ACCENT_COLOR = '#c1f40c'; // Exact color from design
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.6)';

interface BottomTabBarProps {
  currentRoute: string;
  onNavigate: (routeName: string) => void;
  bottomOffset?: number;
}

export function BottomTabBar({ currentRoute, onNavigate, bottomOffset = 0 }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);

  const { isPlaying, play, pause, currentBook } = usePlayerStore();
  const hasAudio = !!currentBook;

  const isHomeActive = currentRoute === 'HomeTab' || currentRoute === 'Main';
  const isSearchActive = currentRoute === 'Search';

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: safeBottom, bottom: bottomOffset }]}>
      <View style={styles.tabContainer}>
        {/* Search */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate('Search')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isSearchActive ? 'search' : 'search-outline'}
            size={26}
            color={isSearchActive ? ACCENT_COLOR : INACTIVE_COLOR}
          />
        </TouchableOpacity>

        {/* Center Play/Pause */}
        <TouchableOpacity
          style={[styles.playButton, !hasAudio && styles.playButtonDisabled]}
          onPress={handlePlayPause}
          activeOpacity={0.7}
          disabled={!hasAudio}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color={hasAudio ? '#000' : 'rgba(0,0,0,0.3)'}
          />
        </TouchableOpacity>

        {/* Home */}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate('HomeTab')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isHomeActive ? 'home' : 'home-outline'}
            size={26}
            color={isHomeActive ? ACCENT_COLOR : INACTIVE_COLOR}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  tabContainer: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  tab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  playButtonDisabled: {
    backgroundColor: 'rgba(200, 255, 0, 0.3)',
    shadowOpacity: 0,
  },
});
