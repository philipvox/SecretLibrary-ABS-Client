/**
 * src/features/player/panels/DetailsPanel.tsx
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  getAuthorName,
  getNarratorName,
  getDescription,
  getSeriesWithSequence,
} from '@/shared/utils/metadata';

interface DetailsPanelProps {
  book: any;
  duration: number;
  chaptersCount: number;
  isLight?: boolean;
  textColor?: string;
  secondaryColor?: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function DetailsPanel({
  book,
  duration,
  chaptersCount,
  isLight = false,
  textColor,
  secondaryColor,
}: DetailsPanelProps) {
  const text = textColor || (isLight ? '#000000' : '#FFFFFF');
  const secondary = secondaryColor || (isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)');
  const chipBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';

  const author = getAuthorName(book);
  const narrator = getNarratorName(book);
  const description = getDescription(book);
  const series = getSeriesWithSequence(book);

  // Extract metadata
  const metadata = book?.media?.metadata || book?.mediaMetadata || {};
  const genres: string[] = metadata.genres || [];
  const publishedYear = metadata.publishedYear || '';
  const language = metadata.language || 'English';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Author & Narrator Row */}
      <View style={styles.headerRow}>
        {author && author !== 'Unknown Author' && (
          <View style={styles.headerItem}>
            <Text style={[styles.label, { color: secondary }]}>By</Text>
            <Text style={[styles.headerValue, { color: text }]} numberOfLines={1}>
              {author}
            </Text>
          </View>
        )}
        {narrator && narrator !== 'Unknown Narrator' && (
          <View style={styles.headerItem}>
            <Text style={[styles.label, { color: secondary }]}>Read by</Text>
            <Text style={[styles.headerValue, { color: text }]} numberOfLines={1}>
              {narrator}
            </Text>
          </View>
        )}
      </View>

      {/* Description */}
      {description && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: secondary }]}>Desc.</Text>
          <Text style={[styles.description, { color: text }]} numberOfLines={5}>
            {description}
          </Text>
        </View>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: secondary }]}>Genres</Text>
          <View style={styles.chipRow}>
            {genres.map((genre, idx) => (
              <View key={idx} style={[styles.chip, { backgroundColor: chipBg }]}>
                <Text style={[styles.chipText, { color: text }]}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Series */}
      {series && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: secondary }]}>Series</Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: chipBg }]}>
              <Text style={[styles.chipText, { color: text }]}>{series}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Metadata Row */}
      <View style={styles.metadataRow}>
        <Text style={[styles.metadataText, { color: text }]}>
          Chapters: {chaptersCount}
        </Text>
        {publishedYear && (
          <>
            <Text style={[styles.metadataSeparator, { color: secondary }]}> | </Text>
            <Text style={[styles.metadataText, { color: text }]}>{publishedYear}</Text>
          </>
        )}
        {language && (
          <>
            <Text style={[styles.metadataSeparator, { color: secondary }]}> | </Text>
            <Text style={[styles.metadataText, { color: text }]}>{language}</Text>
          </>
        )}
        {duration > 0 && (
          <>
            <Text style={[styles.metadataSeparator, { color: secondary }]}> | </Text>
            <Text style={[styles.metadataText, { color: text }]}>
              {formatDuration(duration)}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 24,
  },
  headerItem: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 2,
  },
  headerValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  metadataText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metadataSeparator: {
    fontSize: 14,
  },
});

export default DetailsPanel;
