import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

interface BookHeaderProps {
  book: LibraryItem;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
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
        <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
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
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[5],
  },
  coverContainer: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: theme.radius.xlarge,
    backgroundColor: theme.colors.neutral[200],
    overflow: 'hidden',
    marginBottom: theme.spacing[5],
    ...theme.elevation.medium,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
  },
  author: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[1],
  },
  narrator: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },
});