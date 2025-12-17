/**
 * src/features/home/components/HomeMiniPlayer.tsx
 *
 * Floating mini player for Home screen with mini CD disc
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
} from 'react-native-reanimated';
import { wp, hp, moderateScale, COLORS } from '@/shared/hooks/useResponsive';

// Mini disc size
const MINI_DISC_SIZE = hp(6);
const MINI_HOLE_SIZE = MINI_DISC_SIZE * 0.12;
const MINI_SPINDLE_SIZE = MINI_DISC_SIZE * 0.22;

// Responsive layout constants
const MINI_PLAYER = {
  // Container - full screen width like nav bar
  marginH: 0,
  borderRadius: 0,
  bottomOffset: hp(12.5), // Directly above nav bar

  // Progress bar
  progressHeight: hp(0.4),

  // Content
  paddingH: wp(3),
  paddingV: hp(1),

  // Icons
  skipIconSize: hp(2.5),
  playIconSize: hp(3),
  buttonGap: wp(1),
};

const ACCENT = COLORS.accent;
const TOUCH_TARGET = Math.max(44, hp(5));

export const MINI_PLAYER_SCROLL_THRESHOLD = wp(80);

interface HomeMiniPlayerProps {
  title: string;
  author: string;
  coverUrl: string | null;
  progress: number;
  isPlaying: boolean;
  onPress: () => void;
  onPlayPause: () => void;
  onSkipBack: () => void;
  scrollY?: SharedValue<number>;
  bottomInset?: number;
  tabBarHeight?: number;
  accentColor?: string;
}

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
          <View style={[miniDiscStyles.cover, { backgroundColor: '#333' }]} />
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
    backgroundColor: '#1a1a1a',
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

// Play icon
const PlayIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 5.14v14.72a1 1 0 001.5.86l11.14-7.36a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
      fill={color}
    />
  </Svg>
);

export function HomeMiniPlayer({
  title,
  author,
  coverUrl,
  progress,
  isPlaying,
  onPress,
  onPlayPause,
  onSkipBack,
  accentColor,
}: HomeMiniPlayerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Progress bar at top */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: ACCENT,
              }
            ]}
          />
        </View>

        {/* Content row */}
        <Pressable
          style={styles.content}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Now playing: ${title} by ${author}. Tap to open player.`}
        >
          {/* Mini CD Disc */}
          <MiniCDDisc coverUrl={coverUrl} isPlaying={isPlaying} />

          {/* Title */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={onSkipBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Skip back 30 seconds"
            >
              <RewindIcon size={MINI_PLAYER.skipIconSize} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { marginLeft: MINI_PLAYER.buttonGap }]}
              onPress={onPlayPause}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Ionicons name="pause" size={MINI_PLAYER.playIconSize} color={ACCENT} />
              ) : (
                <PlayIcon size={MINI_PLAYER.playIconSize} color={ACCENT} />
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: MINI_PLAYER.bottomOffset,
    left: MINI_PLAYER.marginH,
    right: MINI_PLAYER.marginH,
    borderRadius: MINI_PLAYER.borderRadius,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(102,102,102,0.5)',
    overflow: 'hidden',
    zIndex: 100,
  },
  innerContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  progressTrack: {
    height: MINI_PLAYER.progressHeight,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MINI_PLAYER.paddingH,
    paddingVertical: MINI_PLAYER.paddingV,
  },
  textContainer: {
    flex: 1,
    marginLeft: wp(3),
    marginRight: wp(2),
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: moderateScale(14),
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
    minWidth: 44,
    minHeight: 44,
  },
});

export default HomeMiniPlayer;
