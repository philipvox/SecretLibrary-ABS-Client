/**
 * src/features/mood-discovery/components/MoodScoringOverlay.tsx
 *
 * Full-screen loading overlay shown while mood scoring is computing.
 * Uses the same SkullCandle animation from AnimatedSplash for visual consistency.
 */

import React, { useEffect, useRef, useReducer, memo } from 'react';
import { StyleSheet, Animated, View, Text } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { scale, useTheme } from '@/shared/theme';
import { secretLibraryFonts, secretLibraryColors } from '@/shared/theme/secretLibrary';

interface MoodScoringOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Loading progress from 0 to 1 */
  progress?: number;
  /** Status text to show */
  statusText?: string;
}

// =============================================================================
// SKULL CANDLE ANIMATION DATA (Same as AnimatedSplash.tsx)
// =============================================================================

const SKULL_PATHS = [
  'M155.1,153.6c-.5-4.6-1.6-9-3-13.3-.7-2.4-1.4-5-2.6-7.3-2.3-4.7-6.2-7.8-9.5-12-2.4-3.1-4.4-6.5-6.5-10,0-.2-.2-.4-.4-.6-1.8-3.7-4.3-7.6-7.4-10.7,0,0-.4-.4-.5-.5-.5-.4-.8-.7-1.2-1,0,.5-.5,1.1-.8,1.4-.5.5-1.3,1.1-2.6,1.1-2.5,0-4.8-1-7.1-1.8-4.8-1.8-7.4-2.5-10,1.4-.8,1.4-1.4,2.8-2.2,4.1-2.3,4.8-4.4,9.4-13.7,7-3.1-.8-5.8-2.5-8.3-4.2-.6-.5-1.3-.8-1.9-1.3-2.3-1.4-8.4-2.2-11.2-1.7-1.6.2-3.1,1.3-4.8,2.4-1.8,1.3-3.7,2.5-6.1,3-1.9.4-4,.4-5.9.4s-3.7,0-5.4.4c-7.2,1.7-10.3,7.2-13.6,13-2.9,5.2-6,10.6-12,13.6-1.7.8-3.1,1.2-4.3,1.2s-2.2-.4-2.9-1.1c-.7-.6-1.1-1.4-1.4-2.3-4.2,13-4,20,1.8,34.4,11.6,29,36.5,49.8,40.9,51.8,4.8,2.2,28-6,33.1-5.5,4.3.5,7.2,5.2,8.9,8.6s3,10.6,4.7,10.9c1.1,0,2.3-.2,3.5-.6.5,0,1.1-.4,1.6-.4,1.7-.5,2.9-.8,3.5-1.1-.4-1-.8-2.3-1.2-3.2-1.3-3.5-2.3-6.7-2.4-10.6,3.6-1.6,4.9,7.1,5.8,9.2.5,1.3,1,2.8,1.3,3.7,1.4-.4,3.7-1.2,6-1.9,2.3-.7,4.6-1.6,6-2-.6-1.7-1-3.4-1.7-4.9-.6-1.3-1.3-2.2-1.6-3.7,0-1-.7-6.8,1.7-5.4,1.4,1,2,3.1,2.5,4.7.5,1.7,1.2,3.2,1.7,4.9.4,1.1,1,2.6,1.3,3.5.5,0,1.2-.4,2-.5,2.2-.6,6.6-1.7,8.5-2.3,0-.7-.5-1.8-1-3.2-.7-2.2-1.2-4.3-1.6-6.6,0-.8,0-1.7.7-2.4.8-.7,4,7.2,4.3,7.8.6,1.3,1,2.9,2.4,3.1,1.9.4,3.8-1.2,5.4-1.9,1.7-.8,3.5-1.4,4.1-3.4.8-2.9-.7-5.9-2.5-8-1.9-2.4-3.5-5.2-4.6-8-1.3-3.5-4.3-18.1-4.2-19.2.7-4.6,3.5-8,7.9-10,3.5-1.6,5.4-4.7,5.6-8.6,0-1.9,0-3.8.2-5.6.4-1.7.6-3,.4-4.8h.3ZM104.3,168h0c-.5,16-18.6,28.2-32.4,13.7-8.3-8.3-9.5-24.5,1.2-31.2,13-8.4,30,2.5,31.3,17.3v.2ZM120.4,187.2c-7.1-19.9-.6-22.3,6.1-1.4,1.2,3.7-4.9,5.3-6.1,1.4ZM145.5,166.2v.2c-8,10.7-22.1,1.9-25-11.4-3.6-14,6.6-29.3,19.6-20.5,10.2,5.9,12.4,22.8,5.4,31.7Z',
  'M17,133.9c5-2.6,7.7-7.2,10.6-12.1,3.5-6.2,7.2-12.6,15.8-14.8,2.2-.5,4.2-.5,6.2-.5s3.5,0,5-.2c1.7-.4,3.1-1.4,4.8-2.5,1.9-1.3,3.8-2.6,6.1-3,3.2-.6,10.4,0,13.8,2.2.7.5,1.3.8,2,1.3,2.4,1.6,4.6,3.1,7.1,3.7,6.4,1.7,7.3-.2,9.6-5,.6-1.3,1.3-2.9,2.3-4.4,4.1-6.7,9.7-4.7,14.2-3,1.9.7,4.1,1.4,5.9,1.6v-1.7c-.4-4.6-7.8-7.7-13.8-10.2-4.2-1.8-7.4-3.2-8.8-5.2-1.2-1.8-1.4-4.4-1.8-7.3-.6-5.5-1.2-7.4-3.5-7.4h0c-1.8,0-4.2,1.1-6.6,2-1.7.7-3.4,1.3-4.8,1.7-5.3,1.3-11,2.5-16.6,3-2,0-4.6-.5-7.1-1.2-1.8-.5-4.9-1.3-5.6-1-1.6,1-1.4,2.8-1,6.4.5,3.5,1.1,7.9-2.9,10.2-11.9,6.8-22.8,18.1-29.4,30.1-1.6,2.9-2.9,5.8-4,8.6-1.7,4.4-1.7,8.4-.8,9.2.4.2,1.3.2,3.2-.7h0v.2h.1Z',
];

const CANDLE_FRAMES = [
  'M83,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-3-3-6.3-6.1-6.8-10.5-.3-4.6.5-9.8,2.7-14,1.3-2.5,2.4-5.2,4.1-7.4.9-1.1,3.3-4.7,4.9-3,.9,1.3-.5,4.3,0,5.7,1.3,3.1,4.1,5.2,6.1,8,1.4,2,2.2,3.9,2.4,5.8h.3Z',
  'M62.6,44.4c-.5,5,2.5,21.1,10.2,17.9,5.7-3.3,8.7-11.2,6.3-17.5-3-6.8-8.7-14.2-5.4-21.7.3-1.1,1.1-4.4.6-5-.9.9-1.6,2.8-2.7,3.9-4.9,6.3-9,14-9.1,22v.3h0Z',
  'M78.9,47.5c-.2,2.5-.2,5.7-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-7.4-11,9.9-18.9,5-31.5v-.8c-.3-1.6-.5-3.1-.3-4.7.5-4.9,6.6-12.8,12.3-11.8.2.3-.9.9-1.3,1.1-5.8,3.5-11.8,9.9-7.7,16.7,0,.3.3.5.5.8,2.8,5,6,11.3,6.3,17.9v.3h-.2Z',
  'M72.7,20c.2,2.4,0,5,.6,7.4.8,2.8,3,4.9,3.9,7.6,2.2,7.4,2.7,17-1.1,23.5-1.9,3.3-7.1,6.1-10.1,2.7-2-3.1-3.5-7.2-3.5-11,0-6.1,4.4-10.9,5.5-16.7.8-4.6,2.4-9.6,4.6-13.4h0Z M81.6,10.2c1-.9,2.2-1.6,3.4-2s3.1-.4,3.7.6c-1.7,1.1-3,1.3-5,1.6-1.9.3-3.1,2-4.9,2.4l2.7-2.5h.1Z',
  'M74.7,60.3c-4.8,3.8-9.9,3.1-11.7-2,0-.3-.2-.6-.3-.9-1.1-6.1,1.8-11.4,4.3-16.9,0-.3.3-.6.4-.9,3-5.2,0-9.9,3-14.6,1.6,6.3,9.4,11,8,18.3v.9c-.3,3.9.3,13-3.6,16.1h-.1Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.5-5.4-3.1-10.7-1.6-15.9,0-.3.2-.6.3-.9,1.3-2.2,2.2-4.3,2.8-6.5,0-.3,0-.5.2-.8,2-5.7-2.7-8.8-2.7-15.1,6.3,3.1,9.4,11,12.4,15.9,0,.3.3.5.5.8.3.5.6.9,1.1,1.4,0,.3.3.5.3.8,1.4,3,2.7,6.1,2.7,9.6v.9c0,1.7-.3,3.6-1.1,5.4v.3h0v-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-5.4,3.5-9.4,5.4-14,.8-1.9,1.9-5,3.6-6.1,2.5-1.7,3.1,2.4,4.6,4.1s3,3.1,4.4,4.9c1.4,2,2.2,3.9,2.4,5.8h.2,0Z',
  'M83.3,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.5-2.5-5.4-5.2-6.4-8.7s-.9-7.7-.2-11.6c.6-3.8,1.6-7.5,1.8-11.4s-.2-7.9-2.4-11.1c4.7,2.2,8.6,6,11.7,10.2s3.7,5.7,5.4,8.7,1.6,3,2.4,4.6,1.4,3.8,1.2,3.8h.3Z',
  'M62.5,44.4c0,.2,0,.4,0,.7,0,1.9.2,3.8.5,5.7.7,3.7,1.9,9,5.4,11.2s2.9.9,4.4.3c4.9-2.1,7.5-9.7,6.4-14.5s-2.5-5.7-4.2-8.3c-3.3-4.9-6.8-9.9-11.6-13.3,1.1,2.8,1.2,5.9.9,8.8-.3,2.1-.7,4.1-1.3,6.1s-.4,2.2-.4,3.3Z',
  'M79.2,47.5c.2,3-.3,6-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-2.7-2.7-2-7.6-.7-10.7s2.1-2.8,3.1-4.3,1.7-3.5,2.1-5.5c.5-3.3,0-6.7-1.7-9.6-1.5-2.6-3.7-4.8-4.5-7.7-.7-2.6-.1-5.3.5-7.9.3,5.4,1.7,10.9,5.1,15.2,1.8,2.2,4.1,4,6,6.2,2.8,3.3,4.6,7.7,4.9,12.2Z',
  'M63.7,24.7c2.7,5,7.8,8.3,11.1,13,3.6,5.1,4.6,11.8,3,17.8-.7,2.7-2.2,4.3-4.5,5.9s-5.4,2-7.3-.2c-1.6-2.5-2.8-5.3-3.3-8.2s.2-5.8.7-8.9c1-6.7,1-13.5,0-20.2.1.3.3.5.4.8Z',
  'M74.8,60.3c-1.2,1.3-2.7,2.2-4.5,2.4s-3,.2-4.4-.7-2.7-2.3-2.7-3.6c0-.3-.2-.6-.3-.9-.6-3.1-.8-6,.4-9.1.8-2,1.8-3.8,2.6-5.8,1.7-4.7,1.4-9.9,1.1-14.9.9,4.3,4.6,7.4,7.1,11.1,1.5,2.3,2.6,5,3.2,7.7.7,3.1,1,6.4,0,9.4s-1.3,3.1-2.5,4.3Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.2-3-3.2-10.2-2-14.1s3.4-10.1,6.3-14.4c2.8-4.3,7.1-8,12.1-9.1-3.6,1.4-5.6,5.5-5.5,9.3.1,3.7,2.1,6.2,3.5,9.5s1.6,5.6,1.6,8.1v.9c0,1.7-.3,3.6-1.1,5.4v.3-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-4.7,2.5-8.5,4.6-12.2s3.9-8.9,4.6-13.6c.3-1.9.7-4.1,2.5-4.8-.6.2.4,6,.6,6.6.4,2.3,1.1,4.6,2,6.7,1.7,4.1,5.7,7.6,6.2,12h.2,0Z',
];

// Skull candle viewBox dimensions
const VIEWBOX_WIDTH = 162;
const VIEWBOX_HEIGHT = 236.5;
const ASPECT_RATIO = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;

// Frame rate: 12fps = 83.33ms per frame
const FRAME_DURATION_MS = 1000 / 12;

// =============================================================================
// ANIMATED SKULL CANDLE COMPONENT
// =============================================================================

interface SkullCandleProps {
  color: string;
  size: number;
}

/**
 * SkullCandle - Memoized flickering candle animation
 */
const SkullCandle = memo(function SkullCandle({ color, size }: SkullCandleProps) {
  const [frameIndex, nextFrame] = useReducer(
    (prev: number) => (prev + 1) % CANDLE_FRAMES.length,
    0
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(nextFrame, FRAME_DURATION_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const scaledHeight = scale(size);
  const scaledWidth = scaledHeight * ASPECT_RATIO;

  return (
    <Svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    >
      {/* Static skull */}
      <G>
        {SKULL_PATHS.map((d, i) => (
          <Path key={`skull-${i}`} d={d} fill={color} />
        ))}
      </G>
      {/* Animated candle flame */}
      <Path d={CANDLE_FRAMES[frameIndex]} fill={color} />
    </Svg>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PROGRESS_BAR_WIDTH = 120;

export function MoodScoringOverlay({
  visible,
  progress = 0,
  statusText = 'Finding your perfect reads...',
}: MoodScoringOverlayProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Fade in/out when visibility changes
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, backgroundColor: colors.background.primary },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Animated skull with flickering candle */}
      <View style={styles.logoContainer}>
        <SkullCandle color={colors.text.primary} size={120} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressTrack, { backgroundColor: colors.progress.track }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: '#FFFFFF' },
            ]}
          />
        </View>
        {/* Status text */}
        <Text style={[styles.statusText, { color: colors.text.tertiary }]}>
          {statusText}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginTop: scale(24),
    alignItems: 'center',
  },
  progressTrack: {
    width: PROGRESS_BAR_WIDTH,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  statusText: {
    marginTop: scale(12),
    fontSize: scale(10),
    textAlign: 'center',
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
