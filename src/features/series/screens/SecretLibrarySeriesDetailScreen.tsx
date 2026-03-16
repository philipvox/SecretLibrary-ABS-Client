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

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookIcon, HeartIconSvg, TopNav, TopNavSearchIcon, TopNavCloseIcon, CollapsibleSection, useBookContextMenu } from '@/shared/components';
import * as Haptics from 'expo-haptics';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { CoverStars } from '@/shared/components/CoverStars';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { BookSpineVerticalData, ShelfRow } from '@/shared/spine';

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
type ViewMode = 'series' | 'book';

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
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const _isDarkMode = colors.isDark;
  const { showMenu } = useBookContextMenu();

  // Handle both param formats
  const seriesName = route.params.seriesName || route.params.name || '';

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('book');

  const { getSeries, isLoaded } = useLibraryCache();

  // Favorite functionality
  const { isSeriesFavorite, addSeriesToFavorites, removeSeriesFromFavorites } = useMyLibraryStore();
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

  // Get series data from cache
  const seriesInfo = useMemo(() => {
    if (!isLoaded || !seriesName) return null;
    return getSeries(seriesName);
  }, [isLoaded, seriesName, getSeries]);

  // All books sorted by sequence number
  const allBooks = useMemo(() => {
    if (!seriesInfo?.books) return [];
    return [...seriesInfo.books].sort((a, b) => {
      const seqA = getSeriesSequence(getMetadata(a)) ?? 999;
      const seqB = getSeriesSequence(getMetadata(b)) ?? 999;
      return seqA - seqB;
    });
  }, [seriesInfo?.books]);

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
      navigation.navigate('Main' as never);
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

  // Render vertical book list (one per line)
  const renderVerticalBookList = (books: LibraryItem[]) => {
    return (
      <View style={styles.verticalList}>
        {books.map((book) => {
          const metadata = getMetadata(book);
          const title = metadata?.title || 'Unknown';
          const duration = getBookDuration(book);
          const durationText = formatDurationCompact(duration);
          const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
          const seriesSeq = getSeriesSequence(metadata);

          return (
            <Pressable
              key={book.id}
              style={[styles.verticalListItem, { borderBottomColor: colors.grayLine }]}
              onPress={() => handleBookPress(book.id)}
              onLongPress={() => navigation.navigate('BookDetail', { id: book.id })}
              delayLongPress={400}
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
        })}
      </View>
    );
  };

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

  return (
    <View style={[styles.container, { backgroundColor: staticColors.black }]}>
      <StatusBar barStyle="light-content" backgroundColor={staticColors.black} />

      <ScrollView
        style={[styles.scrollView, { backgroundColor: staticColors.black }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Navigation - scrolls with content */}
        <View style={{ backgroundColor: staticColors.black }}>
          <TopNav
            variant="dark"
            showLogo={true}
            onLogoPress={handleLogoPress}
            pills={[
              {
                key: 'all-series',
                label: 'All Series',
                icon: <BookIcon size={13} color={staticColors.white} />,
                onPress: () => navigation.navigate('SeriesList'),
              },
              {
                key: 'favorite',
                label: isFavorited ? 'Favorite' : 'Favorite',
                active: isFavorited,
                icon: (
                  <HeartIconSvg
                    size={13}
                    color={isFavorited ? staticColors.black : staticColors.white}
                    filled={isFavorited}
                  />
                ),
                onPress: handleFavoriteToggle,
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
          <Text style={[styles.headerName, { color: colors.black }]}>{seriesInfo.name}</Text>
          <Text style={[styles.headerStats, { color: colors.gray }]}>
            {seriesInfo.bookCount} {seriesInfo.bookCount === 1 ? 'book' : 'books'} · {formatDurationCompact(totalDuration)}
          </Text>
        </View>

        {/* Tabs Row with View Toggle */}
        <View style={styles.tabsRow}>
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'all' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'all' && { color: colors.white }]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'author' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
              onPress={() => setActiveTab('author')}
            >
              <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'author' && { color: colors.white }]}>Author</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'narrator' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
              onPress={() => setActiveTab('narrator')}
            >
              <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'narrator' && { color: colors.white }]}>Narrator</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'genre' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }]]}
              onPress={() => setActiveTab('genre')}
            >
              <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'genre' && { color: colors.white }]}>Genre</Text>
            </Pressable>
          </View>
          {/* View mode toggle */}
          <Pressable
            style={styles.viewToggle}
            onPress={() => setViewMode(viewMode === 'book' ? 'series' : 'book')}
          >
            <Text style={[styles.toggleText, { color: colors.black }]}>
              {viewMode === 'book' ? 'Book' : 'Shelf'}
            </Text>
          </Pressable>
        </View>

        {/* Content based on tab and view mode */}
        {activeTab === 'all' && viewMode === 'series' && (
          <View style={styles.groupedList}>
            <View style={styles.groupSection}>
              <ShelfRow books={allBooks} toSpineData={toSpineData} onSpinePress={handleSpinePress} onSpineLongPress={(spine) => { const item = allBooks.find(b => b.id === spine.id); if (item) showMenu(item); }} />
            </View>
            {allBooks.length === 0 && (
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

        {activeTab === 'author' && viewMode === 'series' && (
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

        {activeTab === 'narrator' && viewMode === 'series' && (
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

        {activeTab === 'genre' && viewMode === 'series' && (
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
            {genreList.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.gray }]}>No genres found</Text>
            )}
          </View>
        )}

        {activeTab === 'genre' && viewMode === 'book' && (
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
            {genreList.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.gray }]}>No genres found</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
  },
  titleHeader: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
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
  toggleText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.white,
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
