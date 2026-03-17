/**
 * src/features/browse/components/RecentlyAddedSection.tsx
 *
 * Recently Added section for Browse page.
 * Supports two display modes: 'covers' (cover art cards) and 'spines' (ShelfRow).
 * Uses SectionHeader for consistent two-level typography.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem, BookMetadata, BookMedia } from '@/core/types';
import { scale, wp } from '@/shared/theme';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';
import { ShelfRow, BookSpineVerticalData } from '@/shared/spine';
import { SectionHeader } from './SectionHeader';

// Carousel layout constants
const PADDING = 24;
const GAP = 12;
const CARD_WIDTH = Math.floor((wp(100) - PADDING - GAP) * 0.42);
const COVER_HEIGHT = CARD_WIDTH;

const colors = secretLibraryColors;

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'metadata' in media && ('audioFiles' in media || 'duration' in media);
}

function getBookDuration(item: LibraryItem): number {
  if (!isBookMedia(item.media)) return 0;
  return item.media.duration || 0;
}

function toSpineData(item: LibraryItem, cachedData?: { backgroundColor?: string; textColor?: string }): BookSpineVerticalData {
  const metadata = getMetadata(item);
  const progress = (item as any)?.mediaProgress?.progress || item.userMediaProgress?.progress || 0;

  const base: BookSpineVerticalData = {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author',
    progress,
    genres: metadata?.genres || [],
    tags: isBookMedia(item.media) ? item.media.tags || [] : [],
    duration: getBookDuration(item),
    seriesName: metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || metadata?.series?.[0]?.name,
  };

  if (cachedData?.backgroundColor && cachedData?.textColor) {
    return { ...base, backgroundColor: cachedData.backgroundColor, textColor: cachedData.textColor };
  }
  return base;
}

// Cover card for 'covers' mode
const CoverCard = React.memo(function CoverCard({ item, onPress, onLongPress }: {
  item: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const coverUrl = useCoverUrl(item.id, { width: 200 });
  const metadata = getMetadata(item);
  const title = metadata.title || 'Untitled';
  const author = metadata.authorName || metadata.authors?.[0]?.name || '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <View style={[styles.coverContainer, { backgroundColor: colors.grayLine }]}>
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        <CoverStars bookId={item.id} />
        <CompleteBadgeOverlay bookId={item.id} size="small" />
      </View>
      <Text style={[styles.cardTitle, { color: colors.white }]} numberOfLines={1}>
        {title}
      </Text>
      {author && (
        <Text style={[styles.cardAuthor, { color: colors.gray }]} numberOfLines={1}>
          {author}
        </Text>
      )}
    </TouchableOpacity>
  );
});

/** Parse publication year from metadata into a sortable number */
function getPublishedYear(item: LibraryItem): number {
  const metadata = getMetadata(item) as BookMetadata;
  // Try publishedDate first (YYYY-MM-DD), then publishedYear
  if (metadata.publishedDate) {
    const y = parseInt(metadata.publishedDate.slice(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  if (metadata.publishedYear) {
    const y = parseInt(metadata.publishedYear, 10);
    if (!isNaN(y)) return y;
  }
  return 0;
}

interface RecentlyAddedSectionProps {
  items: LibraryItem[];
  onBookPress?: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
  onViewAll?: () => void;
  limit?: number;
  title?: string;
  /** Display mode: 'covers' for cover art cards, 'spines' for ShelfRow */
  displayMode?: 'covers' | 'spines';
  /** Sort by: 'added' (default, addedAt) or 'published' (publishedYear/publishedDate) */
  sortBy?: 'added' | 'published';
  /** Override container background color */
  backgroundColor?: string;
}

export const RecentlyAddedSection = React.memo(function RecentlyAddedSection({
  items,
  onBookPress,
  onBookLongPress,
  onViewAll,
  limit = 12,
  title: sectionTitle = 'Recently Added',
  displayMode = 'covers',
  sortBy = 'added',
  backgroundColor: bgColor,
}: RecentlyAddedSectionProps) {
  const recentBooks = useMemo(() => {
    if (!items?.length) return [];

    const books = [...items].filter(item => item.mediaType === 'book');

    if (sortBy === 'published') {
      // Sort by publication year descending, exclude books with no year
      return books
        .map((item) => ({ item, year: getPublishedYear(item) }))
        .filter(({ year }) => year > 0)
        .sort((a, b) => b.year - a.year)
        .slice(0, limit)
        .map(({ item }) => item);
    }

    return books
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .slice(0, limit);
  }, [items, limit, sortBy]);

  const handleBookPress = useCallback((bookId: string) => {
    onBookPress?.(bookId);
  }, [onBookPress]);

  const handleBookLongPress = useCallback((bookId: string) => {
    onBookLongPress?.(bookId);
  }, [onBookLongPress]);

  const handleSpinePress = useCallback((spine: BookSpineVerticalData) => {
    onBookPress?.(spine.id);
  }, [onBookPress]);

  const handleSpineLongPress = useCallback((spine: BookSpineVerticalData) => {
    onBookLongPress?.(spine.id);
  }, [onBookLongPress]);

  if (recentBooks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor ?? colors.black }]}>
      <SectionHeader
        label={sectionTitle}
        onViewAll={onViewAll}
      />

      {displayMode === 'spines' ? (
        <ShelfRow
          books={recentBooks}
          toSpineData={toSpineData}
          onSpinePress={handleSpinePress}
          onSpineLongPress={handleSpineLongPress}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + GAP}
        >
          {recentBooks.map((item) => (
            <CoverCard
              key={item.id}
              item={item}
              onPress={() => handleBookPress(item.id)}
              onLongPress={() => handleBookLongPress(item.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: scale(8),
  },
  carousel: {
    paddingLeft: PADDING,
    paddingRight: PADDING / 2,
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(8),
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(14),
    lineHeight: scale(18),
    marginBottom: scale(2),
  },
  cardAuthor: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
});

export default RecentlyAddedSection;
