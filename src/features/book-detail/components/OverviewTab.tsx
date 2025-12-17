/**
 * src/features/book-detail/components/OverviewTab.tsx
 *
 * Compact overview tab with tappable metadata chips for author, narrator, genres.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryItem } from '@/core/types';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

interface OverviewTabProps {
  book: LibraryItem;
  showFullDetails?: boolean;
}

export function OverviewTab({ book, showFullDetails = false }: OverviewTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigation = useNavigation<any>();

  const metadata = book.media.metadata as any;
  const description = metadata.description || '';

  // Parse authors (handle both string and array formats)
  const authors: string[] = [];
  if (metadata.authorName) {
    authors.push(...metadata.authorName.split(',').map((a: string) => a.trim()).filter(Boolean));
  } else if (metadata.authors?.length > 0) {
    metadata.authors.forEach((a: any) => {
      const name = typeof a === 'string' ? a : a.name;
      if (name) authors.push(name.trim());
    });
  }

  // Parse narrators
  const narrators: string[] = [];
  let rawNarrator = metadata.narratorName || '';
  if (!rawNarrator && metadata.narrators?.length > 0) {
    metadata.narrators.forEach((n: any) => {
      const name = typeof n === 'string' ? n : n.name;
      if (name) narrators.push(name.replace(/^Narrated by\s*/i, '').trim());
    });
  } else if (rawNarrator) {
    narrators.push(...rawNarrator.replace(/^Narrated by\s*/i, '').split(',').map((n: string) => n.trim()).filter(Boolean));
  }

  // Genres
  const genres: string[] = metadata.genres || [];

  // Series info
  const seriesName = metadata.seriesName || metadata.series?.[0]?.name || null;

  const needsExpansion = description.length > 200;
  const displayDescription = needsExpansion && !isExpanded
    ? description.substring(0, 200) + '...'
    : description;

  const handleAuthorPress = (authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  };

  const handleNarratorPress = (narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
  };

  const handleGenrePress = (genre: string) => {
    navigation.navigate('GenreDetail', { genreName: genre });
  };

  const handleSeriesPress = () => {
    if (seriesName) {
      const cleanName = seriesName.replace(/\s*#[\d.]+$/, '').trim();
      navigation.navigate('SeriesDetail', { seriesName: cleanName });
    }
  };

  return (
    <View style={styles.container}>
      {/* Description */}
      {description ? (
        <View style={styles.descriptionSection}>
          <Text style={styles.description}>{displayDescription}</Text>
          {needsExpansion && (
            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              accessibilityLabel={isExpanded ? 'Read less' : 'Read more'}
              accessibilityRole="button"
            >
              <Text style={styles.readMore}>{isExpanded ? 'Read Less' : 'Read More'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.descriptionSection}>
          <Text style={styles.noDescription}>No description available</Text>
        </View>
      )}

      {/* Metadata chips */}
      <View style={styles.metadataSection}>
        {/* Authors */}
        {authors.length > 0 && (
          <View style={styles.metadataRow}>
            <Ionicons name="person-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
            <View style={styles.chipContainer}>
              {authors.map((author, idx) => (
                <TouchableOpacity
                  key={`author-${idx}`}
                  style={styles.chip}
                  onPress={() => handleAuthorPress(author)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Author: ${author}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view author details"
                >
                  <Text style={styles.chipText}>{author}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Narrators */}
        {narrators.length > 0 && (
          <View style={styles.metadataRow}>
            <Ionicons name="mic-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
            <View style={styles.chipContainer}>
              {narrators.map((narrator, idx) => (
                <TouchableOpacity
                  key={`narrator-${idx}`}
                  style={styles.chip}
                  onPress={() => handleNarratorPress(narrator)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Narrator: ${narrator}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view narrator details"
                >
                  <Text style={styles.chipText}>{narrator}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Series */}
        {seriesName && (
          <View style={styles.metadataRow}>
            <Ionicons name="library-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
            <TouchableOpacity
              style={styles.chip}
              onPress={handleSeriesPress}
              activeOpacity={0.7}
              accessibilityLabel={`Series: ${seriesName}`}
              accessibilityRole="button"
              accessibilityHint="Double tap to view series details"
            >
              <Text style={styles.chipText}>{seriesName}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Genres */}
        {genres.length > 0 && (
          <View style={styles.metadataRow}>
            <Ionicons name="pricetag-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
            <View style={styles.chipContainer}>
              {genres.slice(0, 4).map((genre, idx) => (
                <TouchableOpacity
                  key={`genre-${idx}`}
                  style={[styles.chip, styles.genreChip]}
                  onPress={() => handleGenrePress(genre)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Genre: ${genre}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view books in this genre"
                >
                  <Text style={styles.genreChipText}>#{genre.toLowerCase()}</Text>
                </TouchableOpacity>
              ))}
              {genres.length > 4 && (
                <Text style={styles.moreGenres}>+{genres.length - 4}</Text>
              )}
            </View>
          </View>
        )}

        {/* Additional details if showFullDetails */}
        {showFullDetails && (
          <>
            {metadata.publishedYear && (
              <View style={styles.metadataRow}>
                <Ionicons name="calendar-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
                <Text style={styles.detailText}>{metadata.publishedYear}</Text>
              </View>
            )}
            {metadata.publisher && (
              <View style={styles.metadataRow}>
                <Ionicons name="business-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
                <Text style={styles.detailText}>{metadata.publisher}</Text>
              </View>
            )}
            {metadata.language && (
              <View style={styles.metadataRow}>
                <Ionicons name="globe-outline" size={scale(14)} color="rgba(255,255,255,0.4)" />
                <Text style={styles.detailText}>{metadata.language}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
  },
  descriptionSection: {
    paddingHorizontal: scale(20),
    marginBottom: scale(20),
  },
  description: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.7)',
    lineHeight: scale(22),
  },
  noDescription: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  readMore: {
    fontSize: scale(13),
    fontWeight: '600',
    color: ACCENT,
    marginTop: scale(8),
  },

  // Metadata section
  metadataSection: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(10),
  },
  chipContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(16),
  },
  chipText: {
    fontSize: scale(12),
    color: '#fff',
    fontWeight: '500',
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genreChipText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.6)',
  },
  moreGenres: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
    alignSelf: 'center',
  },
  detailText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.6)',
  },
});
