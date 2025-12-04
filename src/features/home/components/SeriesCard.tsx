/**
 * src/features/home/components/SeriesCard.tsx
 *
 * Series card with horizontal stack of covers
 * Figma: 110x86.5px, 5 stacked covers 35x51px each, 17px offset
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { COLORS, TYPOGRAPHY } from '../homeDesign';
import { SeriesCardProps } from '../types';
import { HeartIcon } from './icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

export function SeriesCard({ series, onPress, onLongPress }: SeriesCardProps) {
  // Get cover URLs for books
  const coverUrls = series.books.slice(0, 5).map((book) => apiClient.getItemCoverUrl(book.id));

  const coverWidth = scale(35);
  const coverHeight = scale(51);
  const offset = scale(17);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Horizontal Cover Stack */}
      <View style={[styles.stackContainer, { height: coverHeight }]}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View
            key={index}
            style={[
              styles.coverWrapper,
              {
                width: coverWidth,
                height: coverHeight,
                left: index * offset,
                zIndex: 5 - index,
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

      {/* Title with Heart */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {series.name}
        </Text>
        {series.isFavorite && (
          <View style={styles.heartContainer}>
            <HeartIcon size={scale(14)} color={COLORS.heart} filled />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: scale(110),
  },
  stackContainer: {
    position: 'relative',
    width: scale(103), // 35 + 4*17 = 103
  },
  coverWrapper: {
    position: 'absolute',
    borderRadius: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 9, height: 4 },
    shadowOpacity: 0.46,
    shadowRadius: 2,
    elevation: 4,
  },
  cover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7D7D7D',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7D7D7D',
    borderRadius: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: scale(9),
  },
  title: {
    flex: 1,
    fontFamily: 'System',
    fontSize: scale(12),
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: scale(12.4),
  },
  heartContainer: {
    marginLeft: scale(4),
    marginTop: scale(2),
  },
});
