/**
 * src/features/home/components/HomeBottomNav.tsx
 *
 * Bottom navigation with 3 buttons:
 * - Search (left)
 * - Play with blurred cover (center)
 * - Home (right)
 *
 * Uses custom SVG buttons from Figma designs
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import {
  SearchButton,
  HomeButton,
  HomeButtonActive,
  HomeLargePlayButton,
} from '@/shared/assets/svg';
import { BOTTOM_NAV } from '../constants';

interface HomeBottomNavProps {
  onSearchPress?: () => void;
  onHomePress?: () => void;
  onPlayPress?: () => void;
  isHomeActive?: boolean;
}

// SVG button sizes from Figma designs
const NAV_BUTTON_SIZE = 64;
const PLAY_BUTTON_SIZE = 106;

export function HomeBottomNav({
  onSearchPress,
  onHomePress,
  onPlayPress,
  isHomeActive = true,
}: HomeBottomNavProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { currentBook, isPlayerVisible, togglePlayer } = usePlayerStore();

  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : null;

  const handleSearch = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      navigation.navigate('Search');
    }
  };

  const handleHome = () => {
    if (onHomePress) {
      onHomePress();
    }
    // Already on home, maybe scroll to top or do nothing
  };

  const handlePlay = () => {
    if (onPlayPress) {
      onPlayPress();
    } else {
      togglePlayer();
    }
  };

  return (
    <View style={[styles.container, { bottom: BOTTOM_NAV.bottomOffset + insets.bottom }]}>
      {/* Search button */}
      <TouchableOpacity onPress={handleSearch} activeOpacity={0.8}>
        <SearchButton size={NAV_BUTTON_SIZE} />
      </TouchableOpacity>

      {/* Play button with cover */}
      <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
        {coverUrl && (
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverBg}
            blurRadius={6}
          />
        )}
        <HomeLargePlayButton size={PLAY_BUTTON_SIZE} />
      </TouchableOpacity>

      {/* Home button */}
      <TouchableOpacity onPress={handleHome} activeOpacity={0.8}>
        {isHomeActive ? (
          <HomeButtonActive size={NAV_BUTTON_SIZE} />
        ) : (
          <HomeButton size={NAV_BUTTON_SIZE} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: BOTTOM_NAV.gap,
  },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: PLAY_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverBg: {
    position: 'absolute',
    width: '120%',
    height: '120%',
  },
});

export default HomeBottomNav;