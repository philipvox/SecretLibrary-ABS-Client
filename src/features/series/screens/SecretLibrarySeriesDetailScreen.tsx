/**
 * src/features/series/screens/SecretLibrarySeriesDetailScreen.tsx
 *
 * Secret Library styled Series detail screen with editorial design.
 * Features:
 * - Dark background with large name
 * - Track button with bell icon
 * - Type badge with book icon
 * - Filter tabs (All, Author, Narrator, Genre)
 * - Series/Book view toggle
 *   - Series view: Books with spine visualizations
 *   - Book view: Flat list with inline cover thumbnails
 * - Footer stats
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  StatusBar,
  Image,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '@/navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookIcon, HeartIconSvg, TopNav, TopNavSearchIcon, TopNavCloseIcon, CollapsibleSection, useBookContextMenu } from '@/shared/components';
import { ViewModePicker } from '@/shared/components/ViewModePicker';
import type { ViewMode } from '@/shared/components/ViewModePicker';
import * as Haptics from 'expo-haptics';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { CoverStars } from '@/shared/components/CoverStars';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { BookSpineVerticalData, ShelfRow } from '@/shared/spine';
import { BookGrid } from '@/shared/components/BookGrid';
import Svg, { Path } from 'react-native-svg';

// Sort types for detail screens
type DetailSortMode = 'publishedYear' | 'title' | 'duration' | 'progress';
type DetailSortDirection = 'asc' | 'desc';

const DETAIL_SORT_OPTIONS: { key: DetailSortMode; label: string; defaultDir: DetailSortDirection }[] = [
  { key: 'publishedYear', label: 'Published', defaultDir: 'desc' },
  { key: 'title', label: 'Title', defaultDir: 'asc' },
  { key: 'duration', label: 'Duration', defaultDir: 'desc' },
  { key: 'progress', label: 'Progress', defaultDir: 'desc' },
];

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

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'metadata' in media && 'duration' in media;
}

// Helper to get book duration safely
function getBookDuration(item: LibraryItem | null | undefined): number {
  if (!item || !isBookMedia(item.media)) return 0;
  return item.media.duration || 0;
}

// Extended LibraryItem with optional download fields
interface ExtendedLibraryItem extends LibraryItem {
  isDownloaded?: boolean;
  localPath?: string;
}

type SeriesDetailRouteParams = {
  SeriesDetail: { seriesName?: string; name?: string };
};

type FilterTab = 'all' | 'author' | 'narrator' | 'genre';

// Helper to get metadata
const getMetadata = (item: LibraryItem): BookMetadata | undefined => {
  if (isBookMedia(item.media)) {
    return item.media.metadata;
  }
  return undefined;
};

// Format duration as compact string (e.g., "10h")
function formatDurationCompact(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
}

// Extract series sequence number from metadata
function getSeriesSequence(metadata: any): number | undefined {
  // Check series array first (preferred - has explicit sequence)
  if (Array.isArray(metadata?.series) && metadata.series.length > 0) {
    const primarySeries = metadata.series[0];
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) return parsed;
    }
  }
  // Fallback: check seriesName for #N pattern
  const match = metadata?.seriesName?.match(/#([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return undefined;
}

// Convert LibraryItem to BookSpineVerticalData
function toSpineData(item: LibraryItem, cachedData?: { backgroundColor?: string; textColor?: string }): BookSpineVerticalData {
  const metadata = getMetadata(item);
  const extendedItem = item as ExtendedLibraryItem;
  const progress = item.userMediaProgress?.progress || 0;
  const isDownloaded = !!extendedItem.isDownloaded || !!extendedItem.localPath;

  const base: BookSpineVerticalData = {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || 'Unknown Author',
    progress,
    genres: metadata?.genres || [],
    tags: isBookMedia(item.media) ? item.media.tags || [] : [],
    duration: getBookDuration(item),
    seriesName: metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || metadata?.series?.[0]?.name,
    seriesSequence: getSeriesSequence(metadata),
    isDownloaded,
  };

  // Add cached colors if available
  if (cachedData?.backgroundColor && cachedData?.textColor) {
    return {
      ...base,
      backgroundColor: cachedData.backgroundColor,
      textColor: cachedData.textColor,
    };
  }
  return base;
}

export function SecretLibrarySeriesDetailScreen() {
  const route = useRoute<RouteProp<SeriesDetailRouteParams, 'SeriesDetail'>>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const _isDarkMode = colors.isDark;
  const { showMenu } = useBookContextMenu();

  // Handle both param formats
  const seriesName = route.params.seriesName || route.params.name || '';

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const defaultViewMode = useMyLibraryStore((s) => s.defaultViewMode) ?? 'shelf';
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  useEffect(() => { setViewMode(defaultViewMode); }, [defaultViewMode]);
  const [sortMode, setSortMode] = useState<DetailSortMode>('publishedYear');
  const [sortDirection, setSortDirection] = useState<DetailSortDirection>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const { getSeries, getAuthor, isLoaded } = useLibraryCache();

  // Favorite functionality
  const isSeriesFavorite = useMyLibraryStore((s) => s.isSeriesFavorite);
  const addSeriesToFavorites = useMyLibraryStore((s) => s.addSeriesToFavorites);
  const removeSeriesFromFavorites = useMyLibraryStore((s) => s.removeSeriesFromFavorites);
  const isFavorited = isSeriesFavorite(seriesName);

  const handleFavoriteToggle = useCallback(() => {
    if (isFavorited) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      removeSeriesFromFavorites(seriesName);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addSeriesToFavorites(seriesName);
    }
  }, [isFavorited, seriesName, addSeriesToFavorites, removeSeriesFromFavorites]);

  const handleSortSelect = useCallback((mode: DetailSortMode) => {
    if (mode === sortMode) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      const option = DETAIL_SORT_OPTIONS.find(o => o.key === mode);
      setSortMode(mode);
      setSortDirection(option?.defaultDir || 'desc');
    }
    setShowSortDropdown(false);
  }, [sortMode]);

  const currentSortLabel = DETAIL_SORT_OPTIONS.find(o => o.key === sortMode)?.label || 'Published';

  // Get series data from cache
  const seriesInfo = useMemo(() => {
    if (!isLoaded || !seriesName) return null;
    return getSeries(seriesName);
  }, [isLoaded, seriesName, getSeries]);

  // All books sorted by selected sort mode
  const allBooks = useMemo(() => {
    if (!seriesInfo?.books) return [];
    const books = [...seriesInfo.books];
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortMode) {
      case 'title':
        books.sort((a, b) => dir * (getMetadata(a)?.title || '').localeCompare(getMetadata(b)?.title || ''));
        break;
      case 'publishedYear':
        books.sort((a, b) => {
          const yearA = parseInt(getMetadata(a)?.publishedYear || '0', 10) || 0;
          const yearB = parseInt(getMetadata(b)?.publishedYear || '0', 10) || 0;
          if (yearA !== yearB) return dir * (yearA - yearB);
          return (getMetadata(a)?.title || '').localeCompare(getMetadata(b)?.title || '');
        });
        break;
      case 'duration':
        books.sort((a, b) => dir * ((a.media?.duration || 0) - (b.media?.duration || 0)));
        break;
      case 'progress':
        books.sort((a, b) => dir * ((a.userMediaProgress?.progress || 0) - (b.userMediaProgress?.progress || 0)));
        break;
    }
    return books;
  }, [seriesInfo?.books, sortMode, sortDirection]);

  // Get unique authors
  const authorList = useMemo(() => {
    const authorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const metadata = getMetadata(book);
      const authorName = metadata?.authorName || '';
      if (authorName) {
        // Handle comma-separated authors (use first author for grouping)
        const firstAuthor = authorName.split(',')[0].trim();
        const existing = authorMap.get(firstAuthor);
        if (existing) {
          existing.books.push(book);
        } else {
          authorMap.set(firstAuthor, { name: firstAuthor, books: [book] });
        }
      }
    });
    return Array.from(authorMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [allBooks]);

  // Primary author with image for header display
  const primaryAuthorInfo = useMemo(() => {
    if (authorList.length === 0) return null;
    const primary = authorList[0];
    const cached = getAuthor(primary.name);
    return {
      name: primary.name,
      id: cached?.id,
      imagePath: cached?.imagePath,
    };
  }, [authorList, getAuthor]);

  // Get unique narrators
  const narratorList = useMemo(() => {
    const narratorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const metadata = getMetadata(book);
      // Use narratorName string (server-computed field), falling back to narrators array
      let rawNarrator = metadata?.narratorName || metadata?.narrators?.[0] || '';
      // Remove "Narrated by" prefix if present
      rawNarrator = rawNarrator.replace(/^Narrated by\s*/i, '').trim();
      if (rawNarrator) {
        // Split comma-separated narrators and add book to each
        const narrators = rawNarrator.split(',').map(n => n.trim()).filter(Boolean);
        narrators.forEach(narratorName => {
          const existing = narratorMap.get(narratorName);
          if (existing) {
            existing.books.push(book);
          } else {
            narratorMap.set(narratorName, { name: narratorName, books: [book] });
          }
        });
      }
    });
    return Array.from(narratorMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [allBooks]);

  // Get unique genres from books in this series
  const genreList = useMemo(() => {
    const genreMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const metadata = getMetadata(book);
      const genres = metadata?.genres || [];
      genres.forEach((genre: string) => {
        const existing = genreMap.get(genre);
        if (existing) {
          existing.books.push(book);
        } else {
          genreMap.set(genre, { name: genre, books: [book] });
        }
      });
    });
    return Array.from(genreMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [allBooks]);

  // Total duration
  const totalDuration = useMemo(() => {
    return allBooks.reduce((sum, book) => sum + getBookDuration(book), 0);
  }, [allBooks]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  const handleLogoPress = () => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  };

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleAuthorPress = useCallback((authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  }, [navigation]);

  const handleNarratorPress = useCallback((narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
  }, [navigation]);

  const handleGenrePress = useCallback((genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleSpinePress = useCallback((book: BookSpineVerticalData) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // Render a single vertical book item (used by both FlatList and ScrollView paths)
  const renderVerticalBookItem = useCallback(({ item: book }: { item: LibraryItem }) => {
    const metadata = getMetadata(book);
    const title = metadata?.title || 'Unknown';
    const duration = getBookDuration(book);
    const durationText = formatDurationCompact(duration);
    const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
    const seriesSeq = getSeriesSequence(metadata);

    return (
      <Pressable
        style={[styles.verticalListItem, { borderBottomColor: colors.grayLine }]}
        onPress={() => handleBookPress(book.id)}
        onLongPress={() => navigation.navigate('BookDetail', { id: book.id })}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`Open book ${title}${seriesSeq !== undefined ? `, Book ${seriesSeq}` : ''}, ${durationText}`}
      >
        <View style={{ width: scale(40), height: scale(40), borderRadius: 4, overflow: 'hidden' }}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.verticalCover}
          />
          <CoverStars bookId={book.id} starSize={scale(12)} />
        </View>
        <View style={styles.verticalInfo}>
          <Text style={[styles.verticalTitle, { color: colors.black }]} numberOfLines={1}>{title}</Text>
          {seriesSeq !== undefined && (
            <Text style={[styles.verticalSeries, { color: colors.gray }]} numberOfLines={1}>
              Book {seriesSeq}
            </Text>
          )}
        </View>
        <Text style={[styles.verticalDuration, { color: colors.gray }]}>{durationText}</Text>
      </Pressable>
    );
  }, [colors.grayLine, colors.black, colors.gray, handleBookPress, navigation]);

  const bookKeyExtractor = useCallback((item: LibraryItem) => item.id, []);

  // Render vertical book list (one per line) - used for grouped sections inside ScrollView
  const renderVerticalBookList = useCallback((books: LibraryItem[]) => {
    return (
      <View style={styles.verticalList}>
        {books.map((book) => (
          <React.Fragment key={book.id}>
            {renderVerticalBookItem({ item: book })}
          </React.Fragment>
        ))}
      </View>
    );
  }, [renderVerticalBookItem]);

  // Loading/Error states
  if (!seriesName || !isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.black} />
        <TopNav
          variant="dark"
          showLogo={true}
          onLogoPress={handleLogoPress}
        />
        <View style={[styles.emptyContainer, { backgroundColor: colors.white }]}>
          <BookIcon size={48} color={colors.gray} />
          <Text style={[styles.emptyTitle, { color: colors.black }]}>Series not found</Text>
        </View>
      </View>
    );
  }

  if (!seriesInfo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.black} />
        <TopNav
          variant="dark"
          showLogo={true}
          onLogoPress={handleLogoPress}
        />
        <View style={[styles.emptyContainer, { backgroundColor: colors.white }]}>
          <BookIcon size={48} color={colors.gray} />
          <Text style={[styles.emptyTitle, { color: colors.black }]}>Series not found</Text>
        </View>
      </View>
    );
  }

  // Determine if we should use FlatList (flat book list with no grouping)
  const isFlatBookList = activeTab === 'all' && viewMode === 'list';

  // Shared header content
  const headerContent = (
    <>
      {/* Top Navigation */}
      <View style={{ backgroundColor: colors.white }}>
        <TopNav
          variant="dark"
          showLogo={true}
          onLogoPress={handleLogoPress}
          style={{ backgroundColor: 'transparent' }}
          pills={[
            {
              key: 'all-series',
              label: 'All Series',
              icon: <BookIcon size={13} color={staticColors.white} />,
              onPress: () => navigation.navigate('SeriesList'),
            },
            {
              key: 'sort',
              icon: <SortArrow color={showSortDropdown ? staticColors.black : staticColors.white} direction={sortDirection} />,
              label: currentSortLabel,
              onPress: () => setShowSortDropdown(true),
              active: showSortDropdown,
            },
          ]}
          circleButtons={[
            {
              key: 'search',
              icon: <TopNavSearchIcon color={staticColors.white} size={14} />,
              onPress: handleSearchPress,
            },
            {
              key: 'close',
              icon: <TopNavCloseIcon color={staticColors.white} size={14} />,
              onPress: handleBack,
            },
          ]}
        />
      </View>
      {/* Series Title Header */}
      <View style={styles.titleHeader}>
        <View style={styles.titleRow}>
          <Text style={[styles.headerName, { color: colors.black, flex: 1 }]}>{seriesInfo.name}</Text>
          <Pressable
            onPress={handleFavoriteToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            style={{ marginLeft: 12, marginTop: scale(24) * 1.1 - 24 }}
          >
            <HeartIconSvg
              size={24}
              color={isFavorited ? colors.black : colors.gray}
              filled={isFavorited}
            />
          </Pressable>
        </View>
        <Text style={[styles.headerStats, { color: colors.gray }]}>
          {seriesInfo.bookCount} {seriesInfo.bookCount === 1 ? 'book' : 'books'} · {formatDurationCompact(totalDuration)}
        </Text>

        {/* Author byline — tappable */}
        {primaryAuthorInfo && (
          <Pressable
            style={styles.authorByline}
            onPress={() => handleAuthorPress(primaryAuthorInfo.name)}
            accessibilityRole="button"
            accessibilityLabel={`View author ${primaryAuthorInfo.name}`}
          >
            <Text style={[styles.authorBylineName, { color: colors.gray }]}>{primaryAuthorInfo.name}</Text>
          </Pressable>
        )}
      </View>

      {/* Tabs Row with View Toggle */}
      <View style={styles.tabsRow}>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'all' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
            onPress={() => setActiveTab('all')}
            accessibilityRole="button"
            accessibilityLabel="Filter by All"
            accessibilityState={{ selected: activeTab === 'all' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'all' && { color: colors.white }]}>All</Text>
          </Pressable>
          {authorList.length > 0 && (
          <Pressable
            style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'author' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
            onPress={() => setActiveTab('author')}
            accessibilityRole="button"
            accessibilityLabel="Filter by Author"
            accessibilityState={{ selected: activeTab === 'author' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'author' && { color: colors.white }]}>Author</Text>
          </Pressable>
          )}
          {narratorList.length > 0 && (
          <Pressable
            style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'narrator' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
            onPress={() => setActiveTab('narrator')}
            accessibilityRole="button"
            accessibilityLabel="Filter by Narrator"
            accessibilityState={{ selected: activeTab === 'narrator' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'narrator' && { color: colors.white }]}>Narrator</Text>
          </Pressable>
          )}
          {genreList.length > 0 && (
          <Pressable
            style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'genre' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
            onPress={() => setActiveTab('genre')}
            accessibilityRole="button"
            accessibilityLabel="Filter by Genre"
            accessibilityState={{ selected: activeTab === 'genre' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'genre' && { color: colors.white }]}>Genre</Text>
          </Pressable>
          )}
        </View>
        {/* View mode toggle */}
        <ViewModePicker
          mode={viewMode}
          onModeChange={setViewMode}
          iconColor={colors.black}
          activeIconColor={colors.white}
          inactiveIconColor={colors.gray}
          borderColor={colors.grayLine}
          indicatorColor={colors.black}
          capsuleBg={colors.grayLight}
        />
      </View>
    </>
  );

  // Sort dropdown modal
  const sortDropdown = (
    <Modal visible={showSortDropdown} transparent animationType="fade" onRequestClose={() => setShowSortDropdown(false)}>
      <Pressable style={styles.dropdownOverlay} onPress={() => setShowSortDropdown(false)}>
        <View style={[styles.dropdownMenu, { backgroundColor: colors.isDark ? colors.shelfBg : colors.white }]}>
          {DETAIL_SORT_OPTIONS.map((option) => {
            const isActive = sortMode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={styles.dropdownItem}
                onPress={() => handleSortSelect(option.key)}
              >
                <Text style={[styles.dropdownText, { color: colors.black }, isActive && { fontWeight: '700' }]}>
                  {option.label}
                </Text>
                {isActive && (
                  <Text style={{ fontSize: 14 }}>{sortDirection === 'asc' ? '\u2191' : '\u2193'}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );

  // Shared footer content
  const footerContent = (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: colors.gray }]}>
        {allBooks.length} {allBooks.length === 1 ? 'title' : 'titles'} · {Math.round(totalDuration / 3600)} hours total
      </Text>
    </View>
  );

  // Use FlatList for flat "All + Book" view, ScrollView for everything else
  if (isFlatBookList) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.white} />
        {sortDropdown}
        <FlatList
          data={allBooks}
          keyExtractor={bookKeyExtractor}
          renderItem={renderVerticalBookItem}
          ListHeaderComponent={headerContent}
          ListFooterComponent={footerContent}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.gray }]}>No books found</Text>}
          style={[styles.scrollView, { backgroundColor: colors.white }]}
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.white} />
      {sortDropdown}

      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.white }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {headerContent}

        {/* Content based on tab and view mode */}
        {activeTab === 'all' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            <View style={styles.groupSection}>
              <ShelfRow books={allBooks} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
            </View>
            {allBooks.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.gray }]}>No books found</Text>
            )}
          </View>
        )}

        {activeTab === 'all' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            <BookGrid books={allBooks} onBookPress={(book) => handleBookPress(book.id)} onBookLongPress={(book) => showMenu(book)} />
          </View>
        )}

        {activeTab === 'author' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            {authorList.map((author, index) => (
              <CollapsibleSection
                key={author.name}
                title={author.name}
                count={author.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleAuthorPress(author.name)}
              >
                <ShelfRow books={author.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'author' && viewMode === 'list' && (
          <View style={styles.groupedList}>
            {authorList.map((author, index) => (
              <CollapsibleSection
                key={author.name}
                title={author.name}
                count={author.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleAuthorPress(author.name)}
              >
                {renderVerticalBookList(author.books)}
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'author' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            {authorList.map((author, index) => (
              <CollapsibleSection
                key={author.name}
                title={author.name}
                count={author.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleAuthorPress(author.name)}
              >
                <BookGrid books={author.books} onBookPress={(book) => handleBookPress(book.id)} onBookLongPress={(book) => showMenu(book)} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'narrator' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            {narratorList.map((narrator, index) => (
              <CollapsibleSection
                key={narrator.name}
                title={narrator.name}
                count={narrator.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleNarratorPress(narrator.name)}
              >
                <ShelfRow books={narrator.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'narrator' && viewMode === 'list' && (
          <View style={styles.groupedList}>
            {narratorList.map((narrator, index) => (
              <CollapsibleSection
                key={narrator.name}
                title={narrator.name}
                count={narrator.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleNarratorPress(narrator.name)}
              >
                {renderVerticalBookList(narrator.books)}
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'narrator' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            {narratorList.map((narrator, index) => (
              <CollapsibleSection
                key={narrator.name}
                title={narrator.name}
                count={narrator.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleNarratorPress(narrator.name)}
              >
                <BookGrid books={narrator.books} onBookPress={(book) => handleBookPress(book.id)} onBookLongPress={(book) => showMenu(book)} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'genre' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            {genreList.map((genre, index) => (
              <CollapsibleSection
                key={genre.name}
                title={genre.name}
                count={genre.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleGenrePress(genre.name)}
              >
                <ShelfRow books={genre.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'genre' && viewMode === 'list' && (
          <View style={styles.groupedList}>
            {genreList.map((genre, index) => (
              <CollapsibleSection
                key={genre.name}
                title={genre.name}
                count={genre.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleGenrePress(genre.name)}
              >
                {renderVerticalBookList(genre.books)}
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'genre' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            {genreList.map((genre, index) => (
              <CollapsibleSection
                key={genre.name}
                title={genre.name}
                count={genre.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleGenrePress(genre.name)}
              >
                <BookGrid books={genre.books} onBookPress={(book) => handleBookPress(book.id)} onBookLongPress={(book) => showMenu(book)} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {footerContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
  },
  titleHeader: {
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(24),
    fontWeight: '400',
    color: staticColors.white,
    lineHeight: scale(24) * 1.1,
    marginBottom: 6,
  },
  headerStats: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.gray,
  },
  authorByline: {
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  authorBylinePhotoFrame: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    padding: 2,
    marginRight: 10,
  },
  authorBylinePhoto: {
    width: scale(28),
    height: scale(28),
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  authorBylineName: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: staticColors.gray,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tab: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: staticColors.white,
    borderColor: staticColors.white,
  },
  tabText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: staticColors.gray,
  },
  tabTextActive: {
    color: staticColors.black,
  },
  verticalList: {
    flex: 1,
  },
  verticalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  verticalCover: {
    width: scale(40),
    height: scale(40),
    borderRadius: 4,
  },
  verticalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  verticalTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
    color: staticColors.white,
  },
  verticalSeries: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.gray,
    marginTop: 2,
  },
  verticalDuration: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.gray,
  },
  groupedList: {
    flex: 1,
  },
  groupSection: {
    marginBottom: 36,
  },
  groupTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(26),
    color: staticColors.white,
    marginBottom: 16,
    marginTop: 8,
  },
  groupCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.gray,
  },
  shelfContent: {
    paddingVertical: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
  spineWrapper: {
    // No additional styling needed
  },
  emptyText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: staticColors.gray,
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    paddingTop: 20,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  footerText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: staticColors.gray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(18),
    color: staticColors.white,
    marginTop: 16,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  dropdownText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(12),
  },
});
