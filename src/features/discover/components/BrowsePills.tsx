/**
 * src/features/discover/components/BrowsePills.tsx
 *
 * Navigation pills for quick access to browse categories.
 * Shows Genres, Authors, Series, Narrators with counts.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/shared/components/Icon';
import { useLibraryCache, getAllAuthors, getAllSeries, getAllNarrators, getAllGenres } from '@/core/cache';
import { colors, scale, layout, radius, spacing } from '@/shared/theme';

interface BrowseCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  route: string;
}

interface PillProps {
  category: BrowseCategory;
  onPress: () => void;
}

const BrowsePill = React.memo(function BrowsePill({ category, onPress }: PillProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Icon name={category.icon} size={scale(16)} color={colors.accent} set="ionicons" />
      <Text style={styles.pillText}>{category.name}</Text>
      {category.count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{category.count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export function BrowsePills() {
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {categories.map((category) => (
        <BrowsePill
          key={category.id}
          category={category}
          onPress={() => handleCategoryPress(category)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    marginBottom: spacing.sm,
  },
  container: {
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: scale(14),
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pillText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    marginLeft: spacing.xxs,
  },
  countText: {
    fontSize: scale(11),
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
