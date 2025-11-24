/**
 * src/features/book-detail/components/BookInfo.tsx
 * 
 * Displays book metadata including author, narrator, duration, description.
 * Uses metadata utility for consistent data extraction.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LibraryItem } from '@/core/types';
import { theme } from '@/shared/theme';
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
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
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
    marginBottom: theme.spacing[4],
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: theme.spacing[4],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.light,
    marginBottom: theme.spacing[4],
  },
  metadataItem: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    borderRightWidth: 1,
    borderRightColor: theme.colors.border.light,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing[1],
  },
  metadataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: theme.spacing[4],
    gap: theme.spacing[2],
  },
  genreTag: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radius.full,
  },
  genreText: {
    fontSize: 13,
    color: theme.colors.primary[700],
    fontWeight: '500',
  },
  descriptionContainer: {
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  description: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    lineHeight: 22,
  },
  readMore: {
    fontSize: 15,
    color: theme.colors.primary[500],
    fontWeight: '600',
    marginTop: theme.spacing[2],
  },
});