/**
 * src/features/search/components/QuickBrowseGrid.tsx
 *
 * Quick Browse grid for search empty state.
 * Shows category cards for Genres, Authors, Series, Narrators, Duration.
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { Icon } from '@/shared/components/Icon';
import { useBrowseCounts } from '@/features/browse/hooks/useBrowseCounts';

export type QuickBrowseCategory = 'genres' | 'authors' | 'series' | 'narrators' | 'duration';

interface QuickBrowseGridProps {
  /** Called when a category card is pressed */
  onCategoryPress?: (category: QuickBrowseCategory) => void;
  /** Called when "Browse Page" link is pressed */
  onBrowsePagePress?: () => void;
}

interface GridItemProps {
  iconName: string;
  title: string;
  count: string;
  onPress?: () => void;
}

function GridItem({ iconName, title, count, onPress }: GridItemProps) {
  const colors = useSecretLibraryColors();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.gridItem,
        { backgroundColor: 'transparent' },
        pressed && { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : colors.cream },
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Icon name={iconName} size={24} color={colors.black} strokeWidth={1.5} />
      </View>
      <Text style={[styles.itemTitle, { color: colors.black }]}>{title}</Text>
      <Text style={[styles.itemCount, { color: colors.gray }]}>{count}</Text>
    </Pressable>
  );
}

export function QuickBrowseGrid({ onCategoryPress, onBrowsePagePress }: QuickBrowseGridProps) {
  const colors = useSecretLibraryColors();
  const counts = useBrowseCounts();

  const handleCategoryPress = useCallback(
    (category: QuickBrowseCategory) => {
      onCategoryPress?.(category);
    },
    [onCategoryPress]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.black }]}>Quick Browse</Text>
        <Pressable onPress={onBrowsePagePress}>
          <Text style={[styles.browseLink, { color: colors.gray }]}>
            Browse Page <Text style={styles.arrow}>→</Text>
          </Text>
        </Pressable>
      </View>

      {/* Grid */}
      <View style={[styles.grid, { borderColor: colors.grayLine }]}>
        {/* Row 1: Genres | Authors */}
        <View style={styles.row}>
          <GridItem
            iconName="Layers"
            title="Genres"
            count={`${counts.genreCount}`}
            onPress={() => handleCategoryPress('genres')}
          />
          <View style={[styles.verticalDivider, { backgroundColor: colors.grayLine }]} />
          <GridItem
            iconName="User"
            title="Authors"
            count={`${counts.authorCount}`}
            onPress={() => handleCategoryPress('authors')}
          />
        </View>

        <View style={[styles.horizontalDivider, { backgroundColor: colors.grayLine }]} />

        {/* Row 2: Series | Narrators */}
        <View style={styles.row}>
          <GridItem
            iconName="BarChart2"
            title="Series"
            count={`${counts.seriesCount}`}
            onPress={() => handleCategoryPress('series')}
          />
          <View style={[styles.verticalDivider, { backgroundColor: colors.grayLine }]} />
          <GridItem
            iconName="Mic"
            title="Narrators"
            count={`${counts.narratorCount}`}
            onPress={() => handleCategoryPress('narrators')}
          />
        </View>

        <View style={[styles.horizontalDivider, { backgroundColor: colors.grayLine }]} />

        {/* Row 3: Duration (single item, half width) */}
        <View style={styles.row}>
          <GridItem
            iconName="Clock"
            title="Duration"
            count={`${counts.durationRanges} ranges`}
            onPress={() => handleCategoryPress('duration')}
          />
          <View style={[styles.verticalDivider, { backgroundColor: colors.grayLine }]} />
          <View style={[styles.gridItem, { backgroundColor: 'transparent' }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0, // Full width - no horizontal padding
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16, // Header padding (grid is full width)
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(18),
    fontWeight: '600',
  },
  browseLink: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  arrow: {
    fontSize: scale(14),
  },
  grid: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  horizontalDivider: {
    height: 1,
  },
  verticalDivider: {
    width: 1,
  },
  gridItem: {
    flex: 1,
    padding: 16,
    minHeight: scale(90),
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginBottom: 12,
  },
  itemTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(14),
    marginBottom: 4,
  },
  itemCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
});

export default QuickBrowseGrid;
