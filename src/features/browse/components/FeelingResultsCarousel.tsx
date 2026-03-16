/**
 * src/features/browse/components/FeelingResultsCarousel.tsx
 *
 * Horizontal carousel of books matching the active feeling chip.
 * Shows cover + title for matching books, sorted by score.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryColors as colors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, wp, useSecretLibraryColors } from '@/shared/theme';
import { LibraryItem, BookMetadata } from '@/core/types';
import { useCoverUrl } from '@/core/cache';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';

const CARD_WIDTH = Math.floor(wp(100) * 0.32);
const COVER_HEIGHT = CARD_WIDTH;
const MAX_RESULTS = 15;

interface FeelingResultsCarouselProps {
  items: LibraryItem[];
  chipLabel: string;
  onBookPress: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
}

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

const BookCard = React.memo(function BookCard({
  item,
  onPress,
  onLongPress,
}: {
  item: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const coverUrl = useCoverUrl(item.id, { width: 200 });
  const themeColors = useSecretLibraryColors();
  const metadata = getMetadata(item);
  const title = (metadata as any).title || 'Untitled';
  const author = (metadata as any).authorName || (metadata as any).authors?.[0]?.name || '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <View style={[styles.coverContainer, { backgroundColor: themeColors.grayLine }]}>
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
      <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
      {author && <Text style={styles.cardAuthor} numberOfLines={1}>{author}</Text>}
    </TouchableOpacity>
  );
});

export function FeelingResultsCarousel({
  items,
  chipLabel,
  onBookPress,
  onBookLongPress,
}: FeelingResultsCarouselProps) {
  const displayItems = items.slice(0, MAX_RESULTS);
  const formatLabel = chipLabel.charAt(0).toUpperCase() + chipLabel.slice(1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {formatLabel} <Text style={styles.countText}>({items.length})</Text>
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayItems.map((item) => (
          <BookCard
            key={item.id}
            item={item}
            onPress={() => onBookPress(item.id)}
            onLongPress={onBookLongPress ? () => onBookLongPress(item.id) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    paddingBottom: scale(16),
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: scale(16),
    marginBottom: scale(12),
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(20),
    color: colors.white,
    fontStyle: 'italic',
  },
  countText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: colors.gray,
    fontStyle: 'normal',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(4),
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
    color: colors.white,
    marginBottom: 2,
  },
  cardAuthor: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
