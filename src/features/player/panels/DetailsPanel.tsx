/**
 * src/features/player/panels/DetailsPanel.tsx
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { formatTime } from '../utils';
import {
  getAuthorName,
  getNarratorName,
  getDescription,
  getSeriesWithSequence,
} from '@/shared/utils/metadata';
import type { LibraryItem } from '@/core/api';

interface DetailsPanelProps {
  book: LibraryItem;
  duration: number;
  chaptersCount: number;
  isLight: boolean;
}

export function DetailsPanel({ book, duration, chaptersCount, isLight }: DetailsPanelProps) {
  const textColor = isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const descColor = isLight ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)';

  // Extract metadata using utilities
  const author = getAuthorName(book);
  const narrator = getNarratorName(book);
  const description = getDescription(book);
  const series = getSeriesWithSequence(book);

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
          <Text style={[styles.value, { color: textColor }]}>{author}</Text>
        </View>
      )}

      {/* Narrator */}
      {narrator && narrator !== 'Unknown Narrator' && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>NARRATOR</Text>
          <Text style={[styles.value, { color: textColor }]}>{narrator}</Text>
        </View>
      )}

      {/* Series */}
      {series && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: secondaryColor }]}>SERIES</Text>
          <Text style={[styles.value, { color: textColor }]}>{series}</Text>
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
      </View>

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
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16,
    gap: 32,
  },
  statItem: {
    flex: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
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