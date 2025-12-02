/**
 * src/features/home/components/HomeBottomNav.tsx
 * 
 * Bottom navigation with 3 buttons:
 * - Search (left)
 * - Play with blurred cover (center)
 * - Home (right)
 * 
 * Aligned at baseline (flex-end)
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { BOTTOM_NAV, HOME_COLORS } from '../constants';

interface HomeBottomNavProps {
  onSearchPress?: () => void;
  onHomePress?: () => void;
  onPlayPress?: () => void;
}

// Icons
function SearchIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function HomeIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <View style={styles.playIcon}>
      <View style={styles.playTriangle} />
    </View>
  );
}

export function HomeBottomNav({ onSearchPress, onHomePress, onPlayPress }: HomeBottomNavProps) {
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
      <TouchableOpacity style={styles.navButton} onPress={handleSearch}>
        <SearchIcon size={20} color="rgba(255, 255, 255, 0.7)" />
      </TouchableOpacity>

      {/* Play button with cover */}
      <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
        {coverUrl && (
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverBg}
            blurRadius={6}
          />
        )}
        <PlayIcon size={16} />
      </TouchableOpacity>

      {/* Home button */}
      <TouchableOpacity style={styles.navButton} onPress={handleHome}>
        <HomeIcon size={20} color="rgba(255, 255, 255, 0.7)" />
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
    alignItems: 'flex-end', // Baseline alignment
    justifyContent: 'center',
    gap: BOTTOM_NAV.gap,
  },
  navButton: {
    width: BOTTOM_NAV.buttonSize,
    height: BOTTOM_NAV.buttonSize,
    borderRadius: BOTTOM_NAV.buttonSize / 2,
    backgroundColor: HOME_COLORS.cardBg,
    borderWidth: 1,
    borderColor: HOME_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: BOTTOM_NAV.playButtonSize,
    height: BOTTOM_NAV.playButtonSize,
    borderRadius: BOTTOM_NAV.playButtonSize / 2,
    backgroundColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  coverBg: {
    position: 'absolute',
    width: '120%',
    height: '120%',
  },
  playIcon: {
    zIndex: 1,
    marginLeft: 4, // Optical centering for play triangle
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
});

export default HomeBottomNav;