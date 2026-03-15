/**
 * src/features/browse/components/ForYouTabContent.tsx
 *
 * For You tab content — personalized recommendations.
 * Sections: ActionNeeded → BecauseYouFinishedSeries → MostCollectedAuthor →
 * LibraryMoodChips → MeaningToRead → BrowseFooter
 */

import React from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSecretLibraryColors } from '@/shared/theme';
import { LibraryItem } from '@/core/types';

import { ActionNeededSection } from './ActionNeededSection';
import { BecauseYouFinishedSeriesSection } from './BecauseYouFinishedSeriesSection';
import { MostCollectedAuthorSection } from './MostCollectedAuthorSection';
import { LibraryMoodChips } from './LibraryMoodChips';
import { MeaningToReadSection } from './MeaningToReadSection';
import { BrowseFooter } from './BrowseFooter';

const BOTTOM_CLEARANCE = 180;

interface ForYouTabContentProps {
  filteredItems: LibraryItem[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onBookPress: (bookId: string) => void;
  onBookLongPress: (bookId: string) => void;
  onSeriesPress: (seriesName: string) => void;
  onAuthorPress: (authorName: string) => void;
}

export function ForYouTabContent({
  filteredItems,
  isRefreshing,
  onRefresh,
  onBookPress,
  onBookLongPress,
  onSeriesPress,
  onAuthorPress,
}: ForYouTabContentProps) {
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
      {/* Series Gap Alerts — conditional, max 2 */}
      <ActionNeededSection onSeriesPress={onSeriesPress} />

      {/* Because You Finished [Series] — spine row from completed series */}
      <BecauseYouFinishedSeriesSection
        items={filteredItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
      />

      {/* Most Collected Author — session-rotating author spine row */}
      <MostCollectedAuthorSection
        items={filteredItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
        onAuthorPress={onAuthorPress}
      />

      {/* Library Mood Chips — wrapping chips, 10+ threshold */}
      <LibraryMoodChips items={filteredItems} onBookPress={onBookPress} />

      {/* Meaning To Read — unstarted books 60+ days old */}
      <MeaningToReadSection
        items={filteredItems}
        onBookPress={onBookPress}
        onBookLongPress={onBookLongPress}
      />

      {/* Footer */}
      <BrowseFooter />
    </ScrollView>
  );
}
