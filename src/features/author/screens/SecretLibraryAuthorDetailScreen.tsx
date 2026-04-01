/**
 * src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx
 *
 * Secret Library styled Author detail screen with editorial design.
 * Features:
 * - Dark background with large name
 * - Follow button with icon
 * - Filter tabs (All, Series, Narrator)
 * - Series/Book view toggle
 *   - Series view: Books grouped by series with spine visualizations
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
import { TopNav, TopNavBackIcon, UserIcon, CollapsibleSection, useBookContextMenu } from '@/shared/components';
import { ViewModePicker } from '@/shared/components/ViewModePicker';
import type { ViewMode } from '@/shared/components/ViewModePicker';
import * as Haptics from 'expo-haptics';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { CoverStars } from '@/shared/components/CoverStars';
import { LibraryItem, BookMetadata } from '@/core/types';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { logger } from '@/shared/utils/logger';
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

// Extended metadata with additional fields
interface ExtendedBookMetadata extends BookMetadata {
  tags?: string[];
  narratorName?: string;
}

// Helper to get book metadata safely
// Note: Does NOT require audioFiles - works with cache items that only have metadata
function getBookMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration safely
// Note: Does NOT require audioFiles - works with cache items that only have duration
function getBookDuration(item: LibraryItem | null | undefined): number {
  return item?.media?.duration || 0;
}

// Route params type
interface AuthorDetailParams {
  authorName?: string;
  name?: string;
}

type AuthorDetailRouteParams = {
  AuthorDetail: AuthorDetailParams;
};

type FilterTab = 'all' | 'series' | 'narrator' | 'genre';

// Helper to get metadata (legacy - uses new type guard)
const getMetadata = (item: LibraryItem): ExtendedBookMetadata | null => getBookMetadata(item);

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
function toSpineData(item: LibraryItem, cachedData?: any): BookSpineVerticalData {
  const metadata = getMetadata(item);
  const progress = item.userMediaProgress?.progress || 0;

  const base: BookSpineVerticalData = {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || 'Unknown Author',
    progress,
    genres: metadata?.genres || [],
    tags: metadata?.tags || [],
    duration: getBookDuration(item),
    seriesName: metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || metadata?.series?.[0]?.name,
    seriesSequence: getSeriesSequence(metadata),
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

export function SecretLibraryAuthorDetailScreen() {
  const route = useRoute<RouteProp<AuthorDetailRouteParams, 'AuthorDetail'>>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;
  const { showMenu } = useBookContextMenu();

  // Handle both param formats
  const authorName = route.params.authorName || route.params.name || '';

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const defaultViewMode = useMyLibraryStore((s) => s.defaultViewMode) ?? 'shelf';
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  useEffect(() => { setViewMode(defaultViewMode); }, [defaultViewMode]);
  const [sortMode, setSortMode] = useState<DetailSortMode>('publishedYear');
  const [sortDirection, setSortDirection] = useState<DetailSortDirection>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [authorBooks, setAuthorBooks] = useState<LibraryItem[]>([]);
  const [authorDescription, setAuthorDescription] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isFetchingBooks, setIsFetchingBooks] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchRetryCount, setFetchRetryCount] = useState(0);

  const { getAuthor, isLoaded } = useLibraryCache();

  // Get author data from cache
  const authorInfo = useMemo(() => {
    if (!isLoaded || !authorName) return null;
    return getAuthor(authorName);
  }, [isLoaded, authorName, getAuthor]);

  // Fetch author books from API
  useEffect(() => {
    let cancelled = false;
    const fetchAuthorBooks = async () => {
      if (!authorInfo?.id) return;
      setIsFetchingBooks(true);
      setFetchError(null);
      try {
        const authorData = await apiClient.getAuthor(authorInfo.id, { include: 'items' });
        if (cancelled) return; // Prevent stale data from overwriting
        const authorWithItems = authorData as { libraryItems?: LibraryItem[]; description?: string };
        if (authorWithItems?.libraryItems) {
          setAuthorBooks(authorWithItems.libraryItems);
        }
        if (authorData.description) {
          setAuthorDescription(authorData.description);
        }
      } catch (error) {
        if (!cancelled) {
          logger.warn('[AuthorDetail] Failed to fetch author books:', error);
          setFetchError(error instanceof Error ? error.message : 'Failed to load books');
        }
      } finally {
        if (!cancelled) {
          setIsFetchingBooks(false);
        }
      }
    };
    fetchAuthorBooks();
    return () => { cancelled = true; };
  }, [authorInfo?.id, fetchRetryCount]);

  const retryFetchBooks = useCallback(() => {
    setFetchError(null);
    setFetchRetryCount(c => c + 1);
  }, []);

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

  // All books sorted by selected sort mode
  const allBooks = useMemo(() => {
    const books = [...(authorBooks.length > 0 ? authorBooks : (authorInfo?.books || []))];
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
  }, [authorBooks, authorInfo?.books, sortMode, sortDirection]);

  // Get unique series (books sorted by sequence number within each series)
  const seriesList = useMemo(() => {
    const seriesMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const metadata = getMetadata(book);
      const seriesName = metadata?.series?.[0]?.name || metadata?.seriesName?.replace(/\s*#[\d.]+$/, '');
      if (seriesName) {
        const existing = seriesMap.get(seriesName);
        if (existing) {
          existing.books.push(book);
        } else {
          seriesMap.set(seriesName, { name: seriesName, books: [book] });
        }
      }
    });
    // Sort series alphabetically, and sort books within each series by sequence number
    return Array.from(seriesMap.values())
      .map(series => ({
        ...series,
        books: [...series.books].sort((a, b) => {
          const seqA = getSeriesSequence(getMetadata(a)) ?? 999;
          const seqB = getSeriesSequence(getMetadata(b)) ?? 999;
          return seqA - seqB;
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBooks]);

  // Group all books by series for "All" tab with sub-headers
  const allBooksBySeries = useMemo(() => {
    const groups: { name: string; books: LibraryItem[] }[] = [];
    const seriesMap = new Map<string, LibraryItem[]>();
    const standaloneBooks: LibraryItem[] = [];

    allBooks.forEach(book => {
      const metadata = getMetadata(book);
      const seriesName = metadata?.series?.[0]?.name || metadata?.seriesName?.replace(/\s*#[\d.]+$/, '');
      if (seriesName) {
        const existing = seriesMap.get(seriesName);
        if (existing) {
          existing.push(book);
        } else {
          seriesMap.set(seriesName, [book]);
        }
      } else {
        standaloneBooks.push(book);
      }
    });

    // Add series groups first (sorted alphabetically)
    Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, books]) => {
        // Sort books within each series by sequence number
        const sorted = [...books].sort((a, b) => {
          const seqA = getSeriesSequence(getMetadata(a)) ?? 999;
          const seqB = getSeriesSequence(getMetadata(b)) ?? 999;
          return seqA - seqB;
        });
        groups.push({ name, books: sorted });
      });

    // Add standalone books at the end
    if (standaloneBooks.length > 0) {
      groups.push({ name: 'Standalone', books: standaloneBooks });
    }

    return groups;
  }, [allBooks]);

  // Get unique narrators
  const narratorList = useMemo(() => {
    const narratorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const narratorName = getMetadata(book)?.narratorName;
      if (narratorName) {
        const existing = narratorMap.get(narratorName);
        if (existing) {
          existing.books.push(book);
        } else {
          narratorMap.set(narratorName, { name: narratorName, books: [book] });
        }
      }
    });
    return Array.from(narratorMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [allBooks]);

  // Get unique genres
  const genreList = useMemo(() => {
    const genreMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const genres = getMetadata(book)?.genres || [];
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
    return allBooks.reduce((sum, book) => sum + (getBookDuration(book) || 0), 0);
  }, [allBooks]);

  const handleLogoPress = () => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  };

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

  const handleSeriesPress = useCallback((seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const handleNarratorPress = useCallback((narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
  }, [navigation]);

  const handleGenrePress = useCallback((genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  const handleSpinePress = useCallback((book: BookSpineVerticalData) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // ShelfView replaced by shared ShelfRow component (proper React component, not useCallback)

  // Render inline book list with cover images (paragraph style)
  const _renderBookList = (books: LibraryItem[]) => {
    return (
      <Text style={styles.flowingText}>
        {books.map((book, index) => {
          const metadata = getMetadata(book);
          const title = metadata?.title || 'Unknown';
          const duration = getBookDuration(book) || 0;
          const durationText = formatDurationCompact(duration);
          const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
          const isLast = index === books.length - 1;

          return (
            <Text key={book.id} onPress={() => handleBookPress(book.id)}>
              <Image
                source={{ uri: coverUrl }}
                style={styles.inlineCover}
              />
              <Text style={styles.bookTitle}>{title}</Text>
              <Text style={styles.superscript}>{durationText}</Text>
              {!isLast && <Text style={styles.spacer}>   </Text>}
            </Text>
          );
        })}
      </Text>
    );
  };

  // Render a single vertical book item (used by both FlatList and ScrollView paths)
  const renderVerticalBookItem = useCallback(({ item: book }: { item: LibraryItem }) => {
    const metadata = getMetadata(book);
    const title = metadata?.title || 'Unknown';
    const duration = getBookDuration(book) || 0;
    const durationText = formatDurationCompact(duration);
    const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
    const seriesName = metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || metadata?.series?.[0]?.name;
    const seriesSeq = getSeriesSequence(metadata);

    return (
      <Pressable
        style={[styles.verticalListItem, { borderBottomColor: colors.borderLight }]}
        onPress={() => handleBookPress(book.id)}
        onLongPress={() => navigation.navigate('BookDetail', { id: book.id })}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`Open book ${title}${seriesName ? `, ${seriesName}${seriesSeq ? ` #${seriesSeq}` : ''}` : ''}, ${durationText}`}
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
          {seriesName && (
            <Text style={[styles.verticalSeries, { color: colors.gray }]} numberOfLines={1}>
              {seriesName}{seriesSeq ? ` #${seriesSeq}` : ''}
            </Text>
          )}
        </View>
        <Text style={[styles.verticalDuration, { color: colors.gray }]}>{durationText}</Text>
      </Pressable>
    );
  }, [colors.borderLight, colors.black, colors.gray, handleBookPress, navigation]);

  const bookKeyExtractor = useCallback((item: LibraryItem) => item.id, []);

  // Render vertical book list (one per line) - used for grouped sections inside ScrollView
  const renderVerticalBookList = (books: LibraryItem[]) => {
    return (
      <View style={styles.verticalList}>
        {books.map((book) => (
          <React.Fragment key={book.id}>
            {renderVerticalBookItem({ item: book })}
          </React.Fragment>
        ))}
      </View>
    );
  };

  // Loading/Error states
  if (!authorName || !isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
        <View style={{ backgroundColor: colors.white }}>
          <TopNav
            variant="dark"
            showLogo={true}
            onLogoPress={handleLogoPress}
            style={{ backgroundColor: 'transparent' }}
            circleButtons={[
              {
                key: 'back',
                icon: <TopNavBackIcon color={staticColors.white} size={16} />,
                onPress: handleBack,
              },
            ]}
          />
        </View>
        <View style={[styles.emptyContainer, { backgroundColor: colors.white }]}>
          <UserIcon size={48} color={colors.gray} />
          <Text style={[styles.emptyTitle, { color: colors.black }]}>Author not found</Text>
        </View>
      </View>
    );
  }

  if (!authorInfo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
        <View style={{ backgroundColor: colors.white }}>
          <TopNav
            variant="dark"
            showLogo={true}
            onLogoPress={handleLogoPress}
            style={{ backgroundColor: 'transparent' }}
            circleButtons={[
              {
                key: 'back',
                icon: <TopNavBackIcon color={staticColors.white} size={16} />,
                onPress: handleBack,
              },
            ]}
          />
        </View>
        <View style={[styles.emptyContainer, { backgroundColor: colors.white }]}>
          <UserIcon size={48} color={colors.gray} />
          <Text style={[styles.emptyTitle, { color: colors.black }]}>Author not found</Text>
        </View>
      </View>
    );
  }

  // Determine if we should use FlatList (flat book list with no grouping)
  const isFlatBookList = activeTab === 'all' && viewMode === 'list';

  // Shared header content (dark header + tabs)
  const headerContent = (
    <>
      {/* Header section with dark background */}
      <View style={{ backgroundColor: colors.white }}>
        <TopNav
          variant="dark"
          showLogo={true}
          onLogoPress={handleLogoPress}
          style={{ backgroundColor: 'transparent' }}
          pills={[
            {
              key: 'all-authors',
              label: 'All Authors',
              icon: <UserIcon size={16} color={staticColors.white} />,
              onPress: () => navigation.navigate('AuthorsList'),
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
              key: 'back',
              icon: <TopNavBackIcon color={staticColors.white} size={16} />,
              onPress: handleBack,
            },
          ]}
        />

        {/* Author Info - dark header area */}
        <View style={[styles.authorInfoBlock, { paddingHorizontal: 24 }]}>
          <View style={styles.titleRow}>
            {authorInfo.id && authorInfo.imagePath && (
              <View style={styles.authorPhotoFrame}>
                <Image
                  source={{ uri: apiClient.getAuthorImageUrl(authorInfo.id) }}
                  style={styles.authorPhoto}
                  resizeMode="cover"
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerName, { color: staticColors.white }]}>{authorInfo.name}</Text>
              <Text style={[styles.headerStats, { color: colors.gray }]}>
                {authorInfo.bookCount} {authorInfo.bookCount === 1 ? 'book' : 'books'} · {formatDurationCompact(totalDuration)}
              </Text>
            </View>
          </View>

          {/* Author description - truncated with read more */}
          {(authorDescription || authorInfo.description) && (
            <View style={styles.authorDescriptionContainer}>
              <Text
                style={[styles.authorDescription, { color: colors.gray }]}
                numberOfLines={3}
              >
                {authorDescription || authorInfo.description}
              </Text>
              <Pressable onPress={() => setDescriptionExpanded(true)} hitSlop={8}>
                <Text style={[styles.readMoreText, { color: colors.gray }]}>
                  Read more
                </Text>
              </Pressable>
            </View>
          )}
        </View>
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
          {seriesList.length > 0 && (
          <Pressable
            style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'series' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
            onPress={() => setActiveTab('series')}
            accessibilityRole="button"
            accessibilityLabel="Filter by Series"
            accessibilityState={{ selected: activeTab === 'series' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'series' && { color: colors.white }]}>Series</Text>
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
        <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}>
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

  // Expanded description content — renders below the existing nav
  const expandedDescriptionContent = (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: colors.white }]}
      contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 40 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Thin top rule */}
      <View style={[styles.descriptionRule, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />

      {/* Kicker */}
      <Text style={[styles.descriptionSheetKicker, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
        About {authorInfo.name}
      </Text>

      {/* Body text */}
      <Text style={[styles.descriptionSheetText, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#333' }]}>
        {authorDescription || authorInfo.description}
      </Text>

      {/* Back to books link */}
      <Pressable onPress={() => setDescriptionExpanded(false)} hitSlop={8} style={{ marginTop: 24 }}>
        <Text style={[styles.readMoreText, { color: colors.gray }]}>
          Back to books
        </Text>
      </Pressable>
    </ScrollView>
  );

  // Shared footer content
  const footerContent = (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: colors.gray }]}>
        {allBooks.length} {allBooks.length === 1 ? 'title' : 'titles'} · {Math.round(totalDuration / 3600)} hours total
      </Text>
    </View>
  );

  // Expanded description view — reuses same nav, replaces content below it
  if (descriptionExpanded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
        <View style={{ backgroundColor: colors.white }}>
          <TopNav
            variant="dark"
            showLogo={true}
            onLogoPress={handleLogoPress}
            style={{ backgroundColor: 'transparent' }}
            circleButtons={[
              {
                key: 'back',
                icon: <TopNavBackIcon color={staticColors.white} size={16} />,
                onPress: () => setDescriptionExpanded(false),
              },
            ]}
          />
        </View>
        {expandedDescriptionContent}
      </View>
    );
  }

  // Use FlatList for flat "All + Book" view, ScrollView for everything else
  if (isFlatBookList) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
        <FlatList
          data={allBooks}
          keyExtractor={bookKeyExtractor}
          renderItem={renderVerticalBookItem}
          ListHeaderComponent={headerContent}
          ListFooterComponent={footerContent}
          ListEmptyComponent={
            isFetchingBooks ? (
              <Text style={[styles.emptyText, { color: colors.gray }]}>Loading books...</Text>
            ) : fetchError ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={[styles.emptyText, { color: colors.gray }]}>Failed to load books</Text>
                <Text style={[styles.emptyText, { color: colors.gray, fontSize: scale(10), marginTop: 4 }]}>{fetchError}</Text>
                <Pressable
                  style={{ marginTop: 16, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: colors.grayLine }}
                  onPress={retryFetchBooks}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading books"
                >
                  <Text style={[styles.emptyText, { color: colors.black, marginTop: 0 }]}>Try Again</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.gray }]}>No books found</Text>
            )
          }
          style={[styles.scrollView, { backgroundColor: colors.white }]}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 40 + insets.bottom }}
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
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
      {sortDropdown}

      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.white }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 0, paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {headerContent}

        {/* On web: content flows full-width with padding */}
        <View style={Platform.OS === 'web' ? { paddingHorizontal: 32 } : undefined}>

        {/* Loading state while fetching author books from API */}
        {isFetchingBooks && allBooks.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.gray }]}>Loading books...</Text>
        )}

        {/* Error state if fetch failed and no cached data available */}
        {fetchError && allBooks.length === 0 && !isFetchingBooks && (
          <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 }}>
            <Text style={[styles.emptyText, { color: colors.gray }]}>Failed to load books</Text>
            <Text style={[styles.emptyText, { color: colors.gray, fontSize: scale(10), marginTop: 4 }]}>{fetchError}</Text>
            <Pressable
              style={{ marginTop: 16, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: colors.grayLine }}
              onPress={retryFetchBooks}
              accessibilityRole="button"
              accessibilityLabel="Retry loading books"
            >
              <Text style={[styles.emptyText, { color: colors.black, marginTop: 0 }]}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Content based on tab and view mode */}
        {activeTab === 'all' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            {allBooksBySeries.map((group, index) => (
              <CollapsibleSection
                key={group.name}
                title={group.name}
                count={group.books.length}
                defaultExpanded={index === 0}
                onTitlePress={group.name !== 'Standalone' ? () => handleSeriesPress(group.name) : undefined}
                isStandalone={group.name === 'Standalone'}
              >
                <ShelfRow books={group.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
              </CollapsibleSection>
            ))}
            {allBooksBySeries.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.gray }]}>No books found</Text>
            )}
          </View>
        )}

        {activeTab === 'all' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            <BookGrid books={allBooks} onBookPress={(book) => handleBookPress(book.id)} onBookLongPress={(book) => showMenu(book)} />
          </View>
        )}

        {activeTab === 'series' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            {seriesList.map((series, index) => (
              <CollapsibleSection
                key={series.name}
                title={series.name}
                count={series.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleSeriesPress(series.name)}
              >
                <ShelfRow books={series.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'series' && viewMode === 'list' && (
          <View style={styles.groupedList}>
            {seriesList.map((series, index) => (
              <CollapsibleSection
                key={series.name}
                title={series.name}
                count={series.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleSeriesPress(series.name)}
              >
                {renderVerticalBookList(series.books)}
              </CollapsibleSection>
            ))}
          </View>
        )}

        {activeTab === 'series' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            {seriesList.map((series, index) => (
              <CollapsibleSection
                key={series.name}
                title={series.name}
                count={series.books.length}
                defaultExpanded={index === 0}
                onTitlePress={() => handleSeriesPress(series.name)}
              >
                <BookGrid books={series.books} onBookPress={(book) => handleBookPress(book.id)} onBookLongPress={(book) => showMenu(book)} />
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
        </View>
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
  authorInfoBlock: {
    paddingTop: 20,
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorPhotoFrame: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    padding: 2,
    marginRight: 14,
  },
  authorPhoto: {
    width: scale(44),
    height: scale(44),
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  authorDescriptionContainer: {
    marginTop: 14,
  },
  authorDescription: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(16),
    lineHeight: scale(16) * 1.3,
    color: 'rgba(255,255,255,0.75)',
  },
  readMoreText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  descriptionRule: {
    height: 1,
    marginBottom: 24,
  },
  descriptionSheetKicker: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  descriptionSheetText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(17),
    lineHeight: scale(17) * 1.55,
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
  textList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  flowingText: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(22),
    color: staticColors.white,
    lineHeight: scale(22) * 1.7,
  },
  inlineCover: {
    width: scale(22),
    height: scale(22),
    borderRadius: 3,
  },
  bookTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(22),
    color: staticColors.white,
  },
  superscript: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.gray,
    lineHeight: scale(9) * 1.2,
  },
  spacer: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(22),
    color: staticColors.white,
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
