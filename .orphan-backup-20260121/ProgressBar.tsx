/**
 * src/features/player/components/ProgressBar.tsx
 * Enhanced scrubable progress bar for player
 *
 * Features:
 * - Floating time tooltip during scrub
 * - Animated thumb (grows when scrubbing)
 * - Fine-scrub mode (drag UP to reduce sensitivity)
 * - Chapter markers and snap-to-chapter behavior
 * - Haptic feedback on scrub, chapter crossing, and snap
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
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
import { usePlayerStore, useCurrentChapter } from '../stores/playerStore';
import { haptics } from '@/core/native/haptics';
import { spacing, layout, radius, useTheme } from '@/shared/theme';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Thumb dimensions
  THUMB_SIZE_NORMAL: 12,
  THUMB_SIZE_ACTIVE: 20,

  // Fine-scrub sensitivity zones (based on vertical offset from bar)
  FINE_SCRUB_ZONES: [
    { offset: 0, sensitivity: 1.0, label: '' },       // Normal (on bar)
    { offset: 20, sensitivity: 0.5, label: '1/2x' },  // Half speed
    { offset: 40, sensitivity: 0.25, label: '1/4x' }, // Quarter speed
    { offset: 80, sensitivity: 0.125, label: '1/8x' }, // Very fine
  ],

  // Chapter snap threshold (seconds)
  CHAPTER_SNAP_THRESHOLD: 5,

  // Spring animation config
  SPRING_CONFIG: {
    damping: 20,
    stiffness: 300,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function calculateSensitivity(verticalOffset: number): { sensitivity: number; label: string } {
  const zones = CONFIG.FINE_SCRUB_ZONES;
  for (let i = zones.length - 1; i >= 0; i--) {
    if (verticalOffset >= zones[i].offset) {
      return { sensitivity: zones[i].sensitivity, label: zones[i].label };
    }
  }
  return { sensitivity: 1.0, label: '' };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface ProgressBarProps {
  textColor?: string;
  trackColor?: string;
  fillColor?: string;
  mode?: 'bar' | 'chapters';  // 'bar' = full book, 'chapters' = current chapter
  showChapterMarkers?: boolean;
}

export function ProgressBar({
  textColor,
  trackColor,
  fillColor,
  mode = 'bar',
  showChapterMarkers = true,
}: ProgressBarProps) {
  const { colors } = useTheme();

  // Use provided colors or theme defaults
  const effectiveTextColor = textColor ?? colors.text.tertiary;
  const effectiveTrackColor = trackColor ?? colors.border.default;
  const effectiveFillColor = fillColor ?? colors.text.primary;
  const { position, duration, seekTo, progressMode, isSeeking, seekPosition, chapters } = usePlayerStore();
  const currentChapter = useCurrentChapter();

  // Use mode prop if provided, otherwise use store progressMode
  const effectiveMode = mode !== 'bar' ? mode : progressMode;

  // State
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [barWidth, setBarWidth] = useState(300);

  // Refs for tracking during drag
  const barXRef = useRef(0);
  const startYRef = useRef(0);
  const lastRawPositionRef = useRef(0);
  const lastDragPositionRef = useRef(0);
  const dragStartPositionRef = useRef(0);

  // Animated values
  const thumbScale = useSharedValue(1);
  const tooltipOpacity = useSharedValue(0);

  // Calculate display values based on mode
  const isChapterMode = effectiveMode === 'chapters' && currentChapter;
  const chapterStart = currentChapter?.start || 0;
  const chapterEnd = currentChapter?.end || duration;
  const chapterDuration = chapterEnd - chapterStart;

  // Use seekPosition when seeking (via rewind/ff buttons), dragPosition when dragging progress bar
  const displayPosition = isDragging ? dragPosition : (isSeeking ? seekPosition : position);
  const effectiveDuration = isChapterMode ? chapterDuration : duration;
  const effectivePosition = isChapterMode ? Math.max(0, displayPosition - chapterStart) : displayPosition;
  const progress = effectiveDuration > 0 ? Math.min(1, Math.max(0, effectivePosition / effectiveDuration)) : 0;

  // Get current sensitivity info
  const sensitivityInfo = calculateSensitivity(verticalOffset);

  // Calculate raw position from touch X coordinate
  const calculateRawPosition = useCallback((x: number) => {
    const clampedX = Math.max(0, Math.min(x, barWidth));
    const percentage = clampedX / barWidth;
    if (isChapterMode) {
      return chapterStart + (percentage * chapterDuration);
    }
    return percentage * duration;
  }, [barWidth, duration, isChapterMode, chapterStart, chapterDuration]);

  // Detect chapter crossing for haptic feedback
  const detectChapterCrossing = useCallback((from: number, to: number) => {
    if (!chapters || chapters.length === 0) return null;
    for (const chapter of chapters) {
      if ((from < chapter.start && to >= chapter.start) ||
          (from >= chapter.start && to < chapter.start)) {
        return chapter;
      }
    }
    return null;
  }, [chapters]);

  // Apply chapter snap
  const applyChapterSnap = useCallback((pos: number): number => {
    if (!chapters || chapters.length === 0) return pos;
    for (const chapter of chapters) {
      if (Math.abs(pos - chapter.start) < CONFIG.CHAPTER_SNAP_THRESHOLD) {
        haptics.impact('medium');
        return chapter.start;
      }
    }
    return pos;
  }, [chapters]);

  // Handle drag start
  const handleDragStart = useCallback((x: number, absoluteY: number) => {
    const rawPosition = calculateRawPosition(x);
    setIsDragging(true);
    setDragPosition(rawPosition);
    setVerticalOffset(0);
    startYRef.current = absoluteY;
    lastRawPositionRef.current = rawPosition;
    lastDragPositionRef.current = rawPosition;
    dragStartPositionRef.current = rawPosition;
    haptics.impact('light');
  }, [calculateRawPosition]);

  // Handle drag update with fine-scrub
  const handleDragUpdate = useCallback((x: number, absoluteY: number) => {
    // Calculate vertical offset (dragging UP increases offset)
    const offset = Math.max(0, startYRef.current - absoluteY);
    setVerticalOffset(offset);

    // Get sensitivity for this offset
    const { sensitivity } = calculateSensitivity(offset);

    // Calculate raw position change
    const rawPosition = calculateRawPosition(x);
    const rawDelta = rawPosition - lastRawPositionRef.current;
    lastRawPositionRef.current = rawPosition;

    // Apply sensitivity to get adjusted delta
    const adjustedDelta = rawDelta * sensitivity;
    const newPosition = clamp(
      lastDragPositionRef.current + adjustedDelta,
      0,
      duration
    );

    // Check for chapter crossing
    const crossedChapter = detectChapterCrossing(lastDragPositionRef.current, newPosition);
    if (crossedChapter) {
      haptics.impact('light');
    }

    lastDragPositionRef.current = newPosition;
    setDragPosition(newPosition);
  }, [calculateRawPosition, detectChapterCrossing, duration]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    // Apply chapter snap
    const snappedPosition = applyChapterSnap(dragPosition);
    setIsDragging(false);
    setVerticalOffset(0);
    seekTo(snappedPosition);
    haptics.buttonPress();
  }, [dragPosition, applyChapterSnap, seekTo]);

  // Handle tap
  const handleTap = useCallback((x: number) => {
    const rawPosition = calculateRawPosition(x);
    const snappedPosition = applyChapterSnap(rawPosition);
    seekTo(snappedPosition);
    haptics.impact('light');
  }, [calculateRawPosition, applyChapterSnap, seekTo]);

  // Layout handler
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
    barXRef.current = event.nativeEvent.layout.x;
  }, []);

  // ============================================================================
  // GESTURES
  // ============================================================================

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      'worklet';
      thumbScale.value = withSpring(1.5, CONFIG.SPRING_CONFIG);
      tooltipOpacity.value = withTiming(1, { duration: 100 });
      runOnJS(handleDragStart)(e.x, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(handleDragUpdate)(e.x, e.absoluteY);
    })
    .onEnd(() => {
      'worklet';
      thumbScale.value = withSpring(1, CONFIG.SPRING_CONFIG);
      tooltipOpacity.value = withTiming(0, { duration: 150 });
      runOnJS(handleDragEnd)();
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      runOnJS(handleTap)(e.x);
    });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -CONFIG.THUMB_SIZE_NORMAL / 2 },
      { scale: thumbScale.value },
    ],
  }));

  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [
      { translateY: interpolate(tooltipOpacity.value, [0, 1], [5, 0], Extrapolation.CLAMP) },
    ],
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      {/* Fine-scrub mode indicator */}
      {isDragging && verticalOffset > 20 && (
        <View style={styles.fineModeContainer}>
          <Text style={[styles.fineModeText, { color: colors.accent.primary }]}>Fine {sensitivityInfo.label}</Text>
        </View>
      )}

      {/* Floating tooltip */}
      {isDragging && (
        <Animated.View
          style={[
            styles.tooltip,
            tooltipAnimatedStyle,
            { left: `${progress * 100}%`, backgroundColor: colors.background.elevated },
          ]}
        >
          <Text style={[styles.tooltipText, { color: colors.text.primary }]}>{formatTime(dragPosition)}</Text>
        </Animated.View>
      )}

      <GestureDetector gesture={composed}>
        <Animated.View
          style={styles.trackContainer}
          onLayout={handleLayout}
        >
          <View style={[styles.track, { backgroundColor: effectiveTrackColor }]}>
            {/* Chapter markers */}
            {showChapterMarkers && chapters && chapters.length > 1 && !isChapterMode && (
              chapters.map((chapter, index) => {
                if (index === 0) return null; // Skip first chapter marker
                const markerPos = (chapter.start / duration) * 100;
                return (
                  <View
                    key={chapter.id}
                    style={[
                      styles.chapterMarker,
                      { left: `${markerPos}%`, backgroundColor: `${colors.text.primary}66` },
                    ]}
                  />
                );
              })
            )}

            {/* Progress fill */}
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: effectiveFillColor,
                  width: `${progress * 100}%`,
                },
              ]}
            />

            {/* Animated thumb */}
            <Animated.View
              style={[
                styles.thumb,
                thumbAnimatedStyle,
                {
                  backgroundColor: effectiveFillColor,
                  left: `${progress * 100}%`,
                },
              ]}
            />
          </View>
        </Animated.View>
      </GestureDetector>

      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: effectiveTextColor }]}>
          {formatTime(effectivePosition)}
        </Text>
        <Text style={[styles.timeText, { color: effectiveTextColor }]}>
          {isChapterMode && currentChapter?.title ? currentChapter.title : formatTime(effectiveDuration)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: layout.screenPaddingH,
    position: 'relative',
  },
  trackContainer: {
    height: 30,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: CONFIG.THUMB_SIZE_NORMAL,
    height: CONFIG.THUMB_SIZE_NORMAL,
    borderRadius: CONFIG.THUMB_SIZE_NORMAL / 2,
  },
  chapterMarker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 8,
    borderRadius: 1,
    transform: [{ translateX: -1 }],
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  tooltip: {
    position: 'absolute',
    top: -8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    transform: [{ translateX: -30 }],
    zIndex: 10,
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  fineModeContainer: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  fineModeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});