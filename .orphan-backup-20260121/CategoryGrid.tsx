/**
 * src/features/discover/components/CategoryGrid.tsx
 *
 * Simple 2-column category grid with icons - genres only, inline with homepage design
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
import { useLibraryCache, getAllGenres } from '@/core/cache';
import { scale, wp, spacing, radius, layout, useTheme } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const GAP = scale(10);
const COLUMN_WIDTH = (SCREEN_WIDTH - layout.screenPaddingH * 2 - GAP) / 2;

// Icons use text color for black/white design

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
  textColor: string;
  textTertiaryColor: string;
  bgColor: string;
}

const CategoryCard = React.memo(function CategoryCard({ category, onPress, textColor, textTertiaryColor, bgColor }: CategoryCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon name={category.icon as any} size={scale(20)} color={textColor} />
      <View style={styles.cardText}>
        <Text style={[styles.categoryName, { color: textColor }]}>{category.name}</Text>
        {category.count > 0 && (
          <Text style={[styles.categoryCount, { color: textTertiaryColor }]}>{category.count}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

export function CategoryGrid() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { isLoaded } = useLibraryCache();

  const categories = useMemo((): BrowseCategory[] => {
    if (!isLoaded) {
      return [
        { id: 'genres', name: 'Genres', icon: 'Layers', count: 0, route: 'GenresList' },
        { id: 'authors', name: 'Authors', icon: 'User', count: 0, route: 'AuthorsList' },
        { id: 'series', name: 'Series', icon: 'Library', count: 0, route: 'SeriesList' },
        { id: 'narrators', name: 'Narrators', icon: 'Mic', count: 0, route: 'NarratorsList' },
      ];
    }

    const genres = getAllGenres();

    return [
      { id: 'genres', name: 'Genres', icon: 'Layers', count: genres.length, route: 'GenresList' },
      { id: 'narrators', name: 'Narrators', icon: 'Mic', count: 0, route: 'NarratorsList' },
    ];
  }, [isLoaded]);

  const handleCategoryPress = useCallback((category: BrowseCategory) => {
    navigation.navigate(category.route);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Browse</Text>

      <View style={styles.grid}>
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onPress={() => handleCategoryPress(category)}
            textColor={colors.text.primary}
            textTertiaryColor={colors.text.tertiary}
            bgColor={colors.background.secondary}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: scale(18),
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    width: COLUMN_WIDTH,
    borderRadius: radius.card,
    paddingVertical: scale(14),
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
    fontSize: scale(14),
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: scale(12),
  },
});
