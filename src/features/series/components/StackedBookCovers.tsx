// File: src/features/series/components/StackedBookCovers.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

interface StackedBookCoversProps {
  bookIds: string[];
  size: number;
}

// Reorder books so first book is in center, then fan outward
function reorderForFan(books: string[]): string[] {
  if (books.length <= 1) return books;
  
  const result: string[] = new Array(books.length);
  const center = Math.floor(books.length / 2);
  
  let bookIndex = 0;
  let leftOffset = 0;
  let rightOffset = 0;
  
  for (let i = 0; i < books.length; i++) {
    if (i === 0) {
      result[center] = books[bookIndex++];
    } else if (i % 2 === 1) {
      leftOffset++;
      if (center - leftOffset >= 0) {
        result[center - leftOffset] = books[bookIndex++];
      }
    } else {
      rightOffset++;
      if (center + rightOffset < books.length) {
        result[center + rightOffset] = books[bookIndex++];
      }
    }
  }
  
  return result;
}

// Get layout config based on total book count
function getLayout(totalBooks: number) {
  if (totalBooks <= 5) {
    return { frontCount: Math.min(5, totalBooks), midCount: 0, backCount: 0 };
  } else if (totalBooks <= 10) {
    return { frontCount: 5, midCount: Math.min(4, totalBooks - 5), backCount: 0 };
  }
  return { frontCount: 5, midCount: 4, backCount: 3 };
}

export function StackedBookCovers({ bookIds, size }: StackedBookCoversProps) {
  const layout = getLayout(bookIds.length);
  const rowCount = layout.backCount > 0 ? 3 : layout.midCount > 0 ? 2 : 1;
  
  const baseWidth = size * 0.32;
  const coverHeight = baseWidth; // Square
  const maxRotation = 16;
  const spreadMultiplier = 0.52;
  const rowGap = coverHeight * 0.26;
  
  // Build rows
  const frontBooks = reorderForFan(bookIds.slice(0, layout.frontCount));
  const midBooks = layout.midCount > 0 
    ? reorderForFan(bookIds.slice(5, 5 + layout.midCount)) 
    : [];
  const backBooks = layout.backCount > 0 
    ? reorderForFan(bookIds.slice(9, 9 + layout.backCount)) 
    : [];
  
  const getTransform = (index: number, total: number) => {
    const centerIndex = (total - 1) / 2;
    const offset = index - centerIndex;
    const rotation = offset * (maxRotation / Math.max(1, (total - 1) / 2));
    const spreadX = offset * (baseWidth * spreadMultiplier);
    const verticalOffset = Math.abs(offset) * 3;
    return { rotation, spreadX, verticalOffset };
  };

  const renderRow = (books: string[], yOffset: number, zBase: number) => {
    return books.map((bookId, index) => {
      const coverUrl = apiClient.getItemCoverUrl(bookId);
      const { rotation, spreadX, verticalOffset } = getTransform(index, books.length);
      const distanceFromCenter = Math.abs(index - (books.length - 1) / 2);
      const zIndex = zBase + books.length - Math.round(distanceFromCenter);

      return (
        <View
          key={bookId}
          style={[
            styles.shadowWrapper,
            {
              width: baseWidth,
              height: coverHeight,
              zIndex,
              transform: [
                { translateX: spreadX },
                { translateY: yOffset + verticalOffset },
                { rotate: `${rotation}deg` },
              ],
            },
          ]}
        >
          <View style={styles.imageWrapper}>
            <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={150} />
          </View>
        </View>
      );
    });
  };

  const totalHeight = coverHeight + (rowCount - 1) * rowGap + 20;

  return (
    <View style={[styles.container, { width: size, height: totalHeight }]}>
      {backBooks.length > 0 && renderRow(backBooks, -rowGap * 1.6, 10)}
      {midBooks.length > 0 && renderRow(midBooks, -rowGap, 20)}
      {renderRow(frontBooks, 0, 30)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  shadowWrapper: {
    position: 'absolute',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.neutral[300],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  imageWrapper: {
    flex: 1,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
});