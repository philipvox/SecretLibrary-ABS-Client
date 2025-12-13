/**
 * src/features/series/components/SeriesCard.tsx
 *
 * Enhanced series card based on UX research.
 * Features:
 * - Progress dots showing completion status
 * - Books completed count
 * - Time remaining estimate
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SeriesInfo } from '../services/seriesAdapter';
import { apiClient } from '@/core/api';
import { colors, scale, spacing, radius, elevation, cardTokens } from '@/shared/theme';
import { StackedCovers } from '@/shared/components';
import { formatDuration } from '@/shared/utils/metadata';

const ACCENT = colors.accent;
const ACCENT_DIM = 'rgba(243,182,12,0.5)';

interface SeriesCardProps {
  series: SeriesInfo;
  showProgress?: boolean;
}

// Progress dot component
function ProgressDot({
  status,
  size = 6,
}: {
  status: 'completed' | 'in_progress' | 'not_started';
  size?: number;
}) {
  const getColor = () => {
    switch (status) {
      case 'completed':
        return ACCENT;
      case 'in_progress':
        return ACCENT_DIM;
      default:
        return 'rgba(255,255,255,0.3)';
    }
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getColor(),
      }}
    />
  );
}

function SeriesCardComponent({ series, showProgress = true }: SeriesCardProps) {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate('SeriesDetail', { seriesName: series.name });
  };

  // Get cover URLs from books for stacked display
  const coverUrls = useMemo(() => {
    if (series.books && series.books.length > 0) {
      return series.books.slice(0, 3).map(book => apiClient.getItemCoverUrl(book.id));
    }
    // Fallback to series cover
    return series.coverUrl ? [apiClient.getItemCoverUrl(series.coverUrl)] : [];
  }, [series.books, series.coverUrl]);

  // Calculate progress stats from books
  const progressStats = useMemo(() => {
    if (!series.books || series.books.length === 0) {
      return { completed: 0, inProgress: 0, notStarted: series.bookCount, remainingDuration: 0 };
    }

    let completed = 0;
    let inProgress = 0;
    let totalListened = 0;
    let totalDuration = 0;

    series.books.forEach(book => {
      const progress = (book as any).userMediaProgress?.progress || 0;
      const duration = (book.media as any)?.duration || 0;
      totalDuration += duration;
      totalListened += duration * progress;

      if (progress >= 0.95) {
        completed++;
      } else if (progress > 0) {
        inProgress++;
      }
    });

    const notStarted = series.bookCount - completed - inProgress;
    const remainingDuration = totalDuration - totalListened;

    return { completed, inProgress, notStarted, remainingDuration };
  }, [series.books, series.bookCount]);

  const hasProgress = progressStats.completed > 0 || progressStats.inProgress > 0;
  const isComplete = progressStats.completed === series.bookCount;

  // Limit dots shown (max 10, then show indicator)
  const maxDots = 10;
  const showAllDots = series.bookCount <= maxDots;
  const dotsToShow = showAllDots ? series.bookCount : maxDots - 1;

  const durationText = series.totalDuration > 0
    ? formatDuration(series.totalDuration)
    : null;

  const remainingText = progressStats.remainingDuration
    ? formatDuration(progressStats.remainingDuration)
    : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.coverContainer}>
        <StackedCovers
          coverUrls={coverUrls}
          size={cardTokens.stackedCovers.sizeLarge}
          offset={cardTokens.stackedCovers.offset}
          maxCovers={3}
          borderRadius={radius.md}
        />

        {/* Complete badge */}
        {isComplete && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark" size={scale(12)} color="#000" />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {series.name}
        </Text>

        {/* Progress dots - only show if there's progress */}
        {showProgress && hasProgress && (
          <View style={styles.progressRow}>
            <View style={styles.progressDots}>
              {Array.from({ length: dotsToShow }).map((_, i) => {
                let status: 'completed' | 'in_progress' | 'not_started';
                if (i < progressStats.completed) {
                  status = 'completed';
                } else if (i < progressStats.completed + progressStats.inProgress) {
                  status = 'in_progress';
                } else {
                  status = 'not_started';
                }
                return <ProgressDot key={i} status={status} />;
              })}
              {!showAllDots && (
                <Text style={styles.moreText}>+{series.bookCount - maxDots + 1}</Text>
              )}
            </View>
            <Text style={styles.progressCount}>
              {progressStats.completed}/{series.bookCount}
            </Text>
          </View>
        )}

        {/* Book count and duration */}
        <Text style={styles.bookCount} numberOfLines={1}>
          {hasProgress && remainingText ? (
            `~${remainingText} left`
          ) : (
            <>
              {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
              {durationText && ` • ${durationText}`}
            </>
          )}
        </Text>
      </View>
    </Pressable>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const SeriesCard = memo(SeriesCardComponent);

// Stacked cover dimensions
const COVER_SIZE = cardTokens.stackedCovers.sizeLarge;
const COVER_OFFSET = cardTokens.stackedCovers.offset;
const STACK_WIDTH = COVER_SIZE + (COVER_OFFSET * 2);
const STACK_HEIGHT = COVER_SIZE * 1.5; // 2:3 aspect ratio

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  coverContainer: {
    width: '100%',
    aspectRatio: STACK_WIDTH / STACK_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBadge: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  info: {
    marginTop: spacing.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  moreText: {
    fontSize: scale(10),
    color: colors.textTertiary,
    marginLeft: scale(2),
  },
  progressCount: {
    fontSize: scale(11),
    fontWeight: '600',
    color: ACCENT,
  },
  bookCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
