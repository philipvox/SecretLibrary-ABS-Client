/**
 * src/features/library/screens/AllBooksScreen.tsx
 *
 * All Books screen matching SeriesListScreen design.
 * Shows all books in a list view with sorting options.
 * Sort uses a dropdown modal matching the home page pattern.
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
  Pressable,
  Modal,
  ViewStyle,
  TextStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { CoverStars } from '@/shared/components/CoverStars';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache, useCoverUrl } from '@/core/cache';
import { SkullRefreshControl, TopNav, TopNavBackIcon, TopNavSearchIcon, AlphabetScrubber, ScreenLoadingOverlay } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { CompleteBadgeOverlay } from '@/features/completion';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useTheme } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { LibraryItem, BookMetadata } from '@/core/types';
import { useStarPositionStore } from '@/features/book-detail/stores/starPositionStore';

type AllBooksFilter = 'all' | 'new_to_library' | 'new_releases';
type AllBooksRouteParams = { AllBooks: { filter?: AllBooksFilter } };

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

// Helper to get narrator name
function getNarrator(item: LibraryItem): string {
  const metadata = getMetadata(item) as BookMetadata;
  return metadata.narratorName || metadata.narrators?.[0] || '';
}

// Helper to get user star rating (from star sticker count, 0-5)
function getStarRating(bookId: string): number {
  const stars = useStarPositionStore.getState().positions[bookId];
  return Array.isArray(stars) ? stars.length : 0;
}

// Helper to parse publication year from metadata
function getPublishedYear(item: LibraryItem): number {
  const metadata = getMetadata(item) as BookMetadata;
  if (metadata.publishedDate) {
    const y = parseInt(metadata.publishedDate.slice(0, 4), 10);
    if (!isNaN(y)) return y;
  }
  if (metadata.publishedYear) {
    const y = parseInt(metadata.publishedYear, 10);
    if (!isNaN(y)) return y;
  }
  return 0;
}

// Sort types
type SortType = 'recent' | 'title' | 'author' | 'narrator' | 'duration' | 'published' | 'rating';
type SortDirection = 'asc' | 'desc';

// Sort options config
const SORT_OPTIONS: { key: SortType; label: string; defaultDir: SortDirection }[] = [
  { key: 'recent', label: 'Recently Added', defaultDir: 'desc' },
  { key: 'title', label: 'Title', defaultDir: 'asc' },
  { key: 'author', label: 'Author', defaultDir: 'asc' },
  { key: 'narrator', label: 'Narrator', defaultDir: 'asc' },
  { key: 'published', label: 'Release Date', defaultDir: 'desc' },
  { key: 'duration', label: 'Duration', defaultDir: 'desc' },
  { key: 'rating', label: 'Rating', defaultDir: 'desc' },
];

// Sort arrow icon — matches LibraryScreen pattern
const SortArrow = ({ color = '#000', direction = 'desc' }: { color?: string; direction?: 'asc' | 'desc' }) => (
  <Svg
    width={10}
    height={10}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={3}
    style={direction === 'asc' ? { transform: [{ rotate: '180deg' }] } : undefined}
  >
    <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// List item component
interface ListItemProps {
  item: LibraryItem;
  onPress: () => void;
  isDark: boolean;
  showPublishedYear?: boolean;
  showRating?: boolean;
}

const ListBookItem = React.memo(function ListBookItem({ item, onPress, isDark, showPublishedYear, showRating }: ListItemProps) {
  const coverUrl = useCoverUrl(item.id);
  const metadata = getMetadata(item);
  const title = metadata.title || 'Untitled';
  const author = metadata.authorName || metadata.authors?.[0]?.name || '';
  const duration = getBookDuration(item);
  const durationText = duration > 0 ? formatDurationCompact(duration) : '';
  const pubYear = showPublishedYear ? getPublishedYear(item) : 0;
  const starCount = showRating ? getStarRating(item.id) : 0;
  const ratingText = starCount > 0 ? '★'.repeat(starCount) : '';

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
        <CoverStars bookId={item.id} starSize={scale(14)} />
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
        <Text style={styles.durationText}>
          {[ratingText, durationText, pubYear > 0 ? String(pubYear) : ''].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
});

// Filter config
const FILTER_CONFIG: Record<AllBooksFilter, { label: string; defaultSort: SortType }> = {
  all: { label: 'All Books', defaultSort: 'recent' },
  new_to_library: { label: 'New to Library', defaultSort: 'recent' },
  new_releases: { label: 'New Releases', defaultSort: 'published' },
};

// 90 days in ms for "new to library"
const NEW_TO_LIBRARY_DAYS = 90;
// 3 years for "new releases"
const NEW_RELEASES_YEARS = 3;

export function AllBooksScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AllBooksRouteParams, 'AllBooks'>>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const filter: AllBooksFilter = route.params?.filter || 'all';
  const config = FILTER_CONFIG[filter];

  const [sortBy, setSortBy] = useState<SortType>(config.defaultSort);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | undefined>(undefined);

  const { items: libraryItems, refreshCache, _isLoaded } = useLibraryCache();
  const starPositions = useStarPositionStore((s) => s.positions);

  // Current sort label for the pill
  const currentSortLabel = useMemo(() => {
    const option = SORT_OPTIONS.find(o => o.key === sortBy);
    return option?.label || 'Sort';
  }, [sortBy]);

  // Wait for navigation animation to complete before showing content
  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      setMounted(true);
      globalLoading.hide();
    });
    return () => interaction.cancel();
  }, []);

  // Filter and sort books
  const sortedBooks = useMemo(() => {
    if (!libraryItems?.length) return [];

    let books = libraryItems.filter(item => item.mediaType === 'book');

    // Apply pre-filter based on filter mode
    if (filter === 'new_to_library') {
      const cutoffMs = Date.now() - NEW_TO_LIBRARY_DAYS * 24 * 60 * 60 * 1000;
      const cutoff = cutoffMs / 1000;
      books = books.filter(item => (item.addedAt || 0) > cutoff);
    } else if (filter === 'new_releases') {
      const cutoffYear = new Date().getFullYear() - NEW_RELEASES_YEARS;
      books = books.filter(item => getPublishedYear(item) >= cutoffYear);
    }

    // Sort
    const direction = sortDirection === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'recent':
        books.sort((a, b) => direction * ((b.addedAt || 0) - (a.addedAt || 0)));
        break;
      case 'published':
        books.sort((a, b) => direction * (getPublishedYear(b) - getPublishedYear(a)));
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
      case 'narrator':
        books.sort((a, b) => {
          const narrA = getNarrator(a);
          const narrB = getNarrator(b);
          return direction * narrA.localeCompare(narrB);
        });
        break;
      case 'duration':
        books.sort((a, b) => direction * (getBookDuration(b) - getBookDuration(a)));
        break;
      case 'rating':
        books.sort((a, b) => direction * (getStarRating(b.id) - getStarRating(a.id)));
        break;
    }

    return books;
  }, [libraryItems, sortBy, sortDirection, filter, starPositions]);

  // Get alphabet letters for scrubber (for alphabetic sorts)
  const isAlphabeticSort = sortBy === 'title' || sortBy === 'author' || sortBy === 'narrator';
  const { letters: alphabetLetters, letterIndexMap } = useMemo(() => {
    if (!isAlphabeticSort) {
      return { letters: [], letterIndexMap: new Map<string, number>() };
    }

    const lettersSet = new Set<string>();
    const indexMap = new Map<string, number>();

    sortedBooks.forEach((item, index) => {
      const metadata = getMetadata(item);
      let text: string;
      if (sortBy === 'title') text = metadata.title || '';
      else if (sortBy === 'narrator') text = getNarrator(item);
      else text = (metadata.authorName || metadata.authors?.[0]?.name || '');
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

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSortPillPress = useCallback(() => {
    setShowSortDropdown(true);
  }, []);

  const handleSortSelect = useCallback((key: SortType) => {
    if (sortBy === key) {
      // Toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      const option = SORT_OPTIONS.find(o => o.key === key);
      setSortDirection(option?.defaultDir || 'desc');
      // Clear active letter when switching to non-alphabetic sort
      if (key !== 'title' && key !== 'author' && key !== 'narrator') {
        setActiveLetter(undefined);
      }
    }
    setShowSortDropdown(false);
  }, [sortBy]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshCache();
    setIsRefreshing(false);
  }, [refreshCache]);

  // Estimated row height: cover height (scale(56)) + vertical padding (24) + border (1)
  const ESTIMATED_ITEM_HEIGHT = scale(56) + 25;

  const handleLetterSelect = useCallback((letter: string) => {
    setActiveLetter(letter);
    const index = letterIndexMap.get(letter);
    if (index !== undefined) {
      flatListRef.current?.scrollToOffset({
        offset: index * ESTIMATED_ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [letterIndexMap, ESTIMATED_ITEM_HEIGHT]);

  // Track active letter from scroll position
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isAlphabeticSort) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const currentIndex = Math.floor(offsetY / ESTIMATED_ITEM_HEIGHT);
    if (currentIndex >= 0 && currentIndex < sortedBooks.length) {
      const item = sortedBooks[currentIndex];
      const metadata = getMetadata(item);
      let text: string;
      if (sortBy === 'title') text = metadata.title || '';
      else if (sortBy === 'narrator') text = getNarrator(item);
      else text = (metadata.authorName || metadata.authors?.[0]?.name || '');
      const firstChar = (text || '').charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar) && firstChar !== activeLetter) {
        setActiveLetter(firstChar);
      }
    }
  }, [isAlphabeticSort, sortBy, sortedBooks, ESTIMATED_ITEM_HEIGHT, activeLetter]);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <ListBookItem
      item={item}
      onPress={() => handleBookPress(item.id)}
      isDark={isDark}
      showPublishedYear={sortBy === 'published'}
      showRating={sortBy === 'rating'}
    />
  ), [handleBookPress, isDark, sortBy]);

  const keyExtractor = useCallback((item: LibraryItem) => item.id, []);

  // Icon colors for TopNav
  const iconColor = isDark ? secretLibraryColors.white : secretLibraryColors.black;
  const sortPillIconColor = showSortDropdown
    ? (isDark ? secretLibraryColors.black : secretLibraryColors.white)
    : iconColor;

  return (
    <View style={[styles.container, { backgroundColor: secretLibraryColors.black }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={secretLibraryColors.black} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* TopNav — fixed at top, outside scroll */}
      <TopNav
        variant={isDark ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: secretLibraryColors.black }}
        circleButtons={[
          {
            key: 'search',
            icon: <TopNavSearchIcon color={iconColor} size={16} />,
            onPress: handleSearchPress,
          },
        ]}
        pills={[
          {
            key: 'sort',
            icon: <SortArrow color={sortPillIconColor} direction={sortDirection} />,
            label: currentSortLabel,
            onPress: handleSortPillPress,
            active: showSortDropdown,
          },
          {
            key: 'back',
            label: '',
            icon: <TopNavBackIcon color={iconColor} size={16} />,
            onPress: handleBack,
          },
        ]}
      />

      {/* Book count */}
      <View style={styles.countBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>
          {sortedBooks.length} books
        </Text>
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
            onScroll={handleScroll}
            scrollEventThrottle={32}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
          />
        </SkullRefreshControl>

        {/* Alphabet Scrubber (for title/author sort) */}
        {alphabetLetters.length > 0 && (
          <AlphabetScrubber
            letters={alphabetLetters}
            activeLetter={activeLetter}
            onLetterSelect={handleLetterSelect}
          />
        )}
      </View>

      {/* Sort Dropdown Modal */}
      <Modal
        visible={showSortDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: isDark ? '#1a1a1a' : secretLibraryColors.white }]}>
            {SORT_OPTIONS.map((option) => {
              const isActive = sortBy === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.dropdownItem}
                  onPress={() => handleSortSelect(option.key)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      { color: isDark ? secretLibraryColors.white : secretLibraryColors.black },
                      isActive && styles.dropdownItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <Text style={styles.dropdownCheck}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  countBar: {
    paddingHorizontal: PADDING,
    paddingBottom: 8,
  },
  resultCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Sort dropdown modal — matches LibraryScreen pattern
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  dropdownMenu: {
    width: 260,
    maxHeight: 420,
    borderRadius: 12,
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  } as ViewStyle,
  dropdownItemText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  } as TextStyle,
  dropdownItemTextActive: {
    fontFamily: secretLibraryFonts.jetbrainsMono.bold,
  } as TextStyle,
  dropdownCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F3B60C',
  } as TextStyle,
});

export default AllBooksScreen;
