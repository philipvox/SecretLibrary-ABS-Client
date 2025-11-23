/**
 * Progress bar - redesigned
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { theme } from '@/shared/theme';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function ProgressBar() {
  const { position, duration, seekTo } = usePlayerStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  const displayPosition = isDragging ? dragPosition : position;
  const progress = duration > 0 ? (displayPosition / duration) * 100 : 0;

  const handleSeek = async (newPosition: number) => {
    try {
      await seekTo(newPosition);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const getPositionFromEvent = (event: any, containerWidth: number): number => {
    const x = event.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / containerWidth));
    return ratio * duration;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      const containerWidth = 350;
      const newPosition = getPositionFromEvent(evt, containerWidth);
      setDragPosition(newPosition);
    },

    onPanResponderMove: (evt) => {
      const containerWidth = 350;
      const newPosition = getPositionFromEvent(evt, containerWidth);
      setDragPosition(newPosition);
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
      {/* Progress Bar */}
      <View style={styles.progressContainer} {...panResponder.panHandlers}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]}>
            <View style={styles.thumb} />
          </View>
        </View>
      </View>

      {/* Time Labels */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(displayPosition)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing[8],
    paddingVertical: theme.spacing[4],
  },
  progressContainer: {
    paddingVertical: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.neutral[300],
    borderRadius: theme.radius.small,
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.small,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    right: -8,
    top: -6,
    width: 16,
    height: 16,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500],
    borderWidth: 3,
    borderColor: theme.colors.background.primary,
    ...theme.elevation.small,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    fontWeight: '500',
  },
});