/**
 * src/features/player/components/PlayerScrubButton.tsx
 *
 * Joystick-style play button with scrubbing for the player screen.
 * - Tap: Play/pause toggle
 * - Drag left/right: Scrub rewind/fast-forward (speed based on distance)
 *
 * Adapted from CoverPlayButton for use in CDPlayerScreen.
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { usePlayerStore } from '@/features/player';
import { useCoverUrl } from '@/core/cache';
import { haptics } from '@/core/native/haptics';
import { audioService } from '@/features/player/services/audioService';
import { colors, wp, radius, spacing } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCRUB_CONFIG = {
  DRAG_THRESHOLD: 8,        // pt - movement needed to enter scrub mode
  MAX_DISPLACEMENT: 100,    // pt - maximum drag distance from center (larger for player)
  DEAD_ZONE: 10,            // pt - no scrub in this zone
  HAPTIC_INTERVAL_MS: 30000,// ms of audio scrubbed between haptic ticks

  // Speed zones: displacement → seconds of audio per second of real time
  SPEED_ZONES: [
    { displacement: 10, speed: 0, label: 'dead' },
    { displacement: 30, speed: 0.5, label: '0.5x' },
    { displacement: 50, speed: 1, label: '1x' },
    { displacement: 70, speed: 2, label: '2x' },
    { displacement: 85, speed: 4, label: '4x' },
    { displacement: 100, speed: 30, label: '30s' },
  ],

  // Max playback rate for audible scrubbing
  MAX_AUDIBLE_RATE: 4,

  // Time-based ramp at max displacement
  RAMP_THRESHOLD: 85,
  RAMP_DELAY_MS: 2000,
  RAMP_DURATION_MS: 1000,
  RAMP_MAX_SPEED: 300,

  // Spring animation for snap back
  SPRING_CONFIG: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },
};

// Visual constants
const DEFAULT_BUTTON_SIZE = 80;

// ============================================================================
// ICONS
// ============================================================================

const PlayIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 37 45" fill="none">
    <Path
      d="M0.5 2.50407C0.5 0.926681 2.24075 -0.0298878 3.57227 0.815811L34.8419 20.6762C36.0789 21.4619 36.0789 23.2671 34.8419 24.0528L3.57228 43.9132C2.24075 44.7589 0.5 43.8023 0.5 42.2249V2.50407Z"
      fill={colors.accent}
    />
  </Svg>
);

const PauseIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 30 45" fill="none">
    <Rect x="0" y="0" width="10" height="45" rx="2" fill={colors.accent} />
    <Rect x="20" y="0" width="10" height="45" rx="2" fill={colors.accent} />
  </Svg>
);

const RewindIcon: React.FC<{ size?: number; opacity?: number }> = ({ size = 24, opacity = 0.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 20L9 12L19 4V20Z" fill={`rgba(255,255,255,${opacity})`} />
    <Path d="M10 20L0 12L10 4V20Z" fill={`rgba(255,255,255,${opacity})`} />
  </Svg>
);

const FastForwardIcon: React.FC<{ size?: number; opacity?: number }> = ({ size = 24, opacity = 0.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 4L15 12L5 20V4Z" fill={`rgba(255,255,255,${opacity})`} />
    <Path d="M14 4L24 12L14 20V4Z" fill={`rgba(255,255,255,${opacity})`} />
  </Svg>
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateScrubSpeed(displacement: number): number {
  'worklet';
  const absDisplacement = Math.abs(displacement);
  const direction = displacement >= 0 ? 1 : -1;
  const zones = SCRUB_CONFIG.SPEED_ZONES;

  for (let i = zones.length - 1; i >= 0; i--) {
    if (absDisplacement >= zones[i].displacement) {
      if (i < zones.length - 1) {
        const nextZone = zones[i + 1];
        const progress = (absDisplacement - zones[i].displacement) /
                        (nextZone.displacement - zones[i].displacement);
        const speed = zones[i].speed + progress * (nextZone.speed - zones[i].speed);
        return speed * direction;
      }
      return zones[i].speed * direction;
    }
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function formatTimeOffset(seconds: number): string {
  const sign = seconds >= 0 ? '+' : '-';
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.floor(absSeconds % 60);
  return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSpeedZoneIndex(displacement: number): number {
  const absDisplacement = Math.abs(displacement);
  const zones = SCRUB_CONFIG.SPEED_ZONES;
  for (let i = zones.length - 1; i >= 0; i--) {
    if (absDisplacement >= zones[i].displacement) {
      return i;
    }
  }
  return 0;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface PlayerScrubButtonProps {
  size?: number;
  onScrubChange?: (direction: 'forward' | 'backward' | null, speed: number) => void;
}

export function PlayerScrubButton({
  size = DEFAULT_BUTTON_SIZE,
  onScrubChange,
}: PlayerScrubButtonProps) {
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const chapters = usePlayerStore((s) => s.chapters);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  const coverUrl = useCoverUrl(currentBook?.id || '');

  // Animated values
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const isScrubbing = useSharedValue(false);
  const scrubStartPosition = useSharedValue(0);
  const currentScrubOffset = useSharedValue(0);
  const directionIconOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);

  // State
  const [tooltipText, setTooltipText] = useState('+00:00');
  const [scrubPosition, setScrubPosition] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<{ title: string; start: number; end: number } | null>(null);
  const [speedLabel, setSpeedLabel] = useState('');

  // Refs
  const scrubIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHapticPositionRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const timeAtMaxRef = useRef(0);
  const currentSpeedZoneRef = useRef(0);
  const hasTriggeredRampHapticRef = useRef(false);
  const lastReportedSpeedRef = useRef(0);
  const lastReportedDirectionRef = useRef<'forward' | 'backward' | null>(null);

  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    return () => {
      if (scrubIntervalRef.current) {
        clearInterval(scrubIntervalRef.current);
      }
    };
  }, []);

  const findChapterAtPosition = useCallback((pos: number) => {
    if (!chapters || chapters.length === 0) return null;
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const nextChapter = chapters[i + 1];
      const chapterEnd = nextChapter ? nextChapter.start : duration;
      if (pos >= chapter.start && pos < chapterEnd) {
        return { title: chapter.title, start: chapter.start, end: chapterEnd };
      }
    }
    const lastChapter = chapters[chapters.length - 1];
    return { title: lastChapter.title, start: lastChapter.start, end: duration };
  }, [chapters, duration]);

  const startScrub = useCallback(() => {
    scrubStartPosition.value = positionRef.current;
    currentScrubOffset.value = 0;
    setTooltipText('+00:00');
    setScrubPosition(positionRef.current);
    setShowProgressBar(true);
    setSpeedLabel('');
    lastHapticPositionRef.current = positionRef.current;
    wasPlayingRef.current = isPlaying;
    timeAtMaxRef.current = 0;
    currentSpeedZoneRef.current = 0;
    hasTriggeredRampHapticRef.current = false;

    const chapter = findChapterAtPosition(positionRef.current);
    setCurrentChapter(chapter);

    // Pause playback during scrub
    if (isPlaying) {
      pause();
    }

    haptics.toggle();

    // Reset scrub reporting refs
    lastReportedSpeedRef.current = 0;
    lastReportedDirectionRef.current = null;

    let lastTime = Date.now();
    scrubIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const baseSpeed = calculateScrubSpeed(translateX.value);
      const absDisplacement = Math.abs(translateX.value);

      // Speed zone haptic
      const newZone = getSpeedZoneIndex(translateX.value);
      if (newZone !== currentSpeedZoneRef.current && newZone > 0) {
        if (newZone > currentSpeedZoneRef.current) {
          haptics.impact('medium');
        } else {
          haptics.impact('light');
        }
        currentSpeedZoneRef.current = newZone;
        setSpeedLabel(SCRUB_CONFIG.SPEED_ZONES[newZone].label);
      }

      // Handle dead zone - report null direction
      if (baseSpeed === 0 && lastReportedDirectionRef.current !== null) {
        lastReportedDirectionRef.current = null;
        lastReportedSpeedRef.current = 0;
        onScrubChange?.(null, 0);
      }

      if (baseSpeed !== 0) {
        // Time ramp at max displacement
        if (absDisplacement >= SCRUB_CONFIG.RAMP_THRESHOLD) {
          timeAtMaxRef.current += deltaTime * 1000;
        } else {
          timeAtMaxRef.current = 0;
          hasTriggeredRampHapticRef.current = false;
        }

        let speed = baseSpeed;
        if (timeAtMaxRef.current > SCRUB_CONFIG.RAMP_DELAY_MS) {
          const rampProgress = Math.min(
            (timeAtMaxRef.current - SCRUB_CONFIG.RAMP_DELAY_MS) / SCRUB_CONFIG.RAMP_DURATION_MS,
            1
          );
          const direction = baseSpeed >= 0 ? 1 : -1;
          const absBase = Math.abs(baseSpeed);
          speed = direction * (absBase + (SCRUB_CONFIG.RAMP_MAX_SPEED - absBase) * rampProgress);

          if (!hasTriggeredRampHapticRef.current && rampProgress > 0) {
            haptics.impact('heavy');
            hasTriggeredRampHapticRef.current = true;
            setSpeedLabel('5m');
          }
        }

        // Report scrub direction and actual speed to parent (with filtering to reduce jitter)
        const scrubDirection: 'forward' | 'backward' | null = speed > 0 ? 'forward' : speed < 0 ? 'backward' : null;
        const absSpeed = Math.abs(speed);
        const speedDelta = Math.abs(absSpeed - lastReportedSpeedRef.current);
        const directionChanged = scrubDirection !== lastReportedDirectionRef.current;

        // Only report if direction changed or speed changed by more than 5%
        if (directionChanged || speedDelta > lastReportedSpeedRef.current * 0.05 || speedDelta > 0.5) {
          lastReportedSpeedRef.current = absSpeed;
          lastReportedDirectionRef.current = scrubDirection;
          onScrubChange?.(scrubDirection, absSpeed);
        }

        const deltaPosition = speed * deltaTime;
        const newOffset = currentScrubOffset.value + deltaPosition;
        const newPosition = clamp(
          scrubStartPosition.value + newOffset,
          0,
          duration
        );

        currentScrubOffset.value = newPosition - scrubStartPosition.value;

        setTooltipText(formatTimeOffset(newPosition - scrubStartPosition.value));
        setScrubPosition(newPosition);

        const chapter = findChapterAtPosition(newPosition);
        setCurrentChapter(chapter);

        // Seek to position (silent scrubbing - no audio during scrub)
        audioService.seekTo(newPosition);

        // Haptic tick every 30s
        const scrubbed = Math.abs(newPosition - lastHapticPositionRef.current);
        if (scrubbed >= SCRUB_CONFIG.HAPTIC_INTERVAL_MS / 1000) {
          haptics.seek();
          lastHapticPositionRef.current = newPosition;
        }

        // Boundary haptic
        if (newPosition <= 0 || newPosition >= duration) {
          haptics.error();
        }
      }
    }, 50); // 20fps for seeking
  }, [isPlaying, pause, duration, findChapterAtPosition, onScrubChange]);

  const endScrub = useCallback(() => {
    if (scrubIntervalRef.current) {
      clearInterval(scrubIntervalRef.current);
      scrubIntervalRef.current = null;
    }

    // Notify parent scrub ended
    onScrubChange?.(null, 0);

    const finalPosition = clamp(
      scrubStartPosition.value + currentScrubOffset.value,
      0,
      duration
    );

    audioService.seekTo(finalPosition);
    usePlayerStore.setState({ position: finalPosition });

    setTimeout(() => setShowProgressBar(false), 200);

    if (wasPlayingRef.current) {
      play();
    }

    haptics.buttonPress();
  }, [duration, play, onScrubChange]);

  const handlePlayPause = useCallback(async () => {
    haptics.playbackToggle();
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  // ============================================================================
  // GESTURES
  // ============================================================================

  const panGesture = Gesture.Pan()
    .minDistance(SCRUB_CONFIG.DRAG_THRESHOLD)
    .onStart(() => {
      'worklet';
      isScrubbing.value = true;
      scale.value = withTiming(0.95, { duration: 100 });
      directionIconOpacity.value = withTiming(0.8, { duration: 150 });
      tooltipOpacity.value = withTiming(1, { duration: 100 });
      runOnJS(startScrub)();
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = clamp(
        event.translationX,
        -SCRUB_CONFIG.MAX_DISPLACEMENT,
        SCRUB_CONFIG.MAX_DISPLACEMENT
      );
    })
    .onEnd(() => {
      'worklet';
      isScrubbing.value = false;
      translateX.value = withSpring(0, SCRUB_CONFIG.SPRING_CONFIG);
      scale.value = withSpring(1, SCRUB_CONFIG.SPRING_CONFIG);
      directionIconOpacity.value = withTiming(0, { duration: 200 });
      tooltipOpacity.value = withTiming(0, { duration: 200 });
      runOnJS(endScrub)();
    });

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      'worklet';
      scale.value = withTiming(0.95, { duration: 50 });
    })
    .onEnd(() => {
      'worklet';
      scale.value = withSpring(1, SCRUB_CONFIG.SPRING_CONFIG);
      runOnJS(handlePlayPause)();
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const rewindIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SCRUB_CONFIG.DEAD_ZONE, 0],
      [directionIconOpacity.value, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      { translateX: interpolate(translateX.value, [-100, 0], [-40, 0], Extrapolation.CLAMP) },
    ],
  }));

  const fastForwardIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SCRUB_CONFIG.DEAD_ZONE],
      [0, directionIconOpacity.value],
      Extrapolation.CLAMP
    ),
    transform: [
      { translateX: interpolate(translateX.value, [0, 100], [0, 40], Extrapolation.CLAMP) },
    ],
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [
      { translateY: interpolate(tooltipOpacity.value, [0, 1], [10, 0], Extrapolation.CLAMP) },
    ],
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!currentBook) {
    return null;
  }

  const chapterProgressPercent = currentChapter
    ? ((scrubPosition - currentChapter.start) / (currentChapter.end - currentChapter.start)) * 100
    : 0;
  const chapterDuration = currentChapter ? currentChapter.end - currentChapter.start : 0;
  const positionInChapter = currentChapter ? scrubPosition - currentChapter.start : 0;

  const iconSize = size * 0.4;

  return (
    <View style={styles.container}>
      {/* Progress bar during scrub */}
      {showProgressBar && (
        <View style={styles.progressBarContainer}>
          {currentChapter && (
            <Text style={styles.chapterTitle} numberOfLines={1}>
              {currentChapter.title}
            </Text>
          )}
          {speedLabel && (
            <View style={styles.speedBadge}>
              <Text style={styles.speedBadgeText}>{speedLabel}/s</Text>
            </View>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, chapterProgressPercent))}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressTime}>{formatTime(positionInChapter)}</Text>
            <Text style={styles.progressTimeOffset}>{tooltipText}</Text>
            <Text style={styles.progressTime}>{formatTime(chapterDuration)}</Text>
          </View>
          <Text style={styles.overallTime}>
            {formatTime(scrubPosition)} / {formatTime(duration)}
          </Text>
        </View>
      )}

      {/* Direction icons */}
      <Animated.View style={[styles.directionIcon, styles.rewindIcon, rewindIconStyle]}>
        <RewindIcon size={24} />
      </Animated.View>

      <Animated.View style={[styles.directionIcon, styles.fastForwardIcon, fastForwardIconStyle]}>
        <FastForwardIcon size={24} />
      </Animated.View>

      {/* Tooltip */}
      {!showProgressBar && (
        <Animated.View style={[styles.tooltip, tooltipStyle]}>
          <Text style={styles.tooltipText}>{tooltipText}</Text>
        </Animated.View>
      )}

      {/* Main button */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.button, { width: size, height: size, borderRadius: size / 2 }, buttonAnimatedStyle]}>
          {coverUrl && (
            <Image
              source={coverUrl}
              style={[styles.coverImage, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}
              contentFit="cover"
              transition={200}
            />
          )}

          <View style={[styles.blurOverlay, { borderRadius: size / 2 }]}>
            <BlurView intensity={2} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.darkOverlay} />
          </View>

          <View style={[styles.border, { width: size, height: size, borderRadius: size / 2 }]} />

          <View style={styles.iconOverlay}>
            {isPlaying ? <PauseIcon size={iconSize} /> : <PlayIcon size={iconSize} />}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  button: {
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    position: 'absolute',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  border: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  iconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  rewindIcon: {
    right: DEFAULT_BUTTON_SIZE + 30,
  },
  fastForwardIcon: {
    left: DEFAULT_BUTTON_SIZE + 30,
  },
  tooltip: {
    position: 'absolute',
    top: -45,
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  tooltipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: DEFAULT_BUTTON_SIZE + 30,
    width: SCREEN_WIDTH - 44,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chapterTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  speedBadge: {
    position: 'absolute',
    top: 14,
    right: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  speedBadgeText: {
    color: colors.backgroundPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.progressTrack,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.progressFill,
    borderRadius: radius.xs,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  progressTime: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  progressTimeOffset: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  overallTime: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

export default PlayerScrubButton;
