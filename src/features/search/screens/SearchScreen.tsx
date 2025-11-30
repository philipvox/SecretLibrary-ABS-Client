/**
 * src/features/search/screens/SearchScreen.tsx
 *
 * Enhanced search screen with:
 * - Instant search from library cache
 * - Previous searches history
 * - Authors, narrators, series results
 * - Pre-search filters (expanded by default)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLibraryCache, getAllGenres, getAllAuthors, getAllSeries, getAllNarrators, type FilterOptions } from '@/core/cache';
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

const SEARCH_HISTORY_KEY = 'search_history_v1';
const MAX_HISTORY = 10;

type SortOption = 'title' | 'author' | 'dateAdded' | 'duration';
type FilterTab = 'all' | 'genres' | 'authors' | 'series' | 'duration';
type ResultTab = 'books' | 'authors' | 'narrators' | 'series';

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
  const [showFilters, setShowFilters] = useState(true); // Expanded by default
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('all');
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('books');

  // Previous searches
  const [previousSearches, setPreviousSearches] = useState<string[]>([]);

  // Filter state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [durationFilter, setDurationFilter] = useState<{ min?: number; max?: number }>({});

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Get cached data
  const { filterItems, isLoaded } = useLibraryCache();

  // Get filter options from cache
  const allGenres = useMemo(() => getAllGenres(), [isLoaded]);
  const allAuthors = useMemo(() => getAllAuthors(), [isLoaded]);
  const allNarrators = useMemo(() => getAllNarrators(), [isLoaded]);
  const allSeries = useMemo(() => getAllSeries(), [isLoaded]);

  // Load previous searches on mount
  useEffect(() => {
    loadPreviousSearches();
  }, []);

  const loadPreviousSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setPreviousSearches(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  };

  const saveSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      const updated = [searchQuery, ...previousSearches.filter(s => s !== searchQuery)].slice(0, MAX_HISTORY);
      setPreviousSearches(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save search:', err);
    }
  };

  const clearSearchHistory = async () => {
    try {
      setPreviousSearches([]);
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (err) {
      console.error('Failed to clear search history:', err);
    }
  };

  const removeFromHistory = async (searchToRemove: string) => {
    try {
      const updated = previousSearches.filter(s => s !== searchToRemove);
      setPreviousSearches(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to remove from history:', err);
    }
  };

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

  // Check if we have any active search/filters
  const hasActiveSearch = query.trim().length > 0 || selectedGenres.length > 0 ||
    selectedAuthors.length > 0 || selectedSeries.length > 0 ||
    durationFilter.min !== undefined || durationFilter.max !== undefined;

  // Filter book results - instant from cache!
  const bookResults = useMemo(() => {
    if (!hasActiveSearch) return [];
    return filterItems(filters).slice(0, 100);
  }, [filterItems, filters, hasActiveSearch]);

  // Filter authors matching query
  const authorResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allAuthors
      .filter(a => a.name.toLowerCase().includes(lowerQuery))
      .slice(0, 20);
  }, [query, allAuthors]);

  // Filter narrators matching query
  const narratorResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allNarrators
      .filter(n => n.name.toLowerCase().includes(lowerQuery))
      .slice(0, 20);
  }, [query, allNarrators]);

  // Filter series matching query
  const seriesResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allSeries
      .filter(s => s.name.toLowerCase().includes(lowerQuery))
      .slice(0, 20);
  }, [query, allSeries]);

  // Result counts for tabs
  const resultCounts = useMemo(() => ({
    books: bookResults.length,
    authors: authorResults.length,
    narrators: narratorResults.length,
    series: seriesResults.length,
  }), [bookResults, authorResults, narratorResults, seriesResults]);

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

  const handleSearch = () => {
    if (query.trim()) {
      saveSearch(query.trim());
      Keyboard.dismiss();
    }
  };

  const handlePreviousSearchPress = (search: string) => {
    setQuery(search);
    saveSearch(search);
  };

  const handleBookPress = useCallback(async (book: LibraryItem) => {
    Keyboard.dismiss();
    if (query.trim()) saveSearch(query.trim());
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: false });
    } catch {
      await loadBook(book, { autoPlay: false });
    }
  }, [loadBook, query]);

  const handleAuthorPress = (authorName: string) => {
    Keyboard.dismiss();
    if (query.trim()) saveSearch(query.trim());
    navigation.navigate('AuthorDetail', { authorName });
  };

  const handleNarratorPress = (narratorName: string) => {
    Keyboard.dismiss();
    if (query.trim()) saveSearch(query.trim());
    navigation.navigate('NarratorDetail', { narratorName });
  };

  const handleSeriesPress = (seriesName: string) => {
    Keyboard.dismiss();
    if (query.trim()) saveSearch(query.trim());
    navigation.navigate('SeriesDetail', { seriesName });
  };

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

  const getMetadata = (item: LibraryItem) => (item.media?.metadata as any) || {};

  // Get initials for avatar
  const getInitials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

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
            onSubmitEditing={handleSearch}
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

      {/* Filter Panel - expanded by default */}
      {showFilters && (
        <View style={styles.filterPanel}>
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
                      <Icon name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} color="#000" set="ionicons" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

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

          {activeFilterTab === 'authors' && (
            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              <View style={styles.chipGrid}>
                {allAuthors.slice(0, 50).map(author => (
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

          {activeFilterTab === 'series' && (
            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              <View style={styles.chipGrid}>
                {allSeries.slice(0, 50).map(series => (
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

      {/* Result type tabs - only show when we have results */}
      {hasActiveSearch && query.trim().length > 0 && (
        <View style={styles.resultTabs}>
          {(['books', 'authors', 'narrators', 'series'] as ResultTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.resultTab, activeResultTab === tab && styles.resultTabActive]}
              onPress={() => setActiveResultTab(tab)}
            >
              <Text style={[styles.resultTabText, activeResultTab === tab && styles.resultTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {resultCounts[tab] > 0 && (
                <View style={[styles.resultTabBadge, activeResultTab === tab && styles.resultTabBadgeActive]}>
                  <Text style={[styles.resultTabBadgeText, activeResultTab === tab && styles.resultTabBadgeTextActive]}>
                    {resultCounts[tab]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={styles.results}
        contentContainerStyle={[styles.resultsContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state - show previous searches */}
        {!hasActiveSearch && (
          <View style={styles.emptyStateContainer}>
            {previousSearches.length > 0 ? (
              <View style={styles.previousSearches}>
                <View style={styles.previousSearchesHeader}>
                  <Text style={styles.previousSearchesTitle}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearSearchHistory}>
                    <Text style={styles.clearHistoryText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {previousSearches.map((search, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.previousSearchItem}
                    onPress={() => handlePreviousSearchPress(search)}
                  >
                    <Icon name="time-outline" size={18} color="rgba(255,255,255,0.4)" set="ionicons" />
                    <Text style={styles.previousSearchText}>{search}</Text>
                    <TouchableOpacity
                      style={styles.removeSearchButton}
                      onPress={() => removeFromHistory(search)}
                    >
                      <Icon name="close" size={16} color="rgba(255,255,255,0.3)" set="ionicons" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="search" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
                <Text style={styles.emptyTitle}>Search your library</Text>
                <Text style={styles.emptySubtitle}>Find books by title, author, narrator, or series</Text>
              </View>
            )}

            {/* Quick browse section */}
            <View style={styles.quickBrowse}>
              <Text style={styles.quickBrowseTitle}>Quick Browse</Text>
              <View style={styles.quickBrowseRow}>
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => setActiveFilterTab('genres')}>
                  <Icon name="albums-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Genres</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => setActiveFilterTab('authors')}>
                  <Icon name="person-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Authors</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => setActiveFilterTab('series')}>
                  <Icon name="library-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Series</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* No results */}
        {hasActiveSearch && activeResultTab === 'books' && bookResults.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="book-outline" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>No books found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
          </View>
        )}

        {/* Book Results */}
        {activeResultTab === 'books' && bookResults.length > 0 && (
          <>
            <Text style={styles.resultsCount}>{bookResults.length} books</Text>
            <View style={styles.grid}>
              {bookResults.map(book => {
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
          </>
        )}

        {/* Author Results */}
        {activeResultTab === 'authors' && authorResults.length > 0 && (
          <View style={styles.entityList}>
            {authorResults.map(author => (
              <TouchableOpacity
                key={author.name}
                style={styles.entityItem}
                onPress={() => handleAuthorPress(author.name)}
              >
                <View style={[styles.entityAvatar, { backgroundColor: ACCENT }]}>
                  <Text style={styles.entityAvatarText}>{getInitials(author.name)}</Text>
                </View>
                <View style={styles.entityInfo}>
                  <Text style={styles.entityName}>{author.name}</Text>
                  <Text style={styles.entityMeta}>{author.bookCount} books</Text>
                </View>
                <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" set="ionicons" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Narrator Results */}
        {activeResultTab === 'narrators' && narratorResults.length > 0 && (
          <View style={styles.entityList}>
            {narratorResults.map(narrator => (
              <TouchableOpacity
                key={narrator.name}
                style={styles.entityItem}
                onPress={() => handleNarratorPress(narrator.name)}
              >
                <View style={[styles.entityAvatar, { backgroundColor: '#4A90D9' }]}>
                  <Text style={styles.entityAvatarText}>{getInitials(narrator.name)}</Text>
                </View>
                <View style={styles.entityInfo}>
                  <Text style={styles.entityName}>{narrator.name}</Text>
                  <Text style={styles.entityMeta}>{narrator.bookCount} books narrated</Text>
                </View>
                <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" set="ionicons" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Series Results */}
        {activeResultTab === 'series' && seriesResults.length > 0 && (
          <View style={styles.entityList}>
            {seriesResults.map(series => (
              <TouchableOpacity
                key={series.name}
                style={styles.entityItem}
                onPress={() => handleSeriesPress(series.name)}
              >
                <View style={[styles.entityAvatar, { backgroundColor: '#9B59B6' }]}>
                  <Icon name="library" size={20} color="#FFF" set="ionicons" />
                </View>
                <View style={styles.entityInfo}>
                  <Text style={styles.entityName}>{series.name}</Text>
                  <Text style={styles.entityMeta}>{series.bookCount} books in series</Text>
                </View>
                <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" set="ionicons" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty states for other tabs */}
        {activeResultTab === 'authors' && authorResults.length === 0 && hasActiveSearch && (
          <View style={styles.emptyState}>
            <Icon name="person-outline" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>No authors found</Text>
          </View>
        )}
        {activeResultTab === 'narrators' && narratorResults.length === 0 && hasActiveSearch && (
          <View style={styles.emptyState}>
            <Icon name="mic-outline" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>No narrators found</Text>
          </View>
        )}
        {activeResultTab === 'series' && seriesResults.length === 0 && hasActiveSearch && (
          <View style={styles.emptyState}>
            <Icon name="library-outline" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>No series found</Text>
          </View>
        )}
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

  // Result tabs
  resultTabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BG_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resultTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 14,
  },
  resultTabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  resultTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  resultTabTextActive: {
    color: '#FFFFFF',
  },
  resultTabBadge: {
    marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  resultTabBadgeActive: {
    backgroundColor: ACCENT,
  },
  resultTabBadgeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
  },
  resultTabBadgeTextActive: {
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
  emptyStateContainer: {
    paddingHorizontal: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
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
    textAlign: 'center',
  },

  // Previous searches
  previousSearches: {
    marginBottom: 24,
  },
  previousSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previousSearchesTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  clearHistoryText: {
    color: ACCENT,
    fontSize: 14,
  },
  previousSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  previousSearchText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    marginLeft: 12,
  },
  removeSearchButton: {
    padding: 4,
  },

  // Quick browse
  quickBrowse: {
    marginTop: 8,
  },
  quickBrowseTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickBrowseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickBrowseItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
    marginHorizontal: 4,
  },
  quickBrowseItemText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 8,
  },

  // Grid
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

  // Entity list (authors, narrators, series)
  entityList: {
    paddingHorizontal: 8,
  },
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginBottom: 8,
  },
  entityAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entityAvatarText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  entityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  entityName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  entityMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
});
