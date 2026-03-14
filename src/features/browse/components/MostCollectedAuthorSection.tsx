/**
 * src/features/browse/components/MostCollectedAuthorSection.tsx
 *
 * "More [Author]" — finds authors where the user has read/started some books
 * but has unread books remaining. 2-row cover carousel with VIEW ALL.
 * Session-rotates among qualifying authors.
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { scale, wp, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useCoverUrl } from '@/core/cache';
import { useProgressStore, ProgressData } from '@/core/stores/progressStore';
import { LibraryItem, BookMetadata, BookMedia } from '@/core/types';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';
import { SectionHeader } from './SectionHeader';

// Layout constants for 2-row horizontal scroll
const PADDING = 16;
const GAP = 10;
const CARD_WIDTH = Math.floor(wp(100) * 0.32);
const COVER_HEIGHT = CARD_WIDTH;
const TEXT_HEIGHT = scale(20);
const ROW_HEIGHT = COVER_HEIGHT + scale(6) + TEXT_HEIGHT; // cover + margin + title
const SCROLL_HEIGHT = ROW_HEIGHT * 2 + GAP; // 2 rows + gap between

// Session-stable seed for rotation
const SESSION_SEED = Math.floor(Date.now() / 1000);

interface MoreToReadSectionProps {
  items: LibraryItem[];
  onBookPress: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
  onAuthorPress: (authorName: string) => void;
}

function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'metadata' in media && 'duration' in media;
}

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

function getAuthorName(item: LibraryItem): string {
  const metadata = getMetadata(item);
  return (metadata as any)?.authorName || (metadata as any)?.authors?.[0]?.name || '';
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
    </TouchableOpacity>
  );
});

export const MostCollectedAuthorSection = React.memo(function MostCollectedAuthorSection({
  items,
  onBookPress,
  onBookLongPress,
  onAuthorPress,
}: MoreToReadSectionProps) {
  const colors = useSecretLibraryColors();
  const progressMap = useProgressStore((s) => s.progressMap);

  // Find authors where user has read some books but not all
  const authorData = useMemo(() => {
    if (!items?.length || progressMap.size === 0) return null;

    // Build series index: for each series, map sequence# -> bookId
    const seriesIndex = new Map<string, Map<number, string>>();
    for (const item of items) {
      if (item.mediaType !== 'book') continue;
      const meta = getMetadata(item) as BookMetadata;
      if (!meta?.series) continue;
      for (const s of meta.series) {
        if (!s.name || !s.sequence) continue;
        const seq = parseFloat(s.sequence);
        if (isNaN(seq)) continue;
        if (!seriesIndex.has(s.name)) seriesIndex.set(s.name, new Map());
        seriesIndex.get(s.name)!.set(seq, item.id);
      }
    }

    // Only recommend book 1 / standalone, or mid-series if preceding books are read
    function isSeriesEntryPoint(item: LibraryItem): boolean {
      const meta = getMetadata(item) as BookMetadata;
      if (!meta?.series || meta.series.length === 0) return true;
      for (const s of meta.series) {
        if (!s.sequence) continue;
        const seq = parseFloat(s.sequence);
        if (isNaN(seq) || seq <= 1) continue;
        const sMap = seriesIndex.get(s.name);
        if (!sMap) continue;
        for (const [prevSeq, prevBookId] of sMap) {
          if (prevSeq >= seq) continue;
          const prev = progressMap.get(prevBookId);
          if (!prev || (prev.progress < 0.05 && !prev.isFinished)) return false;
        }
      }
      return true;
    }

    // Group books by author
    const authorBooks = new Map<string, LibraryItem[]>();
    for (const item of items) {
      if (item.mediaType !== 'book') continue;
      const author = getAuthorName(item);
      if (!author) continue;
      const existing = authorBooks.get(author) || [];
      existing.push(item);
      authorBooks.set(author, existing);
    }

    // For each author, count read vs unread
    const candidates: {
      name: string;
      unreadBooks: LibraryItem[];
      readCount: number;
      totalCount: number;
    }[] = [];

    authorBooks.forEach((books, authorName) => {
      if (books.length < 3) return; // Need at least 3 books to be interesting

      let readCount = 0;
      const unread: LibraryItem[] = [];

      for (const book of books) {
        const prog = progressMap.get(book.id);
        if (prog && (prog.progress > 0.05 || prog.isFinished)) {
          readCount++;
        } else if (isSeriesEntryPoint(book)) {
          unread.push(book);
        }
      }

      // Must have read at least 1 and have at least 2 unread entry points
      if (readCount >= 1 && unread.length >= 2) {
        candidates.push({
          name: authorName,
          unreadBooks: unread,
          readCount,
          totalCount: books.length,
        });
      }
    });

    if (candidates.length === 0) return null;

    // Sort by read count descending (authors you've engaged with most)
    candidates.sort((a, b) => b.readCount - a.readCount);

    // Session-rotate among top 3
    const index = SESSION_SEED % Math.min(candidates.length, 3);
    return candidates[index];
  }, [items, progressMap]);

  // Pair books into columns of 2 for the 2-row layout
  const columns = useMemo(() => {
    if (!authorData) return [];
    const books = authorData.unreadBooks.slice(0, 20);
    const cols: LibraryItem[][] = [];
    for (let i = 0; i < books.length; i += 2) {
      cols.push(books.slice(i, Math.min(i + 2, books.length)));
    }
    return cols;
  }, [authorData]);

  const handleBookPress = useCallback(
    (bookId: string) => onBookPress(bookId),
    [onBookPress],
  );

  const handleBookLongPress = useCallback(
    (bookId: string) => onBookLongPress?.(bookId),
    [onBookLongPress],
  );

  if (!authorData || columns.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader
        label={`${authorData.readCount} of ${authorData.totalCount} read`}
        heading={`More ${authorData.name}`}
        count={authorData.unreadBooks.length}
        onViewAll={() => onAuthorPress(authorData.name)}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        style={{ height: authorData.unreadBooks.length > 1 ? SCROLL_HEIGHT : ROW_HEIGHT }}
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
});
