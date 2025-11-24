// File: src/features/player/components/ProgressBar.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { theme } from '@/shared/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = SCREEN_WIDTH - (theme.spacing[8] * 2);

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
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
}

export function ProgressBar({ 
  textColor = theme.colors.text.tertiary,
  trackColor = theme.colors.neutral[300],
  fillColor = theme.colors.text.primary,
}: ProgressBarProps) {
  const { position, duration, seekTo } = usePlayerStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  const displayPosition = isDragging ? dragPosition : position;
  const progress = duration > 0 ? displayPosition / duration : 0;

  const handleSeek = async (newPosition: number) => {
    try {
      await seekTo(newPosition);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / BAR_WIDTH));
      setDragPosition(ratio * duration);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / BAR_WIDTH));
      setDragPosition(ratio * duration);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      handleSeek(dragPosition);
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, { color: textColor }]}>{formatTime(displayPosition)}</Text>
        <Text style={[styles.timeText, { color: textColor }]}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.progressContainer} {...panResponder.panHandlers}>
        <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: fillColor }]} />
          <View style={[styles.thumb, { left: `${progress * 100}%`, borderColor: fillColor }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing[8],
    paddingVertical: theme.spacing[2],
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[2],
  },
  timeText: {
    ...theme.textStyles.caption,
  },
  progressContainer: {
    paddingVertical: theme.spacing[3],
  },
  progressTrack: {
    height: 4,
    borderRadius: theme.radius.small,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.small,
  },
  thumb: {
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.neutral[200],
    borderWidth: 4,
  },
});