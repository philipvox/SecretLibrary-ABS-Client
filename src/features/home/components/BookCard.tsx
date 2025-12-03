/**
 * src/features/home/components/BookCard.tsx
 *
 * Book card for horizontal carousel display
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { COLORS, DIMENSIONS, TYPOGRAPHY, SHADOWS } from '../homeDesign';
import { BookCardProps } from '../types';
import { HeartIcon } from './icons';

export function BookCard({
  book,
  onPress,
  onLongPress,
  isFavorite = false,
  showProgress = false,
  progress = 0,
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

        {/* Heart Badge */}
        {isFavorite && (
          <View style={styles.heartBadge}>
            <HeartIcon size={DIMENSIONS.heartBadgeSize * 0.6} color={COLORS.heart} />
          </View>
        )}

        {/* Progress Bar */}
        {showProgress && progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: DIMENSIONS.bookCardWidth,
  },
  coverContainer: {
    width: DIMENSIONS.bookCardWidth,
    height: DIMENSIONS.bookCardHeight,
    borderRadius: DIMENSIONS.coverRadius,
    overflow: 'hidden',
    backgroundColor: COLORS.controlButtonBg,
    ...SHADOWS.card,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  heartBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: DIMENSIONS.heartBadgeSize,
    height: DIMENSIONS.heartBadgeSize,
    borderRadius: DIMENSIONS.heartBadgeSize / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DIMENSIONS.progressBarHeight,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.playButton,
  },
  title: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
    marginTop: 8,
  },
});
