/**
 * src/features/library/screens/FilteredBooksScreen.tsx
 *
 * Shows filtered books with SeriesDetail-style dark layout.
 * Large title, filter tabs (All/Author/Narrator/Genre), shelf/book view toggle.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useLibraryCache } from '@/core/cache';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { apiClient } from '@/core/api';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { useContinueListening } from '@/shared/hooks/useContinueListening';
import { CompleteBadgeOverlay } from '@/features/completion';
import { CoverStars } from '@/shared/components/CoverStars';
import { TopNav, TopNavBackIcon, useBookContextMenu, CollapsibleSection } from '@/shared/components';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { DURATION_RANGES } from '@/features/browse/hooks/useBrowseCounts';
import { ShelfRow, BookSpineVerticalData } from '@/shared/spine';

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
  | 'feeling'
  | 'continue_series'
  | 'duration'
  | 'tag'
  | 'similar'
  | 'all_books';

export type FilteredBooksParams = {
  title?: string;
  filterType: FilterType;
  filterValue?: string;
  genre?: string;
  /** Tag to filter by (for filterType: 'tag') */
  tag?: string;
  /** Source book ID for 'similar' filterType */
  sourceBookId?: string;
  /** Feeling chip key for 'feeling' filterType */
  feeling?: string;
  minMatchPercent?: number;
  minDuration?: number;
  maxDuration?: number;
};

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

// Convert LibraryItem to BookSpineVerticalData for ShelfRow
function toSpineData(item: LibraryItem, cachedData?: { backgroundColor?: string; textColor?: string }): BookSpineVerticalData {
  const metadata = getMetadata(item) as any;
  const progress = item.userMediaProgress?.progress || 0;
  const base: BookSpineVerticalData = {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author',
    progress,
    genres: metadata?.genres || [],
    tags: isBookMedia(item.media) ? item.media.tags || [] : [],
    duration: getBookDuration(item),
    seriesName: metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || metadata?.series?.[0]?.name,
  };
  if (cachedData?.backgroundColor && cachedData?.textColor) {
    return { ...base, backgroundColor: cachedData.backgroundColor, textColor: cachedData.textColor };
  }
  return base;
}

export function FilteredBooksScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: FilteredBooksParams }, 'params'>>();
  const insets = useSafeAreaInsets();
  const { showMenu } = useBookContextMenu();

  const {
    title: paramTitle,
    filterType,
    filterValue,
    genre,
    tag,
    sourceBookId,
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

  const sortBy: SortType =
    filterType === 'all_books' || filterType === 'new_this_week' ? 'recent'
    : filterType === 'tag' || filterType === 'similar' ? 'title'
    : 'duration';
  const sortDirection: SortDirection = 'asc';
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'author' | 'narrator' | 'genre'>('all');
  const [viewMode, setViewMode] = useState<'book' | 'shelf'>('shelf');
  const [displayLimit, setDisplayLimit] = useState(50);

  const { items: libraryItems, isLoaded } = useLibraryCache();
  const { isFinished, hasBeenStarted } = useReadingHistory();
  const { items: inProgressItems } = useContinueListening();
  const slColors = useSecretLibraryColors();

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
        // Mood quiz removed — return empty for legacy filter type
        result = [];
        break;
      }

      case 'feeling': {
        // Filter by feeling chip scoring
        const { filterByFeeling } = require('@/shared/utils/bookDNA/feelingScoring');
        const feelingKey = route.params?.feeling;
        if (feelingKey) {
          result = filterByFeeling(libraryItems, feelingKey);
        } else {
          result = [];
        }
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

      case 'tag': {
        const filterTag = tag || filterValue || '';
        if (filterTag) {
          result = libraryItems.filter(item => {
            const tags: string[] = isBookMedia(item.media) ? item.media.tags || [] : [];
            return tags.some(t => t === filterTag);
          });
        }
        break;
      }

      case 'similar': {
        const srcId = sourceBookId || '';
        if (srcId) {
          const sourceItem = libraryItems.find(i => i.id === srcId);
          if (sourceItem) {
            const srcMd = getMetadata(sourceItem) as any;
            const srcAuthor = srcMd?.authorName || srcMd?.authors?.[0]?.name || '';
            const srcGenres: string[] = srcMd?.genres || [];
            const srcSeries = srcMd?.series?.[0]?.name || '';

            result = libraryItems.filter(item => {
              if (item.id === srcId) return false;
              if (item.mediaType !== 'book') return false;
              const md = getMetadata(item) as any;
              const author = md?.authorName || md?.authors?.[0]?.name || '';
              const genres: string[] = md?.genres || [];
              const series = md?.series?.[0]?.name || '';
              if (srcAuthor && author === srcAuthor) return true;
              if (srcSeries && series === srcSeries) return true;
              if (srcGenres.length > 0 && genres.some(g => srcGenres.includes(g))) return true;
              return false;
            });
          }
        }
        break;
      }

      case 'all_books': {
        result = libraryItems.filter(item => item.mediaType === 'book');
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
    tag,
    sourceBookId,
    isFinished,
    isSeriesAppropriate,
    inProgressItems,
    minDuration,
    maxDuration,
    sortBy,
    sortDirection,
  ]);

  // Total duration and grouped lists
  const tagTotalDuration = useMemo(() => {
    return filteredBooks.reduce((sum, book) => sum + getBookDuration(book), 0);
  }, [filteredBooks]);

  const tagAuthorList = useMemo(() => {
    const map = new Map<string, { name: string; books: LibraryItem[] }>();
    filteredBooks.forEach(book => {
      const md = getMetadata(book) as any;
      const name = (md?.authorName || '').split(',')[0].trim();
      if (!name) return;
      const existing = map.get(name);
      if (existing) existing.books.push(book);
      else map.set(name, { name, books: [book] });
    });
    return Array.from(map.values()).sort((a, b) => b.books.length - a.books.length);
  }, [filteredBooks]);

  const tagNarratorList = useMemo(() => {
    const map = new Map<string, { name: string; books: LibraryItem[] }>();
    filteredBooks.forEach(book => {
      const md = getMetadata(book) as any;
      let raw = (md?.narratorName || md?.narrators?.[0] || '').replace(/^Narrated by\s*/i, '').trim();
      const name = raw.split(',')[0].trim();
      if (!name) return;
      const existing = map.get(name);
      if (existing) existing.books.push(book);
      else map.set(name, { name, books: [book] });
    });
    return Array.from(map.values()).sort((a, b) => b.books.length - a.books.length);
  }, [filteredBooks]);

  const tagGenreList = useMemo(() => {
    const map = new Map<string, { name: string; books: LibraryItem[] }>();
    filteredBooks.forEach(book => {
      const md = getMetadata(book) as any;
      (md?.genres || []).forEach((g: string) => {
        const existing = map.get(g);
        if (existing) existing.books.push(book);
        else map.set(g, { name: g, books: [book] });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.books.length - a.books.length);
  }, [filteredBooks]);

  // Tag filter: navigation handlers
  const handleSpinePress = useCallback((spine: BookSpineVerticalData) => {
    navigation.navigate('BookDetail', { id: spine.id });
  }, [navigation]);

  const handleAuthorNavPress = useCallback((authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  }, [navigation]);

  const handleNarratorNavPress = useCallback((narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
  }, [navigation]);

  const handleGenreNavPress = useCallback((genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  if (!isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: slColors.white }]}>
        <StatusBar barStyle="light-content" backgroundColor={secretLibraryColors.black} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: slColors.gray }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // SeriesDetail-style layout
  const renderTagBookList = (books: LibraryItem[], paginate = false) => {
    const visibleBooks = paginate ? books.slice(0, displayLimit) : books;
    const hasMore = paginate && books.length > displayLimit;

    return (
      <View>
        {visibleBooks.map((book) => {
          const md = getMetadata(book) as any;
          const title = md?.title || 'Untitled';
          const author = md?.authorName || md?.authors?.[0]?.name || '';
          const duration = getBookDuration(book);
          const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
          return (
            <Pressable
              key={book.id}
              style={[styles.tagListItem, { borderBottomColor: slColors.grayLine }]}
              onPress={() => handleBookPress(book.id)}
              onLongPress={() => navigation.navigate('BookDetail', { id: book.id })}
              delayLongPress={400}
            >
              <View style={styles.tagListCoverWrap}>
                <Image source={coverUrl} style={styles.tagListCover} contentFit="cover" />
                <CoverStars bookId={book.id} starSize={scale(12)} />
                <CompleteBadgeOverlay bookId={book.id} size="small" />
              </View>
              <View style={styles.tagListInfo}>
                <Text style={[styles.tagListTitle, { color: slColors.black }]} numberOfLines={1}>{title}</Text>
                {author ? <Text style={[styles.tagListAuthor, { color: slColors.gray }]} numberOfLines={1}>{author}</Text> : null}
              </View>
              <Text style={[styles.tagListDuration, { color: slColors.gray }]}>{formatDurationCompact(duration)}</Text>
            </Pressable>
          );
        })}
        {hasMore && (
          <Pressable
            style={[styles.showMoreBtn, { borderColor: slColors.grayLine }]}
            onPress={() => setDisplayLimit(prev => prev + 50)}
          >
            <Text style={[styles.showMoreText, { color: slColors.black }]}>
              Show More ({books.length - displayLimit} remaining)
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

    const renderShelfOrList = (books: LibraryItem[], paginate = false) => {
      if (viewMode !== 'shelf') return renderTagBookList(books, paginate);

      const visibleBooks = paginate ? books.slice(0, displayLimit) : books;
      const hasMore = paginate && books.length > displayLimit;

      return (
        <View>
          <ShelfRow
            books={visibleBooks}
            toSpineData={toSpineData}
            onSpinePress={handleSpinePress}
            onSpineLongPress={(spine) => { const item = filteredBooks.find(b => b.id === spine.id); if (item) showMenu(item); }}
          />
          {hasMore && (
            <Pressable
              style={[styles.showMoreBtn, { borderColor: slColors.grayLine }]}
              onPress={() => setDisplayLimit(prev => prev + 50)}
            >
              <Text style={[styles.showMoreText, { color: slColors.black }]}>
                Show More ({books.length - displayLimit} remaining)
              </Text>
            </Pressable>
          )}
        </View>
      );
    };

    return (
      <View style={[styles.container, { backgroundColor: secretLibraryColors.black }]}>
        <StatusBar barStyle="light-content" backgroundColor={secretLibraryColors.black} />

        <ScrollView
          style={{ flex: 1, backgroundColor: secretLibraryColors.black }}
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <TopNav
            variant="dark"
            showLogo={true}
            onLogoPress={handleLogoPress}
            circleButtons={[
              {
                key: 'back',
                icon: <TopNavBackIcon color={secretLibraryColors.white} size={16} />,
                onPress: handleBack,
              },
            ]}
          />
          {/* Title */}
          <View style={styles.tagTitleHeader}>
            {filterType === 'similar' && (
              <Text style={[styles.tagHeaderSubtitle, { color: slColors.gray }]}>Because you listened to</Text>
            )}
            <Text style={[styles.tagHeaderName, { color: slColors.black }]}>{displayTitle}</Text>
            <Text style={[styles.tagHeaderStats, { color: slColors.gray }]}>
              {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} · {formatDurationCompact(tagTotalDuration)}
            </Text>
          </View>

          {/* Tabs + View Toggle */}
          <View style={styles.tagTabsRow}>
            <View style={styles.tagTabs}>
              {(['all', 'author', 'narrator', 'genre'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[
                    styles.tagTab,
                    { borderColor: slColors.grayLine },
                    activeFilterTab === tab && { backgroundColor: slColors.black, borderColor: slColors.black },
                  ]}
                  onPress={() => { setActiveFilterTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={[
                    styles.tagTabText,
                    { color: slColors.gray },
                    activeFilterTab === tab && { color: slColors.white },
                  ]}>
                    {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setViewMode(v => v === 'book' ? 'shelf' : 'book')}>
              <Text style={[styles.tagToggleText, { color: slColors.black }]}>
                {viewMode === 'book' ? 'Book' : 'Shelf'}
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          {activeFilterTab === 'all' && renderShelfOrList(filteredBooks, true)}

          {activeFilterTab === 'author' && tagAuthorList.map((author, i) => (
            <CollapsibleSection
              key={author.name}
              title={author.name}
              count={author.books.length}
              defaultExpanded={i === 0}
              onTitlePress={() => handleAuthorNavPress(author.name)}
            >
              {renderShelfOrList(author.books)}
            </CollapsibleSection>
          ))}

          {activeFilterTab === 'narrator' && tagNarratorList.map((narrator, i) => (
            <CollapsibleSection
              key={narrator.name}
              title={narrator.name}
              count={narrator.books.length}
              defaultExpanded={i === 0}
              onTitlePress={() => handleNarratorNavPress(narrator.name)}
            >
              {renderShelfOrList(narrator.books)}
            </CollapsibleSection>
          ))}

          {activeFilterTab === 'genre' && tagGenreList.map((genreItem, i) => (
            <CollapsibleSection
              key={genreItem.name}
              title={genreItem.name}
              count={genreItem.books.length}
              defaultExpanded={i === 0}
              onTitlePress={() => handleGenreNavPress(genreItem.name)}
            >
              {renderShelfOrList(genreItem.books)}
            </CollapsibleSection>
          ))}

          {filteredBooks.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: slColors.gray }]}>No books found</Text>
            </View>
          )}

          {/* Footer */}
          {filteredBooks.length > 0 && (
            <View style={[styles.tagFooter, { borderTopColor: slColors.grayLine }]}>
              <Text style={[styles.tagFooterText, { color: slColors.gray }]}>
                {filteredBooks.length} {filteredBooks.length === 1 ? 'title' : 'titles'} · {Math.round(tagTotalDuration / 3600)} hours total
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
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
  // Tag filter: SeriesDetail-style layout
  tagTitleHeader: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  tagHeaderSubtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tagHeaderName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(36),
    fontWeight: '400',
    lineHeight: scale(36) * 1.1,
    marginBottom: 6,
  },
  tagHeaderStats: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  tagTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  tagTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagTab: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagTabText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagToggleText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    textDecorationLine: 'underline',
  },
  tagListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tagListCoverWrap: {
    position: 'relative',
  },
  tagListCover: {
    width: scale(40),
    height: scale(40),
    borderRadius: 4,
  },
  tagListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tagListTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
  },
  tagListAuthor: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  tagListDuration: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: scale(14),
    marginTop: scale(8),
    marginHorizontal: 24,
    borderWidth: 1,
    borderRadius: scale(8),
  },
  showMoreText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagFooter: {
    paddingTop: 20,
    borderTopWidth: 1,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  tagFooterText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
});
