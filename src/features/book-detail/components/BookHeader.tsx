import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { colors, spacing, radius, elevation, wp } from '@/shared/theme';

interface BookHeaderProps {
  book: LibraryItem;
}

const SCREEN_WIDTH = wp(100);
const COVER_WIDTH = SCREEN_WIDTH * 0.55;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

export function BookHeader({ book }: BookHeaderProps) {
  const metadata = book.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  const coverUrl = apiClient.getItemCoverUrl(book.id);

  return (
    <View style={styles.container}>
      <View style={styles.coverContainer}>
        <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={300} />
      </View>
      
      <Text style={styles.title} numberOfLines={3}>{title}</Text>
      <Text style={styles.author}>{author}</Text>
      {narrator && (
        <Text style={styles.narrator}>Narrated by {narrator}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  coverContainer: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundTertiary,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...elevation.medium,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  author: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  narrator: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});