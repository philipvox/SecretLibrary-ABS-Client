/**
 * src/features/browse/components/BecauseYouFinishedSeriesSection.tsx
 *
 * "Because you finished [Series Name]" — 2-row cover carousel of
 * genre-matched recommendations from a completed series.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, wp, useSecretLibraryColors } from '@/shared/theme';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem, BookMetadata } from '@/core/types';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';
import { SectionHeader } from './SectionHeader';
import { useRecentlyCompletedSeries } from '../hooks/useRecentlyCompletedSeries';
import { useDNASettingsStore } from '@/features/profile/stores/dnaSettingsStore';

// Layout constants for 2-row horizontal scroll
const PADDING = 24;
const GAP = 10;
const CARD_WIDTH = Math.floor(wp(100) * 0.32);
const COVER_HEIGHT = CARD_WIDTH;
const TEXT_HEIGHT = scale(30); // title + author
const ROW_HEIGHT = COVER_HEIGHT + scale(6) + TEXT_HEIGHT;
const SCROLL_HEIGHT = ROW_HEIGHT * 2 + GAP;

interface BecauseYouFinishedSeriesSectionProps {
  items: LibraryItem[];
  onBookPress: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
}

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

// Cover card
const CoverCard = React.memo(function CoverCard({
  item,
  onPress,
  onLongPress,
}: {
  item: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const coverUrl = useCoverUrl(item.id, { width: 200 });
  const metadata = getMetadata(item);
  const title = metadata.title || 'Untitled';
  const author = metadata.authorName || metadata.authors?.[0]?.name || '';
  const colors = useSecretLibraryColors();

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
        <CoverStars bookId={item.id} starSize={scale(20)} />
        <CompleteBadgeOverlay bookId={item.id} size="small" />
      </View>
      <Text style={[styles.cardTitle, { color: colors.black }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.cardAuthor, { color: colors.gray }]} numberOfLines={1}>
        {author}
      </Text>
    </TouchableOpacity>
  );
});

export const BecauseYouFinishedSeriesSection = React.memo(function BecauseYouFinishedSeriesSection({
  items,
  onBookPress,
  onBookLongPress,
}: BecauseYouFinishedSeriesSectionProps) {
  const dnaEnabled = useDNASettingsStore((s) => s.enableDNAFeatures);
  const colors = useSecretLibraryColors();
  const result = useRecentlyCompletedSeries(items);

  // Pair books into columns of 2 for the 2-row layout
  const columns = useMemo(() => {
    if (!result) return [];
    const books = result.matchingBooks.slice(0, 20);
    const cols: LibraryItem[][] = [];
    for (let i = 0; i < books.length; i += 2) {
      cols.push(books.slice(i, Math.min(i + 2, books.length)));
    }
    return cols;
  }, [result]);

  const handleBookPress = useCallback(
    (bookId: string) => onBookPress(bookId),
    [onBookPress],
  );

  const handleBookLongPress = useCallback(
    (bookId: string) => onBookLongPress?.(bookId),
    [onBookLongPress],
  );

  if (!dnaEnabled || !result || columns.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader
        label={`Because you finished ${result.seriesName}`}
        heading={`More Like ${result.seriesName}`}
        count={result.matchingBooks.length}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        style={{ height: SCROLL_HEIGHT }}
        decelerationRate="fast"
      >
        {columns.map((col, colIndex) => (
          <View key={colIndex} style={styles.column}>
            {col.map((item) => (
              <CoverCard
                key={item.id}
                item={item}
                onPress={() => handleBookPress(item.id)}
                onLongPress={() => handleBookLongPress(item.id)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Genre connection tags */}
      <View style={styles.tagRow}>
        {result.genreTags.map((tag) => (
          <Text key={tag} style={[styles.tag, { color: colors.gray }]}>{tag}</Text>
        ))}
      </View>
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
  column: {
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(6),
    overflow: 'hidden',
    marginBottom: scale(6),
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(12),
    lineHeight: scale(15),
    marginBottom: scale(1),
  },
  cardAuthor: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
  },
  tagRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: scale(12),
    paddingTop: scale(16),
  },
  tag: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.5,
  },
});
