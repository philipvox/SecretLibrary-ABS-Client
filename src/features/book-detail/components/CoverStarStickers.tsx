/**
 * src/features/book-detail/components/CoverStarStickers.tsx
 *
 * Renders gold star sticker PNGs on the book cover.
 * Multiple stars, each at the position where the user double-tapped.
 * Picks from 4 star variants. Clips at edges.
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { scale } from '@/shared/theme';
import type { StarPosition } from '../stores/starPositionStore';

const STAR_IMAGE = require('@assets/stars/star5.webp');

const STAR_SIZE = scale(48);

interface CoverStarStickersProps {
  stars: StarPosition[];
  /** Container width in pixels (needed to convert % to px). Defaults to scale(320). */
  containerWidth?: number;
  /** Container height in pixels. Defaults to scale(320). */
  containerHeight?: number;
}

export function CoverStarStickers({ stars, containerWidth = scale(320), containerHeight = scale(320) }: CoverStarStickersProps) {
  if (!Array.isArray(stars) || stars.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {stars.map((star, i) => {
        const xPx = (star.x / 100) * containerWidth;
        const yPx = (star.y / 100) * containerHeight;
        return (
          <Image
            key={i}
            source={STAR_IMAGE}
            style={{
              position: 'absolute',
              width: STAR_SIZE,
              height: STAR_SIZE,
              top: yPx - STAR_SIZE / 2,
              left: xPx - STAR_SIZE / 2,
              transform: [{ rotate: `${star.rotation}deg` }],
            }}
            resizeMode="contain"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
