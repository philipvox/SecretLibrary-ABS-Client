/**
 * src/shared/components/StackedCovers.tsx
 *
 * Reusable stacked covers component for series/collections.
 * Displays 2-3 book covers offset to show multiple books.
 *
 * Variants:
 * - horizontal: Covers fan out horizontally (default)
 * - vertical: Covers stack vertically with offset
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Library } from 'lucide-react-native';
import { colors, radius, cardTokens, scale } from '@/shared/theme';

interface StackedCoversProps {
  /** Cover URLs (first 2-3 will be used) */
  coverUrls: (string | null | undefined)[];
  /** Optional book IDs for stable keys (prevents flickering) */
  bookIds?: string[];
  /** Size of covers (default from cardTokens) */
  size?: number;
  /** Offset between covers in pixels */
  offset?: number;
  /** Maximum covers to show */
  maxCovers?: number;
  /** Orientation: horizontal or vertical */
  variant?: 'horizontal' | 'vertical';
  /** Border radius override */
  borderRadius?: number;
  /** Container style override */
  style?: ViewStyle;
}

export function StackedCovers({
  coverUrls,
  bookIds,
  size = cardTokens.stackedCovers.size,
  offset = cardTokens.stackedCovers.offset,
  maxCovers = cardTokens.stackedCovers.count,
  variant = 'horizontal',
  borderRadius = radius.sm,
  style,
}: StackedCoversProps) {
  // Memoize cover data with stable keys to prevent flickering
  const coverData = useMemo(() => {
    const result: Array<{ url: string; key: string }> = [];
    for (let i = 0; i < Math.min(coverUrls.length, maxCovers); i++) {
      const url = coverUrls[i];
      if (url) {
        // Use bookId if available, otherwise use index with URL hash for uniqueness
        // Note: URL extraction like url.split('/').pop() can return "cover" for multiple items
        const key = bookIds?.[i] || `cover-${i}-${url.length}`;
        result.push({ url, key });
      }
    }
    return result;
  }, [coverUrls, bookIds, maxCovers]);

  const count = coverData.length;

  // If no covers, show placeholder
  if (count === 0) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius }, style]}>
        <Library size={size * 0.4} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
      </View>
    );
  }

  // Calculate container dimensions
  const isHorizontal = variant === 'horizontal';
  const totalOffset = offset * (count - 1);
  const containerWidth = isHorizontal ? size + totalOffset : size;
  const containerHeight = isHorizontal ? size * 1.5 : size * 1.5 + totalOffset; // 2:3 aspect

  return (
    <View style={[{ width: containerWidth, height: containerHeight }, style]}>
      {coverData.map(({ url, key }, index) => {
        // Position: first cover in back, last in front
        const reverseIndex = count - 1 - index;
        const positionOffset = reverseIndex * offset;

        const coverStyle: ViewStyle = isHorizontal
          ? { left: positionOffset, top: 0 }
          : { top: positionOffset, left: 0 };

        return (
          <View
            key={key}
            style={[
              styles.coverWrapper,
              {
                width: size,
                height: size * 1.5, // 2:3 aspect ratio
                borderRadius,
                zIndex: index, // Last cover on top
                ...coverStyle,
              },
            ]}
          >
            <Image
              source={url}
              style={styles.cover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrapper: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: colors.backgroundTertiary,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    backgroundColor: colors.backgroundElevated,
  },
  placeholder: {
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StackedCovers;
