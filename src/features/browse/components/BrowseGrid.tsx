/**
 * src/features/browse/components/BrowseGrid.tsx
 *
 * 2x2 grid of browse categories.
 * Matches the search page's browse recovery card design.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useBrowseCounts } from '../hooks/useBrowseCounts';
import { BrowseGridItem, BrowseItemType } from './BrowseGridItem';
import { scale } from '@/shared/theme';
import { SectionHeader } from './SectionHeader';

interface BrowseGridProps {
  onItemPress?: (type: BrowseItemType) => void;
}

export function BrowseGrid({ onItemPress }: BrowseGridProps) {
  const counts = useBrowseCounts();

  const handleItemPress = useCallback(
    (type: BrowseItemType) => {
      onItemPress?.(type);
    },
    [onItemPress]
  );

  return (
    <View style={styles.container}>
      <SectionHeader label="Browse" />

      {/* Single row grid */}
      <View style={styles.row}>
        <BrowseGridItem
          type="genres"
          title="Genres"
          count={`${counts.genreCount}`}
          iconName="Sparkles"
          onPress={() => handleItemPress('genres')}
        />
        <BrowseGridItem
          type="narrators"
          title="Narrators"
          count={`${counts.narratorCount}`}
          iconName="CircleUser"
          onPress={() => handleItemPress('narrators')}
        />
        <BrowseGridItem
          type="series"
          title="Series"
          count={`${counts.seriesCount}`}
          iconName="Library"
          onPress={() => handleItemPress('series')}
        />
        <BrowseGridItem
          type="duration"
          title="Duration"
          count={`${counts.durationRanges}`}
          iconName="Timer"
          onPress={() => handleItemPress('duration')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: scale(8),
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
