/**
 * src/features/home/components/PlaylistCard.tsx
 *
 * Playlist card with 2x2 cover grid
 * Figma: 110x141.5px, 51x51px covers with 4px gap
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { COLORS, TYPOGRAPHY } from '../homeDesign';
import { PlaylistCardProps } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

export function PlaylistCard({ playlist, onPress, onLongPress }: PlaylistCardProps) {
  // Get cover URLs for first 4 items
  const coverUrls = playlist.items
    .slice(0, 4)
    .map((item) => apiClient.getItemCoverUrl(item.libraryItemId));

  const coverSize = scale(51);
  const gap = scale(4);
  const gridSize = coverSize * 2 + gap;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* 2x2 Cover Grid */}
      <View style={[styles.grid, { width: gridSize, height: gridSize }]}>
        {/* Top Row */}
        <View style={[styles.row, { gap }]}>
          <CoverCell url={coverUrls[0]} size={coverSize} />
          <CoverCell url={coverUrls[2]} size={coverSize} />
        </View>
        {/* Bottom Row */}
        <View style={[styles.row, { gap, marginTop: gap }]}>
          <CoverCell url={coverUrls[1]} size={coverSize} />
          <CoverCell url={coverUrls[3]} size={coverSize} />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {playlist.name}
      </Text>
    </TouchableOpacity>
  );
}

function CoverCell({ url, size }: { url?: string; size: number }) {
  return (
    <View style={[styles.coverCell, { width: size, height: size }]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: scale(110),
  },
  grid: {
    // Grid container
  },
  row: {
    flexDirection: 'row',
  },
  coverCell: {
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#7D7D7D',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7D7D7D',
  },
  title: {
    fontFamily: 'System',
    fontSize: scale(12),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(12.4),
    marginTop: scale(9),
  },
});
