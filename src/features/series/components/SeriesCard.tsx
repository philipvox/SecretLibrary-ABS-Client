/**
 * src/features/series/components/SeriesCard.tsx
 * 
 * Card displaying series information with book count and duration.
 * Uses metadata utility for consistent data extraction.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { SeriesInfo } from '../services/seriesAdapter';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';
import { formatDuration } from '@/shared/utils/metadata';

interface SeriesCardProps {
  series: SeriesInfo;
}

function SeriesCardComponent({ series }: SeriesCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('SeriesDetail' as never, { seriesName: series.name } as never);
  };

  const coverUrl = series.coverUrl
    ? apiClient.getItemCoverUrl(series.coverUrl)
    : undefined;

  const durationText = series.totalDuration > 0
    ? formatDuration(series.totalDuration)
    : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.coverContainer}>
        {coverUrl ? (
          <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.placeholderCover]}>
            <Text style={styles.placeholderText}>📚</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {series.name}
        </Text>
        <Text style={styles.bookCount} numberOfLines={1}>
          {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
          {durationText && ` • ${durationText}`}
        </Text>
      </View>
    </Pressable>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const SeriesCard = memo(SeriesCardComponent);

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: theme.spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  coverContainer: {
    aspectRatio: 1,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    ...theme.elevation.small,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[300],
  },
  placeholderText: {
    fontSize: 48,
  },
  info: {
    marginTop: theme.spacing[2],
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
    lineHeight: 20,
  },
  bookCount: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
});