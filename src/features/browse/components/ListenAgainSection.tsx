/**
 * src/features/browse/components/ListenAgainSection.tsx
 *
 * "Listen Again" section for Browse page - shows books user has listened to before.
 * Single row horizontal scrolling carousel with cover art cards.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem, BookMetadata } from '@/core/types';
import { scale, wp } from '@/shared/theme';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';
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

interface ListenAgainSectionProps {
  items: LibraryItem[];
  onBookPress?: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
  onViewAll?: () => void;
  limit?: number;
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

export function ListenAgainSection({
  items,
  onBookPress,
  onBookLongPress,
  onViewAll,
  limit = 12
}: ListenAgainSectionProps) {
  const { isFinished } = useReadingHistory();

  // Get books with listening progress (finished books)
  const listenAgainBooks = useMemo(() => {
    if (!items?.length) return [];

    return items
      .filter(item => {
        if (item.mediaType !== 'book') return false;
        const progress = item.userMediaProgress?.progress || 0;
        return isFinished(item.id) || progress >= 0.95;
      })
      .sort((a, b) => {
        const aTime = a.userMediaProgress?.lastUpdate || 0;
        const bTime = b.userMediaProgress?.lastUpdate || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  }, [items, limit, isFinished]);

  const handleBookPress = useCallback((bookId: string) => {
    onBookPress?.(bookId);
  }, [onBookPress]);

  const handleBookLongPress = useCallback((bookId: string) => {
    onBookLongPress?.(bookId);
  }, [onBookLongPress]);

  if (listenAgainBooks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.black }]}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.white }]}>Listen Again</Text>
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
        {listenAgainBooks.map((item) => (
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

export default ListenAgainSection;
