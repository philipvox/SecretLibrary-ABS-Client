/**
 * src/features/search/screens/SearchScreen.tsx
 *
 * Enhanced search screen based on NNGroup/Baymard UX research:
 * - Simple text autocomplete (no thumbnails per research)
 * - Darkened background when autocomplete active
 * - Debounced search (300ms)
 * - Typo tolerance with fuzzy matching
 * - "Did you mean" suggestions for no results
 * - Audiobook-specific metadata (narrator, duration, download status)
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
  Keyboard,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useLibraryCache, getAllGenres, getAllAuthors, getAllSeries, getAllNarrators, useCoverUrl, type FilterOptions } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { downloadManager, DownloadTask } from '@/core/services/downloadManager';
import { Icon } from '@/shared/components/Icon';
import { HeartButton, SeriesHeartButton } from '@/shared/components';
import { BookCard } from '@/shared/components/BookCard';
import { LibraryItem } from '@/core/types';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { fuzzyMatch, findSuggestions, expandAbbreviations } from '../utils/fuzzySearch';
import { colors, wp, spacing, radius } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const BG_COLOR = colors.backgroundPrimary;
const CARD_COLOR = colors.backgroundTertiary;
const ACCENT = colors.accent;
const GAP = spacing.sm;
const CARD_RADIUS = radius.sm;
const PADDING = spacing.lg;

const SEARCH_HISTORY_KEY = 'search_history_v1';
const MAX_HISTORY = 10;
const DEBOUNCE_MS = 300; // Debounce delay for search

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Series card constants - horizontal stack design
const SERIES_CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * 2) / 3;
const SERIES_COVER_SIZE = SERIES_CARD_WIDTH * 0.55;
const MAX_VISIBLE_BOOKS = 10;

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

// Stacked series card - horizontal stack with drop shadows spanning full width
const SeriesCard = React.memo(function SeriesCard({
  series,
  onPress,
}: {
  series: { name: string; bookCount: number; books: LibraryItem[] };
  onPress: () => void;
}) {
  // Get up to MAX_VISIBLE_BOOKS book covers for the stack
  const bookCovers = series.books.slice(0, MAX_VISIBLE_BOOKS).map(b => apiClient.getItemCoverUrl(b.id));
  const title = series.name;
  const firstBookId = series.books[0]?.id;
  const numCovers = bookCovers.length;

  // Calculate offset to spread covers across full card width
  // Last cover should end at card edge, first cover starts at 0
  const stackOffset = numCovers > 1
    ? (SERIES_CARD_WIDTH - SERIES_COVER_SIZE) / (numCovers - 1)
    : 0;

  return (
    <TouchableOpacity style={styles.seriesCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.seriesStackContainer}>
        {/* Render stacked covers - back to front horizontally */}
        {bookCovers.map((coverUrl, idx) => (
          <View
            key={idx}
            style={[
              styles.seriesStackCover,
              {
                left: idx * stackOffset,
                zIndex: numCovers - idx,
              },
            ]}
          >
            <Image
              source={coverUrl}
              style={styles.seriesCoverImage}
              contentFit="cover"
              transition={150}
            />
          </View>
        ))}
      </View>
      <View style={styles.seriesTitleRow}>
        <Text style={styles.seriesTitle} numberOfLines={2}>{title}</Text>
        <SeriesHeartButton seriesName={title} size={12} style={styles.heartButton} />
      </View>
    </TouchableOpacity>
  );
});

type SearchScreenParams = {
  genre?: string;
};

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ Search: SearchScreenParams }, 'Search'>>();
  const inputRef = useRef<TextInput>(null);
  const { loadBook, isLoading: isPlayerLoading, currentBook } = usePlayerStore();

  // Search state
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('all');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Debounced query for search (300ms delay per research)
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Show autocomplete when typing (but not for committed searches)
  const [hasCommittedSearch, setHasCommittedSearch] = useState(false);
  const showAutocomplete = query.length > 0 && isInputFocused && !hasCommittedSearch;

  // Previous searches
  const [previousSearches, setPreviousSearches] = useState<string[]>([]);

  // Filter state - initialize with route params if present
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    return route.params?.genre ? [route.params.genre] : [];
  });
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

  // Download status tracking
  const [downloadTasks, setDownloadTasks] = useState<Map<string, DownloadTask>>(new Map());

  // Subscribe to download status changes
  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((tasks) => {
      const taskMap = new Map<string, DownloadTask>();
      for (const task of tasks) {
        taskMap.set(task.itemId, task);
      }
      setDownloadTasks(taskMap);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

  // Build filter options - use debounced query for full results
  const filters: FilterOptions = useMemo(() => ({
    query: debouncedQuery.trim(),
    genres: selectedGenres.length > 0 ? selectedGenres : undefined,
    authors: selectedAuthors.length > 0 ? selectedAuthors : undefined,
    series: selectedSeries.length > 0 ? selectedSeries : undefined,
    minDuration: durationFilter.min,
    maxDuration: durationFilter.max,
    sortBy,
    sortOrder,
  }), [debouncedQuery, selectedGenres, selectedAuthors, selectedSeries, durationFilter, sortBy, sortOrder]);

  // Check if we have any active search/filters (use debounced for results)
  const hasActiveSearch = debouncedQuery.trim().length > 0 || selectedGenres.length > 0 ||
    selectedAuthors.length > 0 || selectedSeries.length > 0 ||
    durationFilter.min !== undefined || durationFilter.max !== undefined;

  // Filter book results with fuzzy matching
  const bookResults = useMemo(() => {
    if (!hasActiveSearch) return [];

    // Get base results from cache
    let results = filterItems(filters);

    // If query has results, use them; otherwise try fuzzy matching
    if (results.length === 0 && debouncedQuery.trim()) {
      // Try expanded abbreviations
      const expanded = expandAbbreviations(debouncedQuery);
      for (const term of expanded) {
        if (term !== debouncedQuery) {
          const expandedResults = filterItems({ ...filters, query: term });
          if (expandedResults.length > 0) {
            results = expandedResults;
            break;
          }
        }
      }
    }

    return results.slice(0, 100);
  }, [filterItems, filters, hasActiveSearch, debouncedQuery]);

  // Filter authors matching query (with fuzzy matching)
  const authorResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return allAuthors
      .filter(a => fuzzyMatch(debouncedQuery, a.name, 0.6))
      .slice(0, 20);
  }, [debouncedQuery, allAuthors]);

  // Filter narrators matching query (with fuzzy matching)
  const narratorResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return allNarrators
      .filter(n => fuzzyMatch(debouncedQuery, n.name, 0.6))
      .slice(0, 20);
  }, [debouncedQuery, allNarrators]);

  // Filter series matching query (with fuzzy matching)
  const seriesResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return allSeries
      .filter(s => fuzzyMatch(debouncedQuery, s.name, 0.6))
      .slice(0, 20);
  }, [debouncedQuery, allSeries]);

  // ============================================================================
  // AUTOCOMPLETE SUGGESTIONS (simple text, max 6 on mobile per research)
  // ============================================================================

  // Autocomplete uses instant query (not debounced) for responsiveness
  const autocompleteSuggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return { books: [], authors: [], series: [], narrators: [] };

    const lowerQuery = query.toLowerCase();

    // Books - simple text, max 2 (per research: 4-6 total suggestions)
    const books = filterItems({ query: query.trim() })
      .slice(0, 2)
      .map(book => {
        const metadata = book.media?.metadata as any;
        const media = book.media as any;
        const duration = media?.duration || 0;
        const hours = Math.floor(duration / 3600);
        const mins = Math.floor((duration % 3600) / 60);
        const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        return {
          id: book.id,
          title: metadata?.title || 'Unknown',
          author: metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown',
          duration: durationStr,
        };
      });

    // Authors - max 2
    const authors = allAuthors
      .filter(a => a.name.toLowerCase().includes(lowerQuery))
      .slice(0, 2)
      .map(a => ({ name: a.name, bookCount: a.bookCount }));

    // Series - max 1
    const series = allSeries
      .filter(s => s.name.toLowerCase().includes(lowerQuery))
      .slice(0, 1)
      .map(s => ({ name: s.name, bookCount: s.bookCount }));

    // Narrators - max 1
    const narrators = allNarrators
      .filter(n => n.name.toLowerCase().includes(lowerQuery))
      .slice(0, 1)
      .map(n => ({ name: n.name, bookCount: n.bookCount }));

    return { books, authors, series, narrators };
  }, [query, filterItems, allAuthors, allSeries, allNarrators]);

  // "Did you mean" suggestions when no results
  const spellingSuggestions = useMemo(() => {
    if (!hasActiveSearch || bookResults.length > 0 || authorResults.length > 0) {
      return [];
    }

    // Find similar author names
    const authorNames = allAuthors.map(a => a.name);
    const authorSuggestions = findSuggestions(debouncedQuery, authorNames, 2, 0.5);

    // Find similar series names
    const seriesNames = allSeries.map(s => s.name);
    const seriesSuggestions = findSuggestions(debouncedQuery, seriesNames, 1, 0.5);

    return [...authorSuggestions, ...seriesSuggestions].slice(0, 3);
  }, [hasActiveSearch, bookResults, authorResults, debouncedQuery, allAuthors, allSeries]);

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
    setHasCommittedSearch(false);
    inputRef.current?.focus();
  };

  const handleSearch = () => {
    if (query.trim()) {
      saveSearch(query.trim());
      setHasCommittedSearch(true);
      Keyboard.dismiss();
    }
  };

  const handlePreviousSearchPress = (search: string) => {
    setQuery(search);
    setHasCommittedSearch(true);
    saveSearch(search);
    Keyboard.dismiss();
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    setHasCommittedSearch(false);
  };

  const handleInputBlur = () => {
    // Small delay to allow taps on autocomplete items
    setTimeout(() => setIsInputFocused(false), 150);
  };

  const dismissAutocomplete = () => {
    setIsInputFocused(false);
    setHasCommittedSearch(true);
    Keyboard.dismiss();
  };

  // Handle autocomplete selection
  const handleAutocompleteBook = (bookId: string) => {
    setHasCommittedSearch(true);
    Keyboard.dismiss();
    navigation.navigate('BookDetail', { id: bookId });
  };

  const handleAutocompleteAuthor = (authorName: string) => {
    setQuery(authorName);
    setHasCommittedSearch(true);
    saveSearch(authorName);
    Keyboard.dismiss();
    navigation.navigate('AuthorDetail', { authorName });
  };

  const handleAutocompleteSeries = (seriesName: string) => {
    setQuery(seriesName);
    setHasCommittedSearch(true);
    saveSearch(seriesName);
    Keyboard.dismiss();
    navigation.navigate('SeriesDetail', { seriesName });
  };

  const handleAutocompleteNarrator = (narratorName: string) => {
    setQuery(narratorName);
    setHasCommittedSearch(true);
    saveSearch(narratorName);
    Keyboard.dismiss();
    navigation.navigate('NarratorDetail', { narratorName });
  };

  // Handle "Did you mean" suggestion tap
  const handleSpellingSuggestion = (text: string) => {
    setQuery(text);
    setHasCommittedSearch(false);
    saveSearch(text);
  };

  const handleBookPress = useCallback((book: LibraryItem) => {
    Keyboard.dismiss();
    if (query.trim()) saveSearch(query.trim());
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation, query]);

  const handlePlayBook = useCallback(async (book: LibraryItem) => {
    Keyboard.dismiss();
    if (query.trim()) saveSearch(query.trim());
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      await loadBook(book, { autoPlay: true, showPlayer: false });
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

  // Get initials for avatar
  const getInitials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // Check if we have any results
  const hasResults = bookResults.length > 0 || seriesResults.length > 0 ||
    authorResults.length > 0 || narratorResults.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT + 10 }]}>
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
            onChangeText={(text) => {
              setQuery(text);
              setHasCommittedSearch(false);
            }}
            onSubmitEditing={handleSearch}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
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

      {/* Autocomplete Overlay (simple text per research - no thumbnails) */}
      {showAutocomplete && (
        <>
          {/* Darkened background per Baymard research */}
          <Pressable style={styles.autocompleteBackdrop} onPress={dismissAutocomplete} />

          <View style={styles.autocompleteContainer}>
            {/* Books */}
            {autocompleteSuggestions.books.length > 0 && (
              <View style={styles.autocompleteSectionContainer}>
                <Text style={styles.autocompleteSection}>BOOKS</Text>
                {autocompleteSuggestions.books.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    style={styles.autocompleteItem}
                    onPress={() => handleAutocompleteBook(book.id)}
                  >
                    <View style={styles.autocompleteItemContent}>
                      <Text style={styles.autocompleteTitle} numberOfLines={1}>{book.title}</Text>
                      <Text style={styles.autocompleteMeta}>{book.author} · {book.duration}</Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" set="ionicons" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Authors */}
            {autocompleteSuggestions.authors.length > 0 && (
              <View style={styles.autocompleteSectionContainer}>
                <Text style={styles.autocompleteSection}>AUTHORS</Text>
                {autocompleteSuggestions.authors.map((author) => (
                  <TouchableOpacity
                    key={author.name}
                    style={styles.autocompleteItem}
                    onPress={() => handleAutocompleteAuthor(author.name)}
                  >
                    <View style={styles.autocompleteItemContent}>
                      <Text style={styles.autocompleteTitle}>{author.name}</Text>
                      <Text style={styles.autocompleteMeta}>{author.bookCount} books</Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" set="ionicons" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Series */}
            {autocompleteSuggestions.series.length > 0 && (
              <View style={styles.autocompleteSectionContainer}>
                <Text style={styles.autocompleteSection}>SERIES</Text>
                {autocompleteSuggestions.series.map((series) => (
                  <TouchableOpacity
                    key={series.name}
                    style={styles.autocompleteItem}
                    onPress={() => handleAutocompleteSeries(series.name)}
                  >
                    <View style={styles.autocompleteItemContent}>
                      <Text style={styles.autocompleteTitle}>{series.name}</Text>
                      <Text style={styles.autocompleteMeta}>{series.bookCount} books</Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" set="ionicons" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Narrators */}
            {autocompleteSuggestions.narrators.length > 0 && (
              <View style={styles.autocompleteSectionContainer}>
                <Text style={styles.autocompleteSection}>NARRATORS</Text>
                {autocompleteSuggestions.narrators.map((narrator) => (
                  <TouchableOpacity
                    key={narrator.name}
                    style={styles.autocompleteItem}
                    onPress={() => handleAutocompleteNarrator(narrator.name)}
                  >
                    <View style={styles.autocompleteItemContent}>
                      <Text style={styles.autocompleteTitle}>{narrator.name}</Text>
                      <Text style={styles.autocompleteMeta}>{narrator.bookCount} books narrated</Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" set="ionicons" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* No autocomplete results */}
            {autocompleteSuggestions.books.length === 0 &&
              autocompleteSuggestions.authors.length === 0 &&
              autocompleteSuggestions.series.length === 0 &&
              autocompleteSuggestions.narrators.length === 0 && (
                <View style={styles.noAutocomplete}>
                  <Text style={styles.noAutocompleteText}>Press search to find results</Text>
                </View>
              )}
          </View>
        </>
      )}

      {/* Results */}
      <ScrollView
        style={styles.results}
        contentContainerStyle={[styles.resultsContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
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
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => navigation.navigate('GenresList')}>
                  <Icon name="albums-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Genres</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => navigation.navigate('AuthorsList')}>
                  <Icon name="person-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Authors</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.quickBrowseRow}>
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => navigation.navigate('SeriesList')}>
                  <Icon name="library-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Series</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBrowseItem} onPress={() => navigation.navigate('NarratorList')}>
                  <Icon name="mic-outline" size={24} color={ACCENT} set="ionicons" />
                  <Text style={styles.quickBrowseItemText}>Narrators</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* No results - with "Did you mean" recovery (per NNGroup: never leave at dead end) */}
        {hasActiveSearch && !hasResults && (
          <View style={styles.noResultsContainer}>
            <View style={styles.noResultsHeader}>
              <Icon name="search-outline" size={40} color="rgba(255,255,255,0.3)" set="ionicons" />
              <Text style={styles.noResultsTitle}>No results for "{debouncedQuery}"</Text>
            </View>

            {/* Spelling suggestions */}
            {spellingSuggestions.length > 0 && (
              <View style={styles.spellingSuggestions}>
                <Text style={styles.didYouMean}>Did you mean:</Text>
                {spellingSuggestions.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionItem}
                    onPress={() => handleSpellingSuggestion(suggestion.text)}
                  >
                    <Text style={styles.suggestionText}>{suggestion.text}</Text>
                    <Icon name="arrow-forward" size={16} color={ACCENT} set="ionicons" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Browse categories recovery */}
            <View style={styles.browseRecovery}>
              <Text style={styles.browseRecoveryTitle}>Or browse popular categories</Text>
              <View style={styles.browseRecoveryGrid}>
                <TouchableOpacity
                  style={styles.browseRecoveryItem}
                  onPress={() => navigation.navigate('GenresList')}
                >
                  <Icon name="albums-outline" size={20} color={ACCENT} set="ionicons" />
                  <Text style={styles.browseRecoveryText}>Genres</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.browseRecoveryItem}
                  onPress={() => navigation.navigate('AuthorsList')}
                >
                  <Icon name="person-outline" size={20} color={ACCENT} set="ionicons" />
                  <Text style={styles.browseRecoveryText}>Authors</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.browseRecoveryItem}
                  onPress={() => navigation.navigate('SeriesList')}
                >
                  <Icon name="library-outline" size={20} color={ACCENT} set="ionicons" />
                  <Text style={styles.browseRecoveryText}>Series</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tips */}
            <View style={styles.searchTips}>
              <Text style={styles.searchTipsTitle}>Search tips:</Text>
              <Text style={styles.searchTip}>• Check spelling of author/narrator names</Text>
              <Text style={styles.searchTip}>• Try searching by series name</Text>
              <Text style={styles.searchTip}>• Use fewer keywords</Text>
            </View>
          </View>
        )}

        {/* Unified Results - Books Section */}
        {hasActiveSearch && bookResults.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Books</Text>
              {bookResults.length > 5 && (
                <Text style={styles.sectionCount}>{bookResults.length} results</Text>
              )}
            </View>
            <View>
              {bookResults.slice(0, 5).map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  onPress={() => handleBookPress(book)}
                  showListeningProgress={true}
                />
              ))}
            </View>
          </View>
        )}

        {/* Series Section (top 3 with stacked covers) */}
        {hasActiveSearch && seriesResults.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Series</Text>
              {seriesResults.length > 3 && (
                <TouchableOpacity onPress={() => navigation.navigate('SeriesList')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.seriesRow}>
              {seriesResults.slice(0, 3).map(series => (
                <SeriesCard
                  key={series.name}
                  series={series}
                  onPress={() => handleSeriesPress(series.name)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Authors Section (top 2) */}
        {hasActiveSearch && authorResults.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Authors</Text>
              {authorResults.length > 2 && (
                <TouchableOpacity onPress={() => navigation.navigate('AuthorList')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.entityList}>
              {authorResults.slice(0, 2).map(author => (
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
          </View>
        )}

        {/* Narrators Section (top 2) */}
        {hasActiveSearch && narratorResults.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Narrators</Text>
              {narratorResults.length > 2 && (
                <TouchableOpacity onPress={() => navigation.navigate('NarratorList')}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.entityList}>
              {narratorResults.slice(0, 2).map(narrator => (
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
          </View>
        )}
      </ScrollView>
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
    paddingTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  viewAllText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  emptyStateContainer: {
    paddingHorizontal: PADDING,
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
    gap: 8,
    marginBottom: 8,
  },
  quickBrowseItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
  },
  quickBrowseItemText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 8,
  },

  // Series row with horizontally stacked covers
  seriesRow: {
    flexDirection: 'row',
    paddingHorizontal: PADDING,
    gap: GAP,
  },
  seriesCard: {
    width: SERIES_CARD_WIDTH,
  },
  seriesStackContainer: {
    width: SERIES_CARD_WIDTH,
    height: SERIES_COVER_SIZE,
    marginBottom: 8,
  },
  seriesStackCover: {
    position: 'absolute',
    width: SERIES_COVER_SIZE,
    height: SERIES_COVER_SIZE,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: CARD_COLOR,
    // Enhanced drop shadow for each cover
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  seriesCoverImage: {
    width: '100%',
    height: '100%',
  },
  seriesTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  seriesTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 14,
    paddingRight: 4,
  },
  heartButton: {
    height: 26,
    justifyContent: 'flex-start',
    paddingTop: 1,
  },

  // Entity list (authors, narrators)
  entityList: {
    paddingHorizontal: PADDING,
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

  // ============================================================================
  // AUTOCOMPLETE STYLES (per NNGroup/Baymard research)
  // ============================================================================

  autocompleteBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)', // Darkened background per research
    zIndex: 10,
  },
  autocompleteContainer: {
    position: 'absolute',
    top: 110, // Below search bar
    left: 0,
    right: 0,
    backgroundColor: CARD_COLOR,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 400,
    zIndex: 20,
    paddingVertical: 8,
    // Shadow for visual depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  autocompleteSectionContainer: {
    marginBottom: 4,
  },
  autocompleteSection: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  autocompleteItemContent: {
    flex: 1,
  },
  autocompleteTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  autocompleteMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  noAutocomplete: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  noAutocompleteText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },

  // ============================================================================
  // NO RESULTS RECOVERY STYLES (per NNGroup: never leave at dead end)
  // ============================================================================

  noResultsContainer: {
    paddingHorizontal: PADDING,
    paddingTop: 40,
  },
  noResultsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  noResultsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },

  // Spelling suggestions
  spellingSuggestions: {
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  didYouMean: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  suggestionText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },

  // Browse recovery
  browseRecovery: {
    marginBottom: 24,
  },
  browseRecoveryTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  browseRecoveryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  browseRecoveryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 6,
  },
  browseRecoveryText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },

  // Search tips
  searchTips: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  searchTipsTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  searchTip: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    lineHeight: 20,
  },
});
