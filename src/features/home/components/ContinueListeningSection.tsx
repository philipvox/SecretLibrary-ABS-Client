/**
 * src/features/home/components/ContinueListeningSection.tsx
 *
 * Continue Listening section with card container styling
 * Matches the same styling as YourSeriesSection and RecentlyAddedSection
 *
 * Specs:
 * - Container: 93.5%w (3.25%w margin each side)
 * - Border radius: 2.5%w
 * - Background: subtle glass effect (rgba(255,255,255,0.05))
 * - Border: 1px rgba(102,102,102,0.5)
 * - Horizontal scroll for book cards inside
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
import { colors, wp, hp, moderateScale } from '@/shared/theme';

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
  /** Callback when a book card is pressed (to resume) */
  onBookPress: (book: LibraryItem) => void;
  /** Callback when a book card is long-pressed (to view details) */
  onBookLongPress?: (book: LibraryItem) => void;
  /** Callback when "View All" is pressed */
  onViewAll: () => void;
}

/**
 * Individual book card with cover and title
 */
const ContinueListeningCard = ({
  book,
  onPress,
  onLongPress,
}: {
  book: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
}) => {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = book.media?.metadata?.title || 'Unknown';

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      {/* Cover with play overlay */}
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
      </View>

      {/* Title - left aligned */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export function ContinueListeningSection({
  books,
  onBookPress,
  onBookLongPress,
  onViewAll,
}: ContinueListeningSectionProps) {
  const renderCard = useCallback(
    ({ item }: { item: LibraryItem }) => (
      <ContinueListeningCard
        book={item}
        onPress={() => onBookPress(item)}
        onLongPress={onBookLongPress ? () => onBookLongPress(item) : undefined}
      />
    ),
    [onBookPress, onBookLongPress]
  );

  if (books.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Continue Listening</Text>

      {/* Horizontal scroll of book cards - extends to screen edges */}
      <FlatList
        data={books}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: CARD.gap }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: hp(2),
  },
  header: {
    color: colors.textPrimary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    width: CARD.titleWidth,
    textAlign: 'left',
    color: colors.textPrimary,
    fontSize: moderateScale(11),
    marginTop: hp(0.6),
  },
});

export default ContinueListeningSection;
