/**
 * src/features/search/screens/SearchScreen.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { SearchBar } from '../components/SearchBar';
import { 
  SearchResultSection, 
  BookResultsRow,
  SeriesResultsRow,
  GroupResultsRow,
  AllResultsList,
  BookListItem,
} from '../components/SearchResultSection';
import { useSearch } from '../hooks/useSearch';
import { useAllLibraryItems } from '../hooks/useAllLibraryItems';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { useLibrarySeries } from '@/features/series/hooks/useLibrarySeries';
import { useLibraryAuthors } from '@/features/author/hooks/useLibraryAuthors';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner } from '@/shared/components';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';
import { LibraryItem } from '@/core/types';

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
  const { items, isLoading } = useAllLibraryItems(library?.id || '');
  const { series: allSeries } = useLibrarySeries(library?.id || '');
  const { authors: allAuthors } = useLibraryAuthors(library?.id || '');

  const { query, setQuery, clearSearch, results, hasSearched } = useSearch(items);

  const handleBack = () => {
    if (viewMode !== 'default') {
      setViewMode('default');
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  const handleSeriesPress = (seriesName: string) => {
    // Look up series ID from library series data
    const series = allSeries.find(s => 
      s.name?.toLowerCase().trim() === seriesName?.toLowerCase().trim()
    );
    
    if (series?.id) {
      console.log('Navigating to series:', series.id, series.name);
      navigation.navigate('SeriesDetail', { seriesId: series.id });
    } else {
      console.log('Series not found:', seriesName);
    }
  };

  const handleAuthorPress = (authorName: string) => {
    // Look up author ID from library authors data
    const author = allAuthors.find(a => 
      a.name?.toLowerCase().trim() === authorName?.toLowerCase().trim()
    );
    
    if (author?.id) {
      console.log('Navigating to author:', author.id, author.name);
      navigation.navigate('AuthorDetail', { authorId: author.id });
    } else {
      console.log('Author not found:', authorName);
    }
  };

  const handleNarratorPress = (narratorName: string) => {
    console.log('Navigating to narrator:', narratorName);
    navigation.navigate('NarratorDetail', { narratorName });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Icon name="arrow-back" size={24} color={theme.colors.text.primary} set="ionicons" />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              onClear={clearSearch}
              autoFocus={false}
            />
          </View>
        </View>
        <LoadingSpinner text="Loading library..." />
      </View>
    );
  }

  const showBooks = results.books.length > 0;
  const showSeries = results.series.length > 0;
  const showAuthors = results.authors.length > 0;
  const showNarrators = results.narrators.length > 0;
  const hasResults = showBooks || showSeries || showAuthors || showNarrators;

  const seriesData = results.series.map(s => ({ 
    name: s.name, 
    bookCount: s.books.length, 
    books: s.books 
  }));

  const authorsData = results.authors.map(a => ({ 
    name: a.name, 
    bookCount: a.books.length, 
    books: a.books 
  }));

  const narratorsData = results.narrators.map(n => ({ 
    name: n.name, 
    bookCount: n.books.length, 
    books: n.books 
  }));

  const getViewTitle = () => {
    switch (viewMode) {
      case 'books': return `Books (${results.books.length})`;
      case 'series': return `Series (${results.series.length})`;
      case 'authors': return `Authors (${results.authors.length})`;
      case 'narrators': return `Narrators (${results.narrators.length})`;
      default: return '';
    }
  };

  const renderGroupListItem = ({ item }: { item: GroupData }) => {
    const previewBooks = item.books.slice(0, 4);
    
    const handlePress = () => {
      if (viewMode === 'series') {
        handleSeriesPress(item.name);
      } else if (viewMode === 'authors') {
        handleAuthorPress(item.name);
      } else if (viewMode === 'narrators') {
        handleNarratorPress(item.name);
      }
    };

    return (
      <TouchableOpacity style={styles.groupListItem} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.groupListCovers}>
          {previewBooks.map((book, index) => (
            <Image
              key={book.id}
              source={{ uri: apiClient.getItemCoverUrl(book.id) }}
              style={[
                styles.groupListCover,
                { left: index * 20, zIndex: 4 - index },
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
        <View style={styles.groupListInfo}>
          <Text style={styles.groupListName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.groupListCount}>{item.bookCount} {item.bookCount === 1 ? 'book' : 'books'}</Text>
        </View>
        <Icon name="chevron-forward" size={20} color={theme.colors.text.tertiary} set="ionicons" />
      </TouchableOpacity>
    );
  };

  // List view for specific category
  if (viewMode !== 'default' && hasSearched) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Icon name="arrow-back" size={24} color={theme.colors.text.primary} set="ionicons" />
          </TouchableOpacity>
          <Text style={styles.viewTitle}>{getViewTitle()}</Text>
          <View style={styles.backButton} />
        </View>

        {viewMode === 'books' ? (
          <FlatList
            data={results.books}
            renderItem={({ item }) => <BookListItem book={item} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <FlatList
            data={
              viewMode === 'series' ? seriesData :
              viewMode === 'authors' ? authorsData :
              narratorsData
            }
            renderItem={renderGroupListItem}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color={theme.colors.text.primary} set="ionicons" />
        </TouchableOpacity>
        <View style={styles.searchBarContainer}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={clearSearch}
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
        {!hasSearched && (
          <View style={styles.initialState}>
            <Icon
              name="search"
              size={64}
              color={theme.colors.neutral[300]}
              set="ionicons"
            />
            <Text style={styles.initialTitle}>Search your library</Text>
            <Text style={styles.initialSubtitle}>
              {items.length} books available
            </Text>
          </View>
        )}

        {hasSearched && !hasResults && (
          <View style={styles.emptyState}>
            <Icon
              name="search"
              size={48}
              color={theme.colors.neutral[300]}
              set="ionicons"
            />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search term
            </Text>
          </View>
        )}

        {/* Books Section */}
        {showBooks && (
          <SearchResultSection 
            title="Books" 
            count={results.books.length}
            onViewAll={() => setViewMode('books')}
          >
            <BookResultsRow books={results.books.slice(0, 6)} />
          </SearchResultSection>
        )}

        {/* Series Section */}
        {showSeries && (
          <SearchResultSection 
            title="Series" 
            count={results.series.length}
            onViewAll={() => setViewMode('series')}
          >
            <SeriesResultsRow 
              series={seriesData.slice(0, 6)} 
              onPress={handleSeriesPress} 
            />
          </SearchResultSection>
        )}

        {/* Authors & Narrators Row */}
        {(showAuthors || showNarrators) && (
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
        {hasResults && (
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
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    gap: theme.spacing[2],
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
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: theme.spacing[3],
    paddingBottom: 120,
  },
  listContent: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[2],
    paddingBottom: 120,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginVertical: theme.spacing[1],
  },
  groupListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
  },
  groupListCovers: {
    width: 100,
    height: 60,
    position: 'relative',
  },
  groupListCover: {
    position: 'absolute',
    width: 40,
    height: 60,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.neutral[200],
    borderWidth: 2,
    borderColor: theme.colors.background.primary,
  },
  groupListInfo: {
    flex: 1,
    marginLeft: theme.spacing[4],
  },
  groupListName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  groupListCount: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    marginTop: 4,
  },
  sideBySideRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[5],
  },
  halfSection: {
    flex: 1,
  },
  halfSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  halfSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  viewAll: {
    fontSize: 13,
    color: theme.colors.primary[500],
    fontWeight: '500',
  },
  initialState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[8],
    paddingTop: 100,
  },
  initialTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: theme.spacing[4],
    marginBottom: theme.spacing[2],
  },
  initialSubtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[8],
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[1],
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});