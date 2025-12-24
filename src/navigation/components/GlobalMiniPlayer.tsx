/**
 * src/navigation/components/GlobalMiniPlayer.tsx
 *
 * Global floating mini player with CD disc, swipe gestures, and animations.
 * Shows on all screens when a book is loaded, hidden when full player is open.
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Pause, Moon } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  withSpring,
  runOnJS,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  colors,
  spacing,
  layout,
  typography,
  wp,
  hp,
  moderateScale,
  sizes,
} from '@/shared/theme';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { useCoverUrl } from '@/core/cache';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';
import { useQueue } from '@/features/queue/stores/queueStore';
import { formatSleepTimer } from '@/features/player/utils';

// Mini disc size
const MINI_DISC_SIZE = sizes.coverMini;
const MINI_HOLE_SIZE = MINI_DISC_SIZE * 0.22;
const MINI_SPINDLE_SIZE = MINI_DISC_SIZE * 0.32;

// Layout constants
const MINI_PLAYER_HEIGHT = layout.miniPlayerHeight;
const NAV_BAR_HEIGHT = hp(14);
const SWIPE_THRESHOLD = -50;

const TOUCH_TARGET = layout.minTouchTarget;

// Mini CD Disc component
const MiniCDDisc = ({
  coverUrl,
  isPlaying,
}: {
  coverUrl: string | null;
  isPlaying: boolean;
}) => {
  const rotation = useSharedValue(0);
  const speed = useSharedValue(0);
  const lastFrameTime = useSharedValue(Date.now());

  useEffect(() => {
    speed.value = withTiming(isPlaying ? 0.02 : 0, { duration: 200 });
  }, [isPlaying]);

  useFrameCallback((frameInfo) => {
    'worklet';
    const now = frameInfo.timestamp;
    const delta = Math.min(now - lastFrameTime.value, 50);
    lastFrameTime.value = now;
    if (Math.abs(speed.value) > 0.001) {
      rotation.value = (rotation.value + speed.value * delta) % 360;
    }
  }, true);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={miniDiscStyles.container}>
      <Animated.View style={[miniDiscStyles.disc, discStyle]}>
        {coverUrl ? (
          <Image
            source={coverUrl}
            style={miniDiscStyles.cover}
            contentFit="cover"
          />
        ) : (
          <View style={[miniDiscStyles.cover, { backgroundColor: colors.backgroundTertiary }]} />
        )}
      </Animated.View>
      {/* Chrome spindle center - static */}
      <View style={miniDiscStyles.spindleOuter}>
        <LinearGradient
          colors={['#666666', '#444444', '#333333']}
          style={StyleSheet.absoluteFill}
        />
        <View style={miniDiscStyles.spindleInner}>
          <LinearGradient
            colors={['#888888', '#666666', '#444444']}
            style={StyleSheet.absoluteFill}
          />
          <View style={miniDiscStyles.spindleCenter} />
        </View>
      </View>
    </View>
  );
};

const miniDiscStyles = StyleSheet.create({
  container: {
    width: MINI_DISC_SIZE,
    height: MINI_DISC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: MINI_DISC_SIZE,
    height: MINI_DISC_SIZE,
    borderRadius: MINI_DISC_SIZE / 2,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
    borderRadius: MINI_DISC_SIZE / 2,
  },
  spindleOuter: {
    position: 'absolute',
    width: MINI_SPINDLE_SIZE,
    height: MINI_SPINDLE_SIZE,
    borderRadius: MINI_SPINDLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spindleInner: {
    width: MINI_SPINDLE_SIZE * 0.7,
    height: MINI_SPINDLE_SIZE * 0.7,
    borderRadius: (MINI_SPINDLE_SIZE * 0.7) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spindleCenter: {
    width: MINI_HOLE_SIZE,
    height: MINI_HOLE_SIZE,
    borderRadius: MINI_HOLE_SIZE / 2,
    backgroundColor: colors.backgroundTertiary,
  },
});

// Rewind icon
const RewindIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size * 0.7} viewBox="0 0 22 15" fill="none">
    <Path
      d="M9.65391 13.3207C9.65391 13.8212 9.08125 14.1058 8.68224 13.8036L0.391342 7.52258C0.0713467 7.28016 0.0713462 6.79919 0.391341 6.55677L8.68223 0.275788C9.08125 -0.0264932 9.65391 0.258109 9.65391 0.758693V13.3207Z"
      fill={color}
    />
    <Path
      d="M21.7539 13.3207C21.7539 13.8212 21.1812 14.1058 20.7822 13.8036L12.4913 7.52258C12.1713 7.28016 12.1713 6.79919 12.4913 6.55677L20.7822 0.275788C21.1812 -0.0264932 21.7539 0.258109 21.7539 0.758693V13.3207Z"
      fill={color}
    />
  </Svg>
);

// Fast forward icon (mirrored rewind)
const FastForwardIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size * 0.7} viewBox="0 0 22 15" fill="none">
    <Path
      d="M12.3461 1.67933C12.3461 1.17875 12.9188 0.894224 13.3178 1.19641L21.6087 7.47742C21.9287 7.71984 21.9287 8.20081 21.6087 8.44323L13.3178 14.7242C12.9188 15.0265 12.3461 14.7419 12.3461 14.2413V1.67933Z"
      fill={color}
    />
    <Path
      d="M0.246094 1.67933C0.246094 1.17875 0.818755 0.894224 1.21776 1.19641L9.50866 7.47742C9.82866 7.71984 9.82866 8.20081 9.50866 8.44323L1.21777 14.7242C0.818756 15.0265 0.246094 14.7419 0.246094 14.2413V1.67933Z"
      fill={color}
    />
  </Svg>
);

// Play icon
const PlayIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 5.14v14.72a1 1 0 001.5.86l11.14-7.36a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
      fill={color}
    />
  </Svg>
);

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

  // Player state
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const isPlayerVisible = usePlayerStore((s) => s.isPlayerVisible);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const togglePlayer = usePlayerStore((s) => s.togglePlayer);

  // Cover URL
  const coverUrl = useCoverUrl(currentBook?.id || '');

  // Queue
  const queue = useQueue();
  const nextBook = queue.length > 0 ? queue[0].book : null;
  const nextBookTitle = nextBook ? getTitle(nextBook) : null;

  // Swipe gesture state
  const translateY = useSharedValue(0);

  // Handlers - must be defined before any conditional returns
  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, pause, play]);

  const handleSkipBack = useCallback(() => {
    const newPosition = Math.max(0, position - 30);
    seekTo?.(newPosition);
  }, [position, seekTo]);

  const handleSkipForward = useCallback(() => {
    const newPosition = Math.min(duration, position + 30);
    seekTo?.(newPosition);
  }, [position, duration, seekTo]);

  const handleOpenPlayer = useCallback(() => {
    togglePlayer?.();
  }, [togglePlayer]);

  // Swipe up gesture to open full player
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      // Only allow upward swipe
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY < SWIPE_THRESHOLD) {
        // Swipe up detected - open player
        runOnJS(handleOpenPlayer)();
      }
      // Reset position with subtle timing
      translateY.value = withTiming(0, { duration: 150 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(0, translateY.value * 0.3) }],
  }));

  // Don't render if no book or full player is open
  // Also hide on full-screen modal routes
  const hiddenRoutes = ['ReadingHistoryWizard', 'MoodDiscovery', 'MoodResults', 'PreferencesOnboarding'];
  if (!currentBook || isPlayerVisible || hiddenRoutes.includes(currentRouteName)) {
    return null;
  }

  const title = getTitle(currentBook);
  const author = getAuthorName(currentBook);
  const progress = duration > 0 ? position / duration : 0;
  const skipIconSize = hp(2.5);
  const playIconSize = hp(3);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.container, { paddingBottom: NAV_BAR_HEIGHT }, animatedStyle]}
        entering={SlideInDown.duration(250).springify()}
        exiting={SlideOutDown.duration(200)}
      >
        <View style={styles.innerContainer}>
          {/* Progress bar at top */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>

          {/* Content row */}
          <Pressable
            style={styles.content}
            onPress={handleOpenPlayer}
            accessibilityRole="button"
            accessibilityLabel={`Now playing: ${title} by ${author}. Tap or swipe up to open player.`}
            accessibilityHint="Swipe up to expand full player"
          >
            {/* Mini CD Disc */}
            <MiniCDDisc coverUrl={coverUrl} isPlaying={isPlaying} />

            {/* Title and Status */}
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {sleepTimer !== null && sleepTimer > 0 ? (
                <View style={styles.sleepTimerRow}>
                  <Moon size={10} color={colors.accent} />
                  <Text style={styles.sleepTimerText}>
                    {formatSleepTimer(sleepTimer)}
                  </Text>
                </View>
              ) : nextBookTitle ? (
                <Text style={styles.upNext} numberOfLines={1}>
                  Up next: {nextBookTitle}
                </Text>
              ) : null}
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleSkipBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Skip back 30 seconds"
              >
                <RewindIcon size={skipIconSize} color={colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handlePlayPause}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : isPlaying ? (
                  <Pause size={playIconSize} color={colors.accent} strokeWidth={3} />
                ) : (
                  <PlayIcon size={playIconSize} color={colors.accent} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleSkipForward}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Skip forward 30 seconds"
              >
                <FastForwardIcon size={skipIconSize} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Height of the mini player for layout calculations */
export const GLOBAL_MINI_PLAYER_HEIGHT = MINI_PLAYER_HEIGHT;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom:0,
    backgroundColor: colors.backgroundPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    overflow: 'hidden',
    zIndex: 9998,
  },
  innerContainer: {
    backgroundColor: colors.cardBackground,
  },
  progressTrack: {
    height: sizes.progressHeightMini,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  upNext: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  sleepTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sleepTimerText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
  },
});

export default GlobalMiniPlayer;
