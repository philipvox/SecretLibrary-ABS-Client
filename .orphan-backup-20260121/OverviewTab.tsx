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
import { User, Mic, Calendar, Building, Globe, Tag } from 'lucide-react-native';
import { LibraryItem } from '@/core/types';
import { useColors, scale, spacing, radius } from '@/shared/theme';

interface OverviewTabProps {
  book: LibraryItem;
  showFullDetails?: boolean;
}

export function OverviewTab({ book, showFullDetails = false }: OverviewTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigation = useNavigation<any>();
  const colors = useColors();

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

  // Parse genres
  const genres: string[] = metadata.genres || [];

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

  const handleGenrePress = (genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  };

  return (
    <View style={styles.container}>
      {/* Description */}
      {description ? (
        <View style={styles.descriptionSection}>
          <Text style={[styles.description, { color: colors.text.secondary }]}>{displayDescription}</Text>
          {needsExpansion && (
            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              accessibilityLabel={isExpanded ? 'Read less' : 'Read more'}
              accessibilityRole="button"
            >
              <Text style={[styles.readMore, { color: colors.text.primary }]}>{isExpanded ? 'Read Less' : 'Read More'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.descriptionSection}>
          <Text style={[styles.noDescription, { color: colors.text.tertiary }]}>No description available</Text>
        </View>
      )}

      {/* Metadata chips */}
      <View style={styles.metadataSection}>
        {/* Authors */}
        {authors.length > 0 && (
          <View style={styles.metadataRow}>
            <User size={scale(14)} color={colors.text.tertiary} strokeWidth={2} />
            <View style={styles.chipContainer}>
              {authors.map((author, idx) => (
                <TouchableOpacity
                  key={`author-${idx}`}
                  style={[styles.chip, { backgroundColor: colors.surface.default }]}
                  onPress={() => handleAuthorPress(author)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Author: ${author}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view author details"
                >
                  <Text style={[styles.chipText, { color: colors.text.primary }]}>{author}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Narrators */}
        {narrators.length > 0 && (
          <View style={styles.metadataRow}>
            <Mic size={scale(14)} color={colors.text.tertiary} strokeWidth={2} />
            <View style={styles.chipContainer}>
              {narrators.map((narrator, idx) => (
                <TouchableOpacity
                  key={`narrator-${idx}`}
                  style={[styles.chip, { backgroundColor: colors.surface.default }]}
                  onPress={() => handleNarratorPress(narrator)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Narrator: ${narrator}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view narrator details"
                >
                  <Text style={[styles.chipText, { color: colors.text.primary }]}>{narrator}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Genres */}
        {genres.length > 0 && (
          <View style={styles.metadataRow}>
            <Tag size={scale(14)} color={colors.text.tertiary} strokeWidth={2} />
            <View style={styles.chipContainer}>
              {genres.map((genre, idx) => (
                <TouchableOpacity
                  key={`genre-${idx}`}
                  style={[styles.chip, { backgroundColor: colors.surface.default }]}
                  onPress={() => handleGenrePress(genre)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Genre: ${genre}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to view genre details"
                >
                  <Text style={[styles.chipText, { color: colors.text.primary }]}>{genre}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Additional details if showFullDetails */}
        {showFullDetails && (
          <>
            {metadata.publishedYear && (
              <View style={styles.metadataRow}>
                <Calendar size={scale(14)} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={[styles.detailText, { color: colors.text.secondary }]}>{metadata.publishedYear}</Text>
              </View>
            )}
            {metadata.publisher && (
              <View style={styles.metadataRow}>
                <Building size={scale(14)} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={[styles.detailText, { color: colors.text.secondary }]}>{metadata.publisher}</Text>
              </View>
            )}
            {metadata.language && (
              <View style={styles.metadataRow}>
                <Globe size={scale(14)} color={colors.text.tertiary} strokeWidth={2} />
                <Text style={[styles.detailText, { color: colors.text.secondary }]}>{metadata.language}</Text>
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
    lineHeight: scale(22),
  },
  noDescription: {
    fontSize: scale(14),
    fontStyle: 'italic',
  },
  readMore: {
    fontSize: scale(13),
    fontWeight: '600',
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
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(16),
  },
  chipText: {
    fontSize: scale(12),
    fontWeight: '500',
  },
  detailText: {
    fontSize: scale(13),
  },
});
