/**
 * src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx
 *
 * Secret Library styled Narrator detail screen with editorial design.
 * Features:
 * - Dark header with narrator name (similar to browse top nav)
 * - Light content area with book list
 * - Type badge with mic icon
 * - Filter tabs (All, Author, Series, Genre)
 * - Series/Book view toggle
 *   - Series view: Books grouped with spine visualizations
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
import { TopNav, TopNavBackIcon, MicIcon, CollapsibleSection, useBookContextMenu } from '@/shared/components';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { CoverStars } from '@/shared/components/CoverStars';
import { LibraryItem, BookMetadata } from '@/core/types';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { BookSpineVerticalData, ShelfRow } from '@/shared/spine';

// Extended metadata with additional fields
interface ExtendedBookMetadata extends BookMetadata {
  tags?: string[];
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
interface NarratorDetailParams {
  narratorName?: string;
  name?: string;
}

type NarratorDetailRouteParams = {
  NarratorDetail: NarratorDetailParams;
};

type FilterTab = 'all' | 'author' | 'series' | 'genre';
type ViewMode = 'series' | 'book';

// Helper to get metadata (legacy - uses new type guard)
const getMetadata = (item: LibraryItem): ExtendedBookMetadata | null => getBookMetadata(item);

// Format duration as compact string (e.g., "10h")
function formatDurationCompact(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
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

// Extract series sequence number from metadata
function getSeriesSequence(metadata: any): number | undefined {
  if (Array.isArray(metadata?.series) && metadata.series.length > 0) {
    const primarySeries = metadata.series[0];
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) return parsed;
    }
  }
  const match = metadata?.seriesName?.match(/#([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return undefined;
}

export function SecretLibraryNarratorDetailScreen() {
  const route = useRoute<RouteProp<NarratorDetailRouteParams, 'NarratorDetail'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const _isDarkMode = colors.isDark;
  const { showMenu } = useBookContextMenu();

  // Handle both param formats
  const narratorName = route.params.narratorName || route.params.name || '';

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('book');

  const { getNarrator, isLoaded } = useLibraryCache();


  // Get narrator data from cache
  const narratorInfo = useMemo(() => {
    if (!isLoaded || !narratorName) return null;
    return getNarrator(narratorName);
  }, [isLoaded, narratorName, getNarrator]);

  // All books (sorted by title)
  const allBooks = useMemo(() => {
    if (!narratorInfo?.books) return [];
    return [...narratorInfo.books].sort((a, b) => {
      const titleA = (getMetadata(a)?.title || '').toLowerCase();
      const titleB = (getMetadata(b)?.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  }, [narratorInfo?.books]);

  // Get unique authors
  const authorList = useMemo(() => {
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
  }, [allBooks]);

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

  const handleGenrePress = useCallback((genreName: string) => {
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  const handleSpinePress = useCallback((book: BookSpineVerticalData) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

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

  // getSeriesSequence is defined outside the component

  // Render vertical book list (one per line)
  const renderVerticalBookList = (books: LibraryItem[]) => {
    return (
      <View style={styles.verticalList}>
        {books.map((book) => {
          const metadata = getMetadata(book);
          const title = metadata?.title || 'Unknown';
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
                {seriesName && (
                  <Text style={[styles.verticalSeries, { color: colors.gray }]} numberOfLines={1}>
                    {seriesName}{seriesSeq ? ` #${seriesSeq}` : ''}
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

  // Loading/Error states - use staticColors for always-dark header
  if (!narratorName || !isLoaded) {
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
          <MicIcon size={48} color={staticColors.gray} />
          <Text style={[styles.emptyTitle, { color: staticColors.white }]}>Narrator not found</Text>
        </View>
      </View>
    );
  }

  if (!narratorInfo) {
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
          <MicIcon size={48} color={staticColors.gray} />
          <Text style={[styles.emptyTitle, { color: staticColors.white }]}>Narrator not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <StatusBar barStyle="light-content" backgroundColor={staticColors.black} />

      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.white }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header area with dark background — scrolls with content */}
        <View style={[styles.headerArea, { backgroundColor: staticColors.black }]}>
          <TopNav
            variant="dark"
            showLogo={true}
            onLogoPress={handleLogoPress}
            style={{ backgroundColor: 'transparent' }}
            pills={[
              {
                key: 'all-narrators',
                label: 'All Narrators',
                icon: <MicIcon size={16} color={staticColors.white} />,
                onPress: () => navigation.navigate('NarratorsList' as never),
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

          {/* Narrator Info */}
          <View style={[styles.narratorInfoBlock, { paddingHorizontal: 24 }]}>
            <Text style={[styles.headerName, { color: staticColors.white }]}>{narratorInfo.name}</Text>
            <Text style={[styles.headerStats, { color: colors.gray }]}>
              {narratorInfo.bookCount} {narratorInfo.bookCount === 1 ? 'book' : 'books'} · {formatDurationCompact(totalDuration)}
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
              style={[styles.tab, { borderColor: colors.grayLine }, activeTab === 'genre' && { backgroundColor: colors.black, borderColor: colors.black }]}
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
              {viewMode === 'book' ? 'Book' : 'Series'}
            </Text>
          </Pressable>
        </View>

        {/* Content based on tab and view mode */}
        {activeTab === 'all' && viewMode === 'series' && (
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

        {activeTab === 'series' && viewMode === 'series' && (
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
  narratorInfoBlock: {
    marginBottom: 24,
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
    color: staticColors.black,
  },
  toggleText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    textDecorationLine: 'underline',
  },
  textList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  flowingText: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(22),
    color: staticColors.black,
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
    color: staticColors.black,
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
    color: staticColors.black,
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
