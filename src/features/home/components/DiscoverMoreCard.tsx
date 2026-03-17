/**
 * src/features/home/components/DiscoverMoreCard.tsx
 *
 * "Find More Books" card that appears at the end of the bookshelf.
 * Shows 3 recommended book spines (rotated 90°) stacked horizontally with a CTA.
 *
 * Design: Matches Secret Library aesthetic with:
 * - Playfair Display title directly above horizontal spines
 * - Actual BookSpineVertical components rotated 90° and scaled down
 * - Aligns to bottom of shelf like other books
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  secretLibraryColors as staticColors,
  secretLibraryFonts,
} from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { BookSpineVertical, BookSpineVerticalData } from './BookSpineVertical';
// MIGRATED: Now using new spine system via adapter
import { calculateBookDimensions, getSpineDimensions, isLightColor, darkenColorForDisplay } from '../utils/spine/adapter';
import { PROCEDURAL_SPINE_BOX } from '../utils/spine/constants';
import { fitToBoundingBox } from '../utils/spine/core/dimensions';
import { useSpineCacheStore } from '../stores/spineCache';

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
  /** 3 recommended books to show as horizontal spines */
  recommendations: RecommendedBook[];
  /** Callback when "Find More" is pressed */
  onPress: () => void;
  /** Callback when a book spine is pressed */
  onBookPress?: (book: RecommendedBook) => void;
  /** Height to match bookshelf spines */
  height?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SPINE_GAP = 0;

// Card-specific scale — spines in the Discover card are smaller than shelf spines
const CARD_SCALE = 0.6;
const CARD_MAX_W = PROCEDURAL_SPINE_BOX.MAX_WIDTH * CARD_SCALE;
const CARD_MAX_H = PROCEDURAL_SPINE_BOX.MAX_HEIGHT * CARD_SCALE;

// Card dimensions — wide enough for the largest rotated spines
const CARD_WIDTH = 365;

// =============================================================================
// HORIZONTAL SPINE WRAPPER
// =============================================================================

interface HorizontalSpineWrapperProps {
  book: RecommendedBook;
  onPress?: (book: RecommendedBook) => void;
}

function HorizontalSpineWrapper({ book, onPress }: HorizontalSpineWrapperProps) {
  // Get spine cache for consistent styling with shelf view
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);
  // Subscribe to colorVersion to trigger re-render when colors are extracted
  const colorVersion = useSpineCacheStore((state) => state.colorVersion);

  // Convert RecommendedBook to BookSpineVerticalData, enriched with cached colors/typography
  const spineData: BookSpineVerticalData = useMemo(() => {
    const cached = getSpineData(book.id);

    if (cached) {
      // Use cached data for consistent styling with shelf view
      // Apply same darkening logic as BookshelfView
      let bgColor = cached.backgroundColor;
      let txtColor = cached.textColor;

      if (isLightColor(bgColor)) {
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

    // Fallback: use Secret Library default styling (dark background with light text/stroke)
    // This ensures consistent appearance even when spine colors haven't been extracted yet
    // Matches the dark spine aesthetic with white borders seen in the main bookshelf
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      genres: book.genres,
      tags: book.tags,
      duration: book.duration,
      backgroundColor: '#1a1a1a',  // Dark background (matches shelf spines)
      textColor: '#FFFFFF',        // White text and border
    };
  }, [book, getSpineData, colorVersion]);

  // Calculate dimensions based on book's metadata (genre, duration)
  // Uses bounding-box fit to preserve aspect ratio at card scale
  const spineDimensions = useMemo(() => {
    const genres = book.genres || [];
    const tags = book.tags || [];
    const duration = book.duration || 6 * 60 * 60; // Default 6 hours
    const hasGenreData = genres.length > 0 || tags.length > 0;

    let canonicalWidth: number;
    let canonicalHeight: number;

    if (hasGenreData) {
      const calculated = calculateBookDimensions({
        id: book.id,
        genres,
        tags,
        duration,
      });
      canonicalWidth = calculated.width;
      canonicalHeight = calculated.height;
    } else {
      const baseDims = getSpineDimensions(book.id, genres, duration);
      canonicalWidth = baseDims.width;
      canonicalHeight = baseDims.height;
    }

    const { width, height } = fitToBoundingBox(canonicalWidth, canonicalHeight, CARD_MAX_W, CARD_MAX_H);
    return { width, height };
  }, [book.id, book.genres, book.tags, book.duration]);

  // Container dimensions = swapped spine dimensions (rotated 90°)
  // After rotation: height becomes width, width becomes height
  const containerWidth = spineDimensions.height;
  const containerHeight = spineDimensions.width;

  // Handle press on the spine
  const handlePress = useCallback(() => {
    onPress?.(book);
  }, [book, onPress]);

  return (
    <View style={[styles.spineWrapper, { width: containerWidth, height: containerHeight }]}>
      <View
        style={[
          styles.spineRotator,
          {
            width: spineDimensions.width,
            height: spineDimensions.height,
            // Center the rotated element within the container
            marginLeft: (containerWidth - spineDimensions.width) / 2,
            marginTop: (containerHeight - spineDimensions.height) / 2,
          },
        ]}
      >
        <BookSpineVertical
          book={spineData}
          width={spineDimensions.width}
          height={spineDimensions.height}
          leanAngle={0}
          isActive={false}
          showShadow={false}
          onPress={handlePress}
          isHorizontalDisplay={false}
        />
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DiscoverMoreCard({
  recommendations,
  onPress,
  onBookPress,
  _height = 320,
}: DiscoverMoreCardProps) {
  // Theme-aware colors
  const colors = useSecretLibraryColors();

  const handleDiscoverPress = useCallback(() => {
    haptics.buttonPress();
    onPress();
  }, [onPress]);

  const handleBookPress = useCallback((book: RecommendedBook) => {
    haptics.buttonPress();
    onBookPress?.(book);
  }, [onBookPress]);

  // Take up to 3 recommendations
  const booksToShow = recommendations.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Title - tapping goes to Discover */}
      <Pressable style={styles.titleSection} onPress={handleDiscoverPress}>
        <Text style={[styles.title, { color: colors.black }]}>Find More</Text>
        <Text style={[styles.titleItalic, { color: colors.black }]}>Books →</Text>
      </Pressable>

      {/* Horizontal spines - tapping each opens that book's detail */}
      <View style={styles.spinesContainer}>
        {booksToShow.map((book) => (
          <HorizontalSpineWrapper
            key={book.id}
            book={book}
            onPress={handleBookPress}
          />
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    marginLeft: 12,
    alignSelf: 'flex-end', // Align to bottom of shelf
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.semiBold,
    fontSize: scale(44),
    color: staticColors.black,
    lineHeight: scale(42), // Tighter than font size for compact look
  },
  titleItalic: {
    fontFamily: secretLibraryFonts.playfair.semiBold,
    fontStyle: 'italic',
    fontSize: scale(44),
    color: staticColors.black,
    lineHeight: scale(42),
  },
  spinesContainer: {
    gap: SPINE_GAP,
  },
  spineWrapper: {
    overflow: 'hidden',
  },
  spineRotator: {
    transform: [{ rotate: '90deg' }],
  },
});

export default DiscoverMoreCard;
