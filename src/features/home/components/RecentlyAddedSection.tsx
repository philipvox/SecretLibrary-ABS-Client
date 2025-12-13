/**
 * src/features/home/components/RecentlyAddedSection.tsx
 *
 * Recently Added section with card container and list rows
 *
 * Revised spec:
 * - Container: 93.5%w (3.25%w margin each side)
 * - Border radius: 2.5%w
 * - Background: subtle glass effect (simplified to rgba(255,255,255,0.05))
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { colors, wp, hp, moderateScale, layout } from '@/shared/theme';

// Layout constants from revised spec
const MARGIN_H = wp(3.25);       // 3.25%w horizontal margin
const PADDING = wp(4);           // 4%w internal padding
const RADIUS = wp(2.5);          // 2.5%w border radius
const COVER_SIZE = wp(17);       // 17%w square
const COVER_RADIUS = wp(1.5);    // Small radius (~8% of cover size)
const GAP = wp(3);               // 3%w gap between cover and text
const TOUCH_TARGET = Math.max(wp(8), layout.minTouchTarget);
const ROW_GAP = wp(3);           // 3%w vertical gap between rows

interface RecentlyAddedSectionProps {
  /** List of recently added books */
  books: LibraryItem[];
  /** Callback when a book row is pressed (view details) */
  onBookPress: (book: LibraryItem) => void;
  /** Callback when play button is pressed */
  onPlayPress: (book: LibraryItem) => void;
  /** Callback when more button is pressed */
  onMorePress?: (book: LibraryItem) => void;
  /** Maximum number of items to show */
  maxItems?: number;
}

/**
 * Get author name from book metadata
 */
function getAuthor(book: LibraryItem): string {
  const metadata = book.media?.metadata as any;
  if (!metadata) return '';
  if (metadata.authorName) return metadata.authorName;
  if (metadata.authors?.length > 0) {
    return metadata.authors.map((a: any) => a.name).join(', ');
  }
  return '';
}

/**
 * Format duration in hours/minutes
 */
function formatDuration(media?: any): string {
  const seconds = media?.duration;
  if (!seconds || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Single book row in the list
 */
const BookRow = ({
  book,
  onPress,
  onPlayPress,
  onMorePress,
  isFirst,
}: {
  book: LibraryItem;
  onPress: () => void;
  onPlayPress: () => void;
  onMorePress?: () => void;
  isFirst: boolean;
}) => {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = book.media?.metadata?.title || 'Unknown';
  const author = getAuthor(book);
  const duration = formatDuration(book.media);

  return (
    <TouchableOpacity
      style={[styles.row, !isFirst && styles.rowWithGap]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Cover thumbnail */}
      <Image
        source={coverUrl}
        style={styles.cover}
        contentFit="cover"
        transition={150}
      />

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        <Text style={styles.duration} numberOfLines={1}>
          {duration}
        </Text>
      </View>

      {/* Play button - circle outline */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={(e) => {
          e.stopPropagation?.();
          onPlayPress();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.playCircle}>
          <Ionicons name="play" size={wp(3)} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      </TouchableOpacity>

      {/* More button - vertical dots */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={(e) => {
          e.stopPropagation?.();
          onMorePress?.();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="ellipsis-vertical" size={wp(5)} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export function RecentlyAddedSection({
  books,
  onBookPress,
  onPlayPress,
  onMorePress,
  maxItems = 5,
}: RecentlyAddedSectionProps) {
  if (books.length === 0) return null;

  const displayBooks = books.slice(0, maxItems);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <Text style={styles.header}>Recently Added</Text>

        {/* Book rows */}
        {displayBooks.map((book, index) => (
          <BookRow
            key={book.id}
            book={book}
            onPress={() => onBookPress(book)}
            onPlayPress={() => onPlayPress(book)}
            onMorePress={onMorePress ? () => onMorePress(book) : undefined}
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
    marginTop: hp(4),  // 4%h gap from Continue Listening
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
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: COVER_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  info: {
    flex: 1,
    marginLeft: GAP,
    marginRight: wp(2),
  },
  title: {
    color: colors.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  author: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    marginTop: hp(0.2),
  },
  duration: {
    color: colors.textTertiary,
    fontSize: moderateScale(12),
    marginTop: hp(0.1),
  },
  actionButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  playCircle: {
    width: wp(6),
    height: wp(6),
    borderRadius: wp(3),
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RecentlyAddedSection;
