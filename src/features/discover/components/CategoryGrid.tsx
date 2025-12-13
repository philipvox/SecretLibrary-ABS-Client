/**
 * src/features/discover/components/CategoryGrid.tsx
 *
 * Browse by Category grid using app design system.
 * Shows Genres, Authors, Series, and Narrators with counts.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '@/shared/components/Icon';
import { useLibraryCache, getAllAuthors, getAllSeries, getAllNarrators, getAllGenres } from '@/core/cache';
import { colors, scale, wp, spacing, radius, layout, typography } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const GAP = scale(10);
const COLUMN_WIDTH = (SCREEN_WIDTH - layout.screenPaddingH * 2 - GAP) / 2;

const COLORS = { playButton: colors.accent, textPrimary: colors.textPrimary, textTertiary: colors.textTertiary };
const DIMENSIONS = { sectionGap: layout.sectionGap, cardRadius: radius.card };
const TYPOGRAPHY = { sectionTitle: { fontSize: scale(13), fontWeight: '600' as const }, cardTitle: { fontSize: scale(14), fontWeight: '500' as const } };
const LAYOUT = { carouselPaddingHorizontal: layout.screenPaddingH, sectionHeaderMarginBottom: spacing.md };

interface BrowseCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  route: string;
}

interface CategoryCardProps {
  category: BrowseCategory;
  onPress: () => void;
}

const CategoryCard = React.memo(function CategoryCard({ category, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon name={category.icon} size={scale(22)} color={COLORS.playButton} set="ionicons" />
      <View style={styles.cardText}>
        <Text style={styles.categoryName}>{category.name}</Text>
        {category.count > 0 && (
          <Text style={styles.categoryCount}>{category.count}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

export function CategoryGrid() {
  const navigation = useNavigation<any>();
  const { isLoaded } = useLibraryCache();

  // Build categories with counts from cache
  const categories = useMemo((): BrowseCategory[] => {
    if (!isLoaded) {
      return [
        { id: 'genres', name: 'Genres', icon: 'albums-outline', count: 0, route: 'GenresList' },
        { id: 'authors', name: 'Authors', icon: 'person-outline', count: 0, route: 'AuthorsList' },
        { id: 'series', name: 'Series', icon: 'library-outline', count: 0, route: 'SeriesList' },
        { id: 'narrators', name: 'Narrators', icon: 'mic-outline', count: 0, route: 'NarratorsList' },
      ];
    }

    const genres = getAllGenres();
    const authors = getAllAuthors();
    const series = getAllSeries();
    const narrators = getAllNarrators();

    return [
      { id: 'genres', name: 'Genres', icon: 'albums-outline', count: genres.length, route: 'GenresList' },
      { id: 'authors', name: 'Authors', icon: 'person-outline', count: authors.length, route: 'AuthorsList' },
      { id: 'series', name: 'Series', icon: 'library-outline', count: series.length, route: 'SeriesList' },
      { id: 'narrators', name: 'Narrators', icon: 'mic-outline', count: narrators.length, route: 'NarratorsList' },
    ];
  }, [isLoaded]);

  const handleCategoryPress = useCallback((category: BrowseCategory) => {
    navigation.navigate(category.route);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Browse By</Text>

      <View style={styles.grid}>
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onPress={() => handleCategoryPress(category)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    marginTop: scale(8),
    marginBottom: DIMENSIONS.sectionGap,
  },
  title: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.sectionHeaderMarginBottom,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    width: COLUMN_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: DIMENSIONS.cardRadius,
    paddingVertical: scale(16),
    paddingHorizontal: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  cardText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
  },
  categoryCount: {
    fontSize: scale(13),
    color: COLORS.textTertiary,
  },
});
