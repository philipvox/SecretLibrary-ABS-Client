/**
 * Book header - cleaner, more spacious
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

interface BookHeaderProps {
  book: LibraryItem;
}

export function BookHeader({ book }: BookHeaderProps) {
  const metadata = book.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0;
  
  const coverUrl = apiClient.getItemCoverUrl(book.id);

  return (
    <View style={styles.container}>
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.author}>{author}</Text>
        {narrator && <Text style={styles.narrator}>Narrated by {narrator}</Text>}

        {hasProgress && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}% Complete</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing[6],
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  coverContainer: {
    width: 220,
    height: 330,
    borderRadius: theme.radius.xlarge,
    backgroundColor: theme.colors.neutral[100],
    overflow: 'hidden',
    marginBottom: theme.spacing[6],
    ...theme.elevation.medium,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
  },
  title: {
    ...theme.textStyles.h2,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
    fontWeight: '700',
  },
  author: {
    ...theme.textStyles.body,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[1],
  },
  narrator: {
    ...theme.textStyles.bodySmall,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  progressSection: {
    width: '100%',
    marginTop: theme.spacing[3],
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.progress.background,
    borderRadius: theme.radius.small,
    overflow: 'hidden',
    marginBottom: theme.spacing[2],
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.progress.fill,
    borderRadius: theme.radius.small,
  },
  progressText: {
    ...theme.textStyles.caption,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },
});