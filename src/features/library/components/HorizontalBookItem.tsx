// File: src/features/library/components/HorizontalBookItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { colors, spacing, radius, elevation } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

interface HorizontalBookItemProps {
  book: LibraryItem;
}

export function HorizontalBookItem({ book }: HorizontalBookItemProps) {
  const { loadBook } = usePlayerStore();

  const handlePress = async () => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: false });
    } catch {
      await loadBook(book, { autoPlay: false });
    }
  };

  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const description = (book.media.metadata as any)?.description || '';
  
  // Truncate description to ~100 chars
  const shortDescription = description.length > 100 
    ? description.substring(0, 100).trim() + '...'
    : description;

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      {/* Cover */}
      <View style={styles.coverContainer}>
        {coverUrl ? (
          <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.placeholderCover]}>
            <Text style={styles.placeholderText}>📖</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        {shortDescription.length > 0 && (
          <Text style={styles.description} numberOfLines={2}>
            {shortDescription}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.progressTrack,
  },
  coverContainer: {
    width: 70,
    height: 70,
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
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 16,
  },
});