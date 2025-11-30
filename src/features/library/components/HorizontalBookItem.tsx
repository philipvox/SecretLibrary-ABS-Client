// File: src/features/library/components/HorizontalBookItem.tsx
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

interface HorizontalBookItemProps {
  book: LibraryItem;
}

export function HorizontalBookItem({ book }: HorizontalBookItemProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('BookDetail' as never, { bookId: book.id } as never);
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
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[100],
  },
  coverContainer: {
    width: 70,
    height: 70,
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
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing[3],
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
    lineHeight: 20,
  },
  author: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1],
  },
  description: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    lineHeight: 16,
  },
});