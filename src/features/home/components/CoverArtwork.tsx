/**
 * src/features/home/components/CoverArtwork.tsx
 *
 * Cover artwork with shadow - Figma: 263x264px rounded-[8.79px]
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../homeDesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

interface CoverArtworkProps {
  coverUrl?: string;
  size?: number;
}

export function CoverArtwork({
  coverUrl,
  size = scale(263),
}: CoverArtworkProps) {
  const borderRadius = scale(8.79);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  image: {
    backgroundColor: COLORS.controlButtonBg,
  },
  placeholder: {
    backgroundColor: '#7D7D7D',
  },
});
