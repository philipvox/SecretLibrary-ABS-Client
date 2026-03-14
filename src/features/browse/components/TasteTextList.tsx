/**
 * src/features/browse/components/TasteTextList.tsx
 *
 * "Newest Releases" section for Browse page.
 * Shows books sorted by publication date (newest first).
 * Single row horizontal scrolling carousel with peeking content.
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useCoverUrl } from '@/core/cache';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { LibraryItem, BookMetadata } from '@/core/types';
import { scale, wp } from '@/shared/theme';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';
import { useProgressStore } from '@/core/stores/progressStore';
import { useDownloads } from '@/core/hooks/useDownloads';

// Carousel layout constants
const PADDING = 16;
const GAP = 12;
const CARD_WIDTH = Math.floor((wp(100) - PADDING - GAP) * 0.42);
const COVER_HEIGHT = CARD_WIDTH;

// Helper to get book metadata safely
function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

interface TasteTextListProps {
  items: LibraryItem[];
  onBookPress?: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
  onViewAll?: () => void;
}

interface CardProps {
  item: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
}

const colors = secretLibraryColors;

const CarouselBookCard = React.memo(function CarouselBookCard({ item, onPress, onLongPress }: CardProps) {
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

export function TasteTextList({ items, onBookPress, onBookLongPress, onViewAll }: TasteTextListProps) {
  const { isFinished } = useReadingHistory();

  // Library and download state
  const librarySet = useProgressStore((state) => state.librarySet);
  const { downloads } = useDownloads();

  // Get set of downloaded book IDs — recompute when completed downloads change
  const completedDownloads = useMemo(() => downloads.filter(d => d.status === 'complete'), [downloads]);
  const downloadedIds = useMemo(() => {
    return new Set(completedDownloads.map(d => d.itemId));
  }, [completedDownloads]);

  // Get newest releases sorted by publication date
  const newestReleases = useMemo(() => {
    if (!items?.length) return [];

    // Helper to check if book should be excluded
    const shouldExclude = (bookId: string, item: LibraryItem): boolean => {
      // Skip if already in user's library
      if (librarySet.has(bookId)) return true;

      // Skip if already downloaded
      if (downloadedIds.has(bookId)) return true;

      // Skip if has listening progress
      const progress = item.userMediaProgress?.progress || 0;
      if (progress > 0) return true;

      // Skip if finished
      if (isFinished(bookId)) return true;

      return false;
    };

    // Filter eligible books
    const eligibleItems = items.filter((item) => {
      if (item.mediaType !== 'book') return false;
      if (shouldExclude(item.id, item)) return false;

      const metadata = getMetadata(item);

      // Skip books from the middle of a series (only show #1 or standalone)
      const seriesInfo = metadata?.series?.[0];
      const sequence = seriesInfo?.sequence;
      if (sequence && parseFloat(sequence) > 1) return false;

      return true;
    });

    // Sort by publication year (newest first), then by addedAt as tiebreaker
    const sortedByPublishDate = [...eligibleItems].sort((a, b) => {
      const metaA = getMetadata(a);
      const metaB = getMetadata(b);

      // Parse publication year (can be string like "2023" or number)
      const yearA = metaA?.publishedYear ? parseInt(String(metaA.publishedYear), 10) : 0;
      const yearB = metaB?.publishedYear ? parseInt(String(metaB.publishedYear), 10) : 0;

      // Sort newest first
      if (yearB !== yearA) return yearB - yearA;

      // Tiebreaker: most recently added to library
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

    return sortedByPublishDate.slice(0, 15);
  }, [items, librarySet, downloadedIds, isFinished]);

  const handleBookPress = useCallback((bookId: string) => {
    onBookPress?.(bookId);
  }, [onBookPress]);

  const handleBookLongPress = useCallback((bookId: string) => {
    onBookLongPress?.(bookId);
  }, [onBookLongPress]);

  if (newestReleases.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.black }]}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.white }]}>Newest Releases</Text>
        {onViewAll && (
          <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
            <Text style={[styles.viewAllText, { color: colors.gray }]}>View All</Text>
            <ChevronRight size={16} color={colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Scrolling Carousel - Single Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + GAP}
      >
        {newestReleases.map((item) => (
          <CarouselBookCard
            key={item.id}
            item={item}
            onPress={() => handleBookPress(item.id)}
            onLongPress={() => handleBookLongPress(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: scale(24),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    marginBottom: scale(4),
  },
  title: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

export default TasteTextList;
