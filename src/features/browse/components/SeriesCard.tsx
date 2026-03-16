/**
 * src/features/browse/components/SeriesCard.tsx
 *
 * Reusable series card component for browse pages.
 * Single source of truth for series card styling across the app.
 *
 * Variants:
 * - light: White/cream background (default)
 * - dark: Black background
 *
 * Layouts:
 * - list: Full-width with title + author left, mini spines right
 * - grid: Compact square with spines on separate row
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { hashString, SPINE_COLOR_PALETTE } from '@/shared/spine';
import { getSpineUrl } from '@/core/cache';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { SeriesHeartButton } from '@/shared/components/SeriesHeartButton';
import { fitToBoundingBox } from '@/features/home/utils/spine/core/dimensions';


// Re-export for backwards compatibility
export const SERIES_DOT_COLORS = SPINE_COLOR_PALETTE;

// Get deterministic color for a book based on its ID
export function getBookDotColor(bookId: string): string {
  const hash = hashString(bookId);
  return SPINE_COLOR_PALETTE[hash % SPINE_COLOR_PALETTE.length];
}

// Get color dots for a series based on book IDs
export function getSeriesColorDots(bookIds: string[], maxDots = 8): string[] {
  return bookIds.slice(0, maxDots).map(getBookDotColor);
}

// Max height for mini spines in series cards
const MINI_SPINE_MAX_HEIGHT = scale(108);
const MINI_SPINE_MAX_WIDTH = scale(36);
// Fallback aspect ratio when server dimensions aren't cached
const DEFAULT_SPINE_WIDTH = 80;
const DEFAULT_SPINE_HEIGHT = 1200;
// Max combined width for all spines - roughly half the screen minus padding
const SPINE_GAP = 1;
const MAX_SPINES_TOTAL_WIDTH = Math.round(Dimensions.get('window').width * 0.5);

export type SeriesCardVariant = 'light' | 'dark';
export type SeriesCardLayout = 'list' | 'grid';

export interface SeriesCardProps {
  /** Series name */
  name: string;
  /** Author name */
  author: string;
  /** Number of books in series */
  bookCount: number;
  /** Book IDs for generating color dots */
  bookIds: string[];
  /** Visual variant */
  variant?: SeriesCardVariant;
  /** Layout mode */
  layout?: SeriesCardLayout;
  /** Maximum spines to show */
  maxDots?: number;
  /** Called when card is pressed */
  onPress?: () => void;
}

interface SpineItem {
  id: string;
  url: string;
  color: string;
  width: number;
  height: number;
}

export function SeriesCard({
  name,
  author,
  bookCount,
  bookIds,
  _variant = 'light',
  layout = 'list',
  maxDots = 12,
  onPress,
}: SeriesCardProps) {
  // Theme-aware colors
  const colors = useSecretLibraryColors();

  // Read server spine dimensions from cache (same source as home page)
  const serverDims = useSpineCacheStore((s) => s.serverSpineDimensions);

  // Build spine items with proportional dimensions (same logic as BookshelfView)
  // Cull spines if combined width exceeds max
  const spines: SpineItem[] = useMemo(() => {
    const result: SpineItem[] = [];
    let totalWidth = 0;
    const ids = bookIds.slice(0, maxDots);

    for (const id of ids) {
      const cached = serverDims[id];
      const srcW = cached?.width ?? DEFAULT_SPINE_WIDTH;
      const srcH = cached?.height ?? DEFAULT_SPINE_HEIGHT;

      const { width, height } = fitToBoundingBox(
        srcW, srcH, MINI_SPINE_MAX_WIDTH, MINI_SPINE_MAX_HEIGHT
      );

      const nextTotal = totalWidth + width + (result.length > 0 ? SPINE_GAP : 0);
      if (nextTotal > MAX_SPINES_TOTAL_WIDTH) break;

      totalWidth = nextTotal;
      result.push({
        id,
        url: getSpineUrl(id),
        color: getBookDotColor(id),
        width,
        height,
      });
    }

    return result;
  }, [bookIds, maxDots, serverDims]);

  const isGrid = layout === 'grid';

  if (isGrid) {
    return (
      <Pressable
        style={[styles.card, styles.cardGrid, { backgroundColor: colors.white }]}
        onPress={onPress}
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.black }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.author, { color: colors.gray }]} numberOfLines={1}>
            {author}
          </Text>
          <Text style={[styles.count, { color: colors.gray }]}>{bookCount}</Text>
        </View>
        <View style={styles.gridSpinesRow}>
          {spines.map(({ id, url, color, width, height }) => (
            <View key={id} style={[styles.spineBase, { backgroundColor: color, width, height }]}>
              <Image
                source={{ uri: url }}
                style={styles.spineImage}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            </View>
          ))}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.white }]}
      onPress={onPress}
    >
      <View style={styles.listRow}>
        {/* Left: Title + Author stacked */}
        <View style={styles.listLeft}>
          <Text style={[styles.title, { color: colors.black }]} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.authorRow}>
            <Text style={[styles.author, { color: colors.gray }]} numberOfLines={1}>
              {author}
            </Text>
            <Text style={[styles.countInline, { color: colors.gray }]}>
              {' \u00B7 '}{bookCount}
            </Text>
          </View>
          <View style={styles.heartRow}>
            <SeriesHeartButton
              seriesName={name}
              size={14}
              activeColor={colors.gold}
              inactiveColor={colors.gray}
            />
          </View>
        </View>

        {/* Right: Spines with proportional widths, aligned to bottom */}
        <View style={styles.spinesContainer}>
          {spines.map(({ id, url, color, width, height }) => (
            <View key={id} style={[styles.spineBase, { backgroundColor: color, width, height }]}>
              <Image
                source={{ uri: url }}
                style={styles.spineImage}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  cardGrid: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  // List layout: horizontal row with left text + right spines
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listLeft: {
    flex: 1,
    marginRight: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  // Grid layout rows
  topRow: {
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(17),
    lineHeight: scale(17) * 1.3,
  },
  count: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countInline: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    letterSpacing: 0.5,
  },
  author: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flexShrink: 1,
  },
  heartRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  spinesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  spineBase: {
    borderRadius: 1,
    overflow: 'hidden',
  },
  spineImage: {
    width: '100%',
    height: '100%',
  },
  gridSpinesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    marginTop: 10,
  },
});
