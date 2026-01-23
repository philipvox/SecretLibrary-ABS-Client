/**
 * src/features/library/screens/AllBooksScreen.tsx
 *
 * All Books screen matching SeriesListScreen design.
 * Shows all books in a list view with sorting options.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { InteractionManager } from 'react-native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache, useCoverUrl } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { SkullRefreshControl, TopNav, TopNavBackIcon, BookIcon, AlphabetScrubber, ScreenLoadingOverlay } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { CompleteBadgeOverlay } from '@/features/completion';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useTheme } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { LibraryItem, BookMetadata } from '@/core/types';

const PADDING = 16;

// Helper to get book metadata
function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

// Helper to get book duration
function getBookDuration(item: LibraryItem): number {
  return (item.media as any)?.duration || 0;
}

// Helper to format duration compactly
function formatDurationCompact(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Sort types
type SortType = 'recent' | 'title' | 'author' | 'duration';
type SortDirection = 'asc' | 'desc';

// List item component
interface ListItemProps {
  item: LibraryItem;
  onPress: () => void;
  isDark: boolean;
}

const ListBookItem = React.memo(function ListBookItem({ item, onPress, isDark }: ListItemProps) {
  const coverUrl = useCoverUrl(item.id);
  const metadata = getMetadata(item);
  const title = metadata.title || 'Untitled';
  const author = metadata.authorName || metadata.authors?.[0]?.name || '';
  const duration = getBookDuration(item);
  const durationText = duration > 0 ? formatDurationCompact(duration) : '';

  return (
    <Pressable
      style={[
        styles.bookCard,
        isDark ? styles.cardDark : styles.cardLight,
      ]}
      onPress={onPress}
    >
      {/* Cover */}
      <View style={styles.coverContainer}>
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
        />
        <CompleteBadgeOverlay bookId={item.id} size="tiny" />
      </View>

      {/* Info */}
      <View style={styles.bookInfo}>
        <Text
          style={[styles.bookTitle, isDark && styles.bookTitleDark]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {author && (
          <Text style={styles.authorText} numberOfLines={1}>
            {author}
          </Text>
        )}
        {durationText && (
          <Text style={styles.durationText}>
            {durationText}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

export function AllBooksScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { items: libraryItems, refreshCache, isLoaded } = useLibraryCache();

  // Wait for navigation animation to complete before showing content
  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      setMounted(true);
      // Hide global loading overlay triggered from source screen
      globalLoading.hide();
    });
    return () => interaction.cancel();
  }, []);

  // Filter and sort books
  const sortedBooks = useMemo(() => {
    if (!libraryItems?.length) return [];

    let books = libraryItems.filter(item => item.mediaType === 'book');

    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      books = books.filter(item => {
        const metadata = getMetadata(item);
        const title = (metadata.title || '').toLowerCase();
        const author = (metadata.authorName || '').toLowerCase();
        return title.includes(lowerQuery) || author.includes(lowerQuery);
      });
    }

    // Sort
    const direction = sortDirection === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'recent':
        books.sort((a, b) => direction * ((b.addedAt || 0) - (a.addedAt || 0)));
        break;
      case 'title':
        books.sort((a, b) => {
          const titleA = getMetadata(a).title || '';
          const titleB = getMetadata(b).title || '';
          return direction * titleA.localeCompare(titleB);
        });
        break;
      case 'author':
        books.sort((a, b) => {
          const authorA = getMetadata(a).authorName || getMetadata(a).authors?.[0]?.name || '';
          const authorB = getMetadata(b).authorName || getMetadata(b).authors?.[0]?.name || '';
          return direction * authorA.localeCompare(authorB);
        });
        break;
      case 'duration':
        books.sort((a, b) => direction * (getBookDuration(b) - getBookDuration(a)));
        break;
    }

    return books;
  }, [libraryItems, searchQuery, sortBy, sortDirection]);

  // Get alphabet letters for scrubber (only for title/author sort)
  const { letters: alphabetLetters, letterIndexMap } = useMemo(() => {
    if (sortBy !== 'title' && sortBy !== 'author') {
      return { letters: [], letterIndexMap: new Map<string, number>() };
    }

    const lettersSet = new Set<string>();
    const indexMap = new Map<string, number>();

    sortedBooks.forEach((item, index) => {
      const metadata = getMetadata(item);
      const text = sortBy === 'title'
        ? metadata.title
        : (metadata.authorName || metadata.authors?.[0]?.name || '');
      const firstChar = (text || '').charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        if (!lettersSet.has(firstChar)) {
          lettersSet.add(firstChar);
          indexMap.set(firstChar, index);
        }
      }
    });

    return {
      letters: Array.from(lettersSet).sort(),
      letterIndexMap: indexMap,
    };
  }, [sortedBooks, sortBy]);

  // Handlers
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSortPress = useCallback((type: SortType) => {
    if (sortBy === type) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      // Default directions
      setSortDirection(type === 'recent' || type === 'duration' ? 'desc' : 'asc');
    }
  }, [sortBy]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshCache();
    setIsRefreshing(false);
  }, [refreshCache]);

  const handleLetterSelect = useCallback((letter: string) => {
    const index = letterIndexMap.get(letter);
    if (index !== undefined) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [letterIndexMap]);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <ListBookItem
      item={item}
      onPress={() => handleBookPress(item.id)}
      isDark={isDark}
    />
  ), [handleBookPress, isDark]);

  const keyExtractor = useCallback((item: LibraryItem) => item.id, []);

  // Get sort button label
  const getSortLabel = (type: SortType) => {
    if (sortBy !== type) {
      switch (type) {
        case 'recent': return 'Recent';
        case 'title': return 'Title';
        case 'author': return 'Author';
        case 'duration': return 'Length';
      }
    }
    // Active sort - show direction
    switch (type) {
      case 'recent':
        return sortDirection === 'desc' ? 'Newest' : 'Oldest';
      case 'title':
        return sortDirection === 'asc' ? 'A-Z' : 'Z-A';
      case 'author':
        return sortDirection === 'asc' ? 'A-Z' : 'Z-A';
      case 'duration':
        return sortDirection === 'desc' ? 'Longest' : 'Shortest';
    }
  };

  const getSortIcon = (type: SortType) => {
    if (sortBy !== type) {
      switch (type) {
        case 'recent': return 'Clock';
        case 'title': return 'ArrowUpDown';
        case 'author': return 'User';
        case 'duration': return 'Timer';
      }
    }
    return sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />

      {/* TopNav with skull logo and integrated search bar */}
      <TopNav
        variant={isDark ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: colors.background.primary }}
        pills={[
          {
            key: 'books',
            label: 'All Books',
            icon: <BookIcon size={10} color={colors.text.primary} />,
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
          placeholder: 'Search books...',
          inputRef: inputRef as React.RefObject<TextInput>,
        }}
      />

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>
          {sortedBooks.length} books
        </Text>
        <View style={styles.sortButtons}>
          {(['recent', 'title', 'author', 'duration'] as SortType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.sortButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                sortBy === type && { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' },
              ]}
              onPress={() => handleSortPress(type)}
            >
              <Icon
                name={getSortIcon(type)}
                size={12}
                color={sortBy === type ? colors.text.primary : colors.text.tertiary}
              />
              <Text
                style={[
                  styles.sortButtonText,
                  { color: sortBy === type ? colors.text.primary : colors.text.tertiary },
                ]}
              >
                {getSortLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Book List */}
      <View style={styles.listContainer}>
        <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
          <FlatList
            ref={flatListRef}
            data={mounted ? sortedBooks : []}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[styles.list, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
            getItemLayout={(data, index) => ({
              length: 80,
              offset: 80 * index,
              index,
            })}
          />
        </SkullRefreshControl>

        {/* Alphabet Scrubber (for title/author sort) */}
        {alphabetLetters.length > 0 && (
          <AlphabetScrubber
            letters={alphabetLetters}
            onLetterSelect={handleLetterSelect}
          />
        )}
      </View>

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    paddingBottom: 12,
  },
  resultCount: {
    fontSize: 14,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sortButtonText: {
    fontSize: 10,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  list: {
    paddingHorizontal: PADDING,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  cardLight: {
    backgroundColor: secretLibraryColors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  cardDark: {
    backgroundColor: secretLibraryColors.black,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  coverContainer: {
    position: 'relative',
    marginRight: 12,
  },
  cover: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(4),
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
    color: secretLibraryColors.black,
    lineHeight: scale(20),
    marginBottom: 2,
  },
  bookTitleDark: {
    color: secretLibraryColors.white,
  },
  authorText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: secretLibraryColors.gray,
    marginBottom: 2,
  },
  durationText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: secretLibraryColors.gray,
  },
});

export default AllBooksScreen;
