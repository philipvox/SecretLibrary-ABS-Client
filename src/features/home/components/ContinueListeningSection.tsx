/**
 * src/features/home/components/ContinueListeningSection.tsx
 *
 * Continue Listening section with card container styling
 * Matches the same styling as YourSeriesSection and RecentlyAddedSection
 *
 * Features:
 * - Cover tap: loads book to player (paused)
 * - Cover long press: opens book details
 * - Title tap: opens book details
 * - Shows "time since last played" (e.g., "2h ago", "3d ago")
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { wp, hp, moderateScale } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';
import { ThemeColors } from '@/shared/theme/colors';

// Format time ago (e.g., "30 sec ago", "5 min ago", "2 hours ago")
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`;
  if (weeks > 0) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  if (seconds > 10) return `${seconds} sec ago`;
  return 'just now';
}

// Layout constants matching other card sections
const MARGIN_H = wp(3.25);       // 3.25%w horizontal margin
const PADDING = wp(4);           // 4%w internal padding
const RADIUS = wp(2.5);          // 2.5%w border radius
const GAP = wp(3);               // 3%w gap

// Card dimensions
const CARD = {
  coverSize: wp(22),            // Square cover
  gap: wp(4),                   // Gap between cards
  titleWidth: wp(22),           // Width for title text
};

// getItemLayout for horizontal scroll optimization
// Item width includes the cover size plus the gap (separator)
const getItemLayout = (_data: any, index: number) => ({
  length: CARD.coverSize + CARD.gap,
  offset: (CARD.coverSize + CARD.gap) * index,
  index,
});

// Play icon for overlay
const PlayIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 5.14v14.72a1 1 0 001.5.86l11.14-7.36a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
      fill={color}
    />
  </Svg>
);

interface ContinueListeningSectionProps {
  /** List of books to display */
  books: LibraryItem[];
  /** Callback when cover is pressed (loads book paused) */
  onCoverPress: (book: LibraryItem) => void;
  /** Callback when title is pressed or cover is long-pressed (opens details) */
  onDetailsPress: (book: LibraryItem) => void;
  /** Callback when "View All" is pressed */
  onViewAll: () => void;
}

/**
 * Individual book card with cover and title
 * - Cover tap: plays book (paused)
 * - Cover long press: opens details
 * - Title tap: opens details
 */
const ContinueListeningCard = ({
  book,
  onCoverPress,
  onDetailsPress,
  colors,
}: {
  book: LibraryItem;
  onCoverPress: () => void;
  onDetailsPress: () => void;
  colors: ThemeColors;
}) => {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Unknown';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';
  const progress = (book as any).userMediaProgress?.progress || 0;

  // Get lastUpdate from various possible locations in the API response
  const bookAny = book as any;
  const rawLastUpdate =
    bookAny.progressLastUpdate ||
    bookAny.userMediaProgress?.lastUpdate ||
    bookAny.mediaProgress?.lastUpdate ||
    bookAny.recentEpisode?.progress?.lastUpdate;

  // Convert to milliseconds if needed
  // AudiobookShelf API typically returns timestamps in seconds (Unix timestamp)
  let lastUpdateMs: number | undefined;
  if (rawLastUpdate && rawLastUpdate > 0) {
    // If less than 10 billion, it's definitely in seconds and needs conversion
    if (rawLastUpdate < 10000000000) {
      lastUpdateMs = rawLastUpdate * 1000;
    } else {
      // Already in milliseconds
      lastUpdateMs = rawLastUpdate;
    }
  }

  const hasProgress = progress > 0 && progress < 1;
  const timeAgo = lastUpdateMs ? formatTimeAgo(lastUpdateMs) : '';

  return (
    <View style={styles.cardContainer}>
      {/* Cover - tap to play, long press for details */}
      <TouchableOpacity
        onPress={onCoverPress}
        onLongPress={onDetailsPress}
        activeOpacity={0.9}
        accessibilityLabel={author ? `${title} by ${author}, ${Math.round(progress * 100)}% complete` : `${title}, ${Math.round(progress * 100)}% complete`}
        accessibilityRole="button"
        accessibilityHint="Tap to play. Long press for details."
      >
        <View style={styles.coverWrapper}>
          <Image
            source={coverUrl}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
          {/* Play overlay */}
          <View style={styles.playOverlay}>
            <PlayIcon size={wp(7)} color="white" />
          </View>
          {/* Progress bar at bottom of cover */}
          {hasProgress && (
            <View style={styles.progressBarContainer}>
              <View style={[
                styles.progressBarFill,
                { width: `${progress * 100}%`, backgroundColor: colors.progress.fill }
              ]} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Title - tap for details */}
      <TouchableOpacity onPress={onDetailsPress} activeOpacity={0.7}>
        <Text style={[styles.cardTitle, { color: colors.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
      </TouchableOpacity>

      {/* Time since last played */}
      {timeAgo ? (
        <Text style={[styles.timeAgo, { color: colors.text.secondary }]}>{timeAgo}</Text>
      ) : null}
    </View>
  );
};

export function ContinueListeningSection({
  books,
  onCoverPress,
  onDetailsPress,
  onViewAll,
}: ContinueListeningSectionProps) {
  const colors = useColors();

  const renderCard = useCallback(
    ({ item }: { item: LibraryItem }) => (
      <ContinueListeningCard
        book={item}
        onCoverPress={() => onCoverPress(item)}
        onDetailsPress={() => onDetailsPress(item)}
        colors={colors}
      />
    ),
    [onCoverPress, onDetailsPress, colors]
  );

  if (books.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={[styles.header, { color: colors.text.primary }]}>
        Continue Listening
      </Text>

      {/* Horizontal scroll of book cards - extends to screen edges */}
      <FlatList
        data={books}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: CARD.gap }} />}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: hp(2),
  },
  header: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: GAP,
    marginLeft: MARGIN_H, // Align with card left edge
  },
  list: {
    paddingLeft: MARGIN_H, // Start aligned with card left edge
  },

  // Individual card styles
  cardContainer: {
    width: CARD.coverSize,
  },
  coverWrapper: {
    width: CARD.coverSize,
    height: CARD.coverSize,
    borderRadius: wp(1.5),
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Fixed dark overlay for cover visibility
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: wp(1),
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fixed dark overlay for cover visibility
  },
  progressBarFill: {
    height: '100%',
  },
  cardTitle: {
    width: CARD.titleWidth,
    textAlign: 'left',
    fontSize: moderateScale(11),
    marginTop: hp(0.6),
  },
  timeAgo: {
    width: CARD.titleWidth,
    textAlign: 'left',
    fontSize: moderateScale(10),
    marginTop: hp(0.3),
  },
});

export default ContinueListeningSection;
