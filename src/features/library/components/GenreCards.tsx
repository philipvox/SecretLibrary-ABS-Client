/**
 * src/features/library/components/GenreCards.tsx
 *
 * Genre card components in multiple variants:
 * - GenreCardLarge: For "Your Genres" section (150×120)
 * - GenreCardCompact: For within meta-categories (half-width×60)
 * - GenreListItem: For A-Z flat view (text-primary)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/core/api';
import { GenreWithData, getMetaCategoryForGenre } from '../constants/genreCategories';
import { colors, wp, spacing, radius } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

// =============================================================================
// GenreCardLarge - For "Your Genres" section
// =============================================================================

interface GenreCardLargeProps {
  genre: GenreWithData;
  onPress: () => void;
}

export function GenreCardLarge({ genre, onPress }: GenreCardLargeProps) {
  const metaCategory = getMetaCategoryForGenre(genre.name);
  const accentColor = metaCategory?.color || colors.accent;

  // Get up to 3 covers for the fan effect
  const covers = useMemo(() => {
    return genre.coverIds.slice(0, 3).map(id => apiClient.getItemCoverUrl(id));
  }, [genre.coverIds]);

  return (
    <TouchableOpacity
      style={styles.largeCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Cover Fan */}
      <View style={styles.coverFan}>
        {covers.length > 0 ? (
          covers.map((url, index) => (
            <Image
              key={index}
              source={url}
              style={[
                styles.fanCover,
                {
                  left: index * 20,
                  zIndex: covers.length - index,
                  transform: [{ rotate: `${(index - 1) * 5}deg` }],
                },
              ]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))
        ) : (
          <View style={[styles.fanPlaceholder, { backgroundColor: accentColor + '30' }]}>
            <Ionicons name="library-outline" size={32} color={accentColor} />
          </View>
        )}
      </View>

      {/* Genre Info */}
      <Text style={styles.largeName} numberOfLines={1}>
        {genre.name}
      </Text>
      <Text style={styles.largeCount}>{genre.bookCount} books</Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// GenreCardCompact - For within meta-categories
// =============================================================================

interface GenreCardCompactProps {
  genre: GenreWithData;
  onPress: () => void;
}

export function GenreCardCompact({ genre, onPress }: GenreCardCompactProps) {
  const coverUrl = genre.coverIds[0]
    ? apiClient.getItemCoverUrl(genre.coverIds[0])
    : null;

  return (
    <TouchableOpacity
      style={styles.compactCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Single Cover */}
      <View style={styles.compactCoverContainer}>
        {coverUrl ? (
          <Image
            source={coverUrl}
            style={styles.compactCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.compactPlaceholder}>
            <Ionicons name="book-outline" size={20} color="rgba(255,255,255,0.3)" />
          </View>
        )}
      </View>

      {/* Genre Info */}
      <View style={styles.compactInfo}>
        <Text style={styles.compactName} numberOfLines={1}>
          {genre.name}
        </Text>
      </View>

      {/* Book Count */}
      <Text style={styles.compactCount}>{genre.bookCount}</Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// GenreListItem - For A-Z flat view with tiny fanned covers
// =============================================================================

interface GenreListItemProps {
  genre: GenreWithData;
  onPress: () => void;
}

export function GenreListItem({ genre, onPress }: GenreListItemProps) {
  const coverUrl = genre.coverIds[0]
    ? apiClient.getItemCoverUrl(genre.coverIds[0])
    : null;

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Single Cover */}
      <View style={styles.listCoverContainer}>
        {coverUrl ? (
          <Image
            source={coverUrl}
            style={styles.listCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.listCoverPlaceholder}>
            <Ionicons name="book-outline" size={16} color="rgba(255,255,255,0.3)" />
          </View>
        )}
      </View>
      <Text style={styles.listName} numberOfLines={2}>
        {genre.name}
      </Text>
      <Text style={styles.listCount}>{genre.bookCount}</Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// PopularGenreCard - Medium size for popular section
// =============================================================================

interface PopularGenreCardProps {
  genre: GenreWithData;
  onPress: () => void;
}

export function PopularGenreCard({ genre, onPress }: PopularGenreCardProps) {
  const metaCategory = getMetaCategoryForGenre(genre.name);
  const accentColor = metaCategory?.color || colors.accent;

  // Get up to 2 covers
  const covers = useMemo(() => {
    return genre.coverIds.slice(0, 2).map(id => apiClient.getItemCoverUrl(id));
  }, [genre.coverIds]);

  return (
    <TouchableOpacity
      style={[styles.popularCard, { borderColor: accentColor + '40' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Stacked Covers */}
      <View style={styles.popularCovers}>
        {covers.length > 0 ? (
          covers.map((url, index) => (
            <Image
              key={index}
              source={url}
              style={[
                styles.popularCover,
                { left: index * 12, zIndex: covers.length - index },
              ]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))
        ) : (
          <View style={[styles.popularPlaceholder, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name="library-outline" size={24} color={accentColor} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.popularInfo}>
        <Text style={styles.popularName} numberOfLines={1}>
          {genre.name}
        </Text>
        <Text style={styles.popularCount}>{genre.bookCount} books</Text>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Large Card Styles (Your Genres)
  largeCard: {
    width: 150,
    marginRight: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
  },
  coverFan: {
    height: 70,
    marginBottom: 12,
    position: 'relative',
  },
  fanCover: {
    position: 'absolute',
    width: 50,
    height: 70,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fanPlaceholder: {
    width: 50,
    height: 70,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  largeCount: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Compact Card Styles (Within Meta-categories)
  compactCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  compactCoverContainer: {
    width: 40,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  compactCover: {
    width: '100%',
    height: '100%',
  },
  compactPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  compactName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  compactCount: {
    fontSize: 12,
    color: colors.textMuted,
    minWidth: 30,
    textAlign: 'right',
  },

  // List Item Styles (A-Z View)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: 36, // Extra space for alphabet index
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  listCoverContainer: {
    width: 32,
    height: 44,
    marginRight: spacing.md,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  listCover: {
    width: '100%',
    height: '100%',
  },
  listCoverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listName: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    marginRight: spacing.sm,
    lineHeight: 20,
  },
  listCount: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Popular Card Styles
  popularCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  popularCovers: {
    height: 56,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  popularCover: {
    position: 'absolute',
    width: 40,
    height: 56,
    borderRadius: radius.xs,
  },
  popularPlaceholder: {
    width: 40,
    height: 56,
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularInfo: {
    gap: spacing.xxs,
  },
  popularName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  popularCount: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
