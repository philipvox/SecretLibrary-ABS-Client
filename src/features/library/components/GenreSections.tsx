/**
 * src/features/library/components/GenreSections.tsx
 *
 * Section components for the redesigned Genre Browse page:
 * - MetaCategorySection: Collapsible category with genres (uses color dots)
 * - YourGenresSection: Personalized grid with color dot cards
 * - PopularGenresSection: Top genres grid with color dot cards
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import {
  GenreCardLarge,
  GenreCardCompact,
} from './GenreCards';
import { MetaCategory, GenreWithData } from '../constants/genreCategories';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { hashString, SPINE_COLOR_PALETTE } from '@/shared/spine';
import { useTheme } from '@/shared/theme';


// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Get deterministic color for a book based on its ID
function getBookDotColor(bookId: string): string {
  const hash = hashString(bookId);
  return SPINE_COLOR_PALETTE[hash % SPINE_COLOR_PALETTE.length];
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
  const { isDark } = useTheme();

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  }, [onToggle]);

  // Get color dots from genres in this category (up to 5 unique dots)
  const colorDots = useMemo(() => {
    const bookIds: string[] = [];
    for (const genre of genres) {
      for (const coverId of genre.coverIds) {
        if (bookIds.length >= 5) break;
        if (!bookIds.includes(coverId)) {
          bookIds.push(coverId);
        }
      }
      if (bookIds.length >= 5) break;
    }
    return bookIds.map(getBookDotColor);
  }, [genres]);

  return (
    <View style={styles.metaSection}>
      {/* Header */}
      <TouchableOpacity
        style={[
          styles.metaHeader,
          isDark ? styles.metaHeaderDark : styles.metaHeaderLight,
        ]}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.metaHeaderLeft}>
          {/* Color dots instead of stacked covers */}
          <View style={styles.metaDotsContainer}>
            {colorDots.map((color, index) => (
              <View
                key={`${index}-${color}`}
                style={[styles.metaDot, { backgroundColor: color }]}
              />
            ))}
          </View>
          <View style={styles.metaTextContainer}>
            <Text style={[styles.metaTitle, isDark && styles.metaTitleDark]}>
              {metaCategory.name}
            </Text>
            <Text style={styles.metaSubtitle}>
              {genres.length} genres · {totalBooks} books
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronDown size={20} color={secretLibraryColors.gray} strokeWidth={2} />
        ) : (
          <ChevronRight size={20} color={secretLibraryColors.gray} strokeWidth={2} />
        )}
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
                variant={isDark ? 'dark' : 'light'}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// YourGenresSection - Personalized grid
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
  const { colors, isDark } = useTheme();

  if (genres.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Genres</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[styles.seeAllText, { color: colors.accent.primary }]}>See all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Single Column List */}
      <View style={styles.genreList}>
        {genres.slice(0, 6).map((genre) => (
          <GenreCardLarge
            key={genre.name}
            genre={genre}
            onPress={() => onGenrePress(genre.name)}
            variant={isDark ? 'dark' : 'light'}
          />
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// PopularGenresSection - Top genres list (same style as Your Genres)
// =============================================================================

interface PopularGenresSectionProps {
  genres: GenreWithData[];
  onGenrePress: (genreName: string) => void;
}

export function PopularGenresSection({
  genres,
  onGenrePress,
}: PopularGenresSectionProps) {
  const { isDark } = useTheme();

  if (genres.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular Genres</Text>
      </View>

      {/* Single Column List */}
      <View style={styles.genreList}>
        {genres.slice(0, 6).map((genre) => (
          <GenreCardLarge
            key={genre.name}
            genre={genre}
            onPress={() => onGenrePress(genre.name)}
            variant={isDark ? 'dark' : 'light'}
          />
        ))}
      </View>
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
  const { colors } = useTheme();
  const ACCENT = colors.accent.primary;

  return (
    <View style={styles.alphabetIndex}>
      {letters.map((letter) => (
        <TouchableOpacity
          key={letter}
          style={[
            styles.alphabetLetter,
            activeLetter === letter && [styles.alphabetLetterActive, { backgroundColor: ACCENT }],
          ]}
          onPress={() => onLetterPress(letter)}
        >
          <Text
            style={[
              styles.alphabetText,
              { color: colors.text.secondary },
              activeLetter === letter && [styles.alphabetTextActive, { color: colors.text.inverse }],
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
  const { colors, isDark } = useTheme();
  const ACCENT = colors.accent.primary;

  return (
    <View style={[styles.stickyHeader, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)' }]}>
      <Text style={[styles.stickyHeaderText, { color: ACCENT }]}>{letter}</Text>
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
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: secretLibraryColors.gray,
  },
  seeAllText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  genreList: {
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
  },
  metaHeaderLight: {
    backgroundColor: secretLibraryColors.white,
  },
  metaHeaderDark: {
    backgroundColor: secretLibraryColors.black,
  },
  metaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaDotsContainer: {
    flexDirection: 'row',
    gap: 3,
    marginRight: 14,
  },
  metaDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  metaTextContainer: {
    flex: 1,
  },
  metaTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
    color: secretLibraryColors.black,
    marginBottom: 2,
  },
  metaTitleDark: {
    color: secretLibraryColors.white,
  },
  metaSubtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: secretLibraryColors.gray,
  },
  metaContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  metaGenreGrid: {
    // Single column list
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
    borderRadius: 9,
  },
  alphabetText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    fontWeight: '600',
  },
  alphabetTextActive: {
    // color applied inline
  },

  // Sticky Header
  stickyHeader: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  stickyHeaderText: {
    fontFamily: secretLibraryFonts.playfair.semiBold,
    fontSize: scale(14),
    fontWeight: '700',
  },
});
