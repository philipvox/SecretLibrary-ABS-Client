/**
 * src/features/browse/components/RecentSeriesSection.tsx
 *
 * "Recent Series" section for Browse page.
 * Shows series the user has been listening to recently.
 * Single row horizontal scrolling carousel with peeking content.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useLibraryCache, useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { LibraryItem, BookMetadata } from '@/core/types';
import { scale, wp } from '@/shared/theme';
import { useContentFilterStore, filterByAudience } from '../stores/contentFilterStore';
import { useReadingHistory } from '@/features/reading-history-wizard';

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

interface SeriesInfo {
  name: string;
  books: LibraryItem[];
  lastListenedTime: number;
  coverBookId: string;
}

interface RecentSeriesSectionProps {
  onSeriesPress?: (seriesName: string) => void;
  onBookPress?: (bookId: string) => void;
  onViewAll?: () => void;
  limit?: number;
}

interface SeriesCardProps {
  series: SeriesInfo;
  onPress: () => void;
}

const colors = secretLibraryColors;

const SeriesCard = React.memo(function SeriesCard({ series, onPress }: SeriesCardProps) {
  const coverUrl = useCoverUrl(series.coverBookId, { width: 200 });
  const bookCount = series.books.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.coverContainer, { backgroundColor: colors.grayLine }]}>
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        <CoverStars bookId={series.coverBookId} />
        {/* Book count badge */}
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{bookCount}</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: colors.white }]} numberOfLines={2}>
        {series.name}
      </Text>
      <Text style={[styles.cardSubtitle, { color: colors.gray }]} numberOfLines={1}>
        {bookCount} {bookCount === 1 ? 'book' : 'books'}
      </Text>
    </TouchableOpacity>
  );
});

export function RecentSeriesSection({
  onSeriesPress,
  _onBookPress,
  onViewAll,
  limit = 8
}: RecentSeriesSectionProps) {
  const { items: libraryItems, isLoaded } = useLibraryCache();
  const { isFinished, hasBeenStarted } = useReadingHistory();

  // Content filter
  const audience = useContentFilterStore((s) => s.audience);
  const selectedAges = useContentFilterStore((s) => s.selectedAges);
  const selectedRatings = useContentFilterStore((s) => s.selectedRatings);
  const selectedTags = useContentFilterStore((s) => s.selectedTags);
  const selectedGenres = useContentFilterStore((s) => s.selectedGenres);
  const lengthRange = useContentFilterStore((s) => s.lengthRange);

  // Get recently listened series
  const recentSeries = useMemo(() => {
    if (!libraryItems?.length) return [];

    // Apply content filter
    const filteredItems = filterByAudience(libraryItems, audience, selectedAges, selectedRatings, selectedTags, lengthRange, selectedGenres);

    // Group books by series
    const seriesMap = new Map<string, SeriesInfo>();

    filteredItems.forEach(item => {
      if (item.mediaType !== 'book') return;

      const metadata = getMetadata(item);
      const seriesInfo = metadata.series?.[0];
      if (!seriesInfo?.name) return;

      const seriesName = seriesInfo.name;
      const existing = seriesMap.get(seriesName);
      const lastUpdate = item.userMediaProgress?.lastUpdate || 0;

      if (existing) {
        existing.books.push(item);
        if (lastUpdate > existing.lastListenedTime) {
          existing.lastListenedTime = lastUpdate;
          // Use most recently listened book's cover
          if (lastUpdate > 0) {
            existing.coverBookId = item.id;
          }
        }
      } else {
        seriesMap.set(seriesName, {
          name: seriesName,
          books: [item],
          lastListenedTime: lastUpdate,
          coverBookId: item.id,
        });
      }
    });

    // Filter to series with recent listening activity and sort by last listened
    return Array.from(seriesMap.values())
      .filter(series => {
        // Must have some listening activity
        return series.books.some(book => {
          const progress = book.userMediaProgress?.progress || 0;
          return progress > 0 || isFinished(book.id) || hasBeenStarted(book.id);
        });
      })
      .sort((a, b) => b.lastListenedTime - a.lastListenedTime)
      .slice(0, limit);
  }, [libraryItems, limit, audience, selectedAges, selectedRatings, selectedTags, selectedGenres, lengthRange, isFinished, hasBeenStarted]);

  const handleSeriesPress = useCallback((seriesName: string) => {
    onSeriesPress?.(seriesName);
  }, [onSeriesPress]);

  if (!isLoaded || recentSeries.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.black }]}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.white }]}>Recent Series</Text>
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
        {recentSeries.map((series) => (
          <SeriesCard
            key={series.name}
            series={series}
            onPress={() => handleSeriesPress(series.name)}
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
  countBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: colors.white,
    fontWeight: '600',
  },
  cardTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(14),
    lineHeight: scale(18),
    marginBottom: scale(2),
  },
  cardSubtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
});

export default RecentSeriesSection;
