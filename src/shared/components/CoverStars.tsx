/**
 * src/shared/components/CoverStars.tsx
 *
 * Lightweight overlay that renders gold star stickers on any book cover.
 * Reads star positions from the persisted store by bookId.
 * Drop into any cover container as a sibling after the Image.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Image, LayoutChangeEvent } from 'react-native';
import { scale } from '@/shared/theme';
import { useStarPositionStore } from '@/features/book-detail/stores/starPositionStore';
import type { StarPosition } from '@/features/book-detail/stores/starPositionStore';

const STAR_IMAGE = require('../../../assets/stars/star5.webp');

interface CoverStarsProps {
  bookId: string;
  /** Pixel size for each star. Defaults to scale(24). */
  starSize?: number;
}

export function CoverStars({ bookId, starSize = scale(24) }: CoverStarsProps) {
  const stars = useStarPositionStore((s) => s.positions[bookId]);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  if (!Array.isArray(stars) || stars.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none" onLayout={onLayout}>
      {layout.width > 0 && stars.map((star: StarPosition, i: number) => {
        const xPx = (star.x / 100) * layout.width;
        const yPx = (star.y / 100) * layout.height;
        return (
          <Image
            key={i}
            source={STAR_IMAGE}
            style={{
              position: 'absolute',
              width: starSize,
              height: starSize,
              top: yPx - starSize / 2,
              left: xPx - starSize / 2,
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
