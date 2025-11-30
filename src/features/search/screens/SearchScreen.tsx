/**
 * src/features/search/screens/SearchScreen.tsx
 * 
 * Search screen with dark theme and colored result cards
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '../components/SearchBar';
import { 
  SearchResultSection, 
  BookResultsRow,
  SeriesResultsRow,
  GroupResultsRow,
  AllResultsList,
  BookListItem,
  GroupResultCard,
} from '../components/SearchResultSection';
import { useServerSearch } from '../hooks/useServerSearch';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { Icon } from '@/shared/components/Icon';
import { LibraryItem } from '@/core/types';

const HEADER_BG = '#303030';
const GAP = 5;

type ViewMode = 'default' | 'books' | 'series' | 'authors' | 'narrators';

interface GroupData {
  name: string;
  bookCount: number;
  books: LibraryItem[];
}

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [viewMode, setViewMode] = useState<ViewMode>('default');

  const { library } = useDefaultLibrary();
  
  // Server-side search - fast!
  const { query, setQuery, clearSearch, results, isSearching, hasSearched } = useServerSearch(library?.id || '');

  // Use results directly from server
  const seriesData = useMemo(() => {
    return results.series.map(s => ({
      name: s.name,
      bookCount: s.books?.length || 0,
      books: s.books || [],
    }));
  }, [results.series]);

  const authorsData = useMemo(() => {
    return results.authors.map(a => ({
      name: a.name,
      bookCount: a.books?.length || 0,
      books: a.books || [],
    }));
  }, [results.authors]);

  const narratorsData = useMemo(() => {
    return results.narrators.map(n => ({
      name: n.name,
      bookCount: n.books?.length || 0,
      books: n.books || [],
    }));
  }, [results.narrators]);

  const handleClearSearch = () => {
    clearSearch();
    setViewMode('default');
  };

  const handleBack = () => {
    if (viewMode !== 'default') {
      setViewMode('default');
    } else {
      navigation.goBack();
    }
  };

  const handleSeriesPress = (seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  };

  const handleAuthorPress = (authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  };

  const handleNarratorPress = (narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
  };

  const hasResults = results.books.length > 0 || 
    results.series.length > 0 || 
    results.authors.length > 0 || 
    results.narrators.length > 0;

  const showBooks = results.books.length > 0;
  const showSeries = seriesData.length > 0;
  const showAuthors = authorsData.length > 0;
  const showNarrators = narratorsData.length > 0;

  // View mode list rendering
  const renderGroupListItem = ({ item }: { item: GroupData }) => (
    <GroupResultCard
      name={item.name}
      bookCount={item.bookCount}
      books={item.books}
      onPress={() => {
        if (viewMode === 'series') handleSeriesPress(item.name);
        else if (viewMode === 'authors') handleAuthorPress(item.name);
        else handleNarratorPress(item.name);
      }}
    />
  );

  // View mode screens
  if (viewMode !== 'default') {
    const viewTitle = viewMode === 'books' ? 'Books' : 
      viewMode === 'series' ? 'Series' : 
      viewMode === 'authors' ? 'Authors' : 'Narrators';

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Icon name="arrow-back" size={24} color="#FFFFFF" set="ionicons" />
          </TouchableOpacity>
          <Text style={styles.viewTitle}>{viewTitle}</Text>
          <View style={styles.backButton} />
        </View>

        {viewMode === 'books' ? (
          <FlashList
            data={results.books}
            renderItem={({ item }) => <BookListItem book={item} />}
            keyExtractor={(item) => item.id}
            estimatedItemSize={100}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <ScrollView 
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {(viewMode === 'series' ? seriesData :
                viewMode === 'authors' ? authorsData :
                narratorsData
              ).map((item) => (
                <View key={item.name} style={styles.gridItem}>
                  <GroupResultCard
                    name={item.name}
                    bookCount={item.bookCount}
                    books={item.books}
                    onPress={() => {
                      if (viewMode === 'series') handleSeriesPress(item.name);
                      else if (viewMode === 'authors') handleAuthorPress(item.name);
                      else handleNarratorPress(item.name);
                    }}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>
        <View style={styles.searchBarContainer}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={handleClearSearch}
            autoFocus={true}
          />
        </View>
      </View>

      {/* Results */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Initial State */}
        {!hasSearched && !isSearching && (
          <View style={styles.initialState}>
            <Icon
              name="search"
              size={64}
              color="rgba(255,255,255,0.3)"
              set="ionicons"
            />
            <Text style={styles.initialTitle}>Search your library</Text>
            <Text style={styles.initialSubtitle}>
              Type to start searching
            </Text>
          </View>
        )}

        {/* Loading */}
        {isSearching && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {/* No Results */}
        {hasSearched && !isSearching && !hasResults && (
          <View style={styles.emptyState}>
            <Icon
              name="search"
              size={48}
              color="rgba(255,255,255,0.3)"
              set="ionicons"
            />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search term
            </Text>
          </View>
        )}

        {/* Books Section */}
        {showBooks && !isSearching && (
          <SearchResultSection 
            title="Books" 
            count={results.books.length}
            onViewAll={() => setViewMode('books')}
          >
            <BookResultsRow books={results.books.slice(0, 6)} />
          </SearchResultSection>
        )}

        {/* Series Section */}
        {showSeries && !isSearching && (
          <SearchResultSection 
            title="Series" 
            count={seriesData.length}
            onViewAll={() => setViewMode('series')}
          >
            <SeriesResultsRow 
              series={seriesData.slice(0, 6)} 
              onPress={handleSeriesPress} 
            />
          </SearchResultSection>
        )}

        {/* Authors & Narrators Row */}
        {(showAuthors || showNarrators) && !isSearching && (
          <View style={styles.sideBySideRow}>
            {/* Authors */}
            {showAuthors && (
              <View style={styles.halfSection}>
                <View style={styles.halfSectionHeader}>
                  <Text style={styles.halfSectionTitle}>Authors</Text>
                  <TouchableOpacity onPress={() => setViewMode('authors')}>
                    <Text style={styles.viewAll}>View</Text>
                  </TouchableOpacity>
                </View>
                <GroupResultsRow 
                  groups={authorsData.slice(0, 2)} 
                  onPress={handleAuthorPress}
                  compact
                />
              </View>
            )}

            {/* Narrators */}
            {showNarrators && (
              <View style={styles.halfSection}>
                <View style={styles.halfSectionHeader}>
                  <Text style={styles.halfSectionTitle}>Narrators</Text>
                  <TouchableOpacity onPress={() => setViewMode('narrators')}>
                    <Text style={styles.viewAll}>View</Text>
                  </TouchableOpacity>
                </View>
                <GroupResultsRow 
                  groups={narratorsData.slice(0, 2)} 
                  onPress={handleNarratorPress}
                  compact
                />
              </View>
            )}
          </View>
        )}

        {/* All Results List */}
        {hasResults && !isSearching && (
          <SearchResultSection 
            title="All Results" 
            count={results.books.length}
            onViewAll={() => setViewMode('books')}
          >
            <AllResultsList books={results.books.slice(0, 5)} />
          </SearchResultSection>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEADER_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GAP,
    paddingVertical: 10,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    flex: 1,
  },
  viewTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 120,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  gridContent: {
    paddingHorizontal: GAP,
    paddingTop: 8,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.33%',
    padding: GAP / 2,
  },

  // Initial/Empty states
  initialState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  initialTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  initialSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  loadingState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },

  // Side by side row
  sideBySideRow: {
    flexDirection: 'row',
    paddingHorizontal: GAP,
    gap: GAP,
    marginBottom: 20,
  },
  halfSection: {
    flex: 1,
  },
  halfSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  halfSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAll: {
    fontSize: 13,
    color: '#007AFF',
  },
});