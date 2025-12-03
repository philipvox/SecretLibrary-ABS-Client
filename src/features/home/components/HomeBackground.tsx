/**
 * src/features/home/components/HomeBackground.tsx
 *
 * Background with blurred cover art
 */

import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS } from '../homeDesign';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HomeBackgroundProps {
  coverUrl?: string;
  blurIntensity?: number;
}

export function HomeBackground({
  coverUrl,
  blurIntensity = 80,
}: HomeBackgroundProps) {
  return (
    <View style={styles.container}>
      {/* Base color */}
      <View style={styles.baseColor} />

      {/* Blurred cover image */}
      {coverUrl && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.image}
            resizeMode="cover"
            blurRadius={25}
          />
          <BlurView intensity={blurIntensity} style={styles.blur} tint="dark" />
        </View>
      )}

      {/* Dark overlay gradient */}
      <LinearGradient
        colors={[
          'rgba(0, 0, 0, 0.3)',
          'rgba(0, 0, 0, 0.5)',
          'rgba(0, 0, 0, 0.8)',
          COLORS.background,
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.gradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  baseColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.6,
    overflow: 'hidden',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    transform: [{ scale: 1.1 }],
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
});
