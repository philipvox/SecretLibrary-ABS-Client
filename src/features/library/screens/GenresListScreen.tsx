/**
 * src/features/library/screens/GenresListScreen.tsx
 *
 * Redesigned Genre Browse page with:
 * - Two-level hierarchy (meta-categories → individual genres)
 * - Your Genres section (personalized from listening history)
 * - Popular Genres section
 * - Collapsible meta-category sections
 * - View mode toggle (grouped/flat)
 * - Sparse genre handling
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  TextInput,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache, getAllGenres } from '@/core/cache';
import { useContinueListening } from '@/features/home/hooks/useContinueListening';
import { Icon } from '@/shared/components/Icon';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import {
  META_CATEGORIES,
  MetaCategory,
  GenreWithData,
  getMetaCategoryForGenre,
  MIN_BOOKS_TO_SHOW,
} from '../constants/genreCategories';
import {
  MetaCategorySection,
  YourGenresSection,
  PopularGenresSection,
} from '../components/GenreSections';
import { GenreListItem } from '../components/GenreCards';
import { colors, spacing, radius } from '@/shared/theme';

const BG_COLOR = colors.backgroundPrimary;
const CARD_COLOR = colors.backgroundTertiary;
const ACCENT = colors.accent;

type ViewMode = 'grouped' | 'flat';

export function GenresListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const sectionListRef = useRef<SectionList>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refreshCache, isLoaded, filterItems } = useLibraryCache();
  const { items: inProgressItems } = useContinueListening();

  const allGenres = useMemo(() => getAllGenres(), [isLoaded]);

  // Get genres with data (book count, covers, meta-category)
  const genresWithData = useMemo((): GenreWithData[] => {
    return allGenres.map((genre) => {
      const books = filterItems({ genres: [genre] });
      const coverIds = books.slice(0, 4).map(b => b.id);
      const metaCategory = getMetaCategoryForGenre(genre);
      return {
        name: genre,
        bookCount: books.length,
        coverIds,
        metaCategoryId: metaCategory?.id || null,
      };
    }).filter(g => g.bookCount >= MIN_BOOKS_TO_SHOW); // Filter sparse genres
  }, [allGenres, filterItems]);

  // Filter genres by search query
  const filteredGenres = useMemo(() => {
    if (!searchQuery.trim()) return genresWithData;
    const lowerQuery = searchQuery.toLowerCase();
    return genresWithData.filter(g => g.name.toLowerCase().includes(lowerQuery));
  }, [genresWithData, searchQuery]);

  // Get "Your Genres" - genres from books user is listening to
  const yourGenres = useMemo((): GenreWithData[] => {
    // Get unique book IDs from in-progress items
    const listenedBookIds = new Set(inProgressItems.map(item => item.id));

    if (listenedBookIds.size === 0) return [];

    // Count genre occurrences in listened books
    const genreCounts = new Map<string, number>();

    genresWithData.forEach(genre => {
      const books = filterItems({ genres: [genre.name] });
      const listenedCount = books.filter(b => listenedBookIds.has(b.id)).length;
      if (listenedCount > 0) {
        genreCounts.set(genre.name, listenedCount);
      }
    });

    // Get top genres by listened count
    return genresWithData
      .filter(g => genreCounts.has(g.name))
      .sort((a, b) => (genreCounts.get(b.name) || 0) - (genreCounts.get(a.name) || 0))
      .slice(0, 5);
  }, [genresWithData, filterItems, inProgressItems]);

  // Get popular genres (top 6 by book count)
  const popularGenres = useMemo((): GenreWithData[] => {
    return [...genresWithData]
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 6);
  }, [genresWithData]);

  // Group genres by meta-category
  const genresByCategory = useMemo(() => {
    const grouped = new Map<MetaCategory, GenreWithData[]>();

    // Initialize all categories
    META_CATEGORIES.forEach(cat => grouped.set(cat, []));

    // Assign genres
    filteredGenres.forEach(genre => {
      const category = META_CATEGORIES.find(c => c.id === genre.metaCategoryId);
      if (category) {
        const existing = grouped.get(category) || [];
        existing.push(genre);
        grouped.set(category, existing);
      } else {
        // Fallback to Fiction
        const fiction = META_CATEGORIES[0];
        const existing = grouped.get(fiction) || [];
        existing.push(genre);
        grouped.set(fiction, existing);
      }
    });

    // Sort genres within each category
    grouped.forEach((genres, category) => {
      genres.sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [filteredGenres]);

  // Get total books per category
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    genresByCategory.forEach((genres, category) => {
      totals.set(category.id, genres.reduce((sum, g) => sum + g.bookCount, 0));
    });
    return totals;
  }, [genresByCategory]);

  // Flat list sections (A-Z) for SectionList
  const flatSections = useMemo(() => {
    const sorted = [...filteredGenres].sort((a, b) => a.name.localeCompare(b.name));
    const sections: { title: string; data: GenreWithData[] }[] = [];

    sorted.forEach(genre => {
      const letter = genre.name[0].toUpperCase();
      const existing = sections.find(s => s.title === letter);
      if (existing) {
        existing.data.push(genre);
      } else {
        sections.push({ title: letter, data: [genre] });
      }
    });

    return sections;
  }, [filteredGenres]);

  // Available letters for alphabet index
  const availableLetters = useMemo(() => {
    return flatSections.map(s => s.title);
  }, [flatSections]);

  // Handle alphabet letter press - scroll to section
  const handleLetterPress = useCallback((letter: string) => {
    const sectionIndex = flatSections.findIndex(s => s.title === letter);
    if (sectionIndex >= 0 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewPosition: 0,
      });
    }
  }, [flatSections]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  const handleGenrePress = (genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  };

  const handleToggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  const isSearching = searchQuery.trim().length > 0;

  if (!isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Render grouped view
  const renderGroupedView = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={ACCENT}
        />
      }
    >
      {/* Your Genres Section */}
      {!isSearching && yourGenres.length > 0 && (
        <YourGenresSection
          genres={yourGenres}
          onGenrePress={handleGenrePress}
        />
      )}

      {/* Popular Genres Section */}
      {!isSearching && (
        <PopularGenresSection
          genres={popularGenres}
          onGenrePress={handleGenrePress}
        />
      )}

      {/* Browse by Category Header */}
      {!isSearching && (
        <View style={styles.browseHeader}>
          <Text style={styles.browseTitle}>Browse by Category</Text>
        </View>
      )}

      {/* Meta-Category Sections */}
      {META_CATEGORIES.map(category => {
        const genres = genresByCategory.get(category) || [];
        if (genres.length === 0) return null;

        return (
          <MetaCategorySection
            key={category.id}
            metaCategory={category}
            genres={genres}
            totalBooks={categoryTotals.get(category.id) || 0}
            isExpanded={expandedCategories.has(category.id)}
            onToggle={() => handleToggleCategory(category.id)}
            onGenrePress={handleGenrePress}
          />
        );
      })}

      {/* Empty State */}
      {filteredGenres.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="search" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
          <Text style={styles.emptyText}>No genres found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      )}
    </ScrollView>
  );

  // Render flat A-Z view with SectionList and custom alphabet index
  const renderFlatView = () => (
    <View style={styles.flatContainer}>
      <SectionList
        ref={sectionListRef}
        sections={flatSections}
        keyExtractor={(item) => item.name}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom, paddingRight: 28 }}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <GenreListItem
            genre={item}
            onPress={() => handleGenrePress(item.name)}
          />
        )}
        onScrollToIndexFailed={() => {}}
        getItemLayout={(data, index) => ({
          length: 56,
          offset: 56 * index,
          index,
        })}
      />

      {/* Custom Evenly Distributed Alphabet Index */}
      {availableLetters.length > 1 && (
        <View style={[styles.alphabetIndex, { bottom: SCREEN_BOTTOM_PADDING + insets.bottom + 60 }]}>
          {availableLetters.map((letter) => (
            <TouchableOpacity
              key={letter}
              style={styles.alphabetLetterButton}
              onPress={() => handleLetterPress(letter)}
            >
              <Text style={styles.alphabetLetter}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.5)" set="ionicons" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search genres..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Icon name="close-circle" size={18} color="rgba(255,255,255,0.5)" set="ionicons" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* View Mode Toggle & Count */}
      <View style={styles.controlBar}>
        <Text style={styles.resultCount}>{filteredGenres.length} genres</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grouped' && styles.toggleButtonActive]}
            onPress={() => setViewMode('grouped')}
          >
            <Icon
              name="grid-outline"
              size={16}
              color={viewMode === 'grouped' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'flat' && styles.toggleButtonActive]}
            onPress={() => setViewMode('flat')}
          >
            <Icon
              name="list-outline"
              size={16}
              color={viewMode === 'flat' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'grouped' || isSearching ? renderGroupedView() : renderFlatView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: CARD_COLOR,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: ACCENT,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  flatContainer: {
    flex: 1,
  },
  alphabetIndex: {
    position: 'absolute',
    right: 2,
    top: 8,
    width: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alphabetLetterButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    minHeight: 14,
  },
  alphabetLetter: {
    fontSize: 10,
    fontWeight: '700',
    color: ACCENT,
  },
  sectionHeader: {
    backgroundColor: BG_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
  },
  browseHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  browseTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
});
