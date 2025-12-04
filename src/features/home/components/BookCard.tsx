/**
 * src/features/home/components/BookCard.tsx
 *
 * Book card for carousel - Figma: 110x141.5px, cover 106x106px
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { COLORS, TYPOGRAPHY } from '../homeDesign';
import { BookCardProps } from '../types';
import { HeartIcon } from './icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

export function BookCard({
  book,
  onPress,
  onLongPress,
  isFavorite = false,
}: BookCardProps) {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = book.media?.metadata?.title || 'Untitled';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* Title with Heart */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {isFavorite && (
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
  coverContainer: {
    width: scale(106),
    height: scale(106),
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#7D7D7D',
  },
  cover: {
    width: '100%',
    height: '100%',
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
