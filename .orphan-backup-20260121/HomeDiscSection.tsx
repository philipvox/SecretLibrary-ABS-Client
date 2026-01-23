/**
 * src/features/home/components/HomeDiscSection.tsx
 *
 * CD Disc Hero Section for Home screen
 * Features:
 * - 70%w disc size (vs 95%w on player screen)
 * - Blurred cover background
 * - Press animation to open full player
 * - Spinning animation when playing
 * - Chrome spindle center
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient'; // Still used for spindle
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useFrameCallback,
} from 'react-native-reanimated';
import { wp, layout, useTheme } from '@/shared/theme';
import { DURATION, SCALE, CD_ROTATION, EASING } from '@/shared/animation';

// Home disc is 70% of screen width (from layout.homeDiscRatio)
const HOME_DISC_SIZE = wp(layout.homeDiscRatio * 100);
const HOLE_SIZE = HOME_DISC_SIZE * 0.12;
const SPINDLE_SIZE = HOME_DISC_SIZE * 0.18;

interface HomeDiscSectionProps {
  /** Cover image URL */
  coverUrl: string | null;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback speed (affects spin rate) */
  playbackRate?: number;
  /** Callback when disc is pressed */
  onPress: () => void;
  /** Book title for accessibility */
  bookTitle?: string;
  /** Author name for accessibility */
  authorName?: string;
}

/**
 * Animated CD Disc component
 */
const CDDisc: React.FC<{
  coverUrl: string | null;
  size: number;
  isPlaying: boolean;
  playbackRate: number;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ coverUrl, size, isPlaying, playbackRate, colors }) => {
  const rotation = useSharedValue(0);
  const baseDegreesPerMs = useSharedValue(0);
  const lastFrameTime = useSharedValue(Date.now());

  // Calculate rotation speed based on playing state and playback rate
  // Uses centralized CD_ROTATION token for consistent animation speed
  useEffect(() => {
    const degreesPerSecond = isPlaying ? CD_ROTATION.baseSpeed * playbackRate : 0;
    baseDegreesPerMs.value = withTiming(degreesPerSecond / 1000, { duration: DURATION.moderate });
  }, [isPlaying, playbackRate]);

  // UI thread frame callback for smooth 60fps animation
  useFrameCallback((frameInfo) => {
    'worklet';
    const now = frameInfo.timestamp;
    const deltaMs = now - lastFrameTime.value;
    lastFrameTime.value = now;

    // Clamp delta to avoid huge jumps when app was backgrounded
    const clampedDelta = Math.min(deltaMs, 50);

    // Update rotation
    if (Math.abs(baseDegreesPerMs.value) > 0.001) {
      rotation.value = (rotation.value + baseDegreesPerMs.value * clampedDelta) % 360;
    }
  }, true);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        discStyle,
      ]}
    >
      {coverUrl ? (
        <Image
          source={coverUrl}
          style={[styles.discCover, { borderRadius: size / 2 }]}
          contentFit="cover"
          contentPosition="top"
        />
      ) : (
        <View style={[styles.discCover, { backgroundColor: colors.background.secondary, borderRadius: size / 2 }]} />
      )}
    </Animated.View>
  );
};

export function HomeDiscSection({
  coverUrl,
  isPlaying,
  playbackRate = 1,
  onPress,
  bookTitle,
  authorName,
}: HomeDiscSectionProps) {
  const { colors } = useTheme();
  const scaleAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  // Empty state when no cover
  if (!coverUrl) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyDisc, { width: HOME_DISC_SIZE, height: HOME_DISC_SIZE, backgroundColor: colors.background.elevated, borderColor: colors.border.default }]}>
          <View style={[styles.emptyCenter, { backgroundColor: colors.background.elevated }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Disc */}
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scaleAnim.value = withTiming(SCALE.cardPress, {
            duration: DURATION.press,
            easing: EASING.decelerate,
          });
        }}
        onPressOut={() => {
          scaleAnim.value = withTiming(1, {
            duration: DURATION.press,
            easing: EASING.decelerate,
          });
        }}
        accessibilityLabel={bookTitle && authorName
          ? `${bookTitle} by ${authorName}${isPlaying ? ', currently playing' : ''}`
          : isPlaying ? 'Now playing' : 'Open player'}
        accessibilityRole="button"
        accessibilityHint="Double tap to open full player"
      >
        <Animated.View style={animatedStyle}>
          <CDDisc
            coverUrl={coverUrl}
            size={HOME_DISC_SIZE}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            colors={colors}
          />

          {/* Chrome spindle center - static (doesn't rotate) */}
          <View style={styles.centerContainer}>
            <View style={styles.spindleOuter}>
              {/* 3D gradient effect */}
              <LinearGradient
                colors={['#666666', '#444444', '#333333']}
                locations={[0, 0.5, 1]}
                style={styles.spindleGradient}
              />
              <View style={styles.spindleInner}>
                {/* Raised metallic gradient */}
                <LinearGradient
                  colors={['#888888', '#666666', '#444444']}
                  locations={[0, 0.4, 1]}
                  style={StyleSheet.absoluteFill}
                />
                {/* Highlight reflection */}
                <View style={styles.spindleHighlight} />
                {/* Center hole */}
                <View style={[styles.spindleCenter, { backgroundColor: colors.background.secondary }]} />
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: wp(5),
  },
  disc: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  discCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spindleOuter: {
    width: SPINDLE_SIZE,
    height: SPINDLE_SIZE,
    borderRadius: SPINDLE_SIZE / 2,
    backgroundColor: '#A0A0A0',
    alignItems: 'center',
    justifyContent: 'center',
    // Chrome effect with shadows
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  spindleGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SPINDLE_SIZE / 2,
  },
  spindleInner: {
    width: SPINDLE_SIZE * 0.75,
    height: SPINDLE_SIZE * 0.75,
    borderRadius: (SPINDLE_SIZE * 0.75) / 2,
    backgroundColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Highlight effect
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  spindleHighlight: {
    position: 'absolute',
    top: '10%',
    left: '20%',
    width: '30%',
    height: '20%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
    transform: [{ rotate: '-30deg' }],
  },
  spindleCenter: {
    width: HOLE_SIZE,
    height: HOLE_SIZE,
    borderRadius: HOLE_SIZE / 2,
    // backgroundColor set via themeColors in JSX
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: wp(5),
  },
  emptyDisc: {
    borderRadius: HOME_DISC_SIZE / 2,
    // backgroundColor and borderColor set via themeColors in JSX
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCenter: {
    width: HOLE_SIZE,
    height: HOLE_SIZE,
    borderRadius: HOLE_SIZE / 2,
    // backgroundColor set via themeColors in JSX
  },
});

export default HomeDiscSection;
