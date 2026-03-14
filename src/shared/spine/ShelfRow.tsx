/**
 * src/shared/spine/ShelfRow.tsx
 *
 * A proper React component for rendering a horizontal row of book spines.
 * Extracted from the duplicated useCallback ShelfView pattern to fix
 * Rules of Hooks violations (hooks cannot be called inside callbacks).
 *
 * Used by: AuthorDetail, SeriesDetail, NarratorDetail, CollectionDetail screens.
 */

import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BookSpineVertical, BookSpineVerticalData } from '@/features/home/components/BookSpineVertical';
import { useBookRowLayout, UseBookRowLayoutOptions } from '@/features/home/hooks/useBookRowLayout';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { LibraryItem } from '@/core/types';

// Screen-responsive scale factor for detail screens
// Base: 0.75 at 402pt (iPhone design canvas). Scales proportionally for other screen widths.
const DESIGN_WIDTH = 402;

// =============================================================================
// TYPES
// =============================================================================

interface ShelfRowProps {
  /** Library items to display as spines */
  books: LibraryItem[];
  /** Convert a LibraryItem to BookSpineVerticalData (caller provides to handle screen-specific metadata) */
  toSpineData: (item: LibraryItem, cachedColors?: { backgroundColor?: string; textColor?: string }) => BookSpineVerticalData;
  /** Called when a spine is pressed */
  onSpinePress: (book: BookSpineVerticalData) => void;
  /** Called when a spine is long-pressed */
  onSpineLongPress?: (book: BookSpineVerticalData) => void;
  /** Layout options passed to useBookRowLayout */
  layoutOptions?: UseBookRowLayoutOptions;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ShelfRow = React.memo(function ShelfRow({
  books,
  toSpineData,
  onSpinePress,
  onSpineLongPress,
  layoutOptions,
}: ShelfRowProps) {
  const { width: screenWidth } = useWindowDimensions();
  const defaultScaleFactor = React.useMemo(() => 0.75 * (screenWidth / DESIGN_WIDTH), [screenWidth]);
  const resolvedOptions = React.useMemo(
    () => layoutOptions ?? { scaleFactor: defaultScaleFactor, enableLeaning: true },
    [layoutOptions, defaultScaleFactor]
  );
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);

  const spineDataList = React.useMemo(() => {
    return books.map(book => {
      const cached = getSpineData(book.id);
      return toSpineData(book, cached);
    });
  }, [books, getSpineData, toSpineData]);

  const layouts = useBookRowLayout(spineDataList, resolvedOptions);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelfContent}
    >
      {layouts.map((layout) => (
        <View key={layout.book.id} style={styles.spineWrapper}>
          <BookSpineVertical
            book={layout.book}
            width={layout.width}
            height={layout.height}
            leanAngle={layout.leanAngle}
            onPress={onSpinePress}
            onLongPress={onSpineLongPress}
          />
        </View>
      ))}
    </ScrollView>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  shelfContent: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    alignItems: 'flex-end',
  },
  spineWrapper: {
    // Dimensions handled by BookSpineVertical
  },
});
