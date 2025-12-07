/**
 * src/features/library/screens/GenreDetailScreen.tsx
 *
 * Shows all books in a specific genre with search functionality.
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { BookCard } from '@/shared/components/BookCard';

const BG_COLOR = '#000000';
const CARD_COLOR = '#2a2a2a';
const ACCENT = '#CCFF00';
const PADDING = 16;

type SortType = 'title' | 'author' | 'dateAdded';
type SortDirection = 'asc' | 'desc';

type GenreDetailParams = {
  genreName: string;
};

export function GenreDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ GenreDetail: GenreDetailParams }, 'GenreDetail'>>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const genreName = route.params?.genreName || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refreshCache, isLoaded, filterItems } = useLibraryCache();

  // Get all books in this genre
  const genreBooks = useMemo(() => {
    if (!genreName) return [];
    return filterItems({ genres: [genreName] });
  }, [genreName, filterItems]);

  // Filter by search query
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return genreBooks;
    const lowerQuery = searchQuery.toLowerCase();
    return genreBooks.filter((book) => {
      const metadata = book.media?.metadata as any;
      const title = metadata?.title || '';
      const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';
      return (
        title.toLowerCase().includes(lowerQuery) ||
        author.toLowerCase().includes(lowerQuery)
      );
    });
  }, [genreBooks, searchQuery]);

  // Sort books
  const sortedBooks = useMemo(() => {
    const sorted = [...filteredBooks];
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'title':
        sorted.sort((a, b) => {
          const aTitle = (a.media?.metadata as any)?.title || '';
          const bTitle = (b.media?.metadata as any)?.title || '';
          return direction * aTitle.localeCompare(bTitle);
        });
        break;
      case 'author':
        sorted.sort((a, b) => {
          const aAuthor = (a.media?.metadata as any)?.authorName || '';
          const bAuthor = (b.media?.metadata as any)?.authorName || '';
          return direction * aAuthor.localeCompare(bAuthor);
        });
        break;
      case 'dateAdded':
        sorted.sort((a, b) => {
          return direction * ((a.addedAt || 0) - (b.addedAt || 0));
        });
        break;
    }

    return sorted;
  }, [filteredBooks, sortBy, sortDirection]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSortPress = (type: SortType) => {
    if (sortBy === type) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(type);
      setSortDirection('asc');
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

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
            ref={inputRef}
            style={styles.searchInput}
            placeholder={`Search in ${genreName}...`}
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

      {/* Genre Title */}
      <View style={styles.titleBar}>
        <Text style={styles.genreTitle}>{genreName}</Text>
        <Text style={styles.resultCount}>{sortedBooks.length} books</Text>
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
            onPress={() => handleSortPress('title')}
          >
            <Icon
              name={sortBy === 'title' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'swap-vertical'}
              size={14}
              color={sortBy === 'title' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
            <Text style={[styles.sortButtonText, sortBy === 'title' && styles.sortButtonTextActive]}>
              {sortBy === 'title' ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A') : 'Title'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'author' && styles.sortButtonActive]}
            onPress={() => handleSortPress('author')}
          >
            <Icon
              name={sortBy === 'author' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'person-outline'}
              size={14}
              color={sortBy === 'author' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
            <Text style={[styles.sortButtonText, sortBy === 'author' && styles.sortButtonTextActive]}>Author</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'dateAdded' && styles.sortButtonActive]}
            onPress={() => handleSortPress('dateAdded')}
          >
            <Icon
              name={sortBy === 'dateAdded' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'calendar-outline'}
              size={14}
              color={sortBy === 'dateAdded' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
            <Text style={[styles.sortButtonText, sortBy === 'dateAdded' && styles.sortButtonTextActive]}>Date</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
      >
        {sortedBooks.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onPress={() => handleBookPress(book.id)}
            showListeningProgress={true}
          />
        ))}

        {sortedBooks.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="book-outline" size={48} color="rgba(255,255,255,0.2)" set="ionicons" />
            <Text style={styles.emptyTitle}>No books found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'No books in this genre'}
            </Text>
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
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    marginBottom: 8,
  },
  genreTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
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
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    paddingBottom: 12,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: CARD_COLOR,
  },
  sortButtonActive: {
    backgroundColor: ACCENT,
  },
  sortButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#000',
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
  },
  emptyState: {
    flex: 1,
    width: '100%',
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
});
