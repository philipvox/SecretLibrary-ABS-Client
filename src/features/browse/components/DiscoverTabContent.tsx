/**
 * src/features/browse/components/DiscoverTabContent.tsx
 *
 * Discover tab content — mood-based exploration.
 * Sections: TopPickHero(discover) → MoodChipsRow → WhatsTheVibe →
 * RecentlyAdded(covers, "New To Library") → BrowseGrid → BrowseFooter
 */

import React from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSecretLibraryColors } from '@/shared/theme';
import { LibraryItem } from '@/core/types';

import { TopPickHero } from './TopPickHero';
import { MoodChipsRow } from './MoodChipsRow';
import { WhatsTheVibeSection } from './WhatsTheVibeSection';
import { RecentlyAddedSection } from './RecentlyAddedSection';
import { BrowseGrid } from './BrowseGrid';
import { BrowseFooter } from './BrowseFooter';
import type { FeelingChip } from '../stores/feelingChipStore';

const BOTTOM_CLEARANCE = 180;

interface DiscoverTabContentProps {
  filteredItems: LibraryItem[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onBookPress: (bookId: string) => void;
  onBookLongPress: (bookId: string) => void;
  onVibePress: (slug: string) => void;
  onBrowseItemPress: (type: 'genres' | 'narrators' | 'series' | 'duration') => void;
  onViewAllBooks: () => void;
  onMoodPress: (moodKey: FeelingChip) => void;
}

export function DiscoverTabContent({
  filteredItems,
  isRefreshing,
  onRefresh,
  onBookPress,
  onBookLongPress,
  onVibePress,
  onBrowseItemPress,
  onViewAllBooks,
  onMoodPress,
}: DiscoverTabContentProps) {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: BOTTOM_CLEARANCE + insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.gray}
        />
      }
    >
      {/* Hidden Gem Hero */}
      <TopPickHero
        items={filteredItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        variant="discover"
      />

      {/* Mood Chips — horizontal scroll, navigates to filtered results */}
      <MoodChipsRow items={filteredItems} onMoodPress={onMoodPress} />

      {/* What's The Vibe */}
      <WhatsTheVibeSection items={filteredItems} onVibePress={onVibePress} />

      {/* New To Library — covers not spines */}
      <RecentlyAddedSection
        items={filteredItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        onViewAll={onViewAllBooks}
        title="New To Library"
        displayMode="covers"
      />

      {/* Browse Grid — 4-up: Genres, Narrators, Series, Duration */}
      <BrowseGrid onItemPress={onBrowseItemPress} />

      {/* Footer */}
      <BrowseFooter />
    </ScrollView>
  );
}
