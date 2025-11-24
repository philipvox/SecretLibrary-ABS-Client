import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LibraryItem } from '@/core/types';
import { theme } from '@/shared/theme';

interface BookInfoProps {
  book: LibraryItem;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function BookInfo({ book }: BookInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const metadata = book.media.metadata;
  const duration = book.media.duration || 0;
  const description = metadata.description || '';
  const publishedYear = metadata.publishedYear || null;
  const genres = metadata.genres || [];
  const series = metadata.series?.[0];
  
  const needsExpansion = description.length > 150;
  const displayDescription = needsExpansion && !isExpanded 
    ? description.substring(0, 150) + '...' 
    : description;

  return (
    <View style={styles.container}>
      {/* Metadata Row */}
      <View style={styles.metadataRow}>
        <View style={styles.metadataItem}>
          <Text style={styles.metadataLabel}>DURATION</Text>
          <Text style={styles.metadataValue}>{formatDuration(duration)}</Text>
        </View>
        {publishedYear && (
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>PUBLISHED</Text>
            <Text style={styles.metadataValue}>{publishedYear}</Text>
          </View>
        )}
        {series && (
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>SERIES</Text>
            <Text style={styles.metadataValue} numberOfLines={1}>
              {series.name}{series.sequence ? ` #${series.sequence}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Genre Tags */}
      {genres.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.genresScroll}
          contentContainerStyle={styles.genresContainer}
        >
          {genres.map((genre, index) => (
            <View key={index} style={styles.genreTag}>
              <Text style={styles.genreText}>{genre}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* About Section */}
      {description ? (
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{displayDescription}</Text>
          {needsExpansion && (
            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
              <Text style={styles.readMoreButton}>
                {isExpanded ? 'Read Less' : 'Read More'}
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
  },
  metadataRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.large,
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  metadataItem: {
    flex: 1,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: theme.spacing[1],
  },
  metadataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  genresScroll: {
    marginBottom: theme.spacing[4],
    marginHorizontal: -theme.spacing[5],
  },
  genresContainer: {
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[2],
    flexDirection: 'row',
  },
  genreTag: {
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
  },
  genreText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.primary[600],
  },
  aboutSection: {
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[3],
  },
  description: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    lineHeight: 24,
  },
  readMoreButton: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary[500],
    marginTop: theme.spacing[2],
  },
});