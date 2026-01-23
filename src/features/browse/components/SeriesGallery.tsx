/**
 * src/features/browse/components/SeriesGallery.tsx
 *
 * Series section using SeriesCard grid design with color dots.
 * Shows top series in a 2x2 grid with white cards.
 */

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useLibraryCache } from '@/core/cache';
import { SeriesCard, SeriesCardVariant, SeriesCardLayout } from './SeriesCard';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { logger } from '@/shared/utils/logger';

interface SeriesGalleryProps {
  /** Called when a series card is pressed */
  onSeriesPress?: (seriesName: string) => void;
  /** Called when View All is pressed */
  onViewAll?: () => void;
  /** Maximum number of series to display */
  maxSeries?: number;
  /** Card variant (light/dark) */
  variant?: SeriesCardVariant;
  /** Layout mode (list/grid) */
  layout?: SeriesCardLayout;
}

// Get author name from first book in series
function getAuthorName(books: any[]): string {
  if (!books || books.length === 0) return '';
  const metadata = books[0]?.media?.metadata as any;
  return metadata?.authorName || '';
}

// Get book IDs from series for color dots
function getBookIds(books: any[]): string[] {
  if (!books) return [];
  return books.map((book) => book.id);
}

export function SeriesGallery({
  onSeriesPress,
  onViewAll,
  maxSeries = 6,
  variant = 'light',
  layout = 'list',
}: SeriesGalleryProps) {
  const renderStart = useRef(Date.now());

  // Theme-aware colors
  const colors = useSecretLibraryColors();

  // Get series data from library cache (already built, no API call needed)
  const cacheStart = Date.now();
  const seriesMap = useLibraryCache((s) => s.series);
  const isLoaded = useLibraryCache((s) => s.isLoaded);
  const cacheTime = Date.now() - cacheStart;

  // Get top series sorted by book count (computed once from cache)
  const memoStart = Date.now();
  const displaySeries = useMemo(() => {
    if (!seriesMap || seriesMap.size === 0) return [];
    return Array.from(seriesMap.values())
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, maxSeries)
      .map(s => ({
        id: s.name, // Use name as ID for cache-based series
        name: s.name,
        bookCount: s.bookCount,
        books: s.books,
      }));
  }, [seriesMap, maxSeries]);
  const memoTime = Date.now() - memoStart;

  // Log component timing
  useEffect(() => {
    const totalTime = Date.now() - renderStart.current;
    logger.debug(`[Browse Perf] SeriesGallery mounted in ${totalTime}ms (cache: ${cacheTime}ms, memo: ${memoTime}ms, series: ${displaySeries.length})`);
  }, []);

  const handleSeriesPress = useCallback(
    (seriesName: string) => {
      onSeriesPress?.(seriesName);
    },
    [onSeriesPress]
  );

  if (!isLoaded || displaySeries.length === 0) {
    return null;
  }

  const isGrid = layout === 'grid';

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.black }]}>Series</Text>
        <Pressable onPress={onViewAll}>
          <Text style={[styles.link, { color: colors.black }]}>VIEW ALL</Text>
        </Pressable>
      </View>

      {/* Series cards - grid or list */}
      {isGrid ? (
        <View style={[styles.gridWrapper, { backgroundColor: colors.grayLine }]}>
          <View style={styles.grid}>
            {displaySeries.map((s) => (
              <View key={s.id} style={styles.gridItem}>
                <SeriesCard
                  name={s.name}
                  author={getAuthorName(s.books)}
                  bookCount={s.bookCount}
                  bookIds={getBookIds(s.books)}
                  layout="grid"
                  onPress={() => handleSeriesPress(s.name)}
                />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {displaySeries.map((s, index) => (
            <View key={s.id}>
              <SeriesCard
                name={s.name}
                author={getAuthorName(s.books)}
                bookCount={s.bookCount}
                bookIds={getBookIds(s.books)}
                layout="list"
                onPress={() => handleSeriesPress(s.name)}
              />
              {/* Separator line between items */}
              {index < displaySeries.length - 1 && (
                <View style={[styles.separator, { backgroundColor: colors.grayLine }]} />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(24),
    fontWeight: '400',
  },
  link: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textDecorationLine: 'underline',
  },
  // Grid layout - uses background color for 1px gap effect
  gridWrapper: {
    marginHorizontal: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1, // 1px gap between cards creates separator lines
  },
  gridItem: {
    width: '49.7%', // Slightly less than 50% to account for gap
  },
  // List layout
  list: {
    overflow: 'hidden',
  },
  separator: {
    height: 1,
  },
});
