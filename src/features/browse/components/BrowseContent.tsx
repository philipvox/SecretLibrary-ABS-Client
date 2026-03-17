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

import React, { useMemo, useCallback } from 'react';
import { ScrollView, View, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { secretLibraryDarkColors } from '@/shared/theme/secretLibrary';
import { SkullRefreshControl } from '@/shared/components';
import { useCollections } from '@/features/collections';
import { LibraryItem } from '@/core/types';
import { filterByFeeling } from '@/shared/utils/bookDNA';
import { useFeelingChipStore } from '../stores/feelingChipStore';
import type { FeelingChip } from '../stores/feelingChipStore';
import { useDNASettingsStore } from '@/features/profile/stores/dnaSettingsStore';

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
  headerHeight?: number;
  onCoverUrl?: (url: string | null) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onBookPress: (bookId: string) => void;
  onBookLongPress: (bookId: string) => void;
  onSeriesPress: (seriesName: string) => void;
  onAuthorPress: (authorName: string) => void;
  onCollectionPress: (collectionId: string) => void;
  onViewAllCollections: () => void;
  onViewAllNewToLibrary: () => void;
  onViewAllNewReleases: () => void;
  onVibePress: (slug: string) => void;
  onBrowseItemPress: (type: 'genres' | 'narrators' | 'series' | 'duration') => void;
  onMoodPress: (moodKey: FeelingChip) => void;
  onScrollPastHero?: (pastHero: boolean) => void;
}

export function BrowseContent({
  filteredItems,
  headerHeight,
  onCoverUrl,
  isRefreshing,
  onRefresh,
  onBookPress,
  onBookLongPress,
  onSeriesPress,
  onAuthorPress,
  onCollectionPress,
  onViewAllCollections,
  onViewAllNewToLibrary,
  onViewAllNewReleases,
  onVibePress,
  onBrowseItemPress,
  onMoodPress: _onMoodPress,
  onScrollPastHero,
}: BrowseContentProps) {
  const insets = useSafeAreaInsets();
  const pastHeroRef = React.useRef(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const threshold = 300; // roughly past the hero cover
    const isPast = y > threshold;
    if (isPast !== pastHeroRef.current) {
      pastHeroRef.current = isPast;
      onScrollPastHero?.(isPast);
    }
  }, [onScrollPastHero]);

  // Mood chip filter — applied as a layer on top of filteredItems
  const activeChip = useFeelingChipStore((s) => s.activeChip);
  const dnaEnabled = useDNASettingsStore((s) => s.enableDNAFeatures);

  const displayItems = useMemo(() => {
    if (!dnaEnabled || !activeChip) return filteredItems;
    return filterByFeeling(filteredItems, activeChip);
  }, [filteredItems, activeChip, dnaEnabled]);

  // Collections data (for curated section)
  const { collections } = useCollections();
  const firstCollection = collections?.[0];

  return (
    <SkullRefreshControl refreshing={isRefreshing} onRefresh={onRefresh} progressViewOffset={headerHeight || 0}>
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{ paddingBottom: BOTTOM_CLEARANCE + insets.bottom }}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      {/* ── HERO ── */}
      <TopPickHero
        items={displayItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        variant="discover"
        headerHeight={headerHeight}
        onCoverUrl={onCoverUrl}
      />

      {/* Opaque background — prevents fixed blur from showing through */}
      <View style={{ backgroundColor: secretLibraryDarkColors.white }}>
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
          onViewAll={onViewAllNewToLibrary}
          title="New To Library"
          displayMode="covers"
        />

        {/* New Releases — cover cards sorted by publication date */}
        <RecentlyAddedSection
          items={displayItems}
          onBookPress={onBookPress}
          onBookLongPress={onBookLongPress}
          onViewAll={onViewAllNewReleases}
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
      </View>
    </ScrollView>
    </SkullRefreshControl>
  );
}
