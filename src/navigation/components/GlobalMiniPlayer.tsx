/**
 * src/navigation/components/GlobalMiniPlayer.tsx
 *
 * Secret Library Mini Player
 * Clean editorial design with dark background and pill-shaped controls.
 * Positioned at the bottom of the screen above the tab bar.
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { scale } from '@/shared/theme';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore, useCurrentChapterIndex, useSeekingStore } from '@/features/player/stores';
import { useNormalizedChapters } from '@/shared/hooks';
import { getTitle } from '@/shared/utils/metadata';
import { useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { haptics } from '@/core/native/haptics';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import {
  RewindIcon,
  FastForwardIcon,
  PlayIcon,
  PauseIcon,
} from '@/features/player/components/PlayerIcons';
import {
  playerTransitionProgress,
  SPRING_CONFIG,
  SNAP_THRESHOLD,
  VELOCITY_THRESHOLD,
} from '@/features/player/stores/playerTransition';

// =============================================================================
// CONSTANTS
// =============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Dark background color - matches library screen (secretLibraryColors.black)
const MINI_PLAYER_BG = '#0f0f0f';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GlobalMiniPlayer() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [currentRouteName, setCurrentRouteName] = useState('');

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
  const {
    currentBook,
    isPlaying,
    isLoading,
    isBuffering,
    position,
    duration,
    chapters,
    play,
    pause,
    cleanup,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      position: s.position,
      duration: s.duration,
      chapters: s.chapters,
      play: s.play,
      pause: s.pause,
      cleanup: s.cleanup,
    }))
  );

  // Current chapter
  const currentChapterIndex = useCurrentChapterIndex();
  const normalizedChapters = useNormalizedChapters(chapters, {
    bookTitle: getTitle(currentBook),
  });
  const currentChapter = normalizedChapters[currentChapterIndex];
  const chapterName = currentChapter?.displayTitle || `Part ${currentChapterIndex + 1}`;

  // Handlers
  const handlePlayPause = useCallback(() => {
    haptics.selection();
    // Read state at call time to avoid stale closure during rapid taps
    const state = usePlayerStore.getState();
    if (state.isPlaying) {
      state.pause();
    } else {
      state.play();
    }
  }, []);

  // Get bookId for progress saving
  const bookId = currentBook?.id;

  const handleSkipBack = useCallback(() => {
    haptics.selection();
    // Read position at call time to avoid stale closure during rapid taps
    const currentPos = usePlayerStore.getState().position;
    const currentDur = usePlayerStore.getState().duration;
    const newPosition = Math.max(0, currentPos - 15);
    useSeekingStore.getState().seekTo(newPosition, currentDur, bookId);
  }, [bookId]);

  const handleSkipForward = useCallback(() => {
    haptics.selection();
    // Read position at call time to avoid stale closure during rapid taps
    const currentPos = usePlayerStore.getState().position;
    const currentDur = usePlayerStore.getState().duration;
    const newPosition = Math.min(currentDur, currentPos + 30);
    useSeekingStore.getState().seekTo(newPosition, currentDur, bookId);
  }, [bookId]);

  // Called from JS thread (tap handler or gesture completion)
  const setPlayerVisible = useCallback(() => {
    usePlayerStore.getState().setPlayerVisible(true);
  }, []);

  const handleOpenPlayer = useCallback(() => {
    haptics.selection();
    // Animate shared progress to 1 (expanded)
    playerTransitionProgress.value = withSpring(1, SPRING_CONFIG);
    // Set store state so other parts of the app know the player is visible
    setPlayerVisible();
  }, [setPlayerVisible]);

  const handleCloseMiniPlayer = useCallback(() => {
    haptics.selection();
    cleanup();
  }, [cleanup]);

  // Pan gesture: drag up to continuously reveal full player
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      // Convert upward drag to 0→1 progress
      const progress = Math.min(Math.max(-event.translationY / SCREEN_HEIGHT, 0), 1);
      playerTransitionProgress.value = progress;
    })
    .onEnd((event) => {
      'worklet';
      const progress = playerTransitionProgress.value;
      const velocity = -event.velocityY; // positive = upward

      // Quick swipe overrides position threshold
      const shouldExpand = velocity > VELOCITY_THRESHOLD || (velocity > -VELOCITY_THRESHOLD && progress > SNAP_THRESHOLD);

      if (shouldExpand) {
        playerTransitionProgress.value = withSpring(1, SPRING_CONFIG);
        // Set store state from JS thread (animation already running on UI thread)
        runOnJS(setPlayerVisible)();
      } else {
        playerTransitionProgress.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Track whether the full player is expanded to disable touch on mini player
  const isPlayerVisible = usePlayerStore((s) => s.isPlayerVisible);

  // Mini player fades out as full player slides in
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      playerTransitionProgress.value,
      [0, 0.3],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Cover hides instantly so the full player's cover (positioned at same spot) takes over
  const coverAnimStyle = useAnimatedStyle(() => ({
    opacity: playerTransitionProgress.value > 0.01 ? 0 : 1,
  }));

  // Determine if mini player should be hidden
  const hiddenRoutes = ['ReadingHistoryWizard', 'PreferencesOnboarding', 'SpinePlayground'];
  const shouldHide = !currentBook || hiddenRoutes.includes(currentRouteName);

  const title = currentBook ? getTitle(currentBook) : '';
  const coverUrl = useCoverUrl(currentBook?.id || '');
  const metadata = currentBook?.media?.metadata as any;
  const seriesDisplay = (metadata?.seriesName || metadata?.series?.[0]?.name || '').trim();

  return (
    <View
      style={[styles.wrapper, shouldHide && styles.hidden]}
      pointerEvents={shouldHide || isPlayerVisible ? 'none' : 'auto'}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.container,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : scale(12) },
            animatedStyle,
          ]}
        >
          {/* Controls Row */}
          <View style={styles.controlsRow}>
            {/* Book Info - tap to open player */}
            <Pressable style={styles.infoContainer} onPress={handleOpenPlayer}>
              <Animated.View style={[styles.coverWrap, coverAnimStyle]}>
                <Image source={coverUrl} style={styles.cover} contentFit="cover" />
                {currentBook?.id && <CoverStars bookId={currentBook.id} starSize={scale(14)} />}
              </Animated.View>
              <View style={styles.textContainer}>
                <Text style={styles.bookTitle} numberOfLines={1}>{title}</Text>
                {seriesDisplay ? <Text style={styles.seriesName} numberOfLines={1}>{seriesDisplay}</Text> : null}
                <Text style={styles.chapterName} numberOfLines={1}>{chapterName}</Text>
              </View>
            </Pressable>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              {/* Skip Back 15s */}
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipBack}
              >
                <RewindIcon color={secretLibraryColors.white} size={22} />
              </TouchableOpacity>

              {/* Skip Forward 30s */}
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipForward}
              >
                <FastForwardIcon color={secretLibraryColors.white} size={22} />
              </TouchableOpacity>

              {/* Play/Pause */}
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size={18} color={secretLibraryColors.black} />
                ) : isBuffering ? (
                  <View style={styles.bufferingContainer}>
                    <ActivityIndicator size={32} color={secretLibraryColors.black} style={styles.bufferingSpinner} />
                    {isPlaying ? (
                      <PauseIcon color={secretLibraryColors.black} size={12} />
                    ) : (
                      <PlayIcon color={secretLibraryColors.black} size={12} />
                    )}
                  </View>
                ) : isPlaying ? (
                  <PauseIcon color={secretLibraryColors.black} size={18} />
                ) : (
                  <PlayIcon color={secretLibraryColors.black} size={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Height of the mini player for layout calculations (includes safe area estimate) */
export const GLOBAL_MINI_PLAYER_HEIGHT = scale(110);

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
    backgroundColor: MINI_PLAYER_BG,
    paddingHorizontal: scale(20),
    paddingTop: scale(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(12),
    gap: scale(10),
  },
  coverWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  cover: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(4),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: scale(1),
  },
  bookTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(14),
    color: secretLibraryColors.white,
  },
  seriesName: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chapterName: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(11),
    fontStyle: 'italic',
    color: secretLibraryColors.gray,
  },

  // Buttons
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  skipButton: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: secretLibraryColors.white,
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
