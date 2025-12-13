/**
 * src/shared/components/SeriesProgressBadge.tsx
 *
 * Series progress badge component showing completion status.
 *
 * Shows:
 * - "2/3 ●●○" for in-progress series (dots for ≤5 books)
 * - "4/42" for in-progress series (count for >5 books)
 * - "12h 30m left" as subtitle for active series
 * - Green checkmark for completed series
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressDots } from './ProgressDots';
import { colors, scale, spacing } from '@/shared/theme';

const ACCENT = colors.accent;
const SUCCESS = '#4ADE80';

interface SeriesProgressBadgeProps {
  /** Number of completed books */
  completed: number;
  /** Number of in-progress books */
  inProgress: number;
  /** Total number of books in series */
  total: number;
  /** Time remaining in seconds (optional) */
  timeRemaining?: number;
  /** Compact mode - single line */
  compact?: boolean;
}

/**
 * Format time remaining as "Xh Ym left"
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m left`;
  } else if (hours > 0) {
    return `${hours}h left`;
  } else {
    return `${minutes}m left`;
  }
}

export function SeriesProgressBadge({
  completed,
  inProgress,
  total,
  timeRemaining,
  compact = false,
}: SeriesProgressBadgeProps) {
  const isComplete = completed === total && total > 0;
  const hasProgress = completed > 0 || inProgress > 0;

  // Completed series - show checkmark
  if (isComplete) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.completeBadge}>
          <Ionicons name="checkmark" size={scale(12)} color="#000" />
        </View>
        <Text style={styles.completeText}>Complete</Text>
      </View>
    );
  }

  // Series with progress
  if (hasProgress) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ProgressDots
          completed={completed}
          inProgress={inProgress}
          total={total}
          showCount={true}
        />
        {!compact && timeRemaining && timeRemaining > 0 && (
          <Text style={styles.timeText}>{formatTimeRemaining(timeRemaining)}</Text>
        )}
      </View>
    );
  }

  // No progress - show book count
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={styles.countOnlyText}>
        {total} {total === 1 ? 'book' : 'books'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: spacing.xxs,
  },
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  completeBadge: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: SUCCESS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: SUCCESS,
  },
  timeText: {
    fontSize: scale(11),
    color: colors.textTertiary,
  },
  countOnlyText: {
    fontSize: scale(12),
    color: colors.textSecondary,
  },
});

export default SeriesProgressBadge;
