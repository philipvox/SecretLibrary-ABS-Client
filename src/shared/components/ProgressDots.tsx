/**
 * src/shared/components/ProgressDots.tsx
 *
 * Progress dots indicator for series/collections.
 * Shows visual dots for ≤5 items, or count for >5 items.
 *
 * Examples:
 * - "2/3 ●●○" for in-progress series (dots for ≤5 books)
 * - "4/42" for in-progress series (count for >5 books)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, scale, spacing } from '@/shared/theme';

const ACCENT = colors.accent;
const ACCENT_DIM = 'rgba(243, 182, 12, 0.5)';
const DOT_INACTIVE = 'rgba(255, 255, 255, 0.25)';

type DotStatus = 'completed' | 'in_progress' | 'not_started';

interface ProgressDotsProps {
  /** Number of completed items */
  completed: number;
  /** Number of in-progress items */
  inProgress: number;
  /** Total number of items */
  total: number;
  /** Maximum number of dots to show (default 5) */
  maxDots?: number;
  /** Size of each dot (default 6) */
  dotSize?: number;
  /** Whether to show the count alongside dots */
  showCount?: boolean;
}

/**
 * Single progress dot
 */
function Dot({ status, size }: { status: DotStatus; size: number }) {
  const getColor = () => {
    switch (status) {
      case 'completed':
        return ACCENT;
      case 'in_progress':
        return ACCENT_DIM;
      default:
        return DOT_INACTIVE;
    }
  };

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getColor(),
        },
      ]}
    />
  );
}

/**
 * Progress dots component
 */
export function ProgressDots({
  completed,
  inProgress,
  total,
  maxDots = 5,
  dotSize = 6,
  showCount = true,
}: ProgressDotsProps) {
  // For large series (>maxDots), just show count
  if (total > maxDots) {
    return (
      <View style={styles.container}>
        <Text style={styles.countText}>
          {completed}/{total}
        </Text>
      </View>
    );
  }

  // Build dot statuses
  const dotStatuses: DotStatus[] = [];
  for (let i = 0; i < total; i++) {
    if (i < completed) {
      dotStatuses.push('completed');
    } else if (i < completed + inProgress) {
      dotStatuses.push('in_progress');
    } else {
      dotStatuses.push('not_started');
    }
  }

  return (
    <View style={styles.container}>
      {showCount && (
        <Text style={styles.countText}>
          {completed}/{total}
        </Text>
      )}
      <View style={styles.dotsContainer}>
        {dotStatuses.map((status, index) => (
          <Dot key={index} status={status} size={dotSize} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    // Size set dynamically
  },
  countText: {
    fontSize: scale(11),
    fontWeight: '600',
    color: ACCENT,
  },
});

export default ProgressDots;
