/**
 * src/features/home/screens/LibraryScreen.tsx
 *
 * Secret Library - Library Screen
 * Features two view modes: Bookshelf (spines, primary) and Grid (secondary)
 *
 * Design: Clean editorial aesthetic with Playfair Display titles,
 * JetBrains Mono metadata, and a cream/black color scheme.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
// Note: Safe area is handled by TopNav component
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { apiClient } from '@/core/api';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache } from '@/core/cache';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { TopNav, TopNavSearchIcon, SkullRefreshControl, SkeletonBox } from '@/shared/components';
import { useNavigationWithLoading } from '@/shared/hooks';
import {
  secretLibraryColors as staticColors,
  secretLibraryTypography as typography,
  secretLibrarySpacing as spacing,
  secretLibrarySizes as sizes,
  secretLibraryFonts as fonts,
} from '@/shared/theme/secretLibrary';
import { getTitle, getAuthorName, getNarratorName } from '@/shared/utils/metadata';

// Extended metadata with tags
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

import { BookshelfView, LayoutMode } from '../components/BookshelfView';
import { BookSpineVerticalData } from '../components/BookSpineVertical';
import { DiscoverMoreCard, RecommendedBook } from '../components/DiscoverMoreCard';
import { useHomeData } from '../hooks/useHomeData';
import { useRecommendations } from '@/features/recommendations/hooks/useRecommendations';
import { useInProgressBooks, useFinishedBooks } from '@/core/hooks/useUserBooks';
import { useShallow } from 'zustand/react/shallow';
import { useProgressStore } from '@/core/stores/progressStore';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { GLOBAL_MINI_PLAYER_HEIGHT } from '@/navigation/components/GlobalMiniPlayer';
import { useAppReadyStore } from '@/core/stores/appReadyStore';

// =============================================================================
// BOTTOM PADDING CONSTANTS - Edit these to adjust shelf/stack/list positioning
// =============================================================================

// SHELF MODE (upright spines, horizontal scroll)
const SHELF_PADDING_WITH_MINI_PLAYER = GLOBAL_MINI_PLAYER_HEIGHT - 50;
const SHELF_PADDING_NO_MINI_PLAYER = 0;

// LIST MODE (vertical list with covers)
const LIST_PADDING_WITH_MINI_PLAYER = GLOBAL_MINI_PLAYER_HEIGHT + 20;
const LIST_PADDING_NO_MINI_PLAYER = 40;

// GRID MODE (2-column card grid)
const GRID_PADDING_WITH_MINI_PLAYER = GLOBAL_MINI_PLAYER_HEIGHT + 20;
const GRID_PADDING_NO_MINI_PLAYER = 40;

// =============================================================================
// TYPES
// =============================================================================

type ViewMode = 'shelf' | 'list' | 'grid';  // Shelf (upright spines), List (vertical), or Grid (2-column cards)
type SortMode = 'recent' | 'title' | 'author' | 'progress' | 'duration';
type ContentMode = 'library' | 'lastPlayed' | 'finished';  // What content to show
type DownloadFilter = 'all' | 'downloaded' | 'not-downloaded';  // Download status filter

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'progress', label: 'Progress' },
  { key: 'duration', label: 'Duration' },
];

const CONTENT_OPTIONS: { key: ContentMode; label: string }[] = [
  { key: 'library', label: 'My Library' },
  { key: 'lastPlayed', label: 'Last Played' },
  { key: 'finished', label: 'Finished' },
];

const DOWNLOAD_OPTIONS: { key: DownloadFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'downloaded', label: 'Downloaded' },
  { key: 'not-downloaded', label: 'Not Downloaded' },
];

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  duration: string;
  durationSeconds: number;
  progress: number;
  coverUrl?: string;
  lastPlayedAt?: number; // Unix timestamp in milliseconds
  isDownloaded: boolean;
}

// =============================================================================
// ICONS
// =============================================================================

interface IconProps {
  color?: string;
}

// Shelf icon - upright books on shelf (filled)
const ShelfIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill={color}>
    <Rect x={3} y={4} width={4} height={14} rx={1} />
    <Rect x={9} y={6} width={4} height={12} rx={1} />
    <Rect x={15} y={3} width={4} height={15} rx={1} />
    <Rect x={2} y={19} width={20} height={2} rx={0.5} />
  </Svg>
);

// List icon - horizontal lines (filled)
const ListIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill={color}>
    <Circle cx={3} cy={6} r={1.5} />
    <Circle cx={3} cy={12} r={1.5} />
    <Circle cx={3} cy={18} r={1.5} />
    <Rect x={7} y={5} width={14} height={2} rx={1} />
    <Rect x={7} y={11} width={14} height={2} rx={1} />
    <Rect x={7} y={17} width={14} height={2} rx={1} />
  </Svg>
);

// Grid icon - 2x2 squares (filled)
const GridIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill={color}>
    <Rect x={3} y={3} width={8} height={8} rx={1.5} />
    <Rect x={13} y={3} width={8} height={8} rx={1.5} />
    <Rect x={3} y={13} width={8} height={8} rx={1.5} />
    <Rect x={13} y={13} width={8} height={8} rx={1.5} />
  </Svg>
);

// Refresh icon - circular arrows
const RefreshIcon = ({ color = '#000' }: IconProps) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <Path d="M21 3v5h-5" />
  </Svg>
);

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format duration as compact string (e.g., "10h")
function formatDurationCompact(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
}

// =============================================================================
// TRANSFORM DATA
// =============================================================================

function transformToLibraryBook(item: LibraryItem, downloadedIds: Set<string>): LibraryBook {
  const metadata = getBookMetadata(item) || {};
  const mediaProgress = item.mediaProgress || item.userMediaProgress;
  const progress = mediaProgress?.progress || 0;
  const duration = getBookDuration(item);
  // Get lastUpdate timestamp
  const lastPlayedAt = mediaProgress?.lastUpdate || 0;

  return {
    id: item.id,
    title: getTitle(item),
    author: getAuthorName(item),
    duration: formatDuration(duration),
    durationSeconds: duration,
    progress,
    coverUrl: apiClient.getItemCoverUrl(item.id, { width: 400, height: 400 }),
    lastPlayedAt,
    isDownloaded: downloadedIds.has(item.id),
  };
}

/**
 * Extract series name and sequence from metadata
 * Handles both series array and seriesName string formats
 */
function extractSeriesInfo(metadata: any): { name?: string; sequence?: number } {
  // Handle null/undefined metadata
  if (!metadata) return {};

  // Try series array first (expanded API data with name and sequence)
  if (metadata.series?.length > 0) {
    const seriesEntry = metadata.series[0];
    const name = seriesEntry.name || seriesEntry;
    const sequence = seriesEntry.sequence ? parseFloat(seriesEntry.sequence) : undefined;
    if (name && typeof name === 'string') {
      return { name, sequence: sequence || undefined };
    }
  }

  // Try seriesName string (format: "Series Name #N")
  const seriesNameRaw = metadata.seriesName || '';
  if (seriesNameRaw) {
    const seqMatch = seriesNameRaw.match(/#([\d.]+)/);
    if (seqMatch) {
      const sequence = parseFloat(seqMatch[1]);
      const name = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
      return { name, sequence };
    }
    // Series name without sequence
    return { name: seriesNameRaw, sequence: undefined };
  }

  return {};
}

function transformToSpineData(
  book: LibraryBook,
  item: LibraryItem,
  showLastPlayed: boolean = false
): BookSpineVerticalData {
  const metadata = getBookMetadata(item);
  const duration = getBookDuration(item);
  const genres: string[] = metadata?.genres || [];
  const tags: string[] = metadata?.tags || []; // Tags for dimension modifiers (cozy, epic-fantasy, etc.)

  // Extract series info properly
  const seriesInfo = extractSeriesInfo(metadata);

  // Convert timestamp to ISO string only when showing last played
  const lastPlayedAt = showLastPlayed && book.lastPlayedAt
    ? new Date(book.lastPlayedAt).toISOString()
    : undefined;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    progress: book.progress,
    genres,
    tags,
    duration,
    seriesName: seriesInfo.name,
    seriesSequence: seriesInfo.sequence,
    lastPlayedAt,
    isDownloaded: book.isDownloaded,
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LibraryScreen() {
  const { navigateWithLoading, jumpToTabWithLoading, navigation } = useNavigationWithLoading();
  // Note: Safe area is handled by TopNav component (includeSafeArea={true} by default)

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  const [viewMode, setViewMode] = useState<ViewMode>('shelf');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [contentMode, setContentMode] = useState<ContentMode>('library'); // Library vs Last Played
  const [downloadFilter, setDownloadFilter] = useState<DownloadFilter>('all'); // Download status filter
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showContentDropdown, setShowContentDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  // Get data from home hook (for refresh and in-progress data)
  const {
    recentlyListened,
    isRefreshing,
    refresh,
  } = useHomeData();

  // Get library IDs (books user has added to their library)
  // Use progressStore which is the unified source of truth (same as book detail "IN LIBRARY" button)
  // PERF FIX: Subscribe to version number instead of librarySet directly to prevent re-render loops
  // The Set reference changes on every store update, causing cascading re-renders
  const progressVersion = useProgressStore((state) => state.version);
  const isProgressLoaded = useProgressStore((state) => state.isLoaded);

  // Check if mini player is active (has a book loaded)
  const currentBook = usePlayerStore((state) => state.currentBook);
  const isMiniPlayerActive = currentBook !== null;

  // Calculate bottom padding based on view mode and mini player state
  const getBottomPadding = useCallback((mode: ViewMode) => {
    switch (mode) {
      case 'shelf':
        return isMiniPlayerActive ? SHELF_PADDING_WITH_MINI_PLAYER : SHELF_PADDING_NO_MINI_PLAYER;
      case 'list':
        return isMiniPlayerActive ? LIST_PADDING_WITH_MINI_PLAYER : LIST_PADDING_NO_MINI_PLAYER;
      case 'grid':
        return isMiniPlayerActive ? GRID_PADDING_WITH_MINI_PLAYER : GRID_PADDING_NO_MINI_PLAYER;
    }
  }, [isMiniPlayerActive]);

  // Get local SQLite progress data as fallback for "Last Played"
  const { data: localInProgressBooks = [] } = useInProgressBooks();

  // Get finished books from SQLite
  const { data: finishedBooks = [] } = useFinishedBooks();

  // Get library cache for items and refresh functionality
  // PERF FIX: Use selector to only subscribe to needed fields, preventing re-renders from other store changes
  const { items: allCacheItems, refreshCache, isLoading: isCacheLoading, isLoaded: isCacheLoaded } = useLibraryCache(
    useShallow((state) => ({
      items: state.items,
      refreshCache: state.refreshCache,
      isLoading: state.isLoading,
      isLoaded: state.isLoaded,
    }))
  );

  // Get recommendations for "Find More Books" card (5 for empty state stack)
  const { recommendations: recommendedItems } = useRecommendations(allCacheItems, 5);

  // Note: Auto-refresh now happens during app boot (App.tsx) to prevent library flash
  // Manual refresh is still available via pull-to-refresh

  // Transform recommendations to the format needed by DiscoverMoreCard
  // Include genres, tags, and duration so BookSpineVertical can render properly
  const discoverRecommendations = useMemo((): RecommendedBook[] => {
    return recommendedItems.slice(0, 5).map((item) => {
      const metadata = getBookMetadata(item);
      return {
        id: item.id,
        title: getTitle(item),
        author: getAuthorName(item),
        genres: metadata?.genres || [],
        tags: metadata?.tags || [],
        duration: getBookDuration(item),
      };
    });
  }, [recommendedItems]);

  // Handler for "Find More Books" card press
  const handleDiscoverPress = useCallback(() => {
    haptics.buttonPress();
    jumpToTabWithLoading('DiscoverTab');
  }, [jumpToTabWithLoading]);

  // Handler for recommendation book spine press - navigate to book detail
  const handleRecommendationPress = useCallback((book: RecommendedBook) => {
    haptics.buttonPress();
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // Build local "recently listened" from SQLite when server data is empty
  // This ensures "Last Played" shows books even when server returns 0 items
  const localRecentlyListened = useMemo(() => {
    if (recentlyListened.length > 0) return recentlyListened;
    if (localInProgressBooks.length === 0) return [];

    // Convert local progress data to LibraryItems by looking up in cache
    const cacheMap = new Map(allCacheItems.map(item => [item.id, item]));
    const localItems: LibraryItem[] = [];

    for (const userBook of localInProgressBooks) {
      const cacheItem = cacheMap.get(userBook.bookId);
      if (cacheItem) {
        // Enrich cache item with local progress data
        const lastUpdateTime = userBook.lastPlayedAt ? new Date(userBook.lastPlayedAt).getTime() : Date.now();
        localItems.push({
          ...cacheItem,
          mediaProgress: {
            id: userBook.bookId,
            libraryItemId: userBook.bookId,
            currentTime: userBook.currentTime,
            duration: userBook.duration,
            progress: userBook.progress,
            isFinished: userBook.isFinished,
            hideFromContinueListening: false,
            lastUpdate: lastUpdateTime,
            startedAt: lastUpdateTime, // Use lastUpdate as fallback for startedAt
          },
        });
      }
    }

    return localItems.slice(0, 20);
  }, [recentlyListened, localInProgressBooks, allCacheItems]);

  // Build finished books list from SQLite data
  const finishedLibraryItems = useMemo(() => {
    if (finishedBooks.length === 0) return [];

    // Convert finished books to LibraryItems by looking up in cache
    const cacheMap = new Map(allCacheItems.map(item => [item.id, item]));
    const items: LibraryItem[] = [];

    for (const userBook of finishedBooks) {
      const cacheItem = cacheMap.get(userBook.bookId);
      if (cacheItem) {
        // Enrich cache item with finished data
        const finishedTime = userBook.finishedAt ? new Date(userBook.finishedAt).getTime() : Date.now();
        items.push({
          ...cacheItem,
          mediaProgress: {
            id: userBook.bookId,
            libraryItemId: userBook.bookId,
            currentTime: userBook.currentTime,
            duration: userBook.duration,
            progress: userBook.progress,
            isFinished: true,
            hideFromContinueListening: false,
            lastUpdate: finishedTime,
            startedAt: finishedTime,
          },
        });
      }
    }

    return items;
  }, [finishedBooks, allCacheItems]);

  // Get downloaded books
  const { downloads, isLoading: isDownloadsLoading } = useDownloads();
  const downloadedIds = useMemo(() => {
    const ids = new Set<string>();
    downloads
      .filter((d) => d.status === 'complete')
      .forEach((d) => ids.add(d.itemId));
    return ids;
  }, [downloads]);

  // Check if app boot is complete (initial refresh finished)
  const isBootComplete = useAppReadyStore((s) => s.isBootComplete);

  // Data readiness flag - wait for all async sources AND boot completion before showing sorted books
  // This prevents the flash where data changes during the boot refresh
  const isDataReady = isProgressLoaded && isCacheLoaded && !isDownloadsLoading && isBootComplete;

  // DEBUG: Log loading states (can be removed once stable)
  if (__DEV__) {
    console.log(`[LibraryScreen] isDataReady=${isDataReady} (progress=${isProgressLoaded}, cache=${isCacheLoaded}, downloads=${!isDownloadsLoading}, boot=${isBootComplete})`);
  }

  // Get all completed downloads as LibraryItems
  const downloadedLibraryItems = useMemo(() => {
    return downloads
      .filter((d) => d.status === 'complete' && d.libraryItem)
      .map((d) => d.libraryItem as LibraryItem);
  }, [downloads]);

  // Get books in user's library from cache
  // Now using progressStore.librarySet which is the same source as book detail screen
  // PERF FIX: Use getState() inside useMemo instead of subscribing to librarySet
  // This way we re-filter when progressVersion changes (number equality is stable)
  const libraryBooksFromCache = useMemo(() => {
    const librarySet = useProgressStore.getState().librarySet;
    if (!isCacheLoaded || !isProgressLoaded || librarySet.size === 0) return [];
    return allCacheItems.filter(item => librarySet.has(item.id));
  }, [allCacheItems, progressVersion, isCacheLoaded, isProgressLoaded]);

  // Select items based on content mode (Library vs Last Played vs Finished)
  const baseLibraryItems = useMemo(() => {
    switch (contentMode) {
      case 'library':
        // "My Library" - show books user has added to their library
        return libraryBooksFromCache;
      case 'lastPlayed':
        // "Last Played" - use local SQLite data as fallback when server returns empty
        return localRecentlyListened;
      case 'finished':
        // "Finished" - show completed books from SQLite
        return finishedLibraryItems;
      default:
        return libraryBooksFromCache;
    }
  }, [contentMode, libraryBooksFromCache, localRecentlyListened, finishedLibraryItems]);

  // Apply download filter on top of content mode
  const effectiveLibraryItems = useMemo(() => {
    switch (downloadFilter) {
      case 'downloaded':
        return baseLibraryItems.filter(item => downloadedIds.has(item.id));
      case 'not-downloaded':
        return baseLibraryItems.filter(item => !downloadedIds.has(item.id));
      case 'all':
      default:
        return baseLibraryItems;
    }
  }, [baseLibraryItems, downloadFilter, downloadedIds]);

  // Transform to LibraryBook format for list/grid views
  // Uses effectiveLibraryItems so "Downloaded" filter shows ALL downloaded books
  const allBooksUnsorted = useMemo(() => {
    return effectiveLibraryItems.map((item) => transformToLibraryBook(item, downloadedIds));
  }, [effectiveLibraryItems, downloadedIds]);

  // Books are already filtered by effectiveLibraryItems, no additional filtering needed
  const filteredBooks = allBooksUnsorted;

  // Sort books based on sort mode
  // Guard with isDataReady to prevent flash/reordering as data sources load
  const allBooks = useMemo(() => {
    // Return empty array while data is loading - skeleton will show
    if (!isDataReady) {
      return [];
    }

    const sorted = [...filteredBooks];
    switch (sortMode) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        sorted.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'progress':
        sorted.sort((a, b) => b.progress - a.progress); // High to low
        break;
      case 'duration':
        sorted.sort((a, b) => b.durationSeconds - a.durationSeconds); // Long to short
        break;
      case 'recent':
      default:
        // Sort by last played timestamp (most recent first)
        sorted.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
        break;
    }
    return sorted;
  }, [filteredBooks, sortMode, isDataReady]);

  // Handlers
  const handleBookPress = useCallback((book: LibraryBook | BookSpineVerticalData) => {
    haptics.buttonPress();
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    haptics.selection();
    navigation.navigate('Search');
  }, [navigation]);

  const handleRefreshPress = useCallback(async () => {
    haptics.selection();
    await refreshCache();
    await refresh();
  }, [refreshCache, refresh]);

  const handleLogoLongPress = useCallback(() => {
    haptics.selection();
    navigation.navigate('Main', { screen: 'ProfileTab' });
  }, [navigation]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    haptics.selection();
    setViewMode(mode);
  }, []);

  const handleSortPress = useCallback(() => {
    haptics.selection();
    setShowSortDropdown(true);
  }, []);

  const handleSortSelect = useCallback((mode: SortMode) => {
    haptics.selection();
    setSortMode(mode);
    setShowSortDropdown(false);
  }, []);

  const handleContentPress = useCallback(() => {
    haptics.selection();
    setShowContentDropdown(true);
  }, []);

  const handleContentSelect = useCallback((mode: ContentMode) => {
    haptics.selection();
    setContentMode(mode);
    setShowContentDropdown(false);
  }, []);

  const handleDownloadPress = useCallback(() => {
    haptics.selection();
    setShowDownloadDropdown(true);
  }, []);

  const handleDownloadSelect = useCallback((filter: DownloadFilter) => {
    haptics.selection();
    setDownloadFilter(filter);
    setShowDownloadDropdown(false);
  }, []);

  // Create a map for quick lookup of library items by ID
  // Uses effectiveLibraryItems so spine data works for downloaded books
  const libraryItemsMap = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    effectiveLibraryItems.forEach(item => map.set(item.id, item));
    return map;
  }, [effectiveLibraryItems]);

  // Dynamic styles based on mode - using white/black background
  const screenBg = colors.white;
  const textColor = colors.black;
  const buttonInactiveColor = colors.grayLine;
  const buttonInactiveTextColor = colors.gray;

  // Get current labels for dropdowns
  const currentSortLabel = SORT_OPTIONS.find(opt => opt.key === sortMode)?.label || 'Recent';
  const currentContentLabel = CONTENT_OPTIONS.find(opt => opt.key === contentMode)?.label || 'Library';
  const currentDownloadLabel = DOWNLOAD_OPTIONS.find(opt => opt.key === downloadFilter)?.label || 'All';

  // Render list view (vertical list with covers)
  const renderListView = () => {
    return (
      <SkullRefreshControl
        refreshing={isCacheLoading || isRefreshing}
        onRefresh={handleRefreshPress}
      >
        <ScrollView
          style={styles.listScrollView}
          contentContainerStyle={{ paddingBottom: getBottomPadding('list') }}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.verticalList}>
          {allBooks.map((book) => {
            const item = libraryItemsMap.get(book.id);
            const metadata = item ? getBookMetadata(item) : null;
            const seriesInfo = extractSeriesInfo(metadata);
            const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 80, height: 80 });
            const durationText = formatDurationCompact(book.durationSeconds);

            return (
              <Pressable
                key={book.id}
                style={[styles.verticalListItem, { borderBottomColor: colors.grayLine }]}
                onPress={() => handleBookPress(book)}
              >
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.verticalCover}
                />
                <View style={styles.verticalInfo}>
                  <Text style={[styles.verticalTitle, { color: colors.black }]} numberOfLines={1}>{book.title}</Text>
                  {seriesInfo.name && (
                    <Text style={[styles.verticalSeries, { color: colors.gray }]} numberOfLines={1}>
                      {seriesInfo.name}{seriesInfo.sequence ? ` #${seriesInfo.sequence}` : ''}
                    </Text>
                  )}
                </View>
                <Text style={[styles.verticalDuration, { color: colors.gray }]}>{durationText}</Text>
              </Pressable>
            );
          })}
        </View>
        </ScrollView>
      </SkullRefreshControl>
    );
  };

  // Render grid view (2-column cards with covers)
  const renderGridView = () => {
    // Split books into rows of 2
    const rows: LibraryBook[][] = [];
    for (let i = 0; i < allBooks.length; i += 2) {
      rows.push(allBooks.slice(i, i + 2));
    }

    return (
      <SkullRefreshControl
        refreshing={isCacheLoading || isRefreshing}
        onRefresh={handleRefreshPress}
      >
        <ScrollView
          style={styles.gridScrollView}
          contentContainerStyle={{ paddingBottom: getBottomPadding('grid') }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridContainer}>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((book) => {
                  const item = libraryItemsMap.get(book.id);
                  const metadata = item ? getBookMetadata(item) : null;
                  const seriesInfo = extractSeriesInfo(metadata);
                  const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 300, height: 300 });
                  const narrator = item ? getNarratorName(item) : '';
                  const durationText = formatDurationCompact(book.durationSeconds);

                  return (
                    <Pressable
                      key={book.id}
                      style={styles.gridCard}
                      onPress={() => handleBookPress(book)}
                    >
                      <Image
                        source={{ uri: coverUrl }}
                        style={styles.gridCover}
                        contentFit="cover"
                      />
                      <View style={styles.gridInfo}>
                        <Text style={[styles.gridTitle, { color: colors.black }]} numberOfLines={2}>
                          {book.title}
                        </Text>
                        <Text style={[styles.gridAuthor, { color: colors.gray }]} numberOfLines={1}>
                          {book.author}
                        </Text>
                        {seriesInfo.name && (
                          <Text style={[styles.gridMeta, { color: colors.gray }]} numberOfLines={1}>
                            {seriesInfo.name}{seriesInfo.sequence ? ` #${seriesInfo.sequence}` : ''}
                          </Text>
                        )}
                        {narrator && (
                          <Text style={[styles.gridMeta, { color: colors.gray }]} numberOfLines={1}>
                            {narrator}
                          </Text>
                        )}
                        <Text style={[styles.gridMeta, { color: colors.gray }]}>
                          {durationText}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {/* Empty spacer if odd number of books */}
                {row.length === 1 && <View style={styles.gridCard} />}
              </View>
            ))}
          </View>
        </ScrollView>
      </SkullRefreshControl>
    );
  };

  // Navigate to browse
  const handleBrowsePress = useCallback(() => {
    haptics.selection();
    jumpToTabWithLoading('DiscoverTab');
  }, [jumpToTabWithLoading]);

  // Render empty state based on content mode
  const renderEmptyState = () => {
    // For "My Library" mode with no books, use BookshelfView with empty books array
    // This ensures DiscoverMoreCard is positioned exactly the same as when there are books
    if (contentMode === 'library' && discoverRecommendations.length > 0) {
      return (
        <BookshelfView
          books={[]}
          onBookPress={() => {}}
          layoutMode="shelf"
          bottomPadding={getBottomPadding('shelf')}
          recommendations={discoverRecommendations}
          onDiscoverPress={handleDiscoverPress}
          onRecommendationPress={handleRecommendationPress}
        />
      );
    }

    // Fallback text empty state for other modes or when no recommendations
    let title = 'No Books Saved';
    let subtitle = 'Add books to your library to see them here';

    if (contentMode === 'lastPlayed') {
      title = 'No Recently Played';
      subtitle = 'Start listening to see your books here';
    } else if (contentMode === 'finished') {
      title = 'No Finished Books';
      subtitle = 'Complete a book to see it here';
    }

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: colors.black }]}>
          {title}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.gray }]}>
          {subtitle}
        </Text>
        <Pressable
          style={[styles.browseButton, { backgroundColor: colors.black }]}
          onPress={handleBrowsePress}
        >
          <Text style={[styles.browseButtonText, { color: colors.white }]}>Browse Library →</Text>
        </Pressable>
      </View>
    );
  };

  // Render loading skeleton for shelf/stack mode
  const renderLoadingSkeleton = () => {
    // Simple skeleton matching spine dimensions
    const spineWidths = [45, 50, 40, 55, 48, 52, 44, 46];
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSpines}>
          {spineWidths.map((width, i) => (
            <SkeletonBox
              key={i}
              width={width}
              height={220}
              borderRadius={4}
              style={{ marginRight: 6 }}
            />
          ))}
        </View>
      </View>
    );
  };

  // Render content based on view mode
  const renderContent = () => {
    // Show loading skeleton while data sources are loading
    if (!isDataReady) {
      return renderLoadingSkeleton();
    }

    // Show empty state when no books
    if (allBooks.length === 0) {
      return renderEmptyState();
    }

    // List view uses its own rendering
    if (viewMode === 'list') {
      return renderListView();
    }

    // Grid view uses 2-column cards
    if (viewMode === 'grid') {
      return renderGridView();
    }

    // Only show last played time when sorted by recent
    const showLastPlayed = sortMode === 'recent';
    const spineData = allBooks.map((book) => {
      const item = libraryItemsMap.get(book.id);
      return item ? transformToSpineData(book, item, showLastPlayed) : null;
    }).filter(Boolean) as BookSpineVerticalData[];

    // Shelf and Stack modes use BookshelfView with different layoutMode
    return (
      <BookshelfView
        books={spineData}
        onBookPress={(book) => handleBookPress(book)}
        layoutMode={viewMode}
        bottomPadding={getBottomPadding(viewMode)}
        recommendations={discoverRecommendations}
        onDiscoverPress={handleDiscoverPress}
        onRecommendationPress={handleRecommendationPress}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <TopNav
        variant={isDarkMode ? 'dark' : 'light'}
        showLogo={true}
        onLogoLongPress={handleLogoLongPress}
        style={{ backgroundColor: 'transparent' }}
        circleButtons={[
          {
            key: 'refresh',
            icon: <RefreshIcon color={isCacheLoading || isRefreshing ? colors.gray : colors.black} />,
            onPress: isCacheLoading || isRefreshing ? undefined : handleRefreshPress,
          },
          {
            key: 'shelf',
            icon: <ShelfIcon color={viewMode === 'shelf' ? colors.white : buttonInactiveTextColor} />,
            active: viewMode === 'shelf',
            onPress: () => handleViewModeChange('shelf'),
          },
          {
            key: 'grid',
            icon: <GridIcon color={viewMode === 'grid' ? colors.white : buttonInactiveTextColor} />,
            active: viewMode === 'grid',
            onPress: () => handleViewModeChange('grid'),
          },
          {
            key: 'list',
            icon: <ListIcon color={viewMode === 'list' ? colors.white : buttonInactiveTextColor} />,
            active: viewMode === 'list',
            onPress: () => handleViewModeChange('list'),
          },
          {
            key: 'search',
            icon: <TopNavSearchIcon color={colors.black} size={14} />,
            onPress: handleSearchPress,
          },
        ]}
      />

      {/* Filter Row: Content Mode + Download Filter + Sort */}
      <View style={styles.filterRow}>
        {/* Content mode dropdown (Library / Last Played) */}
        <TouchableOpacity style={styles.dropdownBtn} onPress={handleContentPress}>
          <Text style={[styles.dropdownBtnText, { color: textColor }]}>
            ⊙ {currentContentLabel}
          </Text>
        </TouchableOpacity>

        {/* Download filter dropdown */}
        <TouchableOpacity style={styles.dropdownBtn} onPress={handleDownloadPress}>
          <Text style={[styles.dropdownBtnText, { color: textColor }]}>
            ↓ {currentDownloadLabel}
          </Text>
        </TouchableOpacity>

        {/* Sort dropdown button */}
        <TouchableOpacity style={styles.dropdownBtn} onPress={handleSortPress}>
          <Text style={[styles.dropdownBtnText, { color: textColor }]}>
            ⇅ {currentSortLabel}
          </Text>
        </TouchableOpacity>
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
          <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}>
            <Text style={[styles.dropdownTitle, { color: colors.black }]}>
              Sort By
            </Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.dropdownItem,
                  sortMode === option.key && styles.dropdownItemSelected,
                  { borderBottomColor: isDarkMode ? colors.gray : colors.grayLine },
                ]}
                onPress={() => handleSortSelect(option.key)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    { color: colors.black },
                    sortMode === option.key && styles.dropdownItemTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {sortMode === option.key && (
                  <Text style={[styles.dropdownCheck, { color: colors.black }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Content Mode Dropdown Modal */}
      <Modal
        visible={showContentDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContentDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowContentDropdown(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}>
            <Text style={[styles.dropdownTitle, { color: colors.black }]}>
              View
            </Text>
            {CONTENT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.dropdownItem,
                  contentMode === option.key && styles.dropdownItemSelected,
                  { borderBottomColor: isDarkMode ? colors.gray : colors.grayLine },
                ]}
                onPress={() => handleContentSelect(option.key)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    { color: colors.black },
                    contentMode === option.key && styles.dropdownItemTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {contentMode === option.key && (
                  <Text style={[styles.dropdownCheck, { color: colors.black }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Download Filter Dropdown Modal */}
      <Modal
        visible={showDownloadDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDownloadDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowDownloadDropdown(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? colors.shelfBg : colors.white }]}>
            <Text style={[styles.dropdownTitle, { color: colors.black }]}>
              Download Status
            </Text>
            {DOWNLOAD_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.dropdownItem,
                  downloadFilter === option.key && styles.dropdownItemSelected,
                  { borderBottomColor: isDarkMode ? colors.gray : colors.grayLine },
                ]}
                onPress={() => handleDownloadSelect(option.key)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    { color: colors.black },
                    downloadFilter === option.key && styles.dropdownItemTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {downloadFilter === option.key && (
                  <Text style={[styles.dropdownCheck, { color: colors.black }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Filter Row (aligned to right with search)
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingH,
    paddingBottom: 16,
    gap: 16,
  },

  // Dropdown buttons (filter & sort)
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dropdownBtnText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // Dropdown Modal
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: 200,
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownTitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemSelected: {
    // Selected state styling
  },
  dropdownItemText: {
    fontFamily: fonts.playfair.regular,
    fontSize: 16,
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
  },
  dropdownCheck: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
  },

  // Loading skeleton
  loadingContainer: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: spacing.screenPaddingH,
  },
  loadingSpines: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // List View Styles
  listScrollView: {
    flex: 1,
    paddingHorizontal: spacing.screenPaddingH,
  },
  verticalList: {
    flex: 1,
  },
  verticalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
    color: staticColors.black,
  },
  verticalSeries: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.gray,
    marginTop: 2,
  },
  verticalDuration: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: staticColors.gray,
  },

  // Grid View Styles
  gridScrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: spacing.screenPaddingH,
    paddingTop: 8,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gridCard: {
    width: '48%',
  },
  gridCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: staticColors.grayLine,
  },
  gridInfo: {
    marginTop: 10,
  },
  gridTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
    color: staticColors.black,
    lineHeight: scale(18),
  },
  gridAuthor: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: staticColors.gray,
    marginTop: 4,
  },
  gridMeta: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: staticColors.gray,
    marginTop: 2,
  },

  // Empty State - Text version
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(24),
    color: staticColors.black,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: staticColors.gray,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: staticColors.black,
    borderRadius: 4,
  },
  browseButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: staticColors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default LibraryScreen;
