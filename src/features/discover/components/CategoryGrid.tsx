/**
 * src/features/discover/components/CategoryGrid.tsx
 *
 * Browse by Category grid using app design system.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '@/shared/components/Icon';
import { COLORS, DIMENSIONS, TYPOGRAPHY, LAYOUT } from '@/features/home/homeDesign';
import { Category, DEFAULT_CATEGORIES } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

const GAP = scale(10);
const COLUMN_WIDTH = (SCREEN_WIDTH - LAYOUT.carouselPaddingHorizontal * 2 - GAP) / 2;

interface CategoryCardProps {
  category: Category;
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
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );
});

interface CategoryGridProps {
  categories?: Category[];
  onCategoryPress?: (category: Category) => void;
}

export function CategoryGrid({
  categories = DEFAULT_CATEGORIES,
  onCategoryPress,
}: CategoryGridProps) {
  const navigation = useNavigation<any>();

  const handleCategoryPress = useCallback((category: Category) => {
    if (onCategoryPress) {
      onCategoryPress(category);
    } else {
      navigation.navigate('GenresList');
    }
  }, [navigation, onCategoryPress]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Browse by Category</Text>

      <View style={styles.grid}>
        {categories.slice(0, 6).map((category) => (
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
    alignItems: 'center',
    gap: scale(8),
  },
  categoryName: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
  },
});
