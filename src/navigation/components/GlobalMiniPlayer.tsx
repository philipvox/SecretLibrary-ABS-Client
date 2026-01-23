/**
 * src/navigation/components/GlobalMiniPlayer.tsx
 *
 * Secret Library Mini Player
 * Clean editorial design with scrubber, time display, book info, and controls.
 * Positioned at the bottom of the screen above the tab bar.
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { scale, hp, useSecretLibraryColors } from '@/shared/theme';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore, useCurrentChapterIndex } from '@/features/player/stores/playerStore';
import { useSeekingStore } from '@/features/player/stores/seekingStore';
import { useNormalizedChapters } from '@/shared/hooks';
import { getTitle } from '@/shared/utils/metadata';
import { haptics } from '@/core/native/haptics';
import {
  secretLibraryColors as staticColors,
} from '@/shared/theme/secretLibrary';
import {
  RewindIcon,
  FastForwardIcon,
  PlayIcon,
  PauseIcon,
} from '@/features/player/components/PlayerIcons';

// =============================================================================
// CONSTANTS
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NAV_BAR_HEIGHT = hp(7);
const SWIPE_THRESHOLD = -50;
const SCRUBBER_HEIGHT = 20;
const HANDLE_SIZE = 16;
const TRACK_HEIGHT = 3;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GlobalMiniPlayer() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [currentRouteName, setCurrentRouteName] = useState('');

  // Theme-aware colors
  const colors = useSecretLibraryColors();

  // Track current route for hiding on modal screens
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      const state = navigation.getState();
      if (state) {
        const route = state.routes[state.index];
        setCurrentRouteName(route.name);
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Player state - PERF: batch subscriptions with useShallow to reduce re-renders
  // Note: seekTo is handled via useSeekingStore directly for proper position tracking
  const {
    currentBook,
    isPlaying,
    isLoading,
    isBuffering,
    isPlayerVisible,
    position,
    duration,
    chapters,
    play,
    pause,
    togglePlayer,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      isPlayerVisible: s.isPlayerVisible,
      position: s.position,
      duration: s.duration,
      chapters: s.chapters,
      play: s.play,
      pause: s.pause,
      togglePlayer: s.togglePlayer,
    }))
  );

  // Current chapter
  const currentChapterIndex = useCurrentChapterIndex();
  const normalizedChapters = useNormalizedChapters(chapters, {
    bookTitle: getTitle(currentBook),
  });
  const currentChapter = normalizedChapters[currentChapterIndex];
  const chapterName = currentChapter?.displayTitle || `Chapter ${currentChapterIndex + 1}`;

  // Swipe gesture state
  const translateY = useSharedValue(0);

  // Handlers
  const handlePlayPause = useCallback(async () => {
    haptics.selection();
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, pause, play]);

  // Get bookId for progress saving
  const bookId = currentBook?.id;

  const handleSkipBack = useCallback(() => {
    haptics.selection();
    const newPosition = Math.max(0, position - 15);
    // Use seeking store for proper position tracking
    useSeekingStore.getState().seekTo(newPosition, duration, bookId);
  }, [position, duration, bookId]);

  const handleSkipForward = useCallback(() => {
    haptics.selection();
    const newPosition = Math.min(duration, position + 30);
    // Use seeking store for proper position tracking
    useSeekingStore.getState().seekTo(newPosition, duration, bookId);
  }, [position, duration, bookId]);

  const handleOpenPlayer = useCallback(() => {
    haptics.selection();
    togglePlayer?.();
  }, [togglePlayer]);

  // Swipe up gesture to open full player
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY < SWIPE_THRESHOLD) {
        runOnJS(handleOpenPlayer)();
      }
      translateY.value = withTiming(0, { duration: 150 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(0, translateY.value * 0.3) }],
  }));

  // Determine if mini player should be hidden
  // Note: We ALWAYS render the full structure to prevent Android SafeAreaProvider crash
  // Just hide it visually when needed using opacity and pointerEvents
  const hiddenRoutes = ['ReadingHistoryWizard', 'MoodDiscovery', 'MoodResults', 'PreferencesOnboarding'];
  const shouldHide = !currentBook || isPlayerVisible || hiddenRoutes.includes(currentRouteName);

  const title = currentBook ? getTitle(currentBook) : '';

  // Always render full structure to prevent Android SafeAreaProvider crash
  // Hide visually when shouldHide is true
  return (
    <View
      style={[styles.wrapper, shouldHide && styles.hidden]}
      pointerEvents={shouldHide ? 'none' : 'auto'}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.container,
            {
              paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
              backgroundColor: colors.white,
              borderTopColor: colors.grayLine,
            },
            animatedStyle,
          ]}
        >
        {/* Scrubber */}
        <View style={styles.scrubberContainer}>
          {/* Track */}
          <View style={[styles.scrubberTrack, { backgroundColor: colors.grayLine }]}>
            {/* Fill */}
            <Animated.View
              style={[
                styles.scrubberFill,
                { backgroundColor: colors.black, width: `${duration > 0 ? Math.min(1, Math.max(0, position / duration)) * 100 : 0}%` as any }
              ]}
            />
          </View>
          {/* Handle */}
          <Animated.View
            style={[
              styles.scrubberHandle,
              { backgroundColor: colors.black, left: `${duration > 0 ? Math.min(1, Math.max(0, position / duration)) * 100 : 0}%` as any }
            ]}
          />
        </View>

        {/* Controls Row */}
        <View style={styles.controlsRow}>
          {/* Book Info - tap to open player */}
          <Pressable style={styles.infoContainer} onPress={handleOpenPlayer}>
            <Text style={[styles.bookTitle, { color: colors.black }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.chapterName, { color: colors.gray }]} numberOfLines={1}>{chapterName}</Text>
          </Pressable>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Skip Back 15s */}
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
              onPress={handleSkipBack}
            >
              <RewindIcon color={colors.black} size={14} />
            </TouchableOpacity>

            {/* Skip Forward 30s */}
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: colors.grayLine, backgroundColor: colors.grayLight }]}
              onPress={handleSkipForward}
            >
              <FastForwardIcon color={colors.black} size={14} />
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: colors.black }]}
              onPress={handlePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size={14} color={colors.white} />
              ) : isBuffering ? (
                // Buffering: show spinner with small icon
                <View style={styles.bufferingContainer}>
                  <ActivityIndicator size={28} color={colors.white} style={styles.bufferingSpinner} />
                  {isPlaying ? (
                    <PauseIcon color={colors.white} size={10} />
                  ) : (
                    <PlayIcon color={colors.white} size={10} />
                  )}
                </View>
              ) : isPlaying ? (
                <PauseIcon color={colors.white} size={14} />
              ) : (
                <PlayIcon color={colors.white} size={14} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
    </View>
  );
}

/** Height of the mini player for layout calculations */
export const GLOBAL_MINI_PLAYER_HEIGHT = scale(130);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Wrapper - always rendered to prevent Android SafeAreaProvider crash
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  // Hidden state - visually hide without removing from view tree
  hidden: {
    opacity: 0,
  },
  container: {
    backgroundColor: staticColors.grayLight,
    borderTopWidth: 1,
    borderTopColor: staticColors.grayLine,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Scrubber
  scrubberContainer: {
    height: SCRUBBER_HEIGHT,
    justifyContent: 'center',
    marginBottom: 6,
  },
  scrubberTrack: {
    width: '100%',
    height: TRACK_HEIGHT,
    backgroundColor: staticColors.grayLine,
    borderRadius: TRACK_HEIGHT / 2,
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: TRACK_HEIGHT,
    backgroundColor: staticColors.black,
    borderRadius: TRACK_HEIGHT / 2,
  },
  scrubberHandle: {
    position: 'absolute',
    top: (SCRUBBER_HEIGHT - HANDLE_SIZE) / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: staticColors.black,
    borderRadius: HANDLE_SIZE / 2,
    marginLeft: -HANDLE_SIZE / 2,
  },

  // Controls Row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Info
  infoContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    marginRight: 12,
  },
  bookTitle: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: 13,
    fontWeight: '600',
    color: staticColors.black,
  },
  chapterName: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: 11,
    color: staticColors.gray,
  },

  // Buttons
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skipButton: {
    width: 40,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    backgroundColor: staticColors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 40,
    height: 32,
    borderRadius: 16,
    backgroundColor: staticColors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bufferingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingSpinner: {
    position: 'absolute',
  },
});

export default GlobalMiniPlayer;
