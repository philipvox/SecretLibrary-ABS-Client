/**
 * src/navigation/components/BottomTabBar.tsx
 *
 * Minimal 3-item bottom bar:
 * - Search (left)
 * - Play/Pause mini player (center)
 * - Home (right)
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import {
  colors,
  spacing,
  elevation,
  sizes,
} from '@/shared/theme';

// Design constants
const TAB_BAR_HEIGHT = 56;

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
            size={sizes.iconLg}
            color={isSearchActive ? colors.accent : colors.textSecondary}
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
            size={sizes.iconLg}
            color={hasAudio ? colors.backgroundPrimary : colors.textMuted}
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
            size={sizes.iconLg}
            color={isHomeActive ? colors.accent : colors.textSecondary}
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
    paddingHorizontal: spacing['4xl'],
  },
  tab: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.glow,
  },
  playButtonDisabled: {
    backgroundColor: colors.accentSubtle,
    shadowOpacity: 0,
  },
});
