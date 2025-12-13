/**
 * src/features/home/components/CoverGrid.tsx
 *
 * 2x2 grid of cover images for playlist display
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius, scale } from '@/shared/theme';
import { CoverGridProps } from '../types';

const COLORS = { controlButtonBg: colors.cardBackground };
const DIMENSIONS = { playlistCardWidth: scale(110), coverRadius: radius.sm };

export function CoverGrid({
  covers,
  size = DIMENSIONS.playlistCardWidth,
  gap = 2,
}: CoverGridProps) {
  // Take max 4 covers
  const displayCovers = covers.slice(0, 4);

  // Calculate individual cover size
  const coverSize = (size - gap) / 2;

  // Handle different numbers of covers
  const renderCovers = () => {
    switch (displayCovers.length) {
      case 0:
        // Show 4 placeholders
        return Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[styles.cover, styles.placeholder, { width: coverSize, height: coverSize }]} />
        ));

      case 1:
        // Single cover takes full space
        return (
          <Image
            source={{ uri: displayCovers[0] }}
            style={[styles.cover, { width: size, height: size, borderRadius: DIMENSIONS.coverRadius }]}
            contentFit="cover"
            transition={200}
          />
        );

      case 2:
        // Two covers in top row
        return (
          <>
            <View style={styles.row}>
              {displayCovers.map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={[
                    styles.cover,
                    { width: coverSize, height: coverSize },
                    i === 0 && styles.topLeft,
                    i === 1 && styles.topRight,
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </View>
            <View style={styles.row}>
              <View style={[styles.cover, styles.placeholder, styles.bottomLeft, { width: coverSize, height: coverSize }]} />
              <View style={[styles.cover, styles.placeholder, styles.bottomRight, { width: coverSize, height: coverSize }]} />
            </View>
          </>
        );

      case 3:
        // Three covers
        return (
          <>
            <View style={styles.row}>
              {displayCovers.slice(0, 2).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={[
                    styles.cover,
                    { width: coverSize, height: coverSize },
                    i === 0 && styles.topLeft,
                    i === 1 && styles.topRight,
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </View>
            <View style={styles.row}>
              <Image
                source={{ uri: displayCovers[2] }}
                style={[styles.cover, styles.bottomLeft, { width: coverSize, height: coverSize }]}
                contentFit="cover"
                transition={200}
              />
              <View style={[styles.cover, styles.placeholder, styles.bottomRight, { width: coverSize, height: coverSize }]} />
            </View>
          </>
        );

      default:
        // 4 covers in 2x2 grid
        return (
          <>
            <View style={styles.row}>
              {displayCovers.slice(0, 2).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={[
                    styles.cover,
                    { width: coverSize, height: coverSize },
                    i === 0 && styles.topLeft,
                    i === 1 && styles.topRight,
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </View>
            <View style={styles.row}>
              {displayCovers.slice(2, 4).map((url, i) => (
                <Image
                  key={i + 2}
                  source={{ uri: url }}
                  style={[
                    styles.cover,
                    { width: coverSize, height: coverSize },
                    i === 0 && styles.bottomLeft,
                    i === 1 && styles.bottomRight,
                  ]}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </View>
          </>
        );
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size, gap }]}>
      {renderCovers()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: DIMENSIONS.coverRadius,
    overflow: 'hidden',
    backgroundColor: COLORS.controlButtonBg,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  cover: {
    borderRadius: 2,
  },
  placeholder: {
    backgroundColor: COLORS.controlButtonBg,
  },
  topLeft: {
    borderTopLeftRadius: DIMENSIONS.coverRadius,
  },
  topRight: {
    borderTopRightRadius: DIMENSIONS.coverRadius,
  },
  bottomLeft: {
    borderBottomLeftRadius: DIMENSIONS.coverRadius,
  },
  bottomRight: {
    borderBottomRightRadius: DIMENSIONS.coverRadius,
  },
});
