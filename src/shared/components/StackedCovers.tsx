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

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, cardTokens, scale } from '@/shared/theme';

interface StackedCoversProps {
  /** Cover URLs (first 2-3 will be used) */
  coverUrls: (string | null | undefined)[];
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
  size = cardTokens.stackedCovers.size,
  offset = cardTokens.stackedCovers.offset,
  maxCovers = cardTokens.stackedCovers.count,
  variant = 'horizontal',
  borderRadius = radius.sm,
  style,
}: StackedCoversProps) {
  // Filter and limit cover URLs
  const covers = coverUrls.filter(Boolean).slice(0, maxCovers);
  const count = Math.min(covers.length, maxCovers);

  // If no covers, show placeholder
  if (count === 0) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius }, style]}>
        <Ionicons name="library" size={size * 0.4} color="rgba(255,255,255,0.3)" />
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
      {covers.map((url, index) => {
        // Position: first cover in back, last in front
        const reverseIndex = count - 1 - index;
        const positionOffset = reverseIndex * offset;

        const coverStyle: ViewStyle = isHorizontal
          ? { left: positionOffset, top: 0 }
          : { top: positionOffset, left: 0 };

        return (
          <View
            key={index}
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
            {url ? (
              <Image
                source={url}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.cover, styles.placeholderCover]} />
            )}
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
