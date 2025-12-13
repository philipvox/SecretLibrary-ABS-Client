/**
 * src/features/home/components/CoverArtwork.tsx
 *
 * Cover artwork - Anima: 263x264px, rounded-[8.79px], shadow
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import {
  colors,
  spacing,
  radius,
  scale,
  elevation,
} from '@/shared/theme';

interface CoverArtworkProps {
  coverUrl?: string;
  size?: number;
  seriesSequence?: number | string;  // Series number to show in top-right corner
}

export function CoverArtwork({
  coverUrl,
  size = scale(263),
  seriesSequence,
}: CoverArtworkProps) {
  // Anima: 263x264 (slightly taller than wide)
  const width = size;
  const height = size * (264 / 263);
  const borderRadius = scale(8.79);

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
        }
      ]}
    >
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.image, { width, height, borderRadius }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.placeholder, { width, height, borderRadius }]} />
      )}

      {/* Series sequence badge */}
      {seriesSequence !== undefined && (
        <View style={styles.seriesBadge}>
          <Text style={styles.seriesText}>#{seriesSequence}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...elevation.large,
    zIndex: 100,
    position: 'relative',
  },
  image: {
    backgroundColor: colors.backgroundTertiary,
  },
  placeholder: {
    backgroundColor: colors.backgroundTertiary,
  },
  seriesBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  seriesText: {
    fontSize: scale(14),
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },
});
