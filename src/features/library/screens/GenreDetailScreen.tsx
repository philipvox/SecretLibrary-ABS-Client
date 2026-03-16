/**
 * src/features/library/screens/GenreDetailScreen.tsx
 *
 * Secret Library styled Genre detail screen with editorial design.
 * Features:
 * - Dark header with genre name (similar to author/narrator pages)
 * - Light content area with book list
 * - Type badge with music icon
 * - Filter tabs (All, Author, Series, Narrator)
 * - Book/Shelf view toggle
 *   - Book view: Flat list with inline cover thumbnails
 *   - Shelf view: Books with spine visualizations
 * - Footer stats
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopNav, TopNavBackIcon, SkullRefreshControl, CollapsibleSection, useBookContextMenu } from '@/shared/components';
import { Music } from 'lucide-react-native';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { LibraryItem, BookMetadata } from '@/core/types';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { BookSpineVertical, BookSpineVerticalData, useBookRowLayout, useSpineCacheStore } from '@/shared/spine';

// Extended metadata with additional fields
interface ExtendedBookMetadata extends BookMetadata {
  tags?: string[];
  narratorName?: string;
}

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration safely
function getBookDuration(item: LibraryItem | null | undefined): number {
  return item?.media?.duration || 0;
}

// Route params type
type GenreDetailParams = {
  genreName: string;
};

type GenreDetailRouteParams = {
  GenreDetail: GenreDetailParams;
};

type FilterTab = 'all' | 'author' | 'series' | 'narrator';
type ViewMode = 'book' | 'shelf';

// Helper to get metadata (legacy - uses new type guard)
const getMetadata = (item: LibraryItem): ExtendedBookMetadata | null => getBookMetadata(item);

// Format duration as compact string (e.g., "10h")
function formatDurationCompact(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
}

// Extract series sequence number from metadata
function getSeriesSequence(metadata: any): number | undefined {
  // series is an array of SeriesSequence objects — access first element
  if (Array.isArray(metadata?.series) && metadata.series[0]?.sequence) {
    return parseFloat(metadata.series[0].sequence);
  }
  const match = metadata?.seriesName?.match(/#([\d.]+)$/);
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

// Shelf view component - MUST be a separate component to use hooks properly
interface ShelfViewProps {
  books: LibraryItem[];
  onPress: (book: BookSpineVerticalData) => void;
  onLongPress?: (book: BookSpineVerticalData) => void;
}

function ShelfView({ books, onPress, onLongPress }: ShelfViewProps) {
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);

  // Convert books to spine data with cached colors
  const spineDataList = useMemo(() => {
    return books.map(book => {
      const cached = getSpineData(book.id);
      return toSpineData(book, cached);
    });
  }, [books, getSpineData]);

  const layouts = useBookRowLayout(spineDataList, {
    scaleFactor: 0.75,
    enableLeaning: true,
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={shelfStyles.shelfContent}
    >
      {layouts.map((layout) => (
        <View key={layout.book.id} style={shelfStyles.spineWrapper}>
          <BookSpineVertical
            book={layout.book}
            width={layout.width}
            height={layout.height}
            leanAngle={layout.leanAngle}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        </View>
      ))}
    </ScrollView>
  );
}

// Styles for ShelfView (defined outside component for performance)
const shelfStyles = StyleSheet.create({
  shelfContent: {
    paddingVertical: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
  spineWrapper: {
    // No additional styling needed
  },
});

export function GenreDetailScreen() {
  const route = useRoute<RouteProp<GenreDetailRouteParams, 'GenreDetail'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const _isDarkMode = colors.isDark;

  const { showMenu } = useBookContextMenu();

  const genreName = route.params?.genreName || '';

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('book');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refreshCache, isLoaded, getGenre } = useLibraryCache();

  // Get genre data from pre-built index (instant lookup vs filtering entire library)
  const genreInfo = useMemo(() => {
    if (!genreName) return null;
    return getGenre(genreName);
  }, [genreName, getGenre]);

  // Get books from genre info (already indexed AND pre-sorted by title in libraryCache)
  // No need to sort here - books are sorted during cache build for instant access
  const allBooks = genreInfo?.books || [];

  // Get unique authors - LAZY: only compute when Author tab is active
  const authorList = useMemo(() => {
    if (activeTab !== 'author') return []; // Skip expensive calculation
    const authorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const authorName = getMetadata(book)?.authorName;
      if (authorName) {
        const existing = authorMap.get(authorName);
        if (existing) {
          existing.books.push(book);
        } else {
          authorMap.set(authorName, { name: authorName, books: [book] });
        }
      }
    });
    return Array.from(authorMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [allBooks, activeTab]);

  // Get unique series - LAZY: only compute when Series tab is active
  const seriesList = useMemo(() => {
    if (activeTab !== 'series') return []; // Skip expensive calculation
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
    return Array.from(seriesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(group => ({
        ...group,
        books: [...group.books].sort((a, b) => {
          const seqA = getSeriesSequence(getMetadata(a)) ?? 999;
          const seqB = getSeriesSequence(getMetadata(b)) ?? 999;
          return seqA - seqB;
        }),
      }));
  }, [allBooks, activeTab]);

  // Get unique narrators - LAZY: only compute when Narrator tab is active
  const narratorList = useMemo(() => {
    if (activeTab !== 'narrator') return []; // Skip expensive calculation
    const narratorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    allBooks.forEach(book => {
      const metadata = getMetadata(book);
      let rawNarrator = metadata?.narratorName || metadata?.narrators?.[0] || '';
      // Remove "Narrated by" prefix if present
      rawNarrator = rawNarrator.replace(/^Narrated by\s*/i, '').trim();
      if (rawNarrator) {
        // Handle comma-separated narrators (use first narrator for grouping)
        const firstNarrator = rawNarrator.split(',')[0].trim();
        const existing = narratorMap.get(firstNarrator);
        if (existing) {
          existing.books.push(book);
        } else {
          narratorMap.set(firstNarrator, { name: firstNarrator, books: [book] });
        }
      }
    });
    return Array.from(narratorMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [allBooks, activeTab]);

  // Group all books by series for "All" tab with sub-headers (shelf view)
  // LAZY: only compute when All tab + Shelf view is active
  const allBooksBySeries = useMemo(() => {
    if (activeTab !== 'all' || viewMode !== 'shelf') return []; // Skip expensive calculation
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
        groups.push({ name, books });
      });

    // Add standalone books at the end
    if (standaloneBooks.length > 0) {
      groups.push({ name: 'Standalone', books: standaloneBooks });
    }

    return groups;
  }, [allBooks, activeTab, viewMode]);

  // Total duration - pre-computed in library cache for instant access
  const totalDuration = genreInfo?.totalDuration || 0;

  const handleLogoPress = () => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main' as never);
    }
  };

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleAuthorPress = useCallback((authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  }, [navigation]);

  const handleSeriesPress = useCallback((seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const handleNarratorPress = useCallback((narratorName: string) => {
    navigation.navigate('NarratorDetail', { narratorName });
  }, [navigation]);

  const handleSpinePress = useCallback((book: BookSpineVerticalData) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  const handleSpineLongPress = useCallback((book: BookSpineVerticalData) => {
    const item = allBooks.find(b => b.id === book.id);
    if (item) showMenu(item);
  }, [allBooks, showMenu]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  // Render vertical book list (one per line)
  const renderVerticalBookList = (books: LibraryItem[]) => {
    return (
      <View style={styles.verticalList}>
        {books.map((book) => {
          const metadata = getMetadata(book);
          const title = metadata?.title || 'Unknown';
          const author = metadata?.authorName || 'Unknown Author';
          const duration = getBookDuration(book) || 0;
          const durationText = formatDurationCompact(duration);
          const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
          const seriesName = metadata?.seriesName?.replace(/\s*#[\d.]+$/, '') || metadata?.series?.[0]?.name;
          const seriesSeq = getSeriesSequence(metadata);

          return (
            <Pressable
              key={book.id}
              style={[styles.verticalListItem, { borderBottomColor: colors.grayLine }]}
              onPress={() => handleBookPress(book.id)}
              onLongPress={() => navigation.navigate('BookDetail', { id: book.id })}
            >
              <Image
                source={{ uri: coverUrl }}
                style={styles.verticalCover}
              />
              <View style={styles.verticalInfo}>
                <Text style={[styles.verticalTitle, { color: colors.black }]} numberOfLines={1}>{title}</Text>
                <Text style={[styles.verticalAuthor, { color: colors.gray }]} numberOfLines={1}>
                  {author}
                  {seriesName && ` · ${seriesName}${seriesSeq ? ` #${seriesSeq}` : ''}`}
                </Text>
              </View>
              <Text style={[styles.verticalDuration, { color: colors.gray }]}>{durationText}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  // Loading/Error states - use staticColors for always-dark header
  if (!genreName || !isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: staticColors.black }]}>
        <StatusBar barStyle="light-content" backgroundColor={staticColors.black} />
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
        <View style={styles.emptyContainer}>
          <Music size={48} color={staticColors.gray} />
          <Text style={[styles.emptyTitle, { color: staticColors.white }]}>Genre not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: staticColors.black }]}>
      <StatusBar barStyle="light-content" backgroundColor={staticColors.black} />

      <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
        <ScrollView
          style={[styles.scrollView, { backgroundColor: staticColors.black }]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 40 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header area with dark background */}
          <View style={[styles.headerArea, { backgroundColor: staticColors.black }]}>
            <TopNav
              variant="dark"
              showLogo={true}
              onLogoPress={handleLogoPress}
              style={{ backgroundColor: 'transparent' }}
              pills={[
                {
                  key: 'genre',
                  label: 'Genre',
                  icon: <Music size={16} color={staticColors.white} />,
                  onPress: () => navigation.navigate('GenresList' as never),
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

            {/* Genre Info */}
            <View style={[styles.genreInfoBlock, { paddingHorizontal: 24 }]}>
              <Text style={[styles.headerName, { color: staticColors.white }]}>{genreName}</Text>
              <Text style={[styles.headerStats, { color: colors.gray }]}>
                {allBooks.length} {allBooks.length === 1 ? 'book' : 'books'} · {formatDurationCompact(totalDuration)}
              </Text>
            </View>
          </View>
          {/* Tabs Row with View Toggle */}
          <View style={styles.tabsRow}>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'all' && { backgroundColor: colors.black, borderColor: colors.black }]}
                onPress={() => setActiveTab('all')}
              >
                <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'all' && { color: colors.white }]}>All</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'author' && { backgroundColor: colors.black, borderColor: colors.black }]}
                onPress={() => setActiveTab('author')}
              >
                <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'author' && { color: colors.white }]}>Author</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'series' && { backgroundColor: colors.black, borderColor: colors.black }]}
                onPress={() => setActiveTab('series')}
              >
                <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'series' && { color: colors.white }]}>Series</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'narrator' && { backgroundColor: colors.black, borderColor: colors.black }]}
                onPress={() => setActiveTab('narrator')}
              >
                <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'narrator' && { color: colors.white }]}>Narrator</Text>
              </Pressable>
            </View>
            {/* View mode toggle */}
            <Pressable
              style={styles.viewToggle}
              onPress={() => setViewMode(viewMode === 'book' ? 'shelf' : 'book')}
            >
              <Text style={[styles.toggleText, { color: colors.black }]}>
                {viewMode === 'book' ? 'Book' : 'Shelf'}
              </Text>
            </Pressable>
          </View>

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
                  <ShelfView books={group.books} onPress={handleSpinePress} onLongPress={handleSpineLongPress} />
                </CollapsibleSection>
              ))}
              {allBooksBySeries.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No books found</Text>
              )}
            </View>
          )}

          {activeTab === 'all' && viewMode === 'book' && (
            <View style={styles.verticalList}>
              {renderVerticalBookList(allBooks)}
              {allBooks.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No books found</Text>
              )}
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
                  <ShelfView books={author.books} onPress={handleSpinePress} onLongPress={handleSpineLongPress} />
                </CollapsibleSection>
              ))}
              {authorList.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No authors found</Text>
              )}
            </View>
          )}

          {activeTab === 'author' && viewMode === 'book' && (
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
              {authorList.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No authors found</Text>
              )}
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
                  <ShelfView books={series.books} onPress={handleSpinePress} onLongPress={handleSpineLongPress} />
                </CollapsibleSection>
              ))}
              {seriesList.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No series found</Text>
              )}
            </View>
          )}

          {activeTab === 'series' && viewMode === 'book' && (
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
              {seriesList.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No series found</Text>
              )}
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
                  <ShelfView books={narrator.books} onPress={handleSpinePress} onLongPress={handleSpineLongPress} />
                </CollapsibleSection>
              ))}
              {narratorList.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No narrators found</Text>
              )}
            </View>
          )}

          {activeTab === 'narrator' && viewMode === 'book' && (
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
              {narratorList.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.gray }]}>No narrators found</Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.grayLine }]}>
            <Text style={[styles.footerText, { color: colors.gray }]}>
              {allBooks.length} {allBooks.length === 1 ? 'title' : 'titles'} · {Math.round(totalDuration / 3600)} hours total
            </Text>
          </View>
        </ScrollView>
      </SkullRefreshControl>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.white,
  },
  headerArea: {
    backgroundColor: staticColors.black,
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
  },
  genreInfoBlock: {
    marginBottom: 4,
  },
  headerName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(36),
    fontWeight: '400',
    color: staticColors.white,
    lineHeight: scale(36) * 1.1,
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
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: staticColors.black,
    borderColor: staticColors.black,
  },
  tabText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: staticColors.gray,
  },
  tabTextActive: {
    color: staticColors.white,
  },
  toggleText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    textDecorationLine: 'underline',
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
    borderBottomColor: staticColors.grayLine,
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
    color: staticColors.black,
  },
  verticalAuthor: {
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
    color: staticColors.black,
    marginBottom: 16,
    marginTop: 8,
  },
  groupCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.gray,
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
    borderTopWidth: 1,
    borderTopColor: staticColors.grayLine,
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
});
