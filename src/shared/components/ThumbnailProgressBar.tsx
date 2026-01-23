/**
 * src/shared/components/ThumbnailProgressBar.tsx
 *
 * A thin progress bar overlay for book cover thumbnails.
 * Shows listening progress visually at the bottom of covers.
 *
 * Design specs:
 * - Height: 3px
 * - Position: Bottom of cover, flush with edges
 * - Color: Gold/accent for filled portion
 * - Background: Dark semi-transparent for track
 * - Only shown when 0 < progress < 1
 */

import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { scale, colors } from '@/shared/theme';

interface ThumbnailProgressBarProps {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Optional custom height (default: 3) */
  height?: number;
}

/**
 * Progress bar overlay for book thumbnails.
 * Returns null if progress is 0, >= 0.95 (completed), or invalid.
 */
export const ThumbnailProgressBar = memo(function ThumbnailProgressBar({
  progress,
  height = 3,
}: ThumbnailProgressBarProps) {
  // Don't show if no progress, completed, or invalid
  // Return empty View on Android to prevent SafeAreaProvider crash
  if (!progress || progress <= 0 || progress >= 0.95) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  const fillPercent = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <View style={[styles.container, { height: scale(height) }]}>
      <View style={[styles.fill, { width: `${fillPercent}%` }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
  },
});

export default ThumbnailProgressBar;
