/**
 * src/features/library/screens/FilteredBooksScreen.tsx
 *
 * Shows filtered books based on row type (short, long, new, mood-matched, duration, etc.)
 * Uses same design as AllBooksScreen - TopNav with pill, search bar, and sort buttons.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useLibraryCache, useCoverUrl } from '@/core/cache';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { useViewportPrefetch } from '@/shared/hooks/useViewportPrefetch';
import { apiClient } from '@/core/api';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { useMoodRecommendations } from '@/features/mood-discovery/hooks/useMoodRecommendations';
import { useActiveSession } from '@/features/mood-discovery/stores/moodSessionStore';
import { useContinueListening } from '@/shared/hooks/useContinueListening';
import { CompleteBadgeOverlay } from '@/features/completion';
import { SkullRefreshControl, TopNav, TopNavBackIcon, AlphabetScrubber } from '@/shared/components';
import { Icon } from '@/shared/components/Icon';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useTheme } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { DURATION_RANGES } from '@/features/browse/hooks/useBrowseCounts';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}

// Helper to get book duration
function getBookDuration(item: LibraryItem): number {
  return isBookMedia(item.media) ? item.media.duration || 0 : 0;
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

const PADDING = 16;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SHORT_BOOK_THRESHOLD = 5 * 60 * 60;
const LONG_BOOK_THRESHOLD = 10 * 60 * 60;

// Sort types
type SortType = 'recent' | 'title' | 'author' | 'duration';
type SortDirection = 'asc' | 'desc';

// Filter types that can be passed via navigation
export type FilterType =
  | 'new_this_week'
  | 'short_books'
  | 'long_listens'
  | 'not_started'
  | 'recommended'
  | 'mood_matched'
  | 'continue_series'
  | 'duration';

export type FilteredBooksParams = {
  title?: string;
  filterType: FilterType;
  filterValue?: string;
  genre?: string;
  minMatchPercent?: number;
  minDuration?: number;
  maxDuration?: number;
};

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

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

export function FilteredBooksScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: FilteredBooksParams }, 'params'>>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const {
    title: paramTitle,
    filterType,
    filterValue,
    genre,
    minMatchPercent = 20,
    minDuration = 0,
    maxDuration = Infinity,
  } = route.params || {};

  // Get display title from duration range if applicable
  const displayTitle = useMemo(() => {
    if (paramTitle) return paramTitle;
    if (filterType === 'duration' && filterValue) {
      const range = DURATION_RANGES.find(r => r.id === filterValue);
      return range?.label || 'Books';
    }
    return 'Books';
  }, [paramTitle, filterType, filterValue]);

  const [sortBy, setSortBy] = useState<SortType>('duration');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { items: libraryItems, isLoaded, refreshCache } = useLibraryCache();
  const { isFinished, hasBeenStarted } = useReadingHistory();
  const moodSession = useActiveSession();
  const { items: inProgressItems } = useContinueListening();

  // Only fetch mood recommendations if needed
  const needsMoodData = filterType === 'mood_matched';
  const { recommendations: moodRecommendations } = useMoodRecommendations({
    session: needsMoodData ? moodSession : null,
    minMatchPercent,
    limit: 500,
  });

  // Create series filter
  const isSeriesAppropriate = useMemo(() => {
    if (!libraryItems.length) return () => true;
    return createSeriesFilter({
      allItems: libraryItems,
      isFinished,
      hasStarted: hasBeenStarted,
    });
  }, [libraryItems, isFinished, hasBeenStarted]);

  // Filter books based on filter type
  const filteredBooks = useMemo(() => {
    if (!isLoaded) return [];

    let result: LibraryItem[] = [];

    switch (filterType) {
      case 'duration': {
        // Filter by duration range
        result = libraryItems
          .filter(item => {
            const duration = getBookDuration(item);
            if (duration <= 0) return false;
            const meetsMin = duration >= minDuration;
            const meetsMax = maxDuration === Infinity || duration < maxDuration;
            return meetsMin && meetsMax;
          });
        break;
      }

      case 'new_this_week': {
        const oneWeekAgo = Date.now() - ONE_WEEK_MS;
        result = libraryItems
          .filter(item => (item.addedAt || 0) * 1000 > oneWeekAgo)
          .filter(item => !isFinished(item.id))
          .filter(isSeriesAppropriate);
        break;
      }

      case 'short_books': {
        result = libraryItems
          .filter(item => {
            const duration = getBookDuration(item);
            return duration > 0 && duration < SHORT_BOOK_THRESHOLD;
          })
          .filter(item => !isFinished(item.id))
          .filter(isSeriesAppropriate);
        break;
      }

      case 'long_listens': {
        result = libraryItems
          .filter(item => {
            const duration = getBookDuration(item);
            return duration >= LONG_BOOK_THRESHOLD;
          })
          .filter(item => !isFinished(item.id))
          .filter(isSeriesAppropriate);
        break;
      }

      case 'not_started': {
        result = libraryItems
          .filter(item => !isFinished(item.id))
          .filter(isSeriesAppropriate);
        break;
      }

      case 'mood_matched': {
        const moodIds = new Set(moodRecommendations.map(r => r.id));
        result = libraryItems.filter(item => moodIds.has(item.id));
        break;
      }

      case 'continue_series': {
        const seriesFromProgress = new Map<string, number>();
        for (const item of inProgressItems) {
          const metadata = getMetadata(item);
          const series = metadata.series?.[0];
          if (series?.name && series?.sequence) {
            const existing = seriesFromProgress.get(series.name) || 0;
            const seq = parseFloat(series.sequence || '0') || 0;
            if (seq > existing) {
              seriesFromProgress.set(series.name, seq);
            }
          }
        }

        for (const [seriesName, maxSeq] of seriesFromProgress) {
          const nextInSeries = libraryItems.find(item => {
            const metadata = getMetadata(item);
            const series = metadata.series?.[0];
            if (!series?.name || series.name !== seriesName) return false;
            const seq = parseFloat(series.sequence || '0') || 0;
            return seq > maxSeq && !isFinished(item.id);
          });
          if (nextInSeries) {
            result.push(nextInSeries);
          }
        }
        break;
      }

      case 'recommended':
      default:
        result = libraryItems
          .filter(item => !isFinished(item.id))
          .filter(isSeriesAppropriate);
    }

    // Apply genre filter if specified
    if (genre && genre !== 'All') {
      const filterGenre = genre.toLowerCase();
      result = result.filter(item => {
        const metadata = getMetadata(item);
        const genres: string[] = metadata.genres || [];
        return genres.some(g => g.toLowerCase() === filterGenre);
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const metadata = getMetadata(item);
        const itemTitle = (metadata.title || '').toLowerCase();
        const author = (metadata.authorName || '').toLowerCase();
        return itemTitle.includes(query) || author.includes(query);
      });
    }

    // Apply sorting
    const direction = sortDirection === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => direction * ((b.addedAt || 0) - (a.addedAt || 0)));
        break;
      case 'title':
        result.sort((a, b) => {
          const titleA = getMetadata(a).title || '';
          const titleB = getMetadata(b).title || '';
          return direction * titleA.localeCompare(titleB);
        });
        break;
      case 'author':
        result.sort((a, b) => {
          const authorA = getMetadata(a).authorName || getMetadata(a).authors?.[0]?.name || '';
          const authorB = getMetadata(b).authorName || getMetadata(b).authors?.[0]?.name || '';
          return direction * authorA.localeCompare(authorB);
        });
        break;
      case 'duration':
        result.sort((a, b) => direction * (getBookDuration(a) - getBookDuration(b)));
        break;
    }

    return result;
  }, [
    isLoaded,
    libraryItems,
    filterType,
    genre,
    searchQuery,
    isFinished,
    isSeriesAppropriate,
    moodRecommendations,
    inProgressItems,
    minDuration,
    maxDuration,
    sortBy,
    sortDirection,
  ]);

  // Get alphabet letters for scrubber (only for title/author sort)
  const { letters: alphabetLetters, letterIndexMap } = useMemo(() => {
    if (sortBy !== 'title' && sortBy !== 'author') {
      return { letters: [], letterIndexMap: new Map<string, number>() };
    }

    const lettersSet = new Set<string>();
    const indexMap = new Map<string, number>();

    filteredBooks.forEach((item, index) => {
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
  }, [filteredBooks, sortBy]);

  // Prefetch covers
  const getCoverUrl = useCallback((item: LibraryItem) => {
    return apiClient.getItemCoverUrl(item.id, { width: 400, height: 400 });
  }, []);

  const { onViewableItemsChanged, viewabilityConfig } = useViewportPrefetch(
    filteredBooks,
    getCoverUrl,
    { prefetchAhead: 12 }
  );

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshCache();
    setIsRefreshing(false);
  }, [refreshCache]);

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  const handleSortPress = useCallback((type: SortType) => {
    if (sortBy === type) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      // Default directions
      setSortDirection(type === 'recent' ? 'desc' : type === 'duration' ? 'asc' : 'asc');
    }
  }, [sortBy]);

  const handleLetterSelect = useCallback((letter: string) => {
    const index = letterIndexMap.get(letter);
    if (index !== undefined) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [letterIndexMap]);

  // Render functions
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
        return sortDirection === 'asc' ? 'Shortest' : 'Longest';
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

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        No books found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
        {searchQuery ? 'Try a different search term' : 'Check back later for new additions'}
      </Text>
    </View>
  ), [colors.text.primary, colors.text.secondary, searchQuery]);

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
            key: 'filter',
            label: displayTitle,
            icon: <Icon name="Timer" size={10} color={colors.text.primary} />,
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
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
        </Text>
        <View style={styles.sortButtons}>
          {(['duration', 'recent', 'title', 'author'] as SortType[]).map((type) => (
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
            data={filteredBooks}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
            getItemLayout={(data, index) => ({
              length: 80,
              offset: 80 * index,
              index,
            })}
            ListEmptyComponent={ListEmptyComponent}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
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
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: scale(60),
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(18),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    marginTop: 8,
    fontSize: scale(12),
    textAlign: 'center',
  },
});
