/**
 * src/navigation/components/FloatingTabBar.tsx
 *
 * Minimal 3-button floating nav: Search | Player | Home
 * Player button shows book cover with green border and blur overlay
 * Gradient fades from transparent (top) to solid black (bottom)
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { useCoverUrl } from '@/core/cache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design constants from Figma export
const ICON_COLOR = '#B3B3B3';
const GREEN_BORDER = '#34C759';
const PLAY_BUTTON_SIZE = 48;
const ICON_SIZE = 20;
const NAV_HEIGHT = 86; // Height from bottom of buttons to bottom of gradient
const GRADIENT_HEIGHT = 233; // Total gradient height

// Search icon - matches search-1.svg
const SearchIcon: React.FC<{ size?: number; color?: string }> = ({
  size = ICON_SIZE,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 21 21" fill="none">
    <Path
      d="M17.85 17.85L14.1525 14.1525M16.15 9.35005C16.15 13.1056 13.1056 16.15 9.35005 16.15C5.59451 16.15 2.55005 13.1056 2.55005 9.35005C2.55005 5.59451 5.59451 2.55005 9.35005 2.55005C13.1056 2.55005 16.15 5.59451 16.15 9.35005Z"
      stroke={color}
      strokeWidth={2.125}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Home icon - matches home-1.svg
const HomeIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 17,
  color = ICON_COLOR
}) => (
  <Svg width={size} height={size} viewBox="0 0 17 17" fill="none">
    <Path
      d="M6.375 15.5833V8.49996H10.625V15.5833M2.125 6.37496L8.5 1.41663L14.875 6.37496V14.1666C14.875 14.5423 14.7257 14.9027 14.4601 15.1684C14.1944 15.434 13.8341 15.5833 13.4583 15.5833H3.54167C3.16594 15.5833 2.80561 15.434 2.53993 15.1684C2.27426 14.9027 2.125 14.5423 2.125 14.1666V6.37496Z"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Pause icon - matches pause-1.svg
const PauseIcon: React.FC<{ size?: number }> = ({ size = 29 }) => (
  <Svg width={size} height={size} viewBox="0 0 29 29" fill="none">
    <Path
      d="M16.8584 22.8792V6.02087H21.6751V22.8792H16.8584ZM7.2251 22.8792V6.02087H12.0418V22.8792H7.2251Z"
      fill="#FEF7FF"
    />
  </Svg>
);

// Play icon
const PlayIcon: React.FC<{ size?: number }> = ({ size = 29 }) => (
  <Svg width={size} height={size} viewBox="0 0 29 29" fill="none">
    <Path
      d="M8 5L23 14.5L8 24V5Z"
      fill="#FEF7FF"
    />
  </Svg>
);

// Player button with cover image, green border, and blur overlay
const PlayerButton: React.FC<{
  size?: number;
  isPlaying: boolean;
  coverUrl?: string | null;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ size = PLAY_BUTTON_SIZE, isPlaying, coverUrl, onPress, onLongPress }) => {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.playButton, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {/* Book cover background */}
      {coverUrl && (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.coverImage, { width: size, height: size, borderRadius: size / 2 }]}
        />
      )}

      {/* Dark blur overlay */}
      <View style={[styles.blurOverlay, { borderRadius: size / 2 }]}>
        <BlurView
          intensity={2.85}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.darkOverlay} />
      </View>

      {/* Green border ring */}
      <View style={[styles.greenBorder, { width: size, height: size, borderRadius: size / 2 }]} />

      {/* Play/Pause icon */}
      <View style={styles.iconContainer}>
        {isPlaying ? <PauseIcon size={29} /> : <PlayIcon size={29} />}
      </View>
    </Pressable>
  );
};

function FloatingTabBarInner() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { currentBook, isPlaying, play, pause, isPlayerVisible, closePlayer } = usePlayerStore();
  const [currentRouteName, setCurrentRouteName] = useState('HomeTab');
  const [currentRouteParams, setCurrentRouteParams] = useState<any>(null);

  const coverUrl = useCoverUrl(currentBook?.id || '');

  // Listen for navigation state changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      const state = navigation.getState();
      if (state) {
        const route = state.routes[state.index];
        if (route.state) {
          const nestedState = route.state as any;
          const nestedRoute = nestedState.routes?.[nestedState.index];
          setCurrentRouteName(nestedRoute?.name || route.name);
          setCurrentRouteParams(nestedRoute?.params || route.params || null);
        } else {
          setCurrentRouteName(route.name);
          setCurrentRouteParams(route.params || null);
        }
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Hide player button when on BookDetailScreen viewing the currently playing book
  const isOnPlayingBookDetailPage =
    currentRouteName === 'BookDetail' &&
    currentRouteParams?.id &&
    currentBook?.id &&
    currentRouteParams.id === currentBook.id;

  const shouldShowPlayerButton = currentBook && !isOnPlayingBookDetailPage;

  const handleSearchPress = () => {
    if (isPlayerVisible) closePlayer();
    navigation.navigate('Search');
  };

  const handleHomePress = () => {
    if (isPlayerVisible) closePlayer();
    navigation.navigate('Main', { screen: 'HomeTab' });
  };

  const handlePlayerPress = async () => {
    if (!currentBook) {
      navigation.navigate('Main', { screen: 'LibraryTab' });
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
      usePlayerStore.setState({ isPlayerVisible: true });
    }
  };

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 16;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Gradient: transparent at top -> solid black at bottom */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
        locations={[0, 1]}
        style={[styles.gradient, { height: GRADIENT_HEIGHT }]}
        pointerEvents="none"
      />

      {/* Button row */}
      <View style={[styles.buttonRow, { paddingBottom: bottomPadding, marginBottom: 0 }]}>
        {/* Search button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleSearchPress}
          activeOpacity={0.6}
        >
          <SearchIcon />
        </TouchableOpacity>

        {/* Player button (center) */}
        {shouldShowPlayerButton ? (
          <PlayerButton
            isPlaying={isPlaying}
            coverUrl={coverUrl}
            onPress={handlePlayerPress}
            onLongPress={handlePlayerLongPress}
          />
        ) : (
          <View style={{ width: PLAY_BUTTON_SIZE }} />
        )}

        {/* Home button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleHomePress}
          activeOpacity={0.6}
        >
          <HomeIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Error boundary wrapper
class FloatingTabBarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.log('[FloatingTabBar] Caught error:', error.message);
  }

  componentDidUpdate() {
    if (this.state.hasError) {
      setTimeout(() => this.setState({ hasError: false }), 100);
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function FloatingTabBar() {
  return (
    <FloatingTabBarErrorBoundary>
      <FloatingTabBarInner />
    </FloatingTabBarErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 100, // ~100px gap between icons as in the design
    paddingTop: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Player button styles
  playButton: {
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  greenBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 3,
    borderColor: GREEN_BORDER,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
