/**
 * src/features/player/panels/DetailsPanel.tsx
 * Matches the Figma/Anima design with horizontal By/Read by layout
 * Links to author, narrator, series, and genre detail screens
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  getAuthorName,
  getNarratorName,
  getDescription,
  getSeriesName,
  getSeriesWithSequence,
} from '@/shared/utils/metadata';
import { spacing, radius } from '@/shared/theme';

interface DetailsPanelProps {
  book: any;
  duration: number;
  chaptersCount: number;
  isLight?: boolean;
  onClose?: () => void;
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
  onClose,
}: DetailsPanelProps) {
  const navigation = useNavigation();
  const text = isLight ? '#000000' : '#FFFFFF';
  const secondary = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';
  const borderColor = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';

  const author = getAuthorName(book);
  const narrator = getNarratorName(book);
  const description = getDescription(book);
  const series = getSeriesWithSequence(book);
  const seriesName = getSeriesName(book);

  // Extract metadata
  const metadata = book?.media?.metadata || book?.mediaMetadata || {};
  const genres: string[] = metadata.genres || [];
  const publishedYear = metadata.publishedYear || '';
  const language = metadata.language || 'English';

  const hasAuthor = author && author !== 'Unknown Author';
  const hasNarrator = narrator && narrator !== 'Unknown Narrator';

  // Navigation handlers - close player first then navigate
  const handleAuthorPress = () => {
    onClose?.();
    setTimeout(() => {
      navigation.navigate('AuthorDetail' as never, { authorName: author } as never);
    }, 300);
  };

  const handleNarratorPress = () => {
    onClose?.();
    setTimeout(() => {
      navigation.navigate('NarratorDetail' as never, { narratorName: narrator } as never);
    }, 300);
  };

  const handleSeriesPress = () => {
    if (!seriesName) return;
    onClose?.();
    setTimeout(() => {
      navigation.navigate('SeriesDetail' as never, { seriesName } as never);
    }, 300);
  };

  const handleGenrePress = (genre: string) => {
    onClose?.();
    setTimeout(() => {
      navigation.navigate('GenreDetail' as never, { genreName: genre } as never);
    }, 300);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      {/* Author & Narrator Row - Horizontal layout */}
      {(hasAuthor || hasNarrator) && (
        <View style={styles.headerRow}>
          {hasAuthor && (
            <TouchableOpacity style={styles.headerItem} onPress={handleAuthorPress} activeOpacity={0.7}>
              <Text style={[styles.label, { color: secondary }]}>By</Text>
              <Text style={[styles.headerValue, styles.linkText, { color: text }]} numberOfLines={1}>
                {author}
              </Text>
            </TouchableOpacity>
          )}
          {hasNarrator && (
            <TouchableOpacity style={styles.headerItem} onPress={handleNarratorPress} activeOpacity={0.7}>
              <Text style={[styles.label, { color: secondary }]}>Read by</Text>
              <Text style={[styles.headerValue, styles.linkText, { color: text }]} numberOfLines={1}>
                {narrator}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Description - Full text */}
      {description && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: secondary }]}>Desc.</Text>
          <Text style={[styles.description, { color: text }]}>
            {description}
          </Text>
        </View>
      )}

      {/* Genres - Bordered pills, touchable */}
      {genres.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: secondary }]}>Genres</Text>
          <View style={styles.pillRow}>
            {genres.map((genre, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.pill, { borderColor }]}
                onPress={() => handleGenrePress(genre)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, { color: text }]}>{genre}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Series - Bordered pill, touchable */}
      {series && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: secondary }]}>Series</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[styles.pill, { borderColor }]}
              onPress={handleSeriesPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, { color: text }]}>{series}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Metadata Row */}
      <View style={styles.metadataRow}>
        <Text style={[styles.metadataText, { color: text }]}>
          Chapters: {chaptersCount}
        </Text>
        {publishedYear && (
          <Text style={[styles.metadataText, { color: text }]}>{publishedYear}</Text>
        )}
        {language && (
          <Text style={[styles.metadataText, { color: text }]}>{language}</Text>
        )}
        {duration > 0 && (
          <Text style={[styles.metadataText, { color: text }]}>
            {formatDuration(duration)}
          </Text>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    gap: spacing['3xl'],
  },
  headerItem: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
  },
  headerValue: {
    fontSize: 20,
    fontWeight: '400',
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: spacing.xl,
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
    marginTop: spacing.xs,
    fontWeight: '400',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 16,
    fontWeight: '400',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  metadataText: {
    fontSize: 16,
    fontWeight: '400',
  },
});

export { DetailsPanel };
