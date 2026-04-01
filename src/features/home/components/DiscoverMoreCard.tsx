/**
 * src/features/home/components/DiscoverMoreCard.tsx
 *
 * "Find More Books" card at the end of the bookshelf.
 *
 * Approach: Render spines in a normal horizontal row (like the bookshelf),
 * then rotate the entire row -90° to lay the stack on its side.
 * Both server and procedural spines render in their natural vertical
 * orientation — no per-spine rotation math needed.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import {
  secretLibraryColors as staticColors,
  secretLibraryFonts,
} from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { BookSpineVertical, BookSpineVerticalData } from './BookSpineVertical';
import { calculateBookDimensions, getSpineDimensions, isLightColor, darkenColorForDisplay } from '../utils/spine/adapter';
import { useSpineCacheStore } from '../stores/spineCache';
import { useLibraryCache } from '@/core/cache';

// =============================================================================
// TYPES
// =============================================================================

export interface RecommendedBook {
  id: string;
  title: string;
  author: string;
  genres?: string[];
  tags?: string[];
  duration?: number;
}

interface DiscoverMoreCardProps {
  recommendations: RecommendedBook[];
  onPress: () => void;
  onBookPress?: (book: RecommendedBook) => void;
  height?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CARD_MARGIN = 12;

// =============================================================================
// SPINE ITEM (renders in natural vertical orientation)
// =============================================================================

interface SpineItemProps {
  book: RecommendedBook;
  spineWidth: number;
  spineHeight: number;
  onPress?: (book: RecommendedBook) => void;
}

function SpineItem({ book, spineWidth, spineHeight, onPress }: SpineItemProps) {
  const getSpineData = useSpineCacheStore((s) => s.getSpineData);
  const colorVersion = useSpineCacheStore((s) => s.colorVersion);

  const spineData: BookSpineVerticalData = useMemo(() => {
    const cached = getSpineData(book.id);
    if (cached) {
      let bgColor = cached.backgroundColor;
      let txtColor = cached.textColor;
      if (bgColor && isLightColor(bgColor)) {
        bgColor = darkenColorForDisplay(bgColor);
        txtColor = staticColors.white;
      }
      return {
        id: book.id,
        title: cached.title || book.title,
        author: cached.author || book.author,
        genres: cached.genres || book.genres,
        tags: cached.tags || book.tags,
        duration: cached.duration || book.duration,
        seriesName: cached.seriesName,
        backgroundColor: bgColor,
        textColor: txtColor,
      };
    }
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      genres: book.genres,
      tags: book.tags,
      duration: book.duration,
      backgroundColor: '#1a1a1a',
      textColor: '#FFFFFF',
    };
  }, [book, getSpineData, colorVersion]);

  const handlePress = useCallback(() => {
    onPress?.(book);
  }, [book, onPress]);

  return (
    <BookSpineVertical
      book={spineData}
      width={spineWidth}
      height={spineHeight}
      leanAngle={0}
      isActive={false}
      showShadow={false}
      onPress={handlePress}
      isHorizontalDisplay
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscoverMoreCard({
  recommendations,
  onPress,
  onBookPress,
}: DiscoverMoreCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  // The row height (spine height) becomes on-screen width after rotation.
  // On web, cap to a reasonable card size so spines don't stretch across
  // the entire desktop viewport.
  const effectiveWidth = Platform.OS === 'web' ? Math.min(screenWidth, 500) : screenWidth;
  const SPINE_HEIGHT = effectiveWidth - CARD_MARGIN * 2;
  const colors = useSecretLibraryColors();
  const useServerSpines = useSpineCacheStore((s) => s.useServerSpines);
  const useCommunitySpines = useSpineCacheStore((s) => s.useCommunitySpines);
  const serverSpineDimensions = useSpineCacheStore((s) => s.serverSpineDimensions);
  const _spineDimVersion = useSpineCacheStore((s) => s.serverSpineDimensionsVersion);
  const booksWithServerSpines = useLibraryCache((s) => s.booksWithServerSpines);
  const booksWithCommunitySpines = useLibraryCache((s) => s.booksWithCommunitySpines);

  const handleDiscoverPress = useCallback(() => {
    haptics.buttonPress();
    onPress();
  }, [onPress]);

  const handleBookPress = useCallback((book: RecommendedBook) => {
    haptics.buttonPress();
    onBookPress?.(book);
  }, [onBookPress]);

  const booksToShow = recommendations.slice(0, 3);

  // Pre-calculate dimensions for all spines with a common scale factor.
  // For server spines, use actual image dimensions so the layout matches
  // what BookSpineVertical will actually render (avoiding gaps).
  const spineLayouts = useMemo(() => {
    const rawDims = booksToShow.map((book) => {
      const genres = book.genres || [];
      const tags = book.tags || [];
      const duration = book.duration || 6 * 60 * 60;
      const hasGenreData = genres.length > 0 || tags.length > 0;

      let procW: number;
      let procH: number;
      if (hasGenreData) {
        const calc = calculateBookDimensions({ id: book.id, genres, tags, duration });
        procW = calc.width;
        procH = calc.height;
      } else {
        const dims = getSpineDimensions(book.id, genres, duration);
        procW = dims.width;
        procH = dims.height;
      }

      return { width: procW, height: procH };
    });

    const maxH = Math.max(...rawDims.map((d) => d.height));
    const sf = SPINE_HEIGHT / maxH;

    return rawDims.map((d, i) => {
      const propW = Math.round(d.width * sf);
      const propH = Math.round(d.height * sf);

      // If this book has a server spine with cached dimensions,
      // compute the actual width BookSpineVertical will render
      const bookId = booksToShow[i].id;
      const hasSpineImage = (useServerSpines && booksWithServerSpines.has(bookId)) ||
        (useCommunitySpines && booksWithCommunitySpines.has(bookId));
      const cached = serverSpineDimensions[bookId];
      if (hasSpineImage && cached && (Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000)) {
        const sFit = Math.min(propW / cached.width, propH / cached.height);
        return {
          width: Math.round(cached.width * sFit),
          height: Math.round(cached.height * sFit),
        };
      }

      return { width: propW, height: propH };
    });
  }, [booksToShow, useServerSpines, useCommunitySpines, booksWithServerSpines, booksWithCommunitySpines, serverSpineDimensions, _spineDimVersion, SPINE_HEIGHT]);

  const SPINE_GAP = 5;
  const totalRowWidth = useMemo(
    () => spineLayouts.reduce((sum, l) => sum + l.width, 0) + SPINE_GAP * (booksToShow.length - 1),
    [spineLayouts, booksToShow.length],
  );

  // After -90° rotation:
  // - Row width (totalRowWidth) becomes on-screen height
  // - Row height (SPINE_HEIGHT) becomes on-screen width
  const displayW = SPINE_HEIGHT;
  const displayH = totalRowWidth;

  const offsetX = (displayW - totalRowWidth) / 2;
  const offsetY = (displayH - SPINE_HEIGHT) / 2;

  return (
    <View style={styles.container}>
      <Pressable style={styles.titleSection} onPress={handleDiscoverPress} accessibilityLabel="Discover more books" accessibilityRole="button">
        <Text style={[styles.title, { color: colors.black }]}>Discover</Text>
        <Text style={[styles.titleItalic, { color: colors.black }]}>More →</Text>
        <Text style={[styles.subtitle, { color: colors.black }]}>add books to your My Library playlist{'\n'}and watch your bookshelf grow</Text>
      </Pressable>

      {/* Container sized to post-rotation dimensions */}
      <View style={{ width: displayW, height: displayH, overflow: 'hidden' }}>
        {/* Horizontal row of spines, rotated -90° as a unit */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 5,
            width: totalRowWidth,
            height: SPINE_HEIGHT,
            transform: [
              { translateX: offsetX },
              { translateY: offsetY },
              { rotate: '-90deg' },
            ],
          }}
        >
          {booksToShow.map((book, i) => (
            <SpineItem
              key={book.id}
              book={book}
              spineWidth={spineLayouts[i].width}
              spineHeight={spineLayouts[i].height}
              onPress={handleBookPress}
            />
          )).reverse()}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    marginLeft: CARD_MARGIN,
    alignSelf: 'stretch',
  },
  titleSection: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.semiBold,
    fontSize: scale(56),
    color: staticColors.black,
    lineHeight: scale(54),
    textAlign: 'left',
  },
  titleItalic: {
    fontFamily: secretLibraryFonts.playfair.semiBold,
    fontStyle: 'italic',
    fontSize: scale(56),
    color: staticColors.black,
    lineHeight: scale(54),
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(14),
    opacity: 0.5,
    marginTop: scale(4),
    textAlign: 'left',
  },
});

export default DiscoverMoreCard;
