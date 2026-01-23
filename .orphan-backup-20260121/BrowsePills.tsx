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
import { scale, layout, radius, spacing, useTheme } from '@/shared/theme';

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
  textColor: string;
  textSecondaryColor: string;
  bgColor: string;
  borderColor: string;
}

const BrowsePill = React.memo(function BrowsePill({
  category,
  onPress,
  textColor,
  textSecondaryColor,
  bgColor,
  borderColor
}: PillProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: bgColor, borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Icon name={category.icon as any} size={scale(16)} color={textColor} />
      <Text style={[styles.pillText, { color: textColor }]}>{category.name}</Text>
      {category.count > 0 && (
        <View style={[styles.countBadge, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
          <Text style={[styles.countText, { color: textSecondaryColor }]}>{category.count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export function BrowsePills() {
  const navigation = useNavigation<any>();
  const { isLoaded } = useLibraryCache();
  const { colors } = useTheme();

  // Build categories with counts from cache
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
    const authors = getAllAuthors();
    const series = getAllSeries();
    const narrators = getAllNarrators();

    return [
      { id: 'genres', name: 'Genres', icon: 'Layers', count: genres.length, route: 'GenresList' },
      { id: 'authors', name: 'Authors', icon: 'User', count: authors.length, route: 'AuthorsList' },
      { id: 'series', name: 'Series', icon: 'Library', count: series.length, route: 'SeriesList' },
      { id: 'narrators', name: 'Narrators', icon: 'Mic', count: narrators.length, route: 'NarratorsList' },
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
          textColor={colors.text.primary}
          textSecondaryColor={colors.text.secondary}
          bgColor={colors.background.secondary}
          borderColor={colors.border.default}
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
    borderWidth: 1,
  },
  pillText: {
    fontSize: scale(13),
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    marginLeft: spacing.xxs,
  },
  countText: {
    fontSize: scale(11),
    fontWeight: '500',
  },
});
