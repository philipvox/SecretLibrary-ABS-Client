/**
 * src/shared/components/CoverPlayButton.tsx
 *
 * Joystick-style scrubbing control (red circle).
 * - Drag left/right: Scrub rewind/fast-forward (speed based on distance)
 * - Long press (500ms): Open full player
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { usePlayerStore, usePlaybackRate } from '@/features/player';
import { haptics } from '@/core/native/haptics';
import { audioService } from '@/features/player/services/audioService';
import { wp, useTheme } from '@/shared/theme';
import type { JoystickSeekSettings } from '@/features/player/stores/joystickSeekStore';
import { calculateSeekSpeed, applyDeadzone } from '@/features/player/stores/joystickSeekStore';

const SCREEN_WIDTH = wp(100);

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCRUB_CONFIG = {
  DRAG_THRESHOLD: 8,        // pt - movement needed to enter scrub mode
  MAX_DISPLACEMENT: 200,    // pt - maximum drag distance (per UX spec)
  DEAD_ZONE: 20,            // pt - no scrub in this zone (per UX spec)
  LONG_PRESS_DURATION: 500, // ms - threshold for opening player
  HAPTIC_INTERVAL_MS: 30000,// ms of audio scrubbed between haptic ticks

  // Speed zones per UX spec: displacement → speed multiplier
  // 0-20px: dead, 20-60px: 1x, 60-100px: 2x, 100-150px: 5x, 150-200px: 10x, 200px+: 20x
  SPEED_ZONES: [
    { displacement: 20, speed: 0, label: '' },          // Dead zone
    { displacement: 60, speed: 1, label: '1x' },        // 1x realtime
    { displacement: 100, speed: 2, label: '2x' },       // 2x realtime
    { displacement: 150, speed: 5, label: '5x' },       // 5x realtime
    { displacement: 200, speed: 10, label: '10x' },     // 10x realtime
  ],

  // Max speed when held at max displacement
  MAX_SPEED: 20, // 20x realtime

  // Max playback rate for audible scrubbing
  MAX_AUDIBLE_RATE: 4,

  // Time-based ramp at max displacement (accelerate over time)
  RAMP_THRESHOLD: 180,
  RAMP_DELAY_MS: 1500,
  RAMP_DURATION_MS: 1000,
  RAMP_MAX_SPEED: 20,  // 20x realtime at max ramp

  // Timing animation for snap back (more subtle than spring)
  SPRING_CONFIG: {
    damping: 25,
    stiffness: 200,
    mass: 1,
  },
};

// Visual constants
const BUTTON_SIZE = 48;
const COVER_SIZE = 44;

// ============================================================================
// ICONS
// ============================================================================

const RewindIcon: React.FC<{ size?: number; opacity?: number; color?: string }> = ({ size = 16, opacity = 0.8, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 20L9 12L19 4V20Z" fill={color} opacity={opacity} />
    <Path d="M10 20L0 12L10 4V20Z" fill={color} opacity={opacity} />
  </Svg>
);

const FastForwardIcon: React.FC<{ size?: number; opacity?: number; color?: string }> = ({ size = 16, opacity = 0.8, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 4L15 12L5 20V4Z" fill={color} opacity={opacity} />
    <Path d="M14 4L24 12L14 20V4Z" fill={color} opacity={opacity} />
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

function _formatTime(seconds: number): string {
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

export interface JogState {
  isActive: boolean;
  direction: 'forward' | 'backward' | null;
  speedMultiplier: number;  // 1x, 2x, 5x, etc.
  speedLabel: string;       // "2x", "5x", etc.
  currentPosition: number;
  targetPosition: number;
  offset: number;           // seconds offset from start
}

interface CoverPlayButtonProps {
  onOpenPlayer?: () => void;
  size?: number;
  /** Called with scrub speed in degrees per second (negative = backward) */
  onScrubSpeedChange?: (speed: number) => void;
  /** Called with scrub offset in seconds (negative = backward) during scrubbing */
  onScrubOffsetChange?: (offset: number, isScrubbing: boolean) => void;
  /** Called with full jog state for parent to render overlay */
  onJogStateChange?: (state: JogState) => void;
  /** Optional joystick seek settings from the store - if not provided, uses default zone-based scrubbing */
  joystickSettings?: JoystickSeekSettings;
}

export function CoverPlayButton({
  onOpenPlayer,
  size = BUTTON_SIZE,
  onScrubSpeedChange,
  onScrubOffsetChange,
  onJogStateChange,
  joystickSettings,
}: CoverPlayButtonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const chapters = usePlayerStore((s) => s.chapters);
  const playbackRate = usePlaybackRate(); // From speedStore (single source of truth)
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  // Animated values
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const isScrubbing = useSharedValue(false);
  const scrubStartPosition = useSharedValue(0);
  const currentScrubOffset = useSharedValue(0);
  const directionIconOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);

  // State
  const [_tooltipText, setTooltipText] = useState('+00:00');
  const [_scrubPosition, setScrubPosition] = useState(0);
  const [speedLabel, setSpeedLabel] = useState('');
  const [_scrubDirection, setScrubDirection] = useState<'forward' | 'backward' | null>(null);
  const [_currentSpeedMultiplier, setCurrentSpeedMultiplier] = useState(0);
  const [_isJogActive, setIsJogActive] = useState(false);

  // Refs
  const scrubIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHapticPositionRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const timeAtMaxRef = useRef(0);
  const currentSpeedZoneRef = useRef(0);
  const hasTriggeredRampHapticRef = useRef(false);
  const lastSeekTimeRef = useRef(0);  // Throttle seek calls
  const lastSeekPositionRef = useRef(0);  // Track last seeked position
  const SEEK_THROTTLE_MS = 300;  // Only seek every 300ms during scrubbing
  // Chapter boundary refs - store bounds at scrub start to prevent scrubbing past chapter
  const chapterBoundsRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

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
    scrubStartPosition.value = audioService.getLastKnownGoodPosition() ?? positionRef.current;
    currentScrubOffset.value = 0;
    setTooltipText('+00:00');
    setScrubPosition(positionRef.current);
    setSpeedLabel('');
    setScrubDirection(null);
    setCurrentSpeedMultiplier(0);
    setIsJogActive(true);
    lastHapticPositionRef.current = positionRef.current;
    wasPlayingRef.current = isPlaying;
    timeAtMaxRef.current = 0;
    currentSpeedZoneRef.current = 0;
    hasTriggeredRampHapticRef.current = false;
    lastSeekTimeRef.current = 0;
    lastSeekPositionRef.current = positionRef.current;

    // Store chapter bounds at scrub start to prevent scrubbing past chapter
    const chapter = findChapterAtPosition(positionRef.current);
    if (chapter) {
      chapterBoundsRef.current = { start: chapter.start, end: chapter.end };
    } else {
      chapterBoundsRef.current = { start: 0, end: duration };
    }

    // Notify parent that scrubbing started
    onScrubOffsetChange?.(0, true);

    // Notify parent of initial jog state
    onJogStateChange?.({
      isActive: true,
      direction: null,
      speedMultiplier: 0,
      speedLabel: '',
      currentPosition: positionRef.current,
      targetPosition: positionRef.current,
      offset: 0,
    });

    // Tell audio service we're scrubbing (enables optimizations)
    audioService.setScrubbing(true);

    // Clear any pending smart rewind state - user is manually seeking
    usePlayerStore.getState().clearSmartRewind();

    // Pause playback during scrub
    if (isPlaying) {
      pause();
    }

    haptics.toggle();

    let lastTime = Date.now();
    scrubIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const absDisplacement = Math.abs(translateX.value);
      // INVERTED: drag RIGHT = backward (-1), drag LEFT = forward (+1)
      const directionSign = translateX.value >= 0 ? -1 : 1;

      // Calculate scrub speed based on whether joystickSettings is provided
      let baseSpeed: number;
      let hapticEnabled = true;

      if (joystickSettings && joystickSettings.enabled) {
        // Use curve-based calculation from joystick seek settings
        hapticEnabled = joystickSettings.hapticEnabled;

        // Apply deadzone and normalize to 0-1
        const normalizedDistance = applyDeadzone(
          absDisplacement,
          SCRUB_CONFIG.MAX_DISPLACEMENT,
          joystickSettings.deadzone
        );

        if (normalizedDistance > 0) {
          // Calculate speed using curve-based approach
          baseSpeed = calculateSeekSpeed(normalizedDistance, joystickSettings) * directionSign;
        } else {
          baseSpeed = 0;
        }
      } else {
        // Use default zone-based calculation
        baseSpeed = calculateScrubSpeed(translateX.value);
      }

      // Determine direction
      const direction: 'forward' | 'backward' | null = baseSpeed > 0 ? 'forward' : baseSpeed < 0 ? 'backward' : null;

      // Speed zone haptic and label update (only for zone-based mode)
      if (!joystickSettings || !joystickSettings.enabled) {
        const newZone = getSpeedZoneIndex(translateX.value);
        if (newZone !== currentSpeedZoneRef.current && newZone > 0) {
          if (hapticEnabled) {
            if (newZone > currentSpeedZoneRef.current) {
              haptics.impact('medium');
            } else {
              haptics.impact('light');
            }
          }
          currentSpeedZoneRef.current = newZone;
          const label = SCRUB_CONFIG.SPEED_ZONES[newZone].label;
          setSpeedLabel(label);
          setCurrentSpeedMultiplier(SCRUB_CONFIG.SPEED_ZONES[newZone].speed);
        }
      } else {
        // For curve-based mode, update speed label based on actual speed
        const speedMultiplier = Math.abs(baseSpeed);
        if (speedMultiplier !== currentSpeedZoneRef.current && speedMultiplier > 0) {
          // Haptic feedback at speed thresholds (every 60× = 1 minute/second)
          const oldThreshold = Math.floor(currentSpeedZoneRef.current / 60);
          const newThreshold = Math.floor(speedMultiplier / 60);
          if (newThreshold !== oldThreshold && hapticEnabled) {
            if (newThreshold > oldThreshold) {
              haptics.impact('medium');
            } else {
              haptics.impact('light');
            }
          }
          currentSpeedZoneRef.current = speedMultiplier;
          // Format speed as human-readable
          if (speedMultiplier >= 60) {
            setSpeedLabel(`${Math.round(speedMultiplier / 60)}m/s`);
          } else {
            setSpeedLabel(`${Math.round(speedMultiplier)}×`);
          }
          setCurrentSpeedMultiplier(speedMultiplier);
        }
      }

      // Update direction state
      setScrubDirection(direction);

      // When in dead zone, stop disc rotation
      if (baseSpeed === 0) {
        onScrubSpeedChange?.(0);
        setScrubDirection(null);
        setCurrentSpeedMultiplier(0);
      }

      if (baseSpeed !== 0) {
        // Time ramp at max displacement (only for zone-based mode)
        let speed = baseSpeed;
        if (!joystickSettings || !joystickSettings.enabled) {
          if (absDisplacement >= SCRUB_CONFIG.RAMP_THRESHOLD) {
            timeAtMaxRef.current += deltaTime * 1000;
          } else {
            timeAtMaxRef.current = 0;
            hasTriggeredRampHapticRef.current = false;
          }

          if (timeAtMaxRef.current > SCRUB_CONFIG.RAMP_DELAY_MS) {
            const rampProgress = Math.min(
              (timeAtMaxRef.current - SCRUB_CONFIG.RAMP_DELAY_MS) / SCRUB_CONFIG.RAMP_DURATION_MS,
              1
            );
            const direction = baseSpeed >= 0 ? 1 : -1;
            const absBase = Math.abs(baseSpeed);
            speed = direction * (absBase + (SCRUB_CONFIG.RAMP_MAX_SPEED - absBase) * rampProgress);

            if (!hasTriggeredRampHapticRef.current && rampProgress > 0 && hapticEnabled) {
              haptics.impact('heavy');
              hasTriggeredRampHapticRef.current = true;
              setSpeedLabel('5m');
            }
          }
        }

        // Notify parent of scrub speed for disc rotation visualization
        // Map audio speed (seconds/second) to disc rotation (degrees/second)
        // 1x audio speed = 60 deg/s (one rotation in 6 seconds)
        const discRotationSpeed = speed * 60;
        onScrubSpeedChange?.(discRotationSpeed);

        const deltaPosition = speed * deltaTime;
        const newOffset = currentScrubOffset.value + deltaPosition;
        // Clamp to book bounds - allow scrubbing across entire book
        const newPosition = clamp(
          scrubStartPosition.value + newOffset,
          0,
          duration
        );

        // Check if we've hit a book boundary
        const atBoundary = (speed > 0 && newPosition >= duration - 0.1) ||
                          (speed < 0 && newPosition <= 0.1);

        currentScrubOffset.value = newPosition - scrubStartPosition.value;

        const offset = newPosition - scrubStartPosition.value;
        setTooltipText(formatTimeOffset(offset));
        setScrubPosition(newPosition);

        // Notify parent of scrub offset
        onScrubOffsetChange?.(offset, true);

        // Notify parent of full jog state
        onJogStateChange?.({
          isActive: true,
          direction,
          speedMultiplier: Math.abs(speed),
          speedLabel: speedLabel || `${Math.abs(speed).toFixed(0)}x`,
          currentPosition: scrubStartPosition.value,
          targetPosition: newPosition,
          offset,
        });

        // If at boundary, stop disc rotation
        if (atBoundary) {
          onScrubSpeedChange?.(0);
          // Haptic feedback for hitting boundary (only once)
          if (Math.abs(newPosition - lastHapticPositionRef.current) > 0.5 && hapticEnabled) {
            haptics.error();
            lastHapticPositionRef.current = newPosition;
          }
          return; // Don't try to seek further
        }

        // ALWAYS update cached position immediately (not throttled)
        // This keeps lastKnownGoodPosition in sync with UI during scrub
        audioService.setPosition(newPosition);

        // Throttled actual audio seeking for performance
        // Audio catches up every SEEK_THROTTLE_MS
        const now = Date.now();
        if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
          // Only seek if position changed significantly (more than 0.5 seconds)
          if (Math.abs(newPosition - lastSeekPositionRef.current) > 0.5) {
            audioService.seekTo(newPosition);
            lastSeekPositionRef.current = newPosition;
            lastSeekTimeRef.current = now;
          }
        }

        // Haptic tick every 30s
        const scrubbed = Math.abs(newPosition - lastHapticPositionRef.current);
        if (scrubbed >= SCRUB_CONFIG.HAPTIC_INTERVAL_MS / 1000 && hapticEnabled) {
          haptics.seek();
          lastHapticPositionRef.current = newPosition;
        }
      }
    }, 16); // 60fps update rate for smooth visual feedback
  }, [isPlaying, pause, duration, findChapterAtPosition, onScrubOffsetChange, joystickSettings]);

  const endScrub = useCallback(async () => {
    if (scrubIntervalRef.current) {
      clearInterval(scrubIntervalRef.current);
      scrubIntervalRef.current = null;
    }

    // Reset disc rotation speed
    onScrubSpeedChange?.(0);

    // Reset jog state
    setIsJogActive(false);
    setScrubDirection(null);
    setCurrentSpeedMultiplier(0);
    setSpeedLabel('');

    // Notify parent that scrubbing ended
    onScrubOffsetChange?.(0, false);

    // Notify parent jog ended
    onJogStateChange?.({
      isActive: false,
      direction: null,
      speedMultiplier: 0,
      speedLabel: '',
      currentPosition: 0,
      targetPosition: 0,
      offset: 0,
    });

    // Clamp to book bounds - allow scrubbing across entire book
    const finalPosition = clamp(
      scrubStartPosition.value + currentScrubOffset.value,
      0,
      duration
    );

    // CRITICAL: Set isSeeking=true to block position updates from audio callbacks
    // This prevents stale values from overwriting our target position during the
    // entire operation including the 50ms delay.
    usePlayerStore.setState({ isSeeking: true, seekPosition: finalPosition });

    // CRITICAL: Clear scrubbing flag BEFORE final seek
    // This ensures track switches execute immediately instead of being queued.
    // Previously, seeking with isScrubbing=true would queue track switches,
    // then setScrubbing(false) would clear them without executing!
    audioService.setScrubbing(false);

    // Now seek with isScrubbing=false - track switches execute immediately
    await audioService.seekTo(finalPosition);

    // Small delay for audio to settle at new position
    await new Promise(resolve => setTimeout(resolve, 50));

    // CRITICAL: Set position AND clear isSeeking together
    // This ensures the store has the correct position when we exit seeking mode.
    // Audio callbacks can resume updating position after this point.
    const actualPosition = audioService.getLastKnownGoodPosition() ?? finalPosition;
    usePlayerStore.setState({
      position: actualPosition,
      isSeeking: false,
      seekDirection: null,
    });

    // Resume playback if was playing before scrub
    if (wasPlayingRef.current) {
      play();
    }

    haptics.buttonPress();
  }, [duration, play, playbackRate, onScrubSpeedChange, onScrubOffsetChange]);

  // handlePlayPause removed - joystick is for scrubbing only

  const handleLongPress = useCallback(() => {
    if (onOpenPlayer) {
      haptics.longPress();
      onOpenPlayer();
    }
  }, [onOpenPlayer]);

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

  const longPressGesture = Gesture.LongPress()
    .minDuration(SCRUB_CONFIG.LONG_PRESS_DURATION)
    .onStart(() => {
      'worklet';
      runOnJS(handleLongPress)();
    });

  // Tap gesture removed - joystick is for scrubbing only, not play/pause
  // Play/pause is handled elsewhere in the UI

  const composedGesture = Gesture.Race(
    panGesture,
    longPressGesture
  );

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  // INVERTED: Rewind shows when dragging RIGHT (positive translateX = backward)
  const rewindIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SCRUB_CONFIG.DEAD_ZONE],
      [0, directionIconOpacity.value],
      Extrapolation.CLAMP
    ),
    transform: [
      { translateX: interpolate(translateX.value, [0, 80], [0, 30], Extrapolation.CLAMP) },
    ],
  }));

  // INVERTED: FastForward shows when dragging LEFT (negative translateX = forward)
  const fastForwardIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SCRUB_CONFIG.DEAD_ZONE, 0],
      [directionIconOpacity.value, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      { translateX: interpolate(translateX.value, [-80, 0], [-30, 0], Extrapolation.CLAMP) },
    ],
  }));

  const _tooltipStyle = useAnimatedStyle(() => ({
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

  return (
    <View style={styles.container}>
      {/* Main button - solid red, scrub only */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: 'transparent' },
          buttonAnimatedStyle,
        ]}>
          {/* Invisible hitbox with direction icons */}
          {/* Rewind icon - shows when dragging RIGHT (backward) */}
          <Animated.View style={[styles.directionIcon, { left: -30 }, rewindIconStyle]}>
            <RewindIcon size={20} color={colors.text.primary} />
          </Animated.View>
          {/* Fast-forward icon - shows when dragging LEFT (forward) */}
          <Animated.View style={[styles.directionIcon, { right: -30 }, fastForwardIconStyle]}>
            <FastForwardIcon size={20} color={colors.text.primary} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  button: {
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    position: 'absolute',
    borderRadius: COVER_SIZE / 2,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.light,
  },
  border: {
    position: 'absolute',
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.accent.primary,
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
    width: 24,
    height: 24,
  },
  tooltip: {
    position: 'absolute',
    top: -35,
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tooltipText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: BUTTON_SIZE + 24,
    width: SCREEN_WIDTH - 32,
    backgroundColor: colors.overlay.dark,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chapterTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  speedBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: colors.accent.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  speedBadgeText: {
    color: colors.background.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.progress.track,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressTime: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  progressTimeOffset: {
    color: colors.accent.primary,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  overallTime: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginTop: 6,
  },
});

export default CoverPlayButton;
