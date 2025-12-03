/**
 * src/features/home/components/CoverArtwork.tsx
 *
 * Cover artwork with shadow and progress bar
 */

import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, DIMENSIONS, SHADOWS } from '../homeDesign';

interface CoverArtworkProps {
  coverUrl?: string;
  size?: number;
  progress?: number; // 0-1
  showProgress?: boolean;
}

export function CoverArtwork({
  coverUrl,
  size = DIMENSIONS.coverArtworkSize,
  progress = 0,
  showProgress = true,
}: CoverArtworkProps) {
  const progressWidth = Math.min(Math.max(progress, 0), 1) * size;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Cover image or placeholder */}
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.image, { width: size, height: size }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.placeholderText}>📚</Text>
        </View>
      )}

      {/* Overlay gradient (subtle) */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.1)']}
        style={styles.overlay}
      />

      {/* Progress bar */}
      {showProgress && progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                { width: progressWidth },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: DIMENSIONS.coverRadius,
    overflow: 'hidden',
    ...SHADOWS.cover,
  },
  image: {
    borderRadius: DIMENSIONS.coverRadius,
  },
  placeholder: {
    backgroundColor: COLORS.controlButtonBg,
    borderRadius: DIMENSIONS.coverRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DIMENSIONS.coverRadius,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  progressBackground: {
    height: DIMENSIONS.progressBarHeight,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: DIMENSIONS.progressBarHeight / 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.playButton,
    borderRadius: DIMENSIONS.progressBarHeight / 2,
  },
});
