/**
 * src/features/home/components/SeriesCard.tsx
 *
 * Series card with stacked book covers
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { apiClient } from '@/core/api';
import { COLORS, DIMENSIONS, TYPOGRAPHY, SHADOWS } from '../homeDesign';
import { SeriesCardProps } from '../types';
import { CoverStack } from './CoverStack';
import { HeartIcon } from './icons';

export function SeriesCard({ series, onPress, onLongPress }: SeriesCardProps) {
  // Get cover URLs for first 4 books
  const coverUrls = series.books.slice(0, 4).map((book) => apiClient.getItemCoverUrl(book.id));

  // Calculate stack dimensions
  const coverSize = DIMENSIONS.seriesCardWidth * 0.65;
  const overlap = coverSize * 0.15;
  const stackHeight = coverSize * 2 - overlap;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Cover Stack */}
      <View style={[styles.stackContainer, { height: stackHeight }]}>
        <CoverStack
          covers={coverUrls}
          size={coverSize}
          overlap={overlap}
        />

        {/* Heart Badge */}
        {series.isFavorite && (
          <View style={styles.heartBadge}>
            <HeartIcon size={14} color={COLORS.heart} />
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {series.name}
      </Text>

      {/* Book count */}
      <Text style={styles.subtitle}>
        {series.totalBooks} book{series.totalBooks !== 1 ? 's' : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: DIMENSIONS.seriesCardWidth,
  },
  stackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
