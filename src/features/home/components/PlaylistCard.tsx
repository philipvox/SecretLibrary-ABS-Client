/**
 * src/features/home/components/PlaylistCard.tsx
 *
 * Playlist card with 2x2 cover grid
 * Anima: 110x141.5px total
 * 4 covers 51x51px at positions:
 *   (0,0), (55,0), (0,55), (55,55) - 4px gap
 * Title at top:115, left:2
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { colors, scale } from '@/shared/theme';
import { PlaylistCardProps } from '../types';

const COLORS = { textPrimary: colors.textPrimary };

export function PlaylistCard({ playlist, onPress, onLongPress }: PlaylistCardProps) {
  // Get cover URLs for first 4 items
  const coverUrls = playlist.items
    .slice(0, 4)
    .map((item) => apiClient.getItemCoverUrl(item.libraryItemId));

  // Anima positions: (0,0), (55,0), (0,55), (55,55)
  const positions = [
    { top: 0, left: 0 },
    { top: 0, left: 55 },
    { top: 55, left: 0 },
    { top: 55, left: 55 },
  ];

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* 2x2 Cover Grid */}
      <View style={styles.gridContainer}>
        {positions.map((pos, index) => (
          <View
            key={index}
            style={[
              styles.coverWrapper,
              {
                top: scale(pos.top),
                left: scale(pos.left),
              },
            ]}
          >
            {coverUrls[index] ? (
              <Image
                source={{ uri: coverUrls[index] }}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>
        ))}
      </View>

      {/* Title at top:115, left:2 */}
      <Text style={styles.title} numberOfLines={2}>
        {playlist.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: scale(110),
    height: scale(141.5),
    position: 'relative',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: scale(106), // 55 + 51 = 106
    height: scale(106),
  },
  coverWrapper: {
    position: 'absolute',
    width: scale(51),
    height: scale(51),
    borderRadius: scale(5),
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
    position: 'absolute',
    top: scale(115),
    left: scale(2),
    width: scale(106),
    fontFamily: 'System', // TODO: Change to 'GothicA1' when font loaded
    fontSize: scale(12),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(12.4),
  },
});
