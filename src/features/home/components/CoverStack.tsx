/**
 * src/features/home/components/CoverStack.tsx
 *
 * Stacked/fanned cover images for series display
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '@/shared/theme';
import { CoverStackProps } from '../types';

const COLORS = { controlButtonBg: colors.cardBackground };
const DIMENSIONS = { smallRadius: radius.xs };

export function CoverStack({
  covers,
  size = 80,
  overlap = 12,
}: CoverStackProps) {
  // Take max 4 covers
  const displayCovers = covers.slice(0, 4);

  // Calculate container dimensions based on layout
  // Layout: 2x2 grid with overlap
  const containerWidth = size * 2 - overlap;
  const containerHeight = size * 2 - overlap;

  // Position for each cover in 2x2 grid
  const positions = [
    { top: 0, left: 0, zIndex: 4 },           // Top left
    { top: 0, left: size - overlap, zIndex: 3 },   // Top right
    { top: size - overlap, left: 0, zIndex: 2 },   // Bottom left
    { top: size - overlap, left: size - overlap, zIndex: 1 }, // Bottom right
  ];

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight }]}>
      {displayCovers.map((coverUrl, index) => (
        <View
          key={index}
          style={[
            styles.coverWrapper,
            {
              width: size,
              height: size,
              top: positions[index].top,
              left: positions[index].left,
              zIndex: positions[index].zIndex,
            },
          ]}
        >
          <Image
            source={{ uri: coverUrl }}
            style={[styles.cover, { borderRadius: DIMENSIONS.smallRadius }]}
            contentFit="cover"
            transition={200}
          />
        </View>
      ))}

      {/* Placeholder covers if less than 4 */}
      {displayCovers.length < 4 &&
        Array.from({ length: 4 - displayCovers.length }).map((_, index) => {
          const placeholderIndex = displayCovers.length + index;
          return (
            <View
              key={`placeholder-${placeholderIndex}`}
              style={[
                styles.coverWrapper,
                styles.placeholder,
                {
                  width: size,
                  height: size,
                  top: positions[placeholderIndex].top,
                  left: positions[placeholderIndex].left,
                  zIndex: positions[placeholderIndex].zIndex,
                  borderRadius: DIMENSIONS.smallRadius,
                },
              ]}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  coverWrapper: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: COLORS.controlButtonBg,
  },
});
