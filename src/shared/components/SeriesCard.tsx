/**
 * src/shared/components/SeriesCard.tsx
 *
 * Unified series card with fanned cover design.
 * Used in Home and Library screens for series display.
 * Supports optional progress indicators.
 */

import React, { useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import {
  scale,
  spacing,
  radius,
  typography,
  cardTokens,
  interactiveStates,
  layout,
} from '@/shared/theme';
import { useTheme, useIsDarkMode } from '@/shared/theme';
import { SeriesHeartButton, SeriesProgressBadge } from '@/shared/components';

// Use cardTokens for consistent values
const COVER_SIZE = cardTokens.stackedCovers.size;
const FAN_OFFSET = cardTokens.stackedCovers.offset;
const FAN_ROTATION = cardTokens.stackedCovers.rotation;
const FAN_VERTICAL_OFFSET = 6;
const MAX_VISIBLE_BOOKS = cardTokens.stackedCovers.maxCount;

// Gap between cards
const GAP = spacing.md;

/** Book status for progress tracking - matches home/types.ts */
export type BookStatus = 'done' | 'current' | 'not-started';

/** Enhanced series data with progress information - compatible with home/types.ts */
export interface EnhancedSeriesData {
  bookStatuses: BookStatus[];
  seriesTimeRemainingSeconds?: number;
  // Optional fields from home/types.ts EnhancedSeriesData
  seriesProgressPercent?: number;
  currentBookTitle?: string;
  currentBookIndex?: number;
}

/** Book type for series - minimal interface for any book-like object */
export interface SeriesBook {
  id: string;
}

/** Series data structure */
export interface SeriesData {
  name: string;
  books: SeriesBook[];
  bookCount?: number;
}

export interface SeriesCardProps {
  /** Series data */
  series: SeriesData;
  /** Called when card is pressed */
  onPress?: () => void;
  /** Called when card is long pressed */
  onLongPress?: () => void;
  /** When true, shows progress dots and time remaining below series name */
  showProgress?: boolean;
  /** Enhanced series data with progress info (required when showProgress=true) */
  enhancedData?: EnhancedSeriesData;
  /** Show heart button for favorites */
  showHeart?: boolean;
}

function SeriesCardComponent({
  series,
  onPress,
  onLongPress,
  showProgress = false,
  enhancedData,
  showHeart = true,
}: SeriesCardProps) {
  const { colors } = useTheme();
  const isDarkMode = useIsDarkMode();
  const { width: screenWidth } = useWindowDimensions();

  // Calculate card width dynamically for 2-column grid
  // Uses layout.screenPaddingH to match HomeScreen padding
  const cardWidth = (screenWidth - layout.screenPaddingH * 2 - GAP) / 2;

  // Calculate progress counts from enhancedData when showProgress is true
  const progressCounts = useMemo(() => {
    if (!showProgress || !enhancedData) return null;

    const completed = enhancedData.bookStatuses.filter((s) => s === 'done').length;
    const inProgress = enhancedData.bookStatuses.filter((s) => s === 'current').length;
    const total = enhancedData.bookStatuses.length;

    return { completed, inProgress, total };
  }, [showProgress, enhancedData]);

  // Get cover URLs for up to 5 books
  const bookCovers = useMemo(() => {
    const books = series.books || [];
    return books.slice(0, MAX_VISIBLE_BOOKS).map((book) => apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 }));
  }, [series.books]);

  const numCovers = bookCovers.length;
  const bookCount = series.bookCount ?? series.books?.length ?? 0;

  // Theme-aware card background
  const cardBgColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBgColor, width: cardWidth }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={interactiveStates.press.opacity}
    >
      {/* Heart button - top right */}
      {showHeart && (
        <SeriesHeartButton
          seriesName={series.name}
          size={10}
          showCircle
          style={styles.heartButton}
        />
      )}

      {/* Fanned covers */}
      <View style={styles.coverFan}>
        {numCovers > 0 ? (
          <View
            style={[
              styles.fanContainer,
              { width: COVER_SIZE + (numCovers - 1) * FAN_OFFSET },
            ]}
          >
            {bookCovers.map((coverUrl, idx) => {
              const middleIndex = (numCovers - 1) / 2;
              const rotation = (idx - middleIndex) * FAN_ROTATION;
              const distanceFromCenter = Math.abs(idx - middleIndex);
              const zIndex = numCovers - Math.floor(distanceFromCenter);
              const scaleValue = 1 - distanceFromCenter * 0.12;
              const coverSize = COVER_SIZE * scaleValue;
              const sizeOffset = (COVER_SIZE - coverSize) / 2;
              const verticalOffset = sizeOffset + distanceFromCenter * FAN_VERTICAL_OFFSET;
              const horizontalOffset = idx * FAN_OFFSET + sizeOffset;

              return (
                <Image
                  key={idx}
                  source={coverUrl}
                  style={[
                    styles.fanCover,
                    {
                      width: coverSize,
                      height: coverSize,
                      left: horizontalOffset,
                      top: verticalOffset,
                      zIndex,
                      transform: [{ rotate: `${rotation}deg` }],
                      backgroundColor: colors.background.tertiary,
                    },
                  ]}
                  contentFit="cover"
                  transition={150}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Series name */}
      <Text style={[styles.seriesName, { color: colors.text.primary }]} numberOfLines={2}>
        {series.name}
      </Text>

      {/* Progress badge (when showProgress=true) or simple book count */}
      {showProgress && progressCounts ? (
        <View style={styles.progressContainer}>
          <SeriesProgressBadge
            completed={progressCounts.completed}
            inProgress={progressCounts.inProgress}
            total={progressCounts.total}
            timeRemaining={enhancedData?.seriesTimeRemainingSeconds}
            compact={true}
          />
        </View>
      ) : (
        <Text style={[styles.bookCount, { color: colors.text.secondary }]}>
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const SeriesCard = memo(SeriesCardComponent);

const styles = StyleSheet.create({
  card: {
    // width set dynamically via cardWidth prop
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  heartButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
  },
  coverFan: {
    height: COVER_SIZE + FAN_VERTICAL_OFFSET * 2,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanContainer: {
    position: 'relative',
    height: COVER_SIZE + FAN_VERTICAL_OFFSET * 2,
  },
  fanCover: {
    position: 'absolute',
    borderRadius: radius.sm,
    // backgroundColor set dynamically via inline styles using colors.background.tertiary
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  seriesName: {
    ...typography.headlineSmall,
    textAlign: 'center',
  },
  bookCount: {
    ...typography.labelSmall,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
});

export default SeriesCard;
