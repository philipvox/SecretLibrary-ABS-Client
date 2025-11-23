/**
 * src/features/player/components/ProgressBar.tsx
 *
 * Seekable progress bar with draggable thumb.
 * Shows current time and total duration.
 * Allows user to seek to any position by dragging or tapping.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';

/**
 * Format seconds to HH:MM:SS or MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Progress bar component
 */
export function ProgressBar() {
  const { position, duration, seekTo } = usePlayerStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  // Use drag position while dragging, otherwise use actual position
  const displayPosition = isDragging ? dragPosition : position;
  const progress = duration > 0 ? (displayPosition / duration) * 100 : 0;

  /**
   * Handle seeking to position
   */
  const handleSeek = async (newPosition: number) => {
    try {
      await seekTo(newPosition);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  /**
   * Calculate position from touch event
   */
  const getPositionFromEvent = (event: any, containerWidth: number): number => {
    const x = event.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / containerWidth));
    return ratio * duration;
  };

  /**
   * Pan responder for dragging
   */
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      const containerWidth = 350; // Approximate width
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
      {/* Time Labels */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(displayPosition)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer} {...panResponder.panHandlers}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]}>
            {/* Thumb */}
            <View style={styles.thumb} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#666666',
  },
  progressContainer: {
    paddingVertical: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'visible', // Allow thumb to extend beyond track
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    right: -8,
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 3,
  },
});
