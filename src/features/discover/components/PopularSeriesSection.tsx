/**
 * src/features/discover/components/PopularSeriesSection.tsx
 *
 * Horizontal carousel of popular series with stacked book covers
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { getAllSeries, useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { colors, scale, spacing, radius, layout } from '@/shared/theme';

const COLORS = { playButton: colors.accent, textPrimary: colors.textPrimary, textTertiary: colors.textTertiary };
const DIMENSIONS = { sectionGap: layout.sectionGap, cardRadius: radius.card };
const TYPOGRAPHY = { sectionTitle: { fontSize: scale(13), fontWeight: '600' as const }, cardTitle: { fontSize: scale(14), fontWeight: '500' as const } };
const LAYOUT = { carouselPaddingHorizontal: layout.screenPaddingH, sectionHeaderMarginBottom: spacing.md };

const CARD_WIDTH = scale(160);
const COVER_SIZE = scale(100);
const STACK_OFFSET = scale(8);

interface SeriesCardProps {
  series: {
    name: string;
    bookCount: number;
    books: any[];
  };
  onPress: () => void;
}

const SeriesCard = React.memo(function SeriesCard({ series, onPress }: SeriesCardProps) {
  // Get cover URLs for up to 3 books for the stacked effect
  const coverUrls = useMemo(() => {
    return series.books.slice(0, 3).map(book => apiClient.getItemCoverUrl(book.id));
  }, [series.books]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Stacked covers */}
      <View style={styles.stackContainer}>
        {coverUrls.slice().reverse().map((url, index) => {
          const reverseIndex = coverUrls.length - 1 - index;
          return (
            <View
              key={index}
              style={[
                styles.coverWrapper,
                {
                  zIndex: reverseIndex,
                  marginLeft: reverseIndex * STACK_OFFSET,
                  marginTop: reverseIndex * STACK_OFFSET,
                },
              ]}
            >
              <Image
                source={url}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />
            </View>
          );
        })}
      </View>

      {/* Series info */}
      <Text style={styles.seriesName} numberOfLines={2}>
        {series.name}
      </Text>
      <Text style={styles.bookCount}>
        {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
      </Text>
    </TouchableOpacity>
  );
});

interface PopularSeriesSectionProps {
  limit?: number;
}

export function PopularSeriesSection({ limit = 10 }: PopularSeriesSectionProps) {
  const navigation = useNavigation<any>();
  const { isLoaded } = useLibraryCache();

  // Get popular series (sorted by book count)
  const popularSeries = useMemo(() => {
    if (!isLoaded) return [];
    const allSeries = getAllSeries();
    // Filter series with at least 2 books and sort by book count
    return allSeries
      .filter(s => s.bookCount >= 2)
      .slice(0, limit);
  }, [isLoaded, limit]);

  const handleViewAll = useCallback(() => {
    navigation.navigate('SeriesList');
  }, [navigation]);

  const handleSeriesPress = useCallback((seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: typeof popularSeries[0] }) => (
    <SeriesCard
      series={item}
      onPress={() => handleSeriesPress(item.name)}
    />
  ), [handleSeriesPress]);

  const keyExtractor = useCallback((item: typeof popularSeries[0]) => item.name, []);

  if (!isLoaded || popularSeries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Popular Series</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={handleViewAll}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Icon name="chevron-forward" size={scale(14)} color={COLORS.playButton} set="ionicons" />
        </TouchableOpacity>
      </View>

      {/* Horizontal carousel */}
      <FlatList
        data={popularSeries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: scale(8),
    marginBottom: DIMENSIONS.sectionGap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    marginBottom: LAYOUT.sectionHeaderMarginBottom,
  },
  title: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.textPrimary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  viewAllText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: COLORS.playButton,
  },
  listContent: {
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    gap: scale(14),
  },
  card: {
    width: CARD_WIDTH,
  },
  stackContainer: {
    height: COVER_SIZE + STACK_OFFSET * 2,
    width: COVER_SIZE + STACK_OFFSET * 2,
    marginBottom: scale(10),
  },
  coverWrapper: {
    position: 'absolute',
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: DIMENSIONS.cardRadius,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  seriesName: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
    marginBottom: scale(2),
  },
  bookCount: {
    fontSize: scale(12),
    color: COLORS.textTertiary,
  },
});
