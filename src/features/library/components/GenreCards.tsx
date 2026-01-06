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
import { Library, BookOpen } from 'lucide-react-native';
import { apiClient } from '@/core/api';
import { GenreWithData, getMetaCategoryForGenre } from '../constants/genreCategories';
import { colors, wp, spacing, radius, accentColors } from '@/shared/theme';
import { useColors, useIsDarkMode } from '@/shared/theme/themeStore';

const ACCENT = accentColors.red;

const SCREEN_WIDTH = wp(100);

// =============================================================================
// GenreCardLarge - For "Your Genres" section
// =============================================================================

interface GenreCardLargeProps {
  genre: GenreWithData;
  onPress: () => void;
}

export function GenreCardLarge({ genre, onPress }: GenreCardLargeProps) {
  const colors = useColors();
  const isDarkMode = useIsDarkMode();
  const metaCategory = getMetaCategoryForGenre(genre.name);
  const accentColor = metaCategory?.color || ACCENT;

  // Get up to 3 covers for the fan effect
  const covers = useMemo(() => {
    return genre.coverIds.slice(0, 3).map(id => apiClient.getItemCoverUrl(id));
  }, [genre.coverIds]);

  // Calculate card width for 2-column grid (screen width - padding - gap) / 2
  const cardWidth = (SCREEN_WIDTH - 32 - 12) / 2;

  return (
    <TouchableOpacity
      style={[
        styles.largeCard,
        {
          width: cardWidth,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Cover Fan - centered */}
      <View style={styles.coverFan}>
        {covers.length > 0 ? (
          <View style={styles.fanContainer}>
            {covers.map((url, index) => (
              <Image
                key={index}
                source={url}
                style={[
                  styles.fanCover,
                  {
                    left: index * 28,
                    zIndex: covers.length - index,
                    transform: [{ rotate: `${(index - 1) * 8}deg` }],
                  },
                ]}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </View>
        ) : (
          <View style={[styles.fanPlaceholder, { backgroundColor: accentColor + '30' }]}>
            <Library size={40} color={accentColor} strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Genre Info */}
      <Text style={[styles.largeName, { color: colors.text.primary }]} numberOfLines={1}>
        {genre.name}
      </Text>
      <Text style={[styles.largeCount, { color: colors.text.tertiary }]}>{genre.bookCount} books</Text>
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
  const colors = useColors();
  const isDarkMode = useIsDarkMode();
  const coverUrl = genre.coverIds[0]
    ? apiClient.getItemCoverUrl(genre.coverIds[0])
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.compactCard,
        { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
      ]}
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
          <View style={[styles.compactPlaceholder, { backgroundColor: colors.surface.raised }]}>
            <BookOpen size={20} color={colors.text.tertiary} strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Genre Info */}
      <View style={styles.compactInfo}>
        <Text style={[styles.compactName, { color: colors.text.primary }]} numberOfLines={1}>
          {genre.name}
        </Text>
      </View>

      {/* Book Count */}
      <Text style={[styles.compactCount, { color: colors.text.tertiary }]}>{genre.bookCount}</Text>
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
  const colors = useColors();
  const coverUrl = genre.coverIds[0]
    ? apiClient.getItemCoverUrl(genre.coverIds[0])
    : null;

  return (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: colors.border.default }]}
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
          <View style={[styles.listCoverPlaceholder, { backgroundColor: colors.surface.raised }]}>
            <BookOpen size={16} color={colors.text.tertiary} strokeWidth={1.5} />
          </View>
        )}
      </View>
      <Text style={[styles.listName, { color: colors.text.primary }]} numberOfLines={2}>
        {genre.name}
      </Text>
      <Text style={[styles.listCount, { color: colors.text.tertiary }]}>{genre.bookCount}</Text>
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
  const colors = useColors();
  const isDarkMode = useIsDarkMode();
  const metaCategory = getMetaCategoryForGenre(genre.name);
  const accentColor = metaCategory?.color || ACCENT;

  // Get up to 2 covers
  const covers = useMemo(() => {
    return genre.coverIds.slice(0, 2).map(id => apiClient.getItemCoverUrl(id));
  }, [genre.coverIds]);

  return (
    <TouchableOpacity
      style={[
        styles.popularCard,
        {
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderColor: accentColor + '40'
        }
      ]}
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
            <Library size={24} color={accentColor} strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.popularInfo}>
        <Text style={[styles.popularName, { color: colors.text.primary }]} numberOfLines={1}>
          {genre.name}
        </Text>
        <Text style={[styles.popularCount, { color: colors.text.tertiary }]}>{genre.bookCount} books</Text>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Large Card Styles (Your Genres) - 2-column grid
  largeCard: {
    // width calculated dynamically in component
    padding: spacing.md,
    // backgroundColor set via themeColors in JSX
    borderRadius: radius.lg,
  },
  coverFan: {
    height: 95,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanContainer: {
    position: 'relative',
    width: 120,
    height: 95,
  },
  fanCover: {
    position: 'absolute',
    width: 65,
    height: 95,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  fanPlaceholder: {
    width: 65,
    height: 95,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeName: {
    fontSize: 16,
    fontWeight: '600',
    // color set via themeColors in JSX
    marginBottom: spacing.xxs,
    textAlign: 'center',
  },
  largeCount: {
    fontSize: 13,
    // color set via themeColors in JSX
    textAlign: 'center',
  },

  // Compact Card Styles (Within Meta-categories)
  compactCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    // backgroundColor set via themeColors in JSX
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
    // backgroundColor set via themeColors in JSX
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
    // color set via themeColors in JSX
  },
  compactCount: {
    fontSize: 12,
    // color set via themeColors in JSX
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
    // borderBottomColor set via themeColors in JSX
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
    // backgroundColor set via themeColors in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  listName: {
    flex: 1,
    fontSize: 15,
    // color set via themeColors in JSX
    marginRight: spacing.sm,
    lineHeight: 20,
  },
  listCount: {
    fontSize: 14,
    // color set via themeColors in JSX
  },

  // Popular Card Styles
  popularCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    padding: spacing.md,
    // backgroundColor set via themeColors in JSX
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
    // color set via themeColors in JSX
  },
  popularCount: {
    fontSize: 12,
    // color set via themeColors in JSX
  },
});
