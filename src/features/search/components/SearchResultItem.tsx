/**
 * src/features/search/components/SearchResultItem.tsx
 *
 * Search result item showing book cover, title, author.
 * Uses metadata utility for consistent data extraction.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { colors, spacing, radius, elevation } from '@/shared/theme';
import { getTitle, getAuthorName, getFormattedDuration } from '@/shared/utils/metadata';
import { HeartButton } from '@/shared/components';

interface SearchResultItemProps {
  item: LibraryItem;
}

export function SearchResultItem({ item }: SearchResultItemProps) {
  const { loadBook } = usePlayerStore();

  const handlePress = async () => {
    try {
      const fullBook = await apiClient.getItem(item.id);
      await loadBook(fullBook, { autoPlay: false });
    } catch {
      await loadBook(item, { autoPlay: false });
    }
  };

  const coverUrl = apiClient.getItemCoverUrl(item.id);
  const title = getTitle(item);
  const author = getAuthorName(item);
  const duration = getFormattedDuration(item);

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.coverContainer}>
        {coverUrl ? (
          <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.placeholderCover]}>
            <Text style={styles.placeholderText}>📖</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        <Text style={styles.duration}>{duration}</Text>
      </View>

      <HeartButton bookId={item.id} size={18} style={styles.heartButton} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  coverContainer: {
    width: 60,
    height: 90,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.progressTrack,
    ...elevation.small,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.progressTrack,
  },
  placeholderText: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  author: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  duration: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  heartButton: {
    alignSelf: 'center',
    padding: spacing.xs,
  },
});