/**
 * src/features/search/screens/SearchScreen.tsx
 *
 * Simplified, fast search screen using library cache
 * - Instant search results from cache
 * - Smart filtering and sorting
 * - Clean, minimal UI
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLibraryCache, getAllGenres, getAllAuthors, getAllSeries, type FilterOptions } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { LibraryItem } from '@/core/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BG_COLOR = '#1a1a1a';
const CARD_COLOR = '#2a2a2a';
const ACCENT = '#CCFF00';
const GAP = 5;
const CARD_RADIUS = 5;

type SortOption = 'title' | 'author' | 'dateAdded' | 'duration';
type FilterTab = 'all' | 'genres' | 'authors' | 'series' | 'duration';

// Quick duration filters
const DURATION_FILTERS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: '< 5h', min: undefined, max: 5 },
  { label: '5-10h', min: 5, max: 10 },
  { label: '10-20h', min: 10, max: 20 },
  { label: '20h+', min: 20, max: undefined },
];

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const inputRef = useRef<TextInput>(null);
  const { loadBook } = usePlayerStore();

  // Search state
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('all');

  // Filter state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [durationFilter, setDurationFilter] = useState<{ min?: number; max?: number }>({});

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Get cached data
  const { filterItems, genres, isLoaded } = useLibraryCache();

  // Get filter options from cache
  const allGenres = useMemo(() => getAllGenres(), [isLoaded]);
  const allAuthors = useMemo(() => getAllAuthors().slice(0, 50), [isLoaded]);
  const allSeries = useMemo(() => getAllSeries().slice(0, 50), [isLoaded]);

  // Build filter options
  const filters: FilterOptions = useMemo(() => ({
    query: query.trim(),
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    authors: selectedAuthors.length > 0 ? selectedAuthors : undefined,
    series: selectedSeries.length > 0 ? selectedSeries : undefined,
    minDuration: durationFilter.min,
    maxDuration: durationFilter.max,
    sortBy,
    sortOrder,
  }), [query, selectedGenres, selectedAuthors, selectedSeries, durationFilter, sortBy, sortOrder]);

  // Filter results - instant from cache!
  const results = useMemo(() => {
    if (!query.trim() && selectedGenres.length === 0 && selectedAuthors.length === 0 &&
        selectedSeries.length === 0 && !durationFilter.min && !durationFilter.max) {
      return [];
    }
    return filterItems(filters).slice(0, 100);
  }, [filterItems, filters]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGenres.length > 0) count++;
    if (selectedAuthors.length > 0) count++;
    if (selectedSeries.length > 0) count++;
    if (durationFilter.min || durationFilter.max) count++;
    return count;
  }, [selectedGenres, selectedAuthors, selectedSeries, durationFilter]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleClear = () => {
    setQuery('');
    setSelectedGenres([]);
    setSelectedAuthors([]);
    setSelectedSeries([]);
    setDurationFilter({});
    inputRef.current?.focus();
  };

  const handleBookPress = useCallback(async (book: LibraryItem) => {
    Keyboard.dismiss();
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: false });
    } catch {
      await loadBook(book, { autoPlay: false });
    }
  }, [loadBook]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleAuthor = (author: string) => {
    setSelectedAuthors(prev =>
      prev.includes(author) ? prev.filter(a => a !== author) : [...prev, author]
    );
  };

  const toggleSeries = (series: string) => {
    setSelectedSeries(prev =>
      prev.includes(series) ? prev.filter(s => s !== series) : [...prev, series]
    );
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortOrder('asc');
    }
  };

  // Get metadata helper
  const getMetadata = (item: LibraryItem) => (item.media?.metadata as any) || {};

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.5)" set="ionicons" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search books, authors, series..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {(query.length > 0 || activeFilterCount > 0) && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Icon name="close-circle" size={18} color="rgba(255,255,255,0.5)" set="ionicons" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Icon name="options" size={20} color={showFilters ? '#000' : '#FFF'} set="ionicons" />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
            {(['all', 'genres', 'authors', 'series', 'duration'] as FilterTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.filterTab, activeFilterTab === tab && styles.filterTabActive]}
                onPress={() => setActiveFilterTab(tab)}
              >
                <Text style={[styles.filterTabText, activeFilterTab === tab && styles.filterTabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort Options */}
          {activeFilterTab === 'all' && (
            <View style={styles.sortSection}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(['title', 'author', 'dateAdded', 'duration'] as SortOption[]).map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.sortChip, sortBy === option && styles.sortChipActive]}
                    onPress={() => handleSort(option)}
                  >
                    <Text style={[styles.sortChipText, sortBy === option && styles.sortChipTextActive]}>
                      {option === 'dateAdded' ? 'Date' : option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                    {sortBy === option && (
                      <Icon
                        name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color="#000"
                        set="ionicons"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Genre Filter */}
          {activeFilterTab === 'genres' && (
            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              <View style={styles.chipGrid}>
                {allGenres.map(genre => (
                  <TouchableOpacity
                    key={genre}
                    style={[styles.chip, selectedGenres.includes(genre) && styles.chipActive]}
                    onPress={() => toggleGenre(genre)}
                  >
                    <Text style={[styles.chipText, selectedGenres.includes(genre) && styles.chipTextActive]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Author Filter */}
          {activeFilterTab === 'authors' && (
            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              <View style={styles.chipGrid}>
                {allAuthors.map(author => (
                  <TouchableOpacity
                    key={author.name}
                    style={[styles.chip, selectedAuthors.includes(author.name) && styles.chipActive]}
                    onPress={() => toggleAuthor(author.name)}
                  >
                    <Text style={[styles.chipText, selectedAuthors.includes(author.name) && styles.chipTextActive]}>
                      {author.name} ({author.bookCount})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Series Filter */}
          {activeFilterTab === 'series' && (
            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              <View style={styles.chipGrid}>
                {allSeries.map(series => (
                  <TouchableOpacity
                    key={series.name}
                    style={[styles.chip, selectedSeries.includes(series.name) && styles.chipActive]}
                    onPress={() => toggleSeries(series.name)}
                  >
                    <Text style={[styles.chipText, selectedSeries.includes(series.name) && styles.chipTextActive]}>
                      {series.name} ({series.bookCount})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Duration Filter */}
          {activeFilterTab === 'duration' && (
            <View style={styles.durationFilters}>
              {DURATION_FILTERS.map((df, idx) => {
                const isActive = durationFilter.min === df.min && durationFilter.max === df.max;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.durationChip, isActive && styles.durationChipActive]}
                    onPress={() => setDurationFilter({ min: df.min, max: df.max })}
                  >
                    <Text style={[styles.durationChipText, isActive && styles.durationChipTextActive]}>
                      {df.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={styles.results}
        contentContainerStyle={[styles.resultsContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state */}
        {results.length === 0 && query.length === 0 && activeFilterCount === 0 && (
          <View style={styles.emptyState}>
            <Icon name="search" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>Search your library</Text>
            <Text style={styles.emptySubtitle}>Find books by title, author, or narrator</Text>
          </View>
        )}

        {/* No results */}
        {results.length === 0 && (query.length > 0 || activeFilterCount > 0) && (
          <View style={styles.emptyState}>
            <Icon name="book-outline" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>No books found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
          </View>
        )}

        {/* Results count */}
        {results.length > 0 && (
          <Text style={styles.resultsCount}>{results.length} books</Text>
        )}

        {/* Results grid */}
        <View style={styles.grid}>
          {results.map(book => {
            const metadata = getMetadata(book);
            return (
              <TouchableOpacity
                key={book.id}
                style={styles.bookCard}
                onPress={() => handleBookPress(book)}
                activeOpacity={0.8}
              >
                <Image
                  source={apiClient.getItemCoverUrl(book.id)}
                  style={styles.bookCover}
                  contentFit="cover"
                  transition={150}
                />
                <Text style={styles.bookTitle} numberOfLines={2}>
                  {metadata.title || 'Unknown'}
                </Text>
                <Text style={styles.bookAuthor} numberOfLines={1}>
                  {metadata.authorName || 'Unknown'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const GRID_COLUMNS = 3;
const CARD_WIDTH = (SCREEN_WIDTH - GAP * 4) / GRID_COLUMNS;

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
  backButton: {
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
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: ACCENT,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Filter Panel
  filterPanel: {
    backgroundColor: CARD_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  filterTabs: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: {
    backgroundColor: ACCENT,
  },
  filterTabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#000',
  },
  filterContent: {
    maxHeight: 150,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: ACCENT,
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#000',
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  sortLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
    gap: 4,
  },
  sortChipActive: {
    backgroundColor: ACCENT,
  },
  sortChipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  sortChipTextActive: {
    color: '#000',
  },
  durationFilters: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  durationChipActive: {
    backgroundColor: ACCENT,
  },
  durationChipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  durationChipTextActive: {
    color: '#000',
  },

  // Results
  results: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: GAP,
    paddingTop: 12,
  },
  resultsCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 12,
    marginLeft: GAP,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bookCard: {
    width: CARD_WIDTH,
    padding: GAP,
  },
  bookCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: CARD_RADIUS,
    backgroundColor: CARD_COLOR,
  },
  bookTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 15,
  },
  bookAuthor: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
});
