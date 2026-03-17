/**
 * src/features/home/components/SeriesBookStack.tsx
 *
 * Displays series books as a horizontal stacked pile (books lying flat).
 * Book 1 at bottom, last book on top.
 *
 * Visual:
 *         ┌──────────┐
 *         │ Book 5   │  ← top (last to stack)
 *        ┌┴──────────┴┐
 *        │  Book 4    │
 *       ┌┴────────────┴┐
 *       │   Book 3     │  ← offset left/right randomly
 *      ┌┴──────────────┴┐
 *      │    Book 2      │
 *     ┌┴────────────────┴┐
 *     │     Book 1       │  ← bottom (first book, thickest if longest)
 *     └──────────────────┘
 *
 * Features:
 * - Title only on book cover (no author)
 * - Width (horizontal span) based on audiobook duration
 * - Height (thickness) is consistent for visual stacking
 * - Random horizontal offset for natural "messy pile" look
 * - SVG-based rendering with page edge effect
 */

import React, { memo, useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  useSeriesStackLayout,
  StackBookData,
  StackBookLayout,
} from '../hooks/useSeriesStackLayout';

// =============================================================================
// TYPES
// =============================================================================

export interface SeriesBookStackProps {
  /** Array of books in the series */
  books: StackBookData[];
  /** Name of the series (used for caching) */
  seriesName: string;
  /** Maximum number of books to display (default: 5) */
  maxBooks?: number;
  /** Scale factor for dimensions (default: 1) */
  scale?: number;
  /** Thickness of each book in the stack (default: 16) */
  bookThickness?: number;
  /** Callback when stack is pressed */
  onPress?: (seriesName: string) => void;
  /** Callback when a specific book is pressed */
  onBookPress?: (book: StackBookData) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Colors
const BOOK_COVER_COLOR = '#e8e4dc';      // Cream/gray cover
const TEXT_COLOR = '#2a2a2a';            // Dark text
const SHADOW_COLOR = 'rgba(0,0,0,0.12)'; // Subtle shadow

// Dimensions
const CORNER_RADIUS = 2;
const SHADOW_BLUR = 2;
const DEFAULT_BOOK_THICKNESS = 20;       // Height of each book in stack
const DEFAULT_MAX_BOOKS = 5;

// Text
const MIN_FONT_SIZE = 7;
const MAX_FONT_SIZE = 11;
const TEXT_PADDING_X = 6;
const TEXT_PADDING_Y = 2;

// =============================================================================
// SINGLE STACKED BOOK COMPONENT
// =============================================================================

interface StackedBookProps {
  layout: StackBookLayout;
  thickness: number;
  isBottomBook: boolean;
  onPress?: (book: StackBookData) => void;
}

const StackedBook = memo(function StackedBook({
  layout,
  thickness,
  isBottomBook,
  onPress,
}: StackedBookProps) {
  const { book, width, hash } = layout;

  // Total dimensions (no page edge)
  const totalWidth = width;
  const totalHeight = thickness + (isBottomBook ? 0 : SHADOW_BLUR);

  // Calculate font size based on available space
  const fontSize = useMemo(() => {
    const maxByWidth = (width - TEXT_PADDING_X * 2) / (book.title.length * 0.5);
    const maxByHeight = thickness - TEXT_PADDING_Y * 2;
    const size = Math.min(maxByWidth, maxByHeight, MAX_FONT_SIZE);
    return Math.max(MIN_FONT_SIZE, Math.round(size));
  }, [width, thickness, book.title.length]);

  // Truncate title if too long
  const displayTitle = useMemo(() => {
    const maxChars = Math.floor((width - TEXT_PADDING_X * 2) / (fontSize * 0.55));
    if (book.title.length <= maxChars) {
      return book.title;
    }
    return book.title.substring(0, maxChars - 1) + '…';
  }, [book.title, width, fontSize]);

  // Handle press
  const handlePress = useCallback(() => {
    onPress?.(book);
  }, [book, onPress]);

  // Unique gradient IDs
  const shadowGradientId = `shadow-${hash}`;

  return (
    <Pressable onPress={handlePress} disabled={!onPress}>
      <Svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        <Defs>
          {/* Bottom shadow gradient */}
          <LinearGradient id={shadowGradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SHADOW_COLOR} stopOpacity="0.2" />
            <Stop offset="1" stopColor={SHADOW_COLOR} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Shadow underneath (not for bottom book) */}
        {!isBottomBook && (
          <Rect
            x={2}
            y={thickness}
            width={width - 2}
            height={SHADOW_BLUR}
            fill={`url(#${shadowGradientId})`}
          />
        )}

        {/* Book cover (main body) */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={thickness}
          rx={CORNER_RADIUS}
          ry={CORNER_RADIUS}
          fill={BOOK_COVER_COLOR}
        />

        {/* Title text (horizontal, centered) */}
        <SvgText
          x={width / 2}
          y={thickness / 2}
          fill={TEXT_COLOR}
          fontSize={fontSize}
          fontWeight="500"
          fontFamily="System"
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {displayTitle}
        </SvgText>
      </Svg>
    </Pressable>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function SeriesBookStackComponent({
  books,
  seriesName,
  maxBooks = DEFAULT_MAX_BOOKS,
  scale = 1,
  bookThickness = DEFAULT_BOOK_THICKNESS,
  onPress,
  onBookPress,
}: SeriesBookStackProps) {
  // Get cached layouts
  const layouts = useSeriesStackLayout(seriesName, books, {
    maxBooks,
    bookHeight: 100, // Used for width calculation in hook
    scale,
  });

  // Scaled thickness
  const scaledThickness = Math.round(bookThickness * scale);

  // Calculate container dimensions
  const containerSize = useMemo(() => {
    if (layouts.length === 0) return { width: 0, height: 0 };

    // Width: widest book + max offset on each side + page edge
    const maxWidth = Math.max(...layouts.map(l => l.width));
    const maxOffset = Math.max(...layouts.map(l => Math.abs(l.horizontalOffset)));
    const totalWidth = maxWidth + (maxOffset * 2);

    // Height: all books stacked
    const totalHeight = layouts.length * scaledThickness + SHADOW_BLUR;

    return { width: totalWidth, height: totalHeight };
  }, [layouts, scaledThickness]);

  // Handle stack press
  const handleStackPress = useCallback(() => {
    onPress?.(seriesName);
  }, [onPress, seriesName]);

  // Handle individual book press
  const handleBookPress = useCallback(
    (book: StackBookData) => {
      if (onBookPress) {
        onBookPress(book);
      } else if (onPress) {
        onPress(seriesName);
      }
    },
    [onBookPress, onPress, seriesName]
  );

  // Calculate positions for each book in the stack
  const bookPositions = useMemo(() => {
    if (layouts.length === 0) return [];

    const centerX = containerSize.width / 2;

    return layouts.map((layout, index) => {
      // Bottom position: book 1 at bottom, last book at top
      const bottomOffset = (layouts.length - 1 - index) * scaledThickness;

      // Horizontal position: centered with random offset
      const leftOffset = centerX - (layout.width / 2) + layout.horizontalOffset;

      return {
        layout,
        style: {
          position: 'absolute' as const,
          bottom: bottomOffset,
          left: Math.max(0, leftOffset),
          zIndex: index, // Higher index = on top
        },
      };
    });
  }, [layouts, containerSize.width, scaledThickness]);

  if (layouts.length === 0) {
    return null;
  }

  return (
    <Pressable onPress={handleStackPress} disabled={!onPress && !onBookPress}>
      <View style={[styles.container, { width: containerSize.width, height: containerSize.height }]}>
        {bookPositions.map(({ layout, style }, index) => (
          <View key={layout.book.id} style={style}>
            <StackedBook
              layout={layout}
              thickness={scaledThickness}
              isBottomBook={index === 0}
              onPress={onBookPress ? handleBookPress : undefined}
            />
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export const SeriesBookStack = memo(SeriesBookStackComponent);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
});

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { StackBookData, StackBookLayout } from '../hooks/useSeriesStackLayout';
export {
  useSeriesStackLayout,
  useSeriesStackSize,
  precacheSeriesStack,
  clearSeriesStackCache,
} from '../hooks/useSeriesStackLayout';
