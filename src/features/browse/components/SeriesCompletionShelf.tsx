/**
 * src/features/browse/components/SeriesCompletionShelf.tsx
 *
 * Horizontal spine row for one series showing completion status.
 * Uses SectionHeader for consistent two-level typography:
 *   Label: "X OF Y BOOKS" (caps monospace)
 *   Heading: Series Name (serif bold)
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { secretLibraryColors as colors } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { LibraryItem, BookMetadata, BookMedia } from '@/core/types';
import { useProgressStore } from '@/core/stores/progressStore';
import { ShelfRow, BookSpineVerticalData } from '@/shared/spine';
import { SectionHeader } from './SectionHeader';

const DESIGN_WIDTH = 402;
const COMPACT_SCALE = 0.6;

interface SeriesCompletionShelfProps {
  seriesName: string;
  books: LibraryItem[];
  totalBooks?: number;
  onBookPress: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
  onSeriesPress: (seriesName: string) => void;
}

function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'metadata' in media && 'duration' in media;
}

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

function getBookDuration(item: LibraryItem): number {
  if (!isBookMedia(item.media)) return 0;
  return item.media.duration || 0;
}

function toSpineData(item: LibraryItem, cachedData?: { backgroundColor?: string; textColor?: string }): BookSpineVerticalData {
  const metadata = getMetadata(item);
  const progress = item.userMediaProgress?.progress || 0;

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

export const SeriesCompletionShelf = React.memo(function SeriesCompletionShelf({
  seriesName,
  books,
  totalBooks,
  onBookPress,
  onBookLongPress,
  onSeriesPress,
}: SeriesCompletionShelfProps) {
  const getProgress = useProgressStore((s) => s.getProgress);

  const { finishedCount, seriesTotal } = useMemo(() => {
    let finished = 0;

    for (const book of books) {
      const progress = getProgress(book.id);
      if (progress?.isFinished || (progress?.progress ?? 0) >= 0.95) {
        finished++;
      }
    }

    return { finishedCount: finished, seriesTotal: totalBooks ?? books.length };
  }, [books, getProgress, totalBooks]);

  const handleSpinePress = useCallback((spine: BookSpineVerticalData) => {
    onBookPress(spine.id);
  }, [onBookPress]);

  const handleSpineLongPress = useCallback((spine: BookSpineVerticalData) => {
    onBookLongPress?.(spine.id);
  }, [onBookLongPress]);

  const { width: screenWidth } = useWindowDimensions();
  const compactLayoutOptions = useMemo(() => ({
    scaleFactor: COMPACT_SCALE * (screenWidth / DESIGN_WIDTH),
    enableLeaning: true,
  }), [screenWidth]);

  if (books.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader
        label={`${finishedCount} of ${seriesTotal} books`}
        heading={seriesName}
        onViewAll={() => onSeriesPress(seriesName)}
      />

      <ShelfRow
        books={books}
        toSpineData={toSpineData}
        onSpinePress={handleSpinePress}
        onSpineLongPress={handleSpineLongPress}
        layoutOptions={compactLayoutOptions}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    paddingBottom: scale(8),
  },
});
