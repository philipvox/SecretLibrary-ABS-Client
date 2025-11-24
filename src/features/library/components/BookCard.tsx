/**
 * src/features/library/components/BookCard.tsx
 * 
 * Card component for displaying audiobook in library grid.
 * Uses metadata utility for consistent data extraction.
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

interface BookCardProps {
  book: LibraryItem;
}

export function BookCard({ book }: BookCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('BookDetail' as never, { bookId: book.id } as never);
  };

  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.coverContainer}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: '31%',
  },
  pressed: {
    opacity: 0.7,
  },
  coverContainer: {
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.medium,
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
    fontSize: 32,
  },
  info: {
    marginTop: theme.spacing[2],
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    lineHeight: 16,
    marginBottom: 2,
  },
  author: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    lineHeight: 14,
  },
});