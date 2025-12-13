/**
 * src/features/home/components/YourSeriesSection.tsx
 *
 * Your Series section with card container and list rows
 * Shows series the user is currently reading (has progress on at least one book)
 *
 * Uses same card container styling as RecentlyAddedSection:
 * - Container: 93.5%w (3.25%w margin each side)
 * - Border radius: 2.5%w
 * - Background: subtle glass effect (rgba(255,255,255,0.05))
 * - Border: 1px rgba(102,102,102,0.5)
 * - Internal padding: 4%w
 * - Cover: 17%w square with small radius
 * - Header: white, moderateScale(16), semi-bold
 * - 44pt minimum touch targets
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '@/core/api';
import { colors, wp, hp, moderateScale, layout, cardTokens } from '@/shared/theme';
import { StackedCovers, ProgressDots } from '@/shared/components';
import { SeriesWithBooks } from '../types';

// Layout constants (same as RecentlyAddedSection)
const MARGIN_H = wp(3.25);       // 3.25%w horizontal margin
const PADDING = wp(4);           // 4%w internal padding
const RADIUS = wp(2.5);          // 2.5%w border radius
const GAP = wp(3);               // 3%w gap between cover and text
const TOUCH_TARGET = Math.max(wp(8), layout.minTouchTarget);
const ROW_GAP = wp(3);           // 3%w vertical gap between rows

interface YourSeriesSectionProps {
  /** List of series with books */
  series: SeriesWithBooks[];
  /** Callback when a series row is pressed (view details) */
  onSeriesPress: (series: SeriesWithBooks) => void;
  /** Maximum number of items to show */
  maxItems?: number;
}

/**
 * Get cover URLs for a series (up to 3 books)
 */
function getSeriesCoverUrls(series: SeriesWithBooks): string[] {
  return series.books.slice(0, 3).map(book => apiClient.getItemCoverUrl(book.id));
}

/**
 * Get author name from series (from first book)
 */
function getSeriesAuthor(series: SeriesWithBooks): string {
  if (series.books.length === 0) return '';
  const metadata = series.books[0].media?.metadata as any;
  if (!metadata) return '';
  if (metadata.authorName) return metadata.authorName;
  if (metadata.authors?.length > 0) {
    return metadata.authors.map((a: any) => a.name).join(', ');
  }
  return '';
}

/**
 * Calculate time remaining in series (in seconds)
 */
function getTimeRemaining(series: SeriesWithBooks): number {
  return series.books.reduce((total, book) => {
    const progress = (book as any).userMediaProgress?.progress || 0;
    const duration = (book.media as any)?.duration || 0;
    if (progress > 0 && progress < 0.95) {
      return total + duration * (1 - progress);
    } else if (progress === 0) {
      return total + duration;
    }
    return total;
  }, 0);
}

/**
 * Format time remaining as "~Xh Ym left"
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `~${hours}h ${minutes}m left`;
  } else if (hours > 0) {
    return `~${hours}h left`;
  }
  return `~${minutes}m left`;
}

/**
 * Single series row in the list
 */
// Stacked cover size for rows
const STACKED_SIZE = cardTokens.stackedCovers.sizeSmall;
const STACKED_OFFSET = 8;

const SeriesRow = ({
  series,
  onPress,
  isFirst,
}: {
  series: SeriesWithBooks;
  onPress: () => void;
  isFirst: boolean;
}) => {
  const coverUrls = getSeriesCoverUrls(series);
  const author = getSeriesAuthor(series);
  const timeRemaining = getTimeRemaining(series);
  const timeText = formatTimeRemaining(timeRemaining);
  const hasProgress = series.booksCompleted > 0 || series.booksInProgress > 0;
  const isComplete = series.booksCompleted === series.totalBooks && series.totalBooks > 0;

  return (
    <TouchableOpacity
      style={[styles.row, !isFirst && styles.rowWithGap]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Stacked covers */}
      <View style={styles.coverContainer}>
        <StackedCovers
          coverUrls={coverUrls}
          size={STACKED_SIZE}
          offset={STACKED_OFFSET}
          maxCovers={3}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {series.name}
          </Text>
          {isComplete && (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark" size={12} color="#000" />
            </View>
          )}
        </View>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        {/* Progress indicator - Research: Zeigarnik Effect & Goal Gradient */}
        {hasProgress ? (
          <View style={styles.progressRow}>
            <ProgressDots
              completed={series.booksCompleted}
              inProgress={series.booksInProgress}
              total={series.totalBooks}
              showCount={true}
            />
            {timeText && <Text style={styles.timeRemaining}>{timeText}</Text>}
          </View>
        ) : (
          <Text style={styles.bookCount}>
            {series.totalBooks} {series.totalBooks === 1 ? 'book' : 'books'}
          </Text>
        )}
      </View>

      {/* Chevron for navigation - Research: Series are containers, not playable */}
      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={wp(5)} color="rgba(255,255,255,0.5)" />
      </View>
    </TouchableOpacity>
  );
};

export function YourSeriesSection({
  series,
  onSeriesPress,
  maxItems = 5,
}: YourSeriesSectionProps) {
  if (series.length === 0) return null;

  const displaySeries = series.slice(0, maxItems);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <Text style={styles.header}>Your Series</Text>

        {/* Series rows - NO Play button per NNGroup research */}
        {displaySeries.map((item, index) => (
          <SeriesRow
            key={item.id}
            series={item}
            onPress={() => onSeriesPress(item)}
            isFirst={index === 0}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: MARGIN_H,
    marginTop: hp(3),  // 3%h gap from Recently Added
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(102,102,102,0.5)',
    borderRadius: RADIUS,
    padding: PADDING,
  },
  header: {
    color: colors.textPrimary,
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: GAP,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowWithGap: {
    marginTop: ROW_GAP,
  },
  coverContainer: {
    width: STACKED_SIZE + (STACKED_OFFSET * 2), // Account for stacked offset
    height: STACKED_SIZE * 1.5, // 2:3 aspect ratio
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: GAP,
    marginRight: wp(2),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  completeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4ADE80', // Success green
    justifyContent: 'center',
    alignItems: 'center',
  },
  author: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    marginTop: hp(0.2),
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: hp(0.3),
  },
  timeRemaining: {
    color: colors.textTertiary,
    fontSize: moderateScale(11),
  },
  bookCount: {
    color: colors.textTertiary,
    fontSize: moderateScale(12),
    marginTop: hp(0.1),
  },
  chevron: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default YourSeriesSection;
