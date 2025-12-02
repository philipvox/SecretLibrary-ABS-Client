/**
 * src/navigation/components/FloatingTabBar.tsx
 * 
 * Minimal 3-button floating nav: Search | Player | Home
 */

import React from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Rect, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';

const SIDE_BUTTON_SIZE = 64;
const PLAYER_BUTTON_SIZE = 96;
const BUTTON_GAP = 32;

// SVG Components - icons centered in circles
const SearchButton: React.FC<{ size?: number }> = ({ size = SIDE_BUTTON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Rect width="64" height="64" rx="32" fill="#262626" />
    <Path
      d="M38 38L34.5 34.5M36.5 29.5C36.5 33.09 33.59 36 30 36C26.41 36 23.5 33.09 23.5 29.5C23.5 25.91 26.41 23 30 23C33.59 23 36.5 25.91 36.5 29.5Z"
      stroke="#808080"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const HomeButton: React.FC<{ size?: number; active?: boolean }> = ({ 
  size = SIDE_BUTTON_SIZE,
  active = false 
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Rect width="64" height="64" rx="32" fill={active ? "#34C759" : "#262626"} />
    <Path
      d="M30 40V34H34V40M26 31L32 26L38 31V38C38 38.53 37.79 39.04 37.41 39.41C37.04 39.79 36.53 40 36 40H28C27.47 40 26.96 39.79 26.59 39.41C26.21 39.04 26 38.53 26 38V31Z"
      stroke={active ? "#1E1E1E" : "#808080"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const PlayIcon: React.FC = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
      fill="white"
    />
  </Svg>
);

const PauseIcon: React.FC = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
    <Rect x="6" y="4" width="4" height="16" rx="1" fill="white" />
    <Rect x="14" y="4" width="4" height="16" rx="1" fill="white" />
  </Svg>
);

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { currentBook, isPlaying, play, pause, isPlayerVisible } = usePlayerStore();

  if (isPlayerVisible) return null;

  const isHomeTab = state.routes[state.index]?.name === 'HomeTab';
  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : null;

  const handleSearchPress = () => {
    nav.navigate('Search');
  };

  const handleHomePress = () => {
    navigation.navigate('HomeTab');
  };

  const handlePlayerPress = async () => {
    if (!currentBook) {
      navigation.navigate('LibraryTab');
      return;
    }
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const handlePlayerLongPress = () => {
    if (currentBook) {
      usePlayerStore.getState().setPlayerVisible?.(true) ||
      usePlayerStore.setState({ isPlayerVisible: true });
    }
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
      <View style={styles.container}>
        {/* Search Button */}
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handleSearchPress}
          activeOpacity={0.8}
        >
          <SearchButton />
        </TouchableOpacity>

        {/* Player Button */}
        <Pressable
          style={styles.playerButton}
          onPress={handlePlayerPress}
          onLongPress={handlePlayerLongPress}
          delayLongPress={300}
        >
          {coverUrl ? (
            <View style={styles.playerContainer}>
              <Image
                source={coverUrl}
                style={styles.playerCover}
                contentFit="cover"
                transition={100}
              />
              <View style={styles.playerOverlay}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </View>
              <View style={styles.playerRing} />
            </View>
          ) : (
            <View style={styles.emptyPlayer}>
              <PlayIcon />
            </View>
          )}
        </Pressable>

        {/* Home Button */}
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handleHomePress}
          activeOpacity={0.8}
        >
          <HomeButton active={isHomeTab} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: BUTTON_GAP,
  },
  sideButton: {
    width: SIDE_BUTTON_SIZE,
    height: SIDE_BUTTON_SIZE,
  },
  playerButton: {
    width: PLAYER_BUTTON_SIZE,
    height: PLAYER_BUTTON_SIZE,
  },
  playerContainer: {
    width: PLAYER_BUTTON_SIZE,
    height: PLAYER_BUTTON_SIZE,
    borderRadius: PLAYER_BUTTON_SIZE / 2,
    overflow: 'hidden',
  },
  playerCover: {
    width: PLAYER_BUTTON_SIZE,
    height: PLAYER_BUTTON_SIZE,
  },
  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.5)',
    borderRadius: PLAYER_BUTTON_SIZE / 2,
  },
  emptyPlayer: {
    width: PLAYER_BUTTON_SIZE,
    height: PLAYER_BUTTON_SIZE,
    borderRadius: PLAYER_BUTTON_SIZE / 2,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
});