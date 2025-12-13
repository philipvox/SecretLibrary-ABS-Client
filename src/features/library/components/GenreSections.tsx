/**
 * src/features/library/components/GenreSections.tsx
 *
 * Section components for the redesigned Genre Browse page:
 * - MetaCategorySection: Collapsible category with genres
 * - YourGenresSection: Personalized horizontal scroll
 * - PopularGenresSection: Top genres grid
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GenreCardLarge,
  GenreCardCompact,
} from './GenreCards';
import { MetaCategory, GenreWithData } from '../constants/genreCategories';
import { StackedCovers } from '@/shared/components';
import { apiClient } from '@/core/api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// MetaCategorySection - Collapsible category with genres
// =============================================================================

interface MetaCategorySectionProps {
  metaCategory: MetaCategory;
  genres: GenreWithData[];
  totalBooks: number;
  isExpanded: boolean;
  onToggle: () => void;
  onGenrePress: (genreName: string) => void;
}

export function MetaCategorySection({
  metaCategory,
  genres,
  totalBooks,
  isExpanded,
  onToggle,
  onGenrePress,
}: MetaCategorySectionProps) {
  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  }, [onToggle]);

  // Get cover URLs from genres in this category (up to 3 unique covers)
  const coverUrls = useMemo(() => {
    const urls: string[] = [];
    for (const genre of genres) {
      for (const coverId of genre.coverIds) {
        if (urls.length >= 3) break;
        const url = apiClient.getItemCoverUrl(coverId);
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }
      if (urls.length >= 3) break;
    }
    return urls;
  }, [genres]);

  return (
    <View style={styles.metaSection}>
      {/* Header */}
      <TouchableOpacity
        style={styles.metaHeader}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.metaHeaderLeft}>
          {/* Stacked covers instead of icon - NNGroup research: visual scent */}
          <View style={styles.metaCoversContainer}>
            <StackedCovers
              coverUrls={coverUrls}
              size={28}
              offset={6}
              maxCovers={3}
              borderRadius={4}
            />
          </View>
          <View>
            <Text style={styles.metaTitle}>{metaCategory.name}</Text>
            <Text style={styles.metaSubtitle}>
              {genres.length} genres · {totalBooks} books
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color="rgba(255,255,255,0.5)"
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.metaContent}>
          <View style={styles.metaGenreGrid}>
            {genres.map((genre) => (
              <GenreCardCompact
                key={genre.name}
                genre={genre}
                onPress={() => onGenrePress(genre.name)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// YourGenresSection - Personalized horizontal scroll
// =============================================================================

interface YourGenresSectionProps {
  genres: GenreWithData[];
  onGenrePress: (genreName: string) => void;
  onSeeAll?: () => void;
}

export function YourGenresSection({
  genres,
  onGenrePress,
  onSeeAll,
}: YourGenresSectionProps) {
  if (genres.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Genres</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {genres.slice(0, 5).map((genre) => (
          <GenreCardLarge
            key={genre.name}
            genre={genre}
            onPress={() => onGenrePress(genre.name)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// PopularGenresSection - Top genres horizontal scroll (same style as Your Genres)
// =============================================================================

interface PopularGenresSectionProps {
  genres: GenreWithData[];
  onGenrePress: (genreName: string) => void;
}

export function PopularGenresSection({
  genres,
  onGenrePress,
}: PopularGenresSectionProps) {
  if (genres.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular Genres</Text>
      </View>

      {/* Horizontal Scroll - same as Your Genres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {genres.slice(0, 6).map((genre) => (
          <GenreCardLarge
            key={genre.name}
            genre={genre}
            onPress={() => onGenrePress(genre.name)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// AlphabetIndex - Quick navigation for flat list
// =============================================================================

interface AlphabetIndexProps {
  letters: string[];
  activeLetter: string | null;
  onLetterPress: (letter: string) => void;
}

export function AlphabetIndex({
  letters,
  activeLetter,
  onLetterPress,
}: AlphabetIndexProps) {
  return (
    <View style={styles.alphabetIndex}>
      {letters.map((letter) => (
        <TouchableOpacity
          key={letter}
          style={[
            styles.alphabetLetter,
            activeLetter === letter && styles.alphabetLetterActive,
          ]}
          onPress={() => onLetterPress(letter)}
        >
          <Text
            style={[
              styles.alphabetText,
              activeLetter === letter && styles.alphabetTextActive,
            ]}
          >
            {letter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// =============================================================================
// SectionStickyHeader - For sticky A-Z headers
// =============================================================================

interface SectionStickyHeaderProps {
  letter: string;
}

export function SectionStickyHeader({ letter }: SectionStickyHeaderProps) {
  return (
    <View style={styles.stickyHeader}>
      <Text style={styles.stickyHeaderText}>{letter}</Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Section Styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 13,
    color: '#F4B60C',
    fontWeight: '500',
  },
  horizontalScroll: {
    paddingHorizontal: 16,
  },

  // Meta Category Section
  metaSection: {
    marginBottom: 8,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  metaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaCoversContainer: {
    width: 44, // Account for stacked offset
    height: 42, // 28 * 1.5 = 42 for aspect ratio
    marginRight: 12,
    justifyContent: 'center',
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metaSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  metaContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  metaGenreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Alphabet Index
  alphabetIndex: {
    position: 'absolute',
    right: 2,
    top: '10%',
    bottom: '10%',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: 20,
    zIndex: 100,
  },
  alphabetLetter: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alphabetLetterActive: {
    backgroundColor: '#F4B60C',
    borderRadius: 9,
  },
  alphabetText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  alphabetTextActive: {
    color: '#000',
  },

  // Sticky Header
  stickyHeader: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  stickyHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4B60C',
  },
});
