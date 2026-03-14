/**
 * src/features/browse/components/CollectionsTabContent.tsx
 *
 * Curated tab content — collections, series completion, author cloud.
 * Sections: FeaturedCollectionCard → AwardWinners → SeriesCompletionShelf ×N →
 * TopAuthorsCloud → BrowseFooter
 */

import React, { useMemo, useState, useEffect } from 'react';
import { ScrollView, RefreshControl, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSecretLibraryColors } from '@/shared/theme';
import { useCollections } from '@/features/collections';
import { useLibraryCache } from '@/core/cache';
import { useProgressStore } from '@/core/stores/progressStore';
import { LibraryItem } from '@/core/types';

import { SectionHeader } from './SectionHeader';
import { FeaturedCollectionCard } from './FeaturedCollectionCard';
import { AwardWinnersSection } from './AwardWinnersSection';
import { SeriesCompletionShelf } from './SeriesCompletionShelf';
import { TopAuthorsCloud } from './TopAuthorsCloud';
import { BrowseFooter } from './BrowseFooter';

const BOTTOM_CLEARANCE = 180;
const MAX_SERIES_SHELVES = 8;
const MAX_BOOKS_PER_SHELF = 15;

interface CollectionsTabContentProps {
  filteredItems: LibraryItem[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onCollectionPress: (collectionId: string) => void;
  onBookPress: (bookId: string) => void;
  onBookLongPress: (bookId: string) => void;
  onSeriesPress: (seriesName: string) => void;
  onAuthorPress: (authorName: string) => void;
  onViewAllCollections: () => void;
  onViewAllAuthors: () => void;
}

export function CollectionsTabContent({
  filteredItems,
  isRefreshing,
  onRefresh,
  onCollectionPress,
  onBookPress,
  onBookLongPress,
  onSeriesPress,
  onAuthorPress,
  onViewAllCollections,
  onViewAllAuthors,
}: CollectionsTabContentProps) {
  const insets = useSafeAreaInsets();
  const themeColors = useSecretLibraryColors();

  // Collections data
  const { collections } = useCollections();
  const firstCollection = collections?.[0];

  // Series data from library cache
  const seriesMap = useLibraryCache((s) => s.series);
  const getProgress = useProgressStore((s) => s.getProgress);

  // Build set of allowed book IDs from audience-filtered items
  const filteredIds = useMemo(() => {
    return new Set(filteredItems.map((item) => item.id));
  }, [filteredItems]);

  // Defer heavy series computation so the tab renders instantly with collections
  type SeriesShelf = { name: string; books: any[]; totalBooks: number; completionPct: number };
  const [activeSeries, setActiveSeries] = useState<SeriesShelf[]>([]);

  useEffect(() => {
    if (!seriesMap || seriesMap.size === 0) {
      setActiveSeries([]);
      return;
    }

    const handle = InteractionManager.runAfterInteractions(() => {
      const seriesWithActivity: {
        name: string;
        books: any[];
        completionPct: number;
      }[] = [];

      seriesMap.forEach((seriesInfo) => {
        const visibleBooks = seriesInfo.books.filter((b: any) => filteredIds.has(b.id));
        if (visibleBooks.length < 2) return;

        let hasProgress = false;
        let finishedCount = 0;

        for (const book of visibleBooks) {
          const progress = getProgress(book.id);
          if (progress && progress.progress > 0) {
            hasProgress = true;
            if (progress.isFinished || progress.progress >= 0.95) {
              finishedCount++;
            }
          }
        }

        if (hasProgress) {
          seriesWithActivity.push({
            name: seriesInfo.name,
            books: visibleBooks,
            completionPct: finishedCount / visibleBooks.length,
          });
        }
      });

      // Sort by completion % descending (most complete first)
      const result = seriesWithActivity
        .sort((a, b) => b.completionPct - a.completionPct)
        .slice(0, MAX_SERIES_SHELVES)
        .map(s => ({ ...s, totalBooks: s.books.length, books: s.books.slice(0, MAX_BOOKS_PER_SHELF) }));

      setActiveSeries(result);
    });

    return () => handle.cancel();
  }, [seriesMap, getProgress, filteredIds]);

  // Stagger shelf mounting to avoid rendering all spine rows in one frame
  const [mountedCount, setMountedCount] = useState(1);
  useEffect(() => {
    if (mountedCount >= activeSeries.length) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      setMountedCount((c) => Math.min(c + 1, activeSeries.length));
    });
    return () => handle.cancel();
  }, [mountedCount, activeSeries.length]);

  useEffect(() => {
    setMountedCount(1);
  }, [activeSeries]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: BOTTOM_CLEARANCE + insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={themeColors.gray}
        />
      }
    >
      {/* Featured Collection */}
      {firstCollection && (
        <>
          <SectionHeader label="Featured Collection" />
          <FeaturedCollectionCard
            collection={firstCollection}
            onPress={() => onCollectionPress(firstCollection.id)}
          />
        </>
      )}

      {/* Award Winners — horizontal cover cards */}
      <AwardWinnersSection
        onCollectionPress={onCollectionPress}
        onViewAll={onViewAllCollections}
      />

      {/* Series Completion Shelves — sorted by completion % desc, progressively mounted */}
      {activeSeries.slice(0, mountedCount).map(({ name, books, totalBooks }) => (
        <SeriesCompletionShelf
          key={name}
          seriesName={name}
          books={books}
          totalBooks={totalBooks}
          onBookPress={onBookPress}
          onBookLongPress={onBookLongPress}
          onSeriesPress={onSeriesPress}
        />
      ))}

      {/* Top Authors Cloud */}
      <TopAuthorsCloud
        onAuthorPress={onAuthorPress}
        onViewAll={onViewAllAuthors}
      />

      {/* Footer */}
      <BrowseFooter />
    </ScrollView>
  );
}
