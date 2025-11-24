/**
 * src/features/search/components/SearchResultItem.tsx
 * 
 * Search result item showing book cover, title, author.
 * Uses metadata utility for consistent data extraction.
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName, getFormattedDuration } from '@/shared/utils/metadata';

interface SearchResultItemProps {
  item: LibraryItem;
}

export function SearchResultItem({ item }: SearchResultItemProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('BookDetail' as never, { bookId: item.id } as never);
  };

  const coverUrl = apiClient.getItemCoverUrl(item.id);
  const title = getTitle(item);
  const author = getAuthorName(item);
  const duration = getFormattedDuration(item);

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
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
        <Text style={styles.duration}>{duration}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  coverContainer: {
    width: 60,
    height: 90,
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
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1],
  },
  duration: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
  },
});