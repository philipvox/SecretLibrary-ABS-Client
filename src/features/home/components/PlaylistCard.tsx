/**
 * src/features/home/components/PlaylistCard.tsx
 *
 * Playlist card with 2x2 cover grid
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { apiClient } from '@/core/api';
import { COLORS, DIMENSIONS, TYPOGRAPHY } from '../homeDesign';
import { PlaylistCardProps } from '../types';
import { CoverGrid } from './CoverGrid';

export function PlaylistCard({ playlist, onPress, onLongPress }: PlaylistCardProps) {
  // Get cover URLs for first 4 items
  const coverUrls = playlist.items
    .slice(0, 4)
    .map((item) => apiClient.getItemCoverUrl(item.libraryItemId));

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Cover Grid */}
      <CoverGrid covers={coverUrls} size={DIMENSIONS.playlistCardWidth} />

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {playlist.name}
      </Text>

      {/* Item count and duration */}
      <Text style={styles.subtitle}>
        {playlist.items.length} item{playlist.items.length !== 1 ? 's' : ''}
        {playlist.totalDuration > 0 && ` • ${formatDuration(playlist.totalDuration)}`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: DIMENSIONS.playlistCardWidth,
  },
  title: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    ...TYPOGRAPHY.cardSubtitle,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});
