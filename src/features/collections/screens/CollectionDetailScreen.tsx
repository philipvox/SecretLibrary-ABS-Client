/**
 * src/features/collections/screens/CollectionDetailScreen.tsx
 *
 * Collection detail screen styled after Series/Author/Narrator detail screens.
 * Features dark TopNav header with white content area containing
 * collection title, stats, and book list.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Folder } from 'lucide-react-native';
import { useCollectionDetails } from '../hooks/useCollectionDetails';
import { TopNav, TopNavSearchIcon, TopNavCloseIcon, CollapsibleSection } from '@/shared/components';
import { ViewModePicker } from '@/shared/components/ViewModePicker';
import type { ViewMode } from '@/shared/components/ViewModePicker';
import { apiClient } from '@/core/api';
import { CoverStars } from '@/shared/components/CoverStars';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
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
  if (hours === 0) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }
  return `${hours}h`;
}

type CollectionDetailRouteParams = {
  CollectionDetail: { collectionId: string };
};

type FilterTab = 'all' | 'author' | 'narrator';

// Convert LibraryItem to BookSpineVerticalData
function toSpineData(item: LibraryItem, cachedData?: { backgroundColor?: string; textColor?: string }): BookSpineVerticalData {
  const metadata = getMetadata(item);
  const progress = item.userMediaProgress?.progress || 0;

  const base: BookSpineVerticalData = {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || 'Unknown Author',
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

export function CollectionDetailScreen() {
  const route = useRoute<RouteProp<CollectionDetailRouteParams, 'CollectionDetail'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();

  const { collectionId } = route.params;
  const { collection, isLoading, error: _error } = useCollectionDetails(collectionId);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const defaultViewMode = useMyLibraryStore((s) => s.defaultViewMode) ?? 'shelf';
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  useEffect(() => { setViewMode(defaultViewMode); }, [defaultViewMode]);
  const [sortMode, setSortMode] = useState<DetailSortMode>('publishedYear');
  const [sortDirection, setSortDirection] = useState<DetailSortDirection>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

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

  const rawBooks = collection?.books || [];

  // All books sorted by selected sort mode
  const books = useMemo(() => {
    const b = [...rawBooks];
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortMode) {
      case 'title':
        b.sort((a, c) => dir * (getMetadata(a)?.title || '').localeCompare(getMetadata(c)?.title || ''));
        break;
      case 'publishedYear':
        b.sort((a, c) => {
          const yearA = parseInt(getMetadata(a)?.publishedYear || '0', 10) || 0;
          const yearC = parseInt(getMetadata(c)?.publishedYear || '0', 10) || 0;
          if (yearA !== yearC) return dir * (yearA - yearC);
          return (getMetadata(a)?.title || '').localeCompare(getMetadata(c)?.title || '');
        });
        break;
      case 'duration':
        b.sort((a, c) => dir * ((a.media?.duration || 0) - (c.media?.duration || 0)));
        break;
      case 'progress':
        b.sort((a, c) => dir * ((a.userMediaProgress?.progress || 0) - (c.userMediaProgress?.progress || 0)));
        break;
    }
    return b;
  }, [rawBooks, sortMode, sortDirection]);

  // Get unique authors
  const authorList = useMemo(() => {
    const authorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    books.forEach(book => {
      const metadata = getMetadata(book);
      const authorName = metadata?.authorName || 'Unknown Author';
      const existing = authorMap.get(authorName);
      if (existing) {
        existing.books.push(book);
      } else {
        authorMap.set(authorName, { name: authorName, books: [book] });
      }
    });
    return Array.from(authorMap.values()).sort((a, b) => b.books.length - a.books.length);
  }, [books]);

  // Get unique narrators
  const narratorList = useMemo(() => {
    const narratorMap = new Map<string, { name: string; books: LibraryItem[] }>();
    books.forEach(book => {
      const metadata = getMetadata(book);
      let rawNarrator = metadata?.narratorName || metadata?.narrators?.[0] || '';
      rawNarrator = rawNarrator.replace(/^Narrated by\s*/i, '').trim();
      if (rawNarrator) {
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
  }, [books]);

  // Total duration
  const totalDuration = useMemo(() => {
    return books.reduce((sum, book) => sum + getBookDuration(book), 0);
  }, [books]);

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
    const author = metadata?.authorName || '';
    const duration = getBookDuration(book);
    const durationText = formatDurationCompact(duration);
    const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });

    return (
      <Pressable
        style={[styles.verticalListItem, { borderBottomColor: colors.grayLine }]}
        onPress={() => handleBookPress(book.id)}
        accessibilityRole="button"
        accessibilityLabel={`${title}${author ? ` by ${author}` : ''}, ${durationText}`}
      >
        <View style={{ width: scale(44), height: scale(44), borderRadius: 4, overflow: 'hidden' }}>
          <Image source={{ uri: coverUrl }} style={styles.verticalCover} />
          <CoverStars bookId={book.id} starSize={scale(12)} />
        </View>
        <View style={styles.verticalInfo}>
          <Text style={[styles.verticalTitle, { color: colors.black }]} numberOfLines={1}>
            {title}
          </Text>
          {author && (
            <Text style={[styles.verticalAuthor, { color: colors.gray }]} numberOfLines={1}>
              {author}
            </Text>
          )}
        </View>
        <Text style={[styles.verticalDuration, { color: colors.gray }]}>{durationText}</Text>
      </Pressable>
    );
  }, [colors.grayLine, colors.black, colors.gray, handleBookPress]);

  const bookKeyExtractor = useCallback((item: LibraryItem) => item.id, []);

  // Vertical book list - used for grouped sections inside ScrollView
  const renderVerticalBookList = (items: LibraryItem[]) => {
    return (
      <View style={styles.verticalList}>
        {items.map((book) => (
          <React.Fragment key={book.id}>
            {renderVerticalBookItem({ item: book })}
          </React.Fragment>
        ))}
      </View>
    );
  };

  // Loading state
  if (isLoading || !collection) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.black} />
        <TopNav variant="dark" showLogo={true} onLogoPress={handleLogoPress} style={{ backgroundColor: 'transparent' }} />
        <View style={[styles.emptyContainer, { backgroundColor: colors.white }]}>
          <Folder size={48} color={colors.gray} />
          <Text style={[styles.emptyTitle, { color: colors.black }]}>
            {isLoading ? 'Loading collection...' : 'Collection not found'}
          </Text>
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
              key: 'all-collections',
              label: 'All Collections',
              icon: <Folder size={13} color={staticColors.white} />,
              onPress: () => navigation.navigate('CollectionsList'),
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
              icon: <TopNavSearchIcon color={staticColors.white} size={16} />,
              onPress: handleSearchPress,
            },
            {
              key: 'close',
              icon: <TopNavCloseIcon color={staticColors.white} size={16} />,
              onPress: handleBack,
            },
          ]}
        />
      </View>
      {/* Collection Title Header */}
      <View style={styles.titleHeader}>
        <Text style={[styles.headerName, { color: colors.black }]}>{collection.name}</Text>
        {collection.description && (
          <Text style={[styles.headerDescription, { color: colors.gray }]} numberOfLines={2}>
            {collection.description}
          </Text>
        )}
        <Text style={[styles.headerStats, { color: colors.gray }]}>
          {books.length} {books.length === 1 ? 'book' : 'books'} · {formatDurationCompact(totalDuration)}
        </Text>
      </View>

      {/* Tabs Row with View Toggle */}
      <View style={styles.tabsRow}>
        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tab,
              { borderColor: colors.grayLine },
              activeTab === 'all' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }],
            ]}
            onPress={() => setActiveTab('all')}
            accessibilityRole="button"
            accessibilityLabel="All books"
            accessibilityState={{ selected: activeTab === 'all' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'all' && { color: colors.white }]}>
              All
            </Text>
          </Pressable>
          {authorList.length > 0 && (
          <Pressable
            style={[
              styles.tab,
              { borderColor: colors.grayLine },
              activeTab === 'author' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }],
            ]}
            onPress={() => setActiveTab('author')}
            accessibilityRole="button"
            accessibilityLabel="Filter by author"
            accessibilityState={{ selected: activeTab === 'author' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'author' && { color: colors.white }]}>
              Author
            </Text>
          </Pressable>
          )}
          {narratorList.length > 0 && (
          <Pressable
            style={[
              styles.tab,
              { borderColor: colors.grayLine },
              activeTab === 'narrator' && [styles.tabActive, { backgroundColor: colors.black, borderColor: colors.black }],
            ]}
            onPress={() => setActiveTab('narrator')}
            accessibilityRole="button"
            accessibilityLabel="Filter by narrator"
            accessibilityState={{ selected: activeTab === 'narrator' }}
          >
            <Text style={[styles.tabText, { color: colors.gray }, activeTab === 'narrator' && { color: colors.white }]}>
              Narrator
            </Text>
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
        <View style={[styles.dropdownMenu, { backgroundColor: colors.white }]}>
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

  // Use FlatList for flat "All + Book" view, ScrollView for everything else
  if (isFlatBookList) {
    return (
      <View style={[styles.container, { backgroundColor: colors.white }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.white} />
        {sortDropdown}
        <FlatList
          data={books}
          keyExtractor={bookKeyExtractor}
          renderItem={renderVerticalBookItem}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.gray }]}>No books in collection</Text>}
          style={[styles.scrollView, { backgroundColor: colors.white }]}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {headerContent}

        {/* Content based on tab and view mode */}
        {activeTab === 'all' && viewMode === 'shelf' && (
          <View style={styles.groupedList}>
            <View style={styles.groupSection}>
              <ShelfRow books={books} toSpineData={toSpineData} onSpinePress={handleSpinePress} />
            </View>
            {books.length === 0 && <Text style={[styles.emptyText, { color: colors.gray }]}>No books in collection</Text>}
          </View>
        )}

        {activeTab === 'all' && viewMode === 'grid' && (
          <View style={styles.groupedList}>
            <BookGrid books={books} onBookPress={(book) => handleBookPress(book.id)} />
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
                <ShelfRow books={author.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} />
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
                <BookGrid books={author.books} onBookPress={(book) => handleBookPress(book.id)} />
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
                <ShelfRow books={narrator.books} toSpineData={toSpineData} onSpinePress={handleSpinePress} />
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
                <BookGrid books={narrator.books} onBookPress={(book) => handleBookPress(book.id)} />
              </CollapsibleSection>
            ))}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Header
  titleHeader: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  headerName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(32),
    lineHeight: scale(38),
    marginBottom: 8,
  },
  headerDescription: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    lineHeight: scale(18),
    marginBottom: 8,
  },
  headerStats: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Tabs
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabActive: {
    // backgroundColor and borderColor set inline
  },
  tabText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Content
  groupedList: {
    flex: 1,
  },
  groupSection: {
    marginBottom: 24,
  },
  shelfContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  spineWrapper: {
    marginRight: 4,
  },
  // Vertical list
  verticalList: {
    paddingHorizontal: 0,
  },
  verticalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  verticalCover: {
    width: scale(44),
    height: scale(44),
    borderRadius: 4,
    backgroundColor: '#262626',
  },
  verticalInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  verticalTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(15),
    lineHeight: scale(20),
  },
  verticalAuthor: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginTop: 2,
  },
  verticalDuration: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(18),
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
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
