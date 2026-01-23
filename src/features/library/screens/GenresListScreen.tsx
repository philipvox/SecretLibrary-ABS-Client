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

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { useContinueListening } from '@/shared/hooks/useContinueListening';
import { Icon } from '@/shared/components/Icon';
import { SkullRefreshControl, TopNav, TopNavBackIcon, TagIcon, ScreenLoadingOverlay } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { secretLibraryColors } from '@/shared/theme/secretLibrary';
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
import { spacing, radius, useTheme } from '@/shared/theme';

type ViewMode = 'grouped' | 'flat';

export function GenresListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const accent = colors.accent.primary;
  const sectionListRef = useRef<SectionList>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mark as mounted after first render and hide global loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      globalLoading.hide();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const { refreshCache, isLoaded, getGenre } = useLibraryCache();
  const genresWithBooks = useLibraryCache((s) => s.genresWithBooks);
  const { items: inProgressItems } = useContinueListening();

  // Get genres with data directly from pre-indexed cache (no filterItems loop needed)
  const genresWithData = useMemo((): GenreWithData[] => {
    if (!genresWithBooks || genresWithBooks.size === 0) return [];

    return Array.from(genresWithBooks.values())
      .filter(g => g.bookCount >= MIN_BOOKS_TO_SHOW) // Filter sparse genres
      .map((genreInfo) => {
        const metaCategory = getMetaCategoryForGenre(genreInfo.name);
        return {
          name: genreInfo.name,
          bookCount: genreInfo.bookCount,
          coverIds: genreInfo.books.slice(0, 4).map(b => b.id),
          metaCategoryId: metaCategory?.id || null,
        };
      });
  }, [genresWithBooks]);

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

    // Count genre occurrences in listened books (using pre-indexed books)
    const genreCounts = new Map<string, number>();

    genresWithData.forEach(genre => {
      const genreInfo = getGenre(genre.name);
      if (!genreInfo) return;
      const listenedCount = genreInfo.books.filter(b => listenedBookIds.has(b.id)).length;
      if (listenedCount > 0) {
        genreCounts.set(genre.name, listenedCount);
      }
    });

    // Get top genres by listened count
    return genresWithData
      .filter(g => genreCounts.has(g.name))
      .sort((a, b) => (genreCounts.get(b.name) || 0) - (genreCounts.get(a.name) || 0))
      .slice(0, 5);
  }, [genresWithData, getGenre, inProgressItems]);

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
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Render grouped view
  const renderGroupedView = () => (
    <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
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
          <Text style={[styles.browseTitle, { color: colors.text.secondary }]}>Browse by Category</Text>
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
          <Icon name="Search" size={48} color={colors.text.tertiary} />
          <Text style={[styles.emptyText, { color: colors.text.primary }]}>No genres found</Text>
          <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>Try a different search term</Text>
        </View>
      )}
      </ScrollView>
    </SkullRefreshControl>
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
          <View style={[styles.sectionHeader, { backgroundColor: colors.background.primary }]}>
            <Text style={[styles.sectionHeaderText, { color: accent }]}>{section.title}</Text>
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
              <Text style={[styles.alphabetLetter, { color: accent }]}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* TopNav with skull logo and integrated search bar */}
      <TopNav
        variant={isDark ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: colors.background.primary }}
        pills={[
          {
            key: 'genres',
            label: 'Genres',
            icon: <TagIcon size={10} color={colors.text.primary} />,
          },
        ]}
        circleButtons={[
          {
            key: 'back',
            icon: <TopNavBackIcon color={colors.text.primary} size={14} />,
            onPress: handleBack,
          },
        ]}
        searchBar={{
          value: searchQuery,
          onChangeText: setSearchQuery,
          placeholder: 'Search genres...',
        }}
      />

      {/* View Mode Toggle & Count */}
      <View style={styles.controlBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>{filteredGenres.length} genres</Text>
        <View style={[
          styles.viewToggle,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }
        ]}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grouped' && [styles.toggleButtonActive, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }]]}
            onPress={() => setViewMode('grouped')}
          >
            <Icon
              name="LayoutGrid"
              size={16}
              color={viewMode === 'grouped' ? colors.text.primary : colors.text.tertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'flat' && [styles.toggleButtonActive, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }]]}
            onPress={() => setViewMode('flat')}
          >
            <Icon
              name="List"
              size={16}
              color={viewMode === 'flat' ? colors.text.primary : colors.text.tertiary}
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
    // backgroundColor set via themeColors.background in JSX
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set via themeColors.border in JSX
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    // color set via themeColors.text in JSX
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
    // color set via themeColors.textSecondary in JSX
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
    // color set via themeColors.textSecondary in JSX
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    // backgroundColor set via themeColors.border in JSX
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonActive: {
    // backgroundColor applied inline with themeColors.background
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
    // color set dynamically via accent in JSX
  },
  sectionHeader: {
    // backgroundColor set via themeColors.background in JSX
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    // color set dynamically via accent in JSX
  },
  browseHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  browseTitle: {
    fontSize: 13,
    fontWeight: '600',
    // color set via themeColors.textSecondary in JSX
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
    // color set via themeColors.text in JSX
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    // color set via themeColors.textSecondary in JSX
    marginTop: 4,
  },
});
