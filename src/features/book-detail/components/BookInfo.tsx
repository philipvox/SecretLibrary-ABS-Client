/**
 * src/features/book-detail/components/BookInfo.tsx
 * 
 * Displays book metadata including author, narrator, duration, description.
 * Uses metadata utility for consistent data extraction.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LibraryItem } from '@/core/types';
import { colors, spacing, radius } from '@/shared/theme';
import {
  getTitle,
  getAuthorName,
  getNarratorName,
  getDescription,
  getFormattedDuration,
  getPublishedYear,
  getSeriesWithSequence,
  getGenres,
} from '@/shared/utils/metadata';

interface BookInfoProps {
  book: LibraryItem;
}

export function BookInfo({ book }: BookInfoProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const title = getTitle(book);
  const author = getAuthorName(book);
  const narrator = getNarratorName(book);
  const description = getDescription(book);
  const duration = getFormattedDuration(book);
  const publishedYear = getPublishedYear(book);
  const seriesName = getSeriesWithSequence(book);
  const genres = getGenres(book);

  const shouldTruncate = description.length > 200;
  const displayDescription = shouldTruncate && !showFullDescription
    ? description.slice(0, 200) + '...'
    : description;

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Author */}
      <Text style={styles.author}>{author}</Text>

      {/* Narrator */}
      {narrator && narrator !== 'Unknown Narrator' && (
        <Text style={styles.narrator}>Narrated by {narrator}</Text>
      )}

      {/* Metadata Row */}
      <View style={styles.metadataRow}>
        <View style={styles.metadataItem}>
          <Text style={styles.metadataLabel}>Duration</Text>
          <Text style={styles.metadataValue}>{duration}</Text>
        </View>
        
        {publishedYear && (
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Published</Text>
            <Text style={styles.metadataValue}>{publishedYear}</Text>
          </View>
        )}
        
        {seriesName && (
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Series</Text>
            <Text style={styles.metadataValue} numberOfLines={1}>{seriesName}</Text>
          </View>
        )}
      </View>

      {/* Genres */}
      {genres.length > 0 && (
        <View style={styles.genresContainer}>
          {genres.map((genre, index) => (
            <View key={index} style={styles.genreTag}>
              <Text style={styles.genreText}>{genre}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Description */}
      {description ? (
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{displayDescription}</Text>
          {shouldTruncate && (
            <TouchableOpacity onPress={() => setShowFullDescription(!showFullDescription)}>
              <Text style={styles.readMore}>
                {showFullDescription ? 'Show Less' : 'Read More'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  narrator: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  metadataItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  genreTag: {
    backgroundColor: colors.accentSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xl,
  },
  genreText: {
    fontSize: 13,
    color: colors.accentDark,
    fontWeight: '500',
  },
  descriptionContainer: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  readMore: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});