/**
 * src/features/player/panels/DetailsPanel.tsx
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  getAuthorName,
  getNarratorName,
  getDescription,
  getSeriesWithSequence,
  getSeriesName,
  getPublishedYear,
  getGenres,
} from '@/shared/utils/metadata';
import type { LibraryItem } from '@/core/api';

interface DetailsPanelProps {
  book: LibraryItem;
  duration: number;
  chaptersCount: number;
  isLight: boolean;
  onNavigateToAuthor?: (authorName: string) => void;
  onNavigateToNarrator?: (narratorName: string) => void;
  onNavigateToSeries?: (seriesName: string) => void;
}

export function DetailsPanel({
  book,
  duration,
  chaptersCount,
  isLight,
  onNavigateToAuthor,
  onNavigateToNarrator,
  onNavigateToSeries,
}: DetailsPanelProps) {
  const textColor = isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const descColor = isLight ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)';
  const tagBgColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const linkColor = isLight ? '#007AFF' : '#4DA3FF';

  // Extract metadata using utilities
  const author = getAuthorName(book);
  const narrator = getNarratorName(book);
  const description = getDescription(book);
  const series = getSeriesWithSequence(book);
  const seriesName = getSeriesName(book);
  const publishedYear = getPublishedYear(book);
  const genres = getGenres(book);
  const metadata = (book?.media?.metadata as any) || {};
  const publisher = metadata.publisher || null;
  const language = metadata.language || null;

  const handleAuthorPress = () => {
    if (author && author !== 'Unknown Author' && onNavigateToAuthor) {
      onNavigateToAuthor(author);
    }
  };

  const handleNarratorPress = () => {
    if (narrator && narrator !== 'Unknown Narrator' && onNavigateToNarrator) {
      onNavigateToNarrator(narrator);
    }
  };

  const handleSeriesPress = () => {
    if (seriesName && onNavigateToSeries) {
      onNavigateToSeries(seriesName);
    }
  };

  // Check if navigation is available
  const canNavigateToAuthor = !!onNavigateToAuthor && author && author !== 'Unknown Author';
  const canNavigateToNarrator = !!onNavigateToNarrator && narrator && narrator !== 'Unknown Narrator';
  const canNavigateToSeries = !!onNavigateToSeries && !!seriesName;

  // Format duration nicely
  const formatDurationLong = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Author */}
      {author && author !== 'Unknown Author' && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>AUTHOR</Text>
          {canNavigateToAuthor ? (
            <TouchableOpacity onPress={handleAuthorPress} activeOpacity={0.7}>
              <Text style={[styles.value, styles.link, { color: linkColor }]}>{author}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.value, { color: textColor }]}>{author}</Text>
          )}
        </View>
      )}

      {/* Narrator */}
      {narrator && narrator !== 'Unknown Narrator' && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>NARRATOR</Text>
          {canNavigateToNarrator ? (
            <TouchableOpacity onPress={handleNarratorPress} activeOpacity={0.7}>
              <Text style={[styles.value, styles.link, { color: linkColor }]}>{narrator}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.value, { color: textColor }]}>{narrator}</Text>
          )}
        </View>
      )}

      {/* Series */}
      {series && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>SERIES</Text>
          {canNavigateToSeries ? (
            <TouchableOpacity onPress={handleSeriesPress} activeOpacity={0.7}>
              <Text style={[styles.value, styles.link, { color: linkColor }]}>{series}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.value, { color: textColor }]}>{series}</Text>
          )}
        </View>
      )}

      {/* Publisher */}
      {publisher && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>PUBLISHER</Text>
          <Text style={[styles.value, { color: textColor }]}>{publisher}</Text>
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.label, { color: secondaryColor }]}>DURATION</Text>
          <Text style={[styles.statValue, { color: textColor }]}>
            {formatDurationLong(duration)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.label, { color: secondaryColor }]}>CHAPTERS</Text>
          <Text style={[styles.statValue, { color: textColor }]}>{chaptersCount}</Text>
        </View>
        {publishedYear && (
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: secondaryColor }]}>YEAR</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{publishedYear}</Text>
          </View>
        )}
      </View>

      {/* Language */}
      {language && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>LANGUAGE</Text>
          <Text style={[styles.value, { color: textColor }]}>{language}</Text>
        </View>
      )}

      {/* Genres/Tags */}
      {genres.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={[styles.label, { color: secondaryColor }]}>GENRES</Text>
          <View style={styles.tagsRow}>
            {genres.slice(0, 4).map((genre: string, idx: number) => (
              <View key={idx} style={[styles.tag, { backgroundColor: tagBgColor }]}>
                <Text style={[styles.tagText, { color: textColor }]}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Description */}
      {description && (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.label, { color: secondaryColor }]}>DESCRIPTION</Text>
          <Text style={[styles.description, { color: descColor }]}>
            {description}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  link: {
    textDecorationLine: 'underline',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16,
    gap: 24,
  },
  statItem: {
    flex: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  tagsSection: {
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
});

export default DetailsPanel;
