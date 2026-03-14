/**
 * src/features/browse/components/BrowseContent.tsx
 *
 * Unified Browse page — single continuous scroll combining the best of
 * all three former tabs (For You, Discover, Curated).
 *
 * When a mood chip is active, ALL sections filter to that mood.
 *
 * Section order:
 *   1. Hidden Gem Hero
 *   2. ActionNeeded (series gaps)
 *   3. BecauseYouFinishedSeries
 *   4. MoreToRead (authors with unread books)
 *   5. LibraryMoodChips (horizontal scroll — controls mood filter)
 *   6. WhatsTheVibe
 *   7. MeaningToRead
 *   8. RecentlyAdded (covers, "New To Library")
 *   9. NewReleases (covers, sorted by publication date)
 *  10. FeaturedCollection + AwardWinners
 *  11. BrowseGrid
 *  12. BrowseFooter
 */

import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkullRefreshControl } from '@/shared/components';
import { useCollections } from '@/features/collections';
import { LibraryItem } from '@/core/types';
import { filterByFeeling } from '@/shared/utils/bookDNA';
import { useFeelingChipStore } from '../stores/feelingChipStore';
import type { FeelingChip } from '../stores/feelingChipStore';

// Sections — personalized (from For You)
import { ActionNeededSection } from './ActionNeededSection';
import { BecauseYouFinishedSeriesSection } from './BecauseYouFinishedSeriesSection';
import { MostCollectedAuthorSection } from './MostCollectedAuthorSection';
import { LibraryMoodChips } from './LibraryMoodChips';
import { MeaningToReadSection } from './MeaningToReadSection';

// Sections — discovery (from Discover)
import { TopPickHero } from './TopPickHero';
import { WhatsTheVibeSection } from './WhatsTheVibeSection';
import { RecentlyAddedSection } from './RecentlyAddedSection';
import { BrowseGrid } from './BrowseGrid';

// Sections — curated (from Collections, top section only)
import { SectionHeader } from './SectionHeader';
import { FeaturedCollectionCard } from './FeaturedCollectionCard';
import { AwardWinnersSection } from './AwardWinnersSection';

// Footer
import { BrowseFooter } from './BrowseFooter';

const BOTTOM_CLEARANCE = 180;

interface BrowseContentProps {
  filteredItems: LibraryItem[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onBookPress: (bookId: string) => void;
  onBookLongPress: (bookId: string) => void;
  onSeriesPress: (seriesName: string) => void;
  onAuthorPress: (authorName: string) => void;
  onCollectionPress: (collectionId: string) => void;
  onViewAllCollections: () => void;
  onViewAllBooks: () => void;
  onVibePress: (slug: string) => void;
  onBrowseItemPress: (type: 'genres' | 'narrators' | 'series' | 'duration') => void;
  onMoodPress: (moodKey: FeelingChip) => void;
}

export function BrowseContent({
  filteredItems,
  isRefreshing,
  onRefresh,
  onBookPress,
  onBookLongPress,
  onSeriesPress,
  onAuthorPress,
  onCollectionPress,
  onViewAllCollections,
  onViewAllBooks,
  onVibePress,
  onBrowseItemPress,
  onMoodPress,
}: BrowseContentProps) {
  const insets = useSafeAreaInsets();

  // Mood chip filter — applied as a layer on top of filteredItems
  const activeChip = useFeelingChipStore((s) => s.activeChip);

  const displayItems = useMemo(() => {
    if (!activeChip) return filteredItems;
    return filterByFeeling(filteredItems, activeChip);
  }, [filteredItems, activeChip]);

  // Collections data (for curated section)
  const { collections } = useCollections();
  const firstCollection = collections?.[0];

  return (
    <SkullRefreshControl refreshing={isRefreshing} onRefresh={onRefresh}>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: BOTTOM_CLEARANCE + insets.bottom }}
    >
      {/* ── HERO ── */}
      <TopPickHero
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        variant="discover"
      />

      {/* Mood Chips — controls mood filter for entire page */}
      <LibraryMoodChips items={filteredItems} onBookPress={onBookPress} />

      {/* ── PERSONALIZED ── */}

      {/* Series Gap Alerts — conditional, max 2 */}
      <ActionNeededSection onSeriesPress={onSeriesPress} />

      {/* Because You Finished [Series] — spine row */}
      <BecauseYouFinishedSeriesSection
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
      />

      {/* More To Read — authors with unread books (session-rotating) */}
      <MostCollectedAuthorSection
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        onAuthorPress={onAuthorPress}
      />

      {/* ── DISCOVERY ── */}

      {/* What's The Vibe — comp-vibe cards */}
      <WhatsTheVibeSection items={displayItems} onVibePress={onVibePress} />

      {/* Meaning To Read — unstarted books 30+ days old */}
      <MeaningToReadSection
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
      />

      {/* New To Library — cover cards sorted by addedAt */}
      <RecentlyAddedSection
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        onViewAll={onViewAllBooks}
        title="New To Library"
        displayMode="covers"
      />

      {/* New Releases — cover cards sorted by publication date */}
      <RecentlyAddedSection
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        title="New Releases"
        displayMode="covers"
        sortBy="published"
      />

      {/* ── CURATED ── */}

      {/* Featured Collection — full-width mosaic card */}
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

      {/* ── BROWSE ── */}

      {/* Browse Grid — Genres, Narrators, Series, Duration */}
      <BrowseGrid onItemPress={onBrowseItemPress} />

      {/* Footer — stat line */}
      <BrowseFooter />
    </ScrollView>
    </SkullRefreshControl>
  );
}
