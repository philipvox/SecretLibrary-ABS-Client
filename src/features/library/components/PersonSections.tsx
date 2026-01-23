/**
 * src/features/library/components/PersonSections.tsx
 *
 * Section components for Authors and Narrators browse pages:
 * - YourPersonsSection: Personalized list (vertical, max 5)
 * - PopularPersonsSection: Top 6 by book count
 * - MetaCategoryPersonSection: Collapsible category (Fiction Authors, etc.)
 * - PersonCardLarge: Full-width list item with avatar
 * - PersonCardCompact: Compact item for expanded categories
 *
 * Matches the design pattern from GenreSections.tsx but uses avatars
 * instead of color dots since authors/narrators have photos/initials.
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
import { Image } from 'expo-image';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { MetaCategory } from '../constants/genreCategories';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { hashString, SPINE_COLOR_PALETTE } from '@/features/home/utils/spine/adapter';
import { useTheme } from '@/shared/theme';
import { apiClient } from '@/core/api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Types
// =============================================================================

export interface PersonWithData {
  id?: string;
  name: string;
  bookCount: number;
  imagePath?: string;
  primaryGenre: string | null;
  metaCategoryId: string | null;
  sampleBookIds?: string[]; // For color dots in category header
  books?: any[]; // Pre-indexed books for efficient lookups
}

// Avatar color generator based on name
const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Get deterministic color for a book based on its ID (for category header dots)
function getBookDotColor(bookId: string): string {
  const hash = hashString(bookId);
  return SPINE_COLOR_PALETTE[hash % SPINE_COLOR_PALETTE.length];
}

// =============================================================================
// PersonCardLarge - For "Your" and "Popular" sections
// Full-width list layout with avatar
// =============================================================================

interface PersonCardLargeProps {
  person: PersonWithData;
  onPress: () => void;
  variant?: 'light' | 'dark';
  type: 'author' | 'narrator';
}

export function PersonCardLarge({ person, onPress, variant = 'light', type }: PersonCardLargeProps) {
  const isDark = variant === 'dark';
  const hasImage = type === 'author' && person.id && person.imagePath;

  return (
    <TouchableOpacity
      style={[
        styles.largeCard,
        isDark ? styles.cardDark : styles.cardLight,
        isDark ? styles.borderDark : styles.borderLight,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[styles.largeAvatar, { backgroundColor: getAvatarColor(person.name) }]}>
        {hasImage ? (
          <Image
            source={apiClient.getAuthorImageUrl(person.id!)}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={styles.avatarText}>{getInitials(person.name)}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.largeCardInfo}>
        <Text
          style={[styles.largeName, isDark && styles.titleDark]}
          numberOfLines={1}
        >
          {person.name}
        </Text>
        <Text style={styles.count}>
          {person.bookCount} {person.bookCount === 1 ? 'book' : 'books'} in library
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// PersonCardCompact - For within meta-categories
// Smaller avatar with compact info
// =============================================================================

interface PersonCardCompactProps {
  person: PersonWithData;
  onPress: () => void;
  variant?: 'light' | 'dark';
  type: 'author' | 'narrator';
}

export function PersonCardCompact({ person, onPress, variant = 'light', type }: PersonCardCompactProps) {
  const isDark = variant === 'dark';
  const hasImage = type === 'author' && person.id && person.imagePath;

  return (
    <TouchableOpacity
      style={[
        styles.compactCard,
        isDark ? styles.cardDark : styles.cardLight,
        isDark ? styles.borderDark : styles.borderLight,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[styles.compactAvatar, { backgroundColor: getAvatarColor(person.name) }]}>
        {hasImage ? (
          <Image
            source={apiClient.getAuthorImageUrl(person.id!)}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={styles.compactAvatarText}>{getInitials(person.name)}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.compactCardInfo}>
        <Text
          style={[styles.compactName, isDark && styles.titleDark]}
          numberOfLines={1}
        >
          {person.name}
        </Text>
        <Text style={styles.count}>
          {person.bookCount} {person.bookCount === 1 ? 'book' : 'books'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// MetaCategoryPersonSection - Collapsible category with persons
// =============================================================================

interface MetaCategoryPersonSectionProps {
  metaCategory: MetaCategory;
  persons: PersonWithData[];
  totalBooks: number;
  isExpanded: boolean;
  onToggle: () => void;
  onPersonPress: (name: string) => void;
  type: 'author' | 'narrator';
  label: string; // e.g., "Fiction Authors" or "Fiction Narrators"
}

export function MetaCategoryPersonSection({
  metaCategory,
  persons,
  totalBooks,
  isExpanded,
  onToggle,
  onPersonPress,
  type,
  label,
}: MetaCategoryPersonSectionProps) {
  const { colors, isDark } = useTheme();

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  }, [onToggle]);

  // Get color dots from sample books in this category (up to 5)
  const colorDots = useMemo(() => {
    const bookIds: string[] = [];
    for (const person of persons) {
      if (person.sampleBookIds) {
        for (const bookId of person.sampleBookIds) {
          if (bookIds.length >= 5) break;
          if (!bookIds.includes(bookId)) {
            bookIds.push(bookId);
          }
        }
      }
      if (bookIds.length >= 5) break;
    }
    return bookIds.map(getBookDotColor);
  }, [persons]);

  const personLabel = type === 'author' ? 'authors' : 'narrators';

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
          {/* Color dots */}
          <View style={styles.metaDotsContainer}>
            {colorDots.length > 0 ? (
              colorDots.map((color, index) => (
                <View
                  key={`${index}-${color}`}
                  style={[styles.metaDot, { backgroundColor: color }]}
                />
              ))
            ) : (
              // Fallback: show category color if no book dots
              <View style={[styles.metaDot, { backgroundColor: metaCategory.color }]} />
            )}
          </View>
          <View style={styles.metaTextContainer}>
            <Text style={[styles.metaTitle, isDark && styles.metaTitleDark]}>
              {label}
            </Text>
            <Text style={styles.metaSubtitle}>
              {persons.length} {personLabel} · {totalBooks} books
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
          {persons.map((person) => (
            <PersonCardCompact
              key={person.name}
              person={person}
              onPress={() => onPersonPress(person.name)}
              variant={isDark ? 'dark' : 'light'}
              type={type}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// YourPersonsSection - Personalized list
// =============================================================================

interface YourPersonsSectionProps {
  persons: PersonWithData[];
  onPersonPress: (name: string) => void;
  type: 'author' | 'narrator';
  onSeeAll?: () => void;
}

export function YourPersonsSection({
  persons,
  onPersonPress,
  type,
  onSeeAll,
}: YourPersonsSectionProps) {
  const { colors, isDark } = useTheme();

  if (persons.length === 0) return null;

  const title = type === 'author' ? 'Your Authors' : 'Your Narrators';

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[styles.seeAllText, { color: colors.accent.primary }]}>See all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <View style={styles.personList}>
        {persons.slice(0, 5).map((person) => (
          <PersonCardLarge
            key={person.name}
            person={person}
            onPress={() => onPersonPress(person.name)}
            variant={isDark ? 'dark' : 'light'}
            type={type}
          />
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// PopularPersonsSection - Top persons by book count
// =============================================================================

interface PopularPersonsSectionProps {
  persons: PersonWithData[];
  onPersonPress: (name: string) => void;
  type: 'author' | 'narrator';
}

export function PopularPersonsSection({
  persons,
  onPersonPress,
  type,
}: PopularPersonsSectionProps) {
  const { isDark } = useTheme();

  if (persons.length === 0) return null;

  const title = type === 'author' ? 'Popular Authors' : 'Popular Narrators';

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {/* List */}
      <View style={styles.personList}>
        {persons.slice(0, 6).map((person) => (
          <PersonCardLarge
            key={person.name}
            person={person}
            onPress={() => onPersonPress(person.name)}
            variant={isDark ? 'dark' : 'light'}
            type={type}
          />
        ))}
      </View>
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
  personList: {
    paddingHorizontal: 16,
  },

  // Card base styles
  cardLight: {
    backgroundColor: secretLibraryColors.white,
  },
  cardDark: {
    backgroundColor: secretLibraryColors.black,
  },
  borderLight: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  borderDark: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },

  // Large Card (Your/Popular sections)
  largeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  largeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  largeCardInfo: {
    flex: 1,
  },
  largeName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(17),
    color: secretLibraryColors.black,
    lineHeight: scale(22),
    marginBottom: 2,
  },
  titleDark: {
    color: secretLibraryColors.white,
  },
  count: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: secretLibraryColors.gray,
  },

  // Compact Card (Meta-category expanded)
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  compactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  compactAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  compactCardInfo: {
    flex: 1,
  },
  compactName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(15),
    color: secretLibraryColors.black,
    marginBottom: 2,
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
    paddingHorizontal: 32,
    paddingTop: 8,
  },
});
