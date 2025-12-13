/**
 * src/features/player/components/ProgressBar.tsx
 * Scrubable progress bar for player
 * Supports both full book progress and chapter-based progress modes
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { usePlayerStore, useCurrentChapter } from '../stores/playerStore';
import { colors, spacing, layout } from '@/shared/theme';

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

interface ProgressBarProps {
  textColor?: string;
  trackColor?: string;
  fillColor?: string;
  mode?: 'bar' | 'chapters';  // 'bar' = full book, 'chapters' = current chapter
}

export function ProgressBar({
  textColor = colors.textTertiary,
  trackColor = colors.progressTrack,
  fillColor = colors.textPrimary,
  mode = 'bar',
}: ProgressBarProps) {
  const { position, duration, seekTo, progressMode, isSeeking, seekPosition } = usePlayerStore();
  const currentChapter = useCurrentChapter();

  // Use mode prop if provided, otherwise use store progressMode
  const effectiveMode = mode !== 'bar' ? mode : progressMode;
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [barWidth, setBarWidth] = useState(300);
  const barXRef = useRef(0);

  // Calculate display values based on mode
  const isChapterMode = effectiveMode === 'chapters' && currentChapter;
  const chapterStart = currentChapter?.start || 0;
  const chapterEnd = currentChapter?.end || duration;
  const chapterDuration = chapterEnd - chapterStart;

  // Use seekPosition when seeking (via rewind/ff buttons), dragPosition when dragging progress bar
  // This ensures chapter info updates correctly during continuous seeking
  const displayPosition = isDragging ? dragPosition : (isSeeking ? seekPosition : position);
  const effectiveDuration = isChapterMode ? chapterDuration : duration;
  const effectivePosition = isChapterMode ? Math.max(0, displayPosition - chapterStart) : displayPosition;
  const progress = effectiveDuration > 0 ? Math.min(1, Math.max(0, effectivePosition / effectiveDuration)) : 0;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
    barXRef.current = event.nativeEvent.layout.x;
  }, []);

  const calculatePosition = useCallback((x: number) => {
    const clampedX = Math.max(0, Math.min(x, barWidth));
    const percentage = clampedX / barWidth;
    // In chapter mode, calculate position within chapter bounds
    if (isChapterMode) {
      return chapterStart + (percentage * chapterDuration);
    }
    return percentage * duration;
  }, [barWidth, duration, isChapterMode, chapterStart, chapterDuration]);

  const handleDragStart = useCallback((x: number) => {
    setIsDragging(true);
    setDragPosition(calculatePosition(x));
  }, [calculatePosition]);

  const handleDragUpdate = useCallback((x: number) => {
    setDragPosition(calculatePosition(x));
  }, [calculatePosition]);

  const handleDragEnd = useCallback((x: number) => {
    const finalPosition = calculatePosition(x);
    setIsDragging(false);
    seekTo(finalPosition);
  }, [calculatePosition, seekTo]);

  const handleTap = useCallback((x: number) => {
    const newPosition = calculatePosition(x);
    seekTo(newPosition);
  }, [calculatePosition, seekTo]);

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      runOnJS(handleDragStart)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(handleDragUpdate)(e.x);
    })
    .onEnd((e) => {
      runOnJS(handleDragEnd)(e.x);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(handleTap)(e.x);
    });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View 
          style={styles.trackContainer}
          onLayout={handleLayout}
        >
          <View style={[styles.track, { backgroundColor: trackColor }]}>
            <View 
              style={[
                styles.fill, 
                { 
                  backgroundColor: fillColor,
                  width: `${progress * 100}%`,
                }
              ]} 
            />
            <View 
              style={[
                styles.thumb,
                {
                  backgroundColor: fillColor,
                  left: `${progress * 100}%`,
                  transform: [{ translateX: -6 }],
                }
              ]}
            />
          </View>
        </Animated.View>
      </GestureDetector>
      
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: textColor }]}>
          {formatTime(effectivePosition)}
        </Text>
        <Text style={[styles.timeText, { color: textColor }]}>
          {isChapterMode && currentChapter?.title ? currentChapter.title : formatTime(effectiveDuration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: layout.screenPaddingH,
  },
  trackContainer: {
    height: 30,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
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
});