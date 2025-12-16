/**
 * src/features/library/screens/MyLibraryScreen.tsx
 *
 * My Library screen with tab-based navigation.
 *
 * Tabs:
 * 1. All - All books with download/stream indicators
 * 2. Downloaded - Downloaded content with management
 * 3. In Progress - Continue listening with hero card
 * 4. Favorites - Liked books, authors, series, narrators
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  FlatList,
  Alert,
  Pressable,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache, getAllAuthors, getAllSeries, getAllNarrators } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { formatBytes } from '@/shared/utils/format';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { DownloadItem } from '@/features/downloads/components/DownloadItem';
import { SectionHeader } from '@/features/home/components/SectionHeader';
import { SeriesProgressBadge, StackedCovers } from '@/shared/components';
import { SortPicker, SortOption } from '../components/SortPicker';
import { StorageSummary } from '../components/StorageSummary';
import { ContinueListeningHero } from '../components/ContinueListeningHero';
import { LibraryEmptyState } from '../components/LibraryEmptyState';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { usePreferencesStore } from '@/features/recommendations/stores/preferencesStore';
import { useContinueListening } from '@/features/home/hooks/useContinueListening';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, spacing, radius } from '@/shared/theme';

const COLORS = {
  background: colors.backgroundPrimary,
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  accent: colors.accent,
  cardBg: colors.cardBackground,
};

const HORIZONTAL_CARD_WIDTH = scale(110);
const HORIZONTAL_CARD_COVER = scale(100);

// Tab types
type TabType = 'all' | 'downloaded' | 'in-progress' | 'favorites';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
}

// Helper to extract metadata safely
function getMetadata(item: LibraryItem): any {
  return (item.media?.metadata as any) || {};
}

// Get progress from item
function getProgress(item: LibraryItem): number {
  const userProgress = (item as any).userMediaProgress;
  return userProgress?.progress || 0;
}

// Get duration from item
function getDuration(item: LibraryItem): number {
  const media = item.media as any;
  return media?.duration || 0;
}

// Format time remaining
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

// Format duration
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Compass/browse icon
const BrowseIcon = ({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
    <Path
      d="M14.31 8l-5.31 2.16L12 15.31l5.31-2.16L14.31 8z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Download icon for empty state
const DownloadIcon = ({ size = 48, color = 'rgba(255,255,255,0.3)' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Checkmark icon
const CheckIcon = ({ size = 12, color = '#4ADE80' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12l5 5L20 7"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface EnrichedBook {
  id: string;
  item: LibraryItem;
  title: string;
  author: string;
  seriesName: string;
  sequence?: number;
  progress: number;
  duration: number;
  totalBytes: number;
  lastPlayedAt?: number;
  addedAt?: number;
  isDownloaded?: boolean;
}

interface SeriesGroup {
  name: string;
  books: EnrichedBook[];
  totalBooks: number;
  downloadedCount: number;
  completedCount: number;
  inProgressCount: number;
}

// Tab configuration
const TABS: TabConfig[] = [
  { id: 'all', label: 'All', icon: 'library-outline' },
  { id: 'downloaded', label: 'Downloaded', icon: 'cloud-download-outline' },
  { id: 'in-progress', label: 'In Progress', icon: 'play-circle-outline' },
  { id: 'favorites', label: 'Favorites', icon: 'heart-outline' },
];

// Tab bar component
const TabBar = React.memo(function TabBar({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: Record<TabType, number>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBar}
      style={styles.tabBarContainer}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts[tab.id];
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTabChange(tab.id);
            }}
          >
            <Ionicons
              name={isActive ? (tab.icon.replace('-outline', '') as any) : (tab.icon as any)}
              size={scale(16)}
              color={isActive ? COLORS.accent : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {count > 0 && (
              <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

export function MyLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { items: cachedItems, isLoaded, getSeries, getItem } = useLibraryCache();
  const { downloads, pauseDownload, resumeDownload, deleteDownload } = useDownloads();
  const { loadBook } = usePlayerStore();

  // Favorites from stores
  const libraryIds = useMyLibraryStore((state) => state.libraryIds);
  const favoriteSeriesNames = useMyLibraryStore((state) => state.favoriteSeriesNames);
  const favoriteAuthors = usePreferencesStore((state) => state.favoriteAuthors);
  const favoriteNarrators = usePreferencesStore((state) => state.favoriteNarrators);

  // Continue listening data
  const { items: continueListeningItems } = useContinueListening();

  // Tab, sort, and search state
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sort, setSort] = useState<SortOption>('recently-played');
  const [searchQuery, setSearchQuery] = useState('');

  // Separate active downloads from completed
  const activeDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'downloading' || d.status === 'pending' || d.status === 'paused' || d.status === 'error'),
    [downloads]
  );

  const completedDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'complete'),
    [downloads]
  );

  // Get total storage used
  const totalStorageUsed = useMemo(() => {
    return completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);
  }, [completedDownloads]);

  // Enrich downloads with book metadata
  const enrichedBooks = useMemo<EnrichedBook[]>(() => {
    if (!isLoaded) return [];

    return completedDownloads.map((download) => {
      const item = getItem(download.itemId);
      if (!item) {
        return {
          id: download.itemId,
          item: {} as LibraryItem,
          title: 'Unknown Title',
          author: 'Unknown Author',
          seriesName: '',
          progress: 0,
          duration: 0,
          totalBytes: download.totalBytes || 0,
        };
      }

      const metadata = getMetadata(item);
      const seriesName = metadata.seriesName || '';
      const sequenceMatch = seriesName.match(/^(.+?)\s*#([\d.]+)$/);
      const cleanSeriesName = sequenceMatch ? sequenceMatch[1].trim() : seriesName;
      const sequence = sequenceMatch ? parseFloat(sequenceMatch[2]) : undefined;

      return {
        id: download.itemId,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName: cleanSeriesName,
        sequence,
        progress: getProgress(item),
        duration: getDuration(item),
        totalBytes: download.totalBytes || 0,
        lastPlayedAt: (item as any).userMediaProgress?.lastUpdate,
        addedAt: item.addedAt,
      };
    });
  }, [completedDownloads, getItem, isLoaded]);

  // Get favorited books (heart icon) from cache
  const favoritedBooks = useMemo((): EnrichedBook[] => {
    if (!isLoaded || !cachedItems) return [];

    const result: EnrichedBook[] = [];

    for (const bookId of libraryIds) {
      const item = getItem(bookId);
      if (!item) continue;

      const metadata = getMetadata(item);
      const seriesName = metadata.seriesName || '';
      const sequenceMatch = seriesName.match(/^(.+?)\s*#([\d.]+)$/);
      const cleanSeriesName = sequenceMatch ? sequenceMatch[1].trim() : seriesName;
      const sequence = sequenceMatch ? parseFloat(sequenceMatch[2]) : undefined;

      // Check if also downloaded
      const download = completedDownloads.find(d => d.itemId === bookId);

      result.push({
        id: bookId,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName: cleanSeriesName,
        sequence,
        progress: getProgress(item),
        duration: getDuration(item),
        totalBytes: download?.totalBytes || 0,
        lastPlayedAt: (item as any).userMediaProgress?.lastUpdate,
        addedAt: item.addedAt,
        isDownloaded: !!download,
      });
    }

    return result;
  }, [libraryIds, cachedItems, isLoaded, completedDownloads, getItem]);

  // "All" = union of downloaded + favorited books (deduplicated)
  const allLibraryBooks = useMemo<EnrichedBook[]>(() => {
    const bookMap = new Map<string, EnrichedBook>();

    // Add all downloaded books
    for (const book of enrichedBooks) {
      bookMap.set(book.id, { ...book, isDownloaded: true });
    }

    // Add favorited books (mark if also downloaded)
    for (const book of favoritedBooks) {
      if (!bookMap.has(book.id)) {
        bookMap.set(book.id, book);
      }
    }

    return Array.from(bookMap.values());
  }, [enrichedBooks, favoritedBooks]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    // In-progress from downloaded books only
    const inProgressCount = enrichedBooks.filter(b => b.progress > 0 && b.progress < 0.95).length;
    const downloadedCount = enrichedBooks.length;
    const favoritesCount = libraryIds.length + favoriteSeriesNames.length +
                           favoriteAuthors.length + favoriteNarrators.length;
    const allCount = allLibraryBooks.length;

    return {
      'all': allCount,
      'downloaded': downloadedCount,
      'in-progress': inProgressCount,
      'favorites': favoritesCount,
    } as Record<TabType, number>;
  }, [allLibraryBooks.length, enrichedBooks, libraryIds.length,
      favoriteSeriesNames.length, favoriteAuthors.length, favoriteNarrators.length]);

  // Get books for current tab
  const currentTabBooks = useMemo(() => {
    switch (activeTab) {
      case 'downloaded':
        return enrichedBooks;
      case 'in-progress':
        return enrichedBooks.filter(b => b.progress > 0 && b.progress < 0.95);
      case 'favorites':
        return favoritedBooks;
      default:
        return allLibraryBooks;
    }
  }, [activeTab, enrichedBooks, favoritedBooks, allLibraryBooks]);

  // Apply sort
  const sortedBooks = useMemo(() => {
    const sorted = [...currentTabBooks];

    switch (sort) {
      case 'recently-played':
        return sorted.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
      case 'recently-added':
        return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'author-asc':
        return sorted.sort((a, b) => a.author.localeCompare(b.author));
      case 'duration-asc':
        return sorted.sort((a, b) => a.duration - b.duration);
      case 'duration-desc':
        return sorted.sort((a, b) => b.duration - a.duration);
      default:
        return sorted;
    }
  }, [currentTabBooks, sort]);

  // Apply search filter
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedBooks;
    }

    const query = searchQuery.toLowerCase().trim();
    return sortedBooks.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      b.seriesName?.toLowerCase().includes(query)
    );
  }, [sortedBooks, searchQuery]);

  // In-progress books for Continue Listening section
  const inProgressBooks = useMemo(() => {
    if (activeTab === 'favorites') return [];
    return filteredBooks.filter(b => b.progress > 0 && b.progress < 0.95);
  }, [filteredBooks, activeTab]);

  // Get favorite authors/series/narrators data
  const favoriteAuthorData = useMemo(() => {
    if (!isLoaded) return [];
    const allAuthorsMap = getAllAuthors();
    return favoriteAuthors
      .map(name => allAuthorsMap.find(a => a.name === name))
      .filter(Boolean);
  }, [favoriteAuthors, isLoaded]);

  const favoriteSeriesData = useMemo(() => {
    if (!isLoaded) return [];
    const allSeriesMap = getAllSeries();
    return favoriteSeriesNames
      .map(name => allSeriesMap.find(s => s.name === name))
      .filter(Boolean);
  }, [favoriteSeriesNames, isLoaded]);

  const favoriteNarratorData = useMemo(() => {
    if (!isLoaded) return [];
    const allNarratorsMap = getAllNarrators();
    return favoriteNarrators
      .map(name => allNarratorsMap.find(n => n.name === name))
      .filter(Boolean);
  }, [favoriteNarrators, isLoaded]);

  // Group books by series
  const seriesGroups = useMemo<SeriesGroup[]>(() => {
    const seriesMap = new Map<string, EnrichedBook[]>();

    for (const book of filteredBooks) {
      if (book.seriesName) {
        const existing = seriesMap.get(book.seriesName) || [];
        existing.push(book);
        seriesMap.set(book.seriesName, existing);
      }
    }

    return Array.from(seriesMap.entries()).map(([name, books]) => {
      // Get full series info from cache
      const seriesInfo = getSeries(name);
      const totalBooks = seriesInfo?.books?.length || books.length;

      return {
        name,
        books: books.sort((a, b) => (a.sequence || 999) - (b.sequence || 999)),
        totalBooks,
        downloadedCount: books.length,
        completedCount: books.filter(b => b.progress >= 0.95).length,
        inProgressCount: books.filter(b => b.progress > 0 && b.progress < 0.95).length,
      };
    });
  }, [filteredBooks, getSeries]);

  // Refresh handler
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  // Navigation handlers
  const handleProfilePress = () => navigation.navigate('Main', { screen: 'ProfileTab' });
  const handleDiscoverPress = () => navigation.navigate('Main', { screen: 'DiscoverTab' });
  const handleHomePress = () => navigation.navigate('Main', { screen: 'HomeTab' });
  const handleBrowse = () => navigation.navigate('DiscoverTab');
  const handleBookPress = (itemId: string) => navigation.navigate('BookDetail', { id: itemId });
  const handleSeriesPress = (seriesName: string) => navigation.navigate('SeriesDetail', { seriesName });
  const handleManageStorage = () => navigation.navigate('Main', { screen: 'ProfileTab' });

  // Resume book playback
  const handleResumeBook = useCallback(async (book: EnrichedBook) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      if (book.item) {
        await loadBook(book.item, { autoPlay: true, showPlayer: false });
      }
    }
  }, [loadBook]);

  // Play book from beginning
  const handlePlayBook = useCallback(async (book: EnrichedBook) => {
    if (book.progress >= 0.95) {
      // Completed book - ask to restart
      Alert.alert(
        'Restart Book?',
        'This book is completed. Would you like to start from the beginning?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restart',
            onPress: async () => {
              try {
                const fullBook = await apiClient.getItem(book.id);
                await loadBook(fullBook, { autoPlay: true, showPlayer: false, startPosition: 0 });
              } catch {
                if (book.item) {
                  await loadBook(book.item, { autoPlay: true, showPlayer: false, startPosition: 0 });
                }
              }
            },
          },
        ]
      );
    } else {
      handleResumeBook(book);
    }
  }, [loadBook, handleResumeBook]);

  // Pause/Resume all downloads
  const handlePauseAll = useCallback(() => {
    activeDownloads.forEach(d => {
      if (d.status === 'downloading') {
        pauseDownload(d.itemId);
      }
    });
  }, [activeDownloads, pauseDownload]);

  const handleResumeAll = useCallback(() => {
    activeDownloads.forEach(d => {
      if (d.status === 'paused') {
        resumeDownload(d.itemId);
      }
    });
  }, [activeDownloads, resumeDownload]);

  const hasDownloading = activeDownloads.some(d => d.status === 'downloading');
  const hasPaused = activeDownloads.some(d => d.status === 'paused');

  const hasContent = completedDownloads.length > 0 || activeDownloads.length > 0;

  // Render Continue Listening card
  const renderContinueListeningCard = useCallback(({ item }: { item: EnrichedBook }) => {
    const coverUrl = apiClient.getItemCoverUrl(item.id);
    const progressPct = Math.round(item.progress * 100);
    const timeRemaining = item.duration * (1 - item.progress);

    return (
      <TouchableOpacity
        style={styles.horizontalCard}
        onPress={() => handleResumeBook(item)}
        onLongPress={() => handleBookPress(item.id)}
        activeOpacity={0.9}
      >
        <View style={styles.horizontalCardCoverContainer}>
          <Image
            source={coverUrl}
            style={styles.horizontalCardCover}
            contentFit="cover"
            transition={200}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.cardGradient}
          />
          <View style={styles.horizontalCardProgress}>
            <View style={[styles.horizontalCardProgressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.cardProgressText}>{progressPct}%</Text>
        </View>
        <Text style={styles.horizontalCardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.horizontalCardSubtitle}>{formatTimeRemaining(timeRemaining)}</Text>
      </TouchableOpacity>
    );
  }, [handleResumeBook, handleBookPress]);

  // Render book row with download/stream indicator
  const renderBookRow = useCallback((book: EnrichedBook, showIndicator = true) => {
    const coverUrl = apiClient.getItemCoverUrl(book.id);
    const isCompleted = book.progress >= 0.95;
    const isDownloaded = book.isDownloaded || book.totalBytes > 0;

    return (
      <TouchableOpacity
        key={book.id}
        style={styles.bookRow}
        onPress={() => handleBookPress(book.id)}
        activeOpacity={0.7}
      >
        <View style={styles.bookCoverContainer}>
          <Image source={coverUrl} style={styles.bookCover} contentFit="cover" />
          {/* Download/Stream indicator */}
          {showIndicator && (
            <View style={[styles.statusBadge, isDownloaded ? styles.downloadedBadge : styles.streamBadge]}>
              <Ionicons
                name={isDownloaded ? 'checkmark' : 'cloud-outline'}
                size={scale(10)}
                color="#FFFFFF"
              />
            </View>
          )}
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.accent} />
            </View>
          )}
        </View>

        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
          <View style={styles.bookMetaRow}>
            <Text style={styles.bookMeta}>{formatDuration(book.duration)}</Text>
            {book.progress > 0 && book.progress < 0.95 && (
              <Text style={styles.bookProgress}>{Math.round(book.progress * 100)}%</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.playButton}
          onPress={() => handlePlayBook(book)}
          activeOpacity={0.7}
        >
          <Ionicons name="play" size={18} color="#000" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [handleBookPress, handlePlayBook]);

  // Render favorite author card
  const renderAuthorCard = useCallback((author: any) => {
    if (!author) return null;
    const bookCount = author.books?.length || 0;

    return (
      <TouchableOpacity
        key={author.name}
        style={styles.personCard}
        onPress={() => navigation.navigate('AuthorDetail', { name: author.name })}
        activeOpacity={0.7}
      >
        <View style={styles.personAvatar}>
          {author.imageUrl ? (
            <Image source={author.imageUrl} style={styles.personImage} contentFit="cover" />
          ) : (
            <Ionicons name="person" size={scale(24)} color={COLORS.textSecondary} />
          )}
        </View>
        <Text style={styles.personName} numberOfLines={1}>{author.name}</Text>
        <Text style={styles.personMeta}>{bookCount} book{bookCount !== 1 ? 's' : ''}</Text>
      </TouchableOpacity>
    );
  }, [navigation]);

  // Render favorite narrator card
  const renderNarratorCard = useCallback((narrator: any) => {
    if (!narrator) return null;
    const bookCount = narrator.books?.length || 0;

    return (
      <TouchableOpacity
        key={narrator.name}
        style={styles.personCard}
        onPress={() => navigation.navigate('NarratorDetail', { name: narrator.name })}
        activeOpacity={0.7}
      >
        <View style={styles.personAvatar}>
          <Ionicons name="mic" size={scale(24)} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.personName} numberOfLines={1}>{narrator.name}</Text>
        <Text style={styles.personMeta}>{bookCount} book{bookCount !== 1 ? 's' : ''}</Text>
      </TouchableOpacity>
    );
  }, [navigation]);

  // Render favorite series card - uses StackedCovers per design spec
  const renderFavoriteSeriesCard = useCallback((series: any) => {
    if (!series) return null;
    const bookCount = series.books?.length || 0;
    // Get cover URLs for stacked display (up to 3 books)
    const coverUrls = (series.books || []).slice(0, 3).map((book: any) =>
      apiClient.getItemCoverUrl(book.id)
    );

    return (
      <TouchableOpacity
        key={series.name}
        style={styles.favoriteSeriesCard}
        onPress={() => handleSeriesPress(series.name)}
        activeOpacity={0.7}
      >
        <View style={styles.seriesCoversContainer}>
          <StackedCovers
            coverUrls={coverUrls}
            size={40}
            offset={10}
            maxCovers={3}
          />
        </View>
        <View style={styles.favoriteSeriesInfo}>
          <Text style={styles.favoriteSeriesName} numberOfLines={1}>{series.name}</Text>
          <Text style={styles.favoriteSeriesMeta}>{bookCount} book{bookCount !== 1 ? 's' : ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={scale(16)} color={COLORS.textSecondary} />
      </TouchableOpacity>
    );
  }, [handleSeriesPress]);

  // Render series card
  const renderSeriesCard = useCallback((series: SeriesGroup) => {
    // Calculate time remaining for in-progress books
    const timeRemaining = series.books.reduce((total, book) => {
      if (book.progress > 0 && book.progress < 0.95) {
        return total + book.duration * (1 - book.progress);
      }
      return total;
    }, 0);

    // Get cover URLs for stacked display
    const coverUrls = series.books.slice(0, 3).map(book => apiClient.getItemCoverUrl(book.id));

    return (
      <TouchableOpacity
        key={series.name}
        style={styles.seriesCard}
        onPress={() => handleSeriesPress(series.name)}
        activeOpacity={0.8}
      >
        <View style={styles.seriesCoversContainer}>
          <StackedCovers
            coverUrls={coverUrls}
            size={40}
            offset={10}
            maxCovers={3}
          />
        </View>

        <View style={styles.seriesInfo}>
          <Text style={styles.seriesName} numberOfLines={1}>{series.name}</Text>
          <Text style={styles.seriesStats}>
            {series.downloadedCount} of {series.totalBooks} downloaded
          </Text>

          {/* Series Progress Badge */}
          <SeriesProgressBadge
            completed={series.completedCount}
            inProgress={series.inProgressCount}
            total={series.totalBooks}
            timeRemaining={timeRemaining}
          />
        </View>
      </TouchableOpacity>
    );
  }, [handleSeriesPress]);

  // Check if there's any content in the library (downloaded or favorited)
  const hasAnyContent = allLibraryBooks.length > 0 || activeDownloads.length > 0 ||
                        favoriteSeriesNames.length > 0 || favoriteAuthors.length > 0 ||
                        favoriteNarrators.length > 0;

  // Render Favorites tab content
  const renderFavoritesContent = () => {
    const hasFavoriteBooks = favoritedBooks.length > 0;
    const hasFavoriteAuthors = favoriteAuthorData.length > 0;
    const hasFavoriteSeries = favoriteSeriesData.length > 0;
    const hasFavoriteNarrators = favoriteNarratorData.length > 0;
    const hasAnyFavorites = hasFavoriteBooks || hasFavoriteAuthors || hasFavoriteSeries || hasFavoriteNarrators;

    if (!hasAnyFavorites) {
      return <LibraryEmptyState tab="favorites" onAction={handleBrowse} />;
    }

    return (
      <>
        {/* Favorite Books */}
        {hasFavoriteBooks && (
          <View style={styles.section}>
            <SectionHeader title={`Favorite Books (${favoritedBooks.length})`} showViewAll={false} />
            {favoritedBooks.map(book => renderBookRow(book))}
          </View>
        )}

        {/* Favorite Authors */}
        {hasFavoriteAuthors && (
          <View style={styles.section}>
            <SectionHeader title={`Favorite Authors (${favoriteAuthorData.length})`} showViewAll={false} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {favoriteAuthorData.map(author => renderAuthorCard(author))}
            </ScrollView>
          </View>
        )}

        {/* Favorite Series */}
        {hasFavoriteSeries && (
          <View style={styles.section}>
            <SectionHeader title={`Favorite Series (${favoriteSeriesData.length})`} showViewAll={false} />
            {favoriteSeriesData.map(series => renderFavoriteSeriesCard(series))}
          </View>
        )}

        {/* Favorite Narrators */}
        {hasFavoriteNarrators && (
          <View style={styles.section}>
            <SectionHeader title={`Favorite Narrators (${favoriteNarratorData.length})`} showViewAll={false} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {favoriteNarratorData.map(narrator => renderNarratorCard(narrator))}
            </ScrollView>
          </View>
        )}
      </>
    );
  };

  // Render In Progress tab content
  const renderInProgressContent = () => {
    const inProgressItems = enrichedBooks.filter(b => b.progress > 0 && b.progress < 0.95);

    if (inProgressItems.length === 0) {
      return <LibraryEmptyState tab="in-progress" onAction={handleBrowse} />;
    }

    // Sort by most recently played
    const sortedItems = [...inProgressItems].sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
    const heroItem = sortedItems[0];
    const otherItems = sortedItems.slice(1);

    return (
      <>
        {/* Hero Continue Listening Card */}
        {heroItem && (
          <View style={styles.heroSection}>
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => handleResumeBook(heroItem)}
              activeOpacity={0.9}
            >
              <Image
                source={apiClient.getItemCoverUrl(heroItem.id)}
                style={styles.heroCover}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.9)']}
                style={styles.heroGradient}
              />
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>Continue Listening</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{heroItem.title}</Text>
                <Text style={styles.heroAuthor}>{heroItem.author}</Text>
                <View style={styles.heroProgressContainer}>
                  <View style={styles.heroProgressBar}>
                    <View style={[styles.heroProgressFill, { width: `${Math.round(heroItem.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.heroProgressText}>
                    {formatTimeRemaining(heroItem.duration * (1 - heroItem.progress))}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.heroPlayButton}
                onPress={() => handleResumeBook(heroItem)}
              >
                <Ionicons name="play" size={scale(28)} color="#000" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* Other In Progress Items */}
        {otherItems.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={`More In Progress (${otherItems.length})`} showViewAll={false} />
            {otherItems.map(book => renderBookRow(book))}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Content */}
      {!hasAnyContent ? (
        <View style={[styles.emptyContainer, { paddingTop: insets.top + TOP_NAV_HEIGHT + 16 }]}>
          <LibraryEmptyState tab="all" onAction={handleBrowse} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + TOP_NAV_HEIGHT + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
            />
          }
        >
          {/* Screen Title */}
          <Text style={styles.screenTitle}>My Library</Text>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={scale(18)} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search library..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={scale(18)} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tab Bar */}
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />

          {/* Sort Picker (not shown on Favorites tab) */}
          {activeTab !== 'favorites' && activeTab !== 'in-progress' && (
            <SortPicker
              selected={sort}
              onSelect={setSort}
              bookCount={filteredBooks.length}
            />
          )}

          {/* =============== TAB CONTENT =============== */}
          {activeTab === 'favorites' ? (
            renderFavoritesContent()
          ) : activeTab === 'in-progress' ? (
            renderInProgressContent()
          ) : (
            <>
              {/* =============== CONTINUE LISTENING HERO (All tab) =============== */}
              {activeTab === 'all' && continueListeningItems.length > 0 && (() => {
                const heroItem = continueListeningItems[0];
                const progress = heroItem.userMediaProgress?.progress || 0;
                const duration = (heroItem.media as any)?.duration || 0;
                const remainingSeconds = duration * (1 - progress);

                // Only show if genuinely in progress (not complete)
                if (progress <= 0 || progress >= 0.95) return null;

                return (
                  <ContinueListeningHero
                    book={heroItem}
                    progress={progress}
                    remainingSeconds={remainingSeconds}
                    onPlay={async () => {
                      try {
                        const fullBook = await apiClient.getItem(heroItem.id);
                        await loadBook(fullBook, { autoPlay: true, showPlayer: false });
                      } catch {
                        await loadBook(heroItem, { autoPlay: true, showPlayer: false });
                      }
                    }}
                    onPress={() => handleBookPress(heroItem.id)}
                  />
                );
              })()}

              {/* =============== 1. DOWNLOADING SECTION =============== */}
              {activeDownloads.length > 0 && (activeTab === 'all' || activeTab === 'downloaded') && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderWithAction}>
                    <Text style={styles.sectionTitle}>
                      Downloading ({activeDownloads.length})
                    </Text>
                    {hasDownloading && (
                      <TouchableOpacity onPress={handlePauseAll}>
                        <Text style={styles.sectionAction}>Pause All</Text>
                      </TouchableOpacity>
                    )}
                    {!hasDownloading && hasPaused && (
                      <TouchableOpacity onPress={handleResumeAll}>
                        <Text style={styles.sectionAction}>Resume All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.downloadList}>
                    {activeDownloads.map((download) => (
                      <DownloadItem
                        key={download.itemId}
                        download={download}
                        onPause={() => pauseDownload(download.itemId)}
                        onResume={() => resumeDownload(download.itemId)}
                        onDelete={() => deleteDownload(download.itemId)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* =============== 2. BOOKS SECTION =============== */}
              {filteredBooks.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title={activeTab === 'downloaded'
                      ? `Downloaded Books (${filteredBooks.length})`
                      : `Books (${filteredBooks.length})`
                    }
                    showViewAll={false}
                  />
                  {filteredBooks.map(book => renderBookRow(book, activeTab === 'all'))}
                </View>
              )}

              {/* =============== 3. SERIES SECTION =============== */}
              {activeTab === 'all' && favoriteSeriesData.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title={`Series (${favoriteSeriesData.length})`}
                    showViewAll={false}
                  />
                  {favoriteSeriesData.map(series => renderFavoriteSeriesCard(series))}
                </View>
              )}
              {seriesGroups.length > 0 && activeTab === 'downloaded' && (
                <View style={styles.section}>
                  <SectionHeader
                    title={`Downloaded Series (${seriesGroups.length})`}
                    showViewAll={false}
                  />
                  {seriesGroups.map(renderSeriesCard)}
                </View>
              )}

              {/* =============== 4. AUTHORS SECTION (All tab) =============== */}
              {activeTab === 'all' && favoriteAuthorData.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title={`Authors (${favoriteAuthorData.length})`}
                    showViewAll={false}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                  >
                    {favoriteAuthorData.map(author => renderAuthorCard(author))}
                  </ScrollView>
                </View>
              )}

              {/* =============== 5. NARRATORS SECTION (All tab) =============== */}
              {activeTab === 'all' && favoriteNarratorData.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title={`Narrators (${favoriteNarratorData.length})`}
                    showViewAll={false}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                  >
                    {favoriteNarratorData.map(narrator => renderNarratorCard(narrator))}
                  </ScrollView>
                </View>
              )}

              {/* =============== STORAGE SUMMARY (Downloaded tab) =============== */}
              {activeTab === 'downloaded' && (
                <StorageSummary
                  usedBytes={totalStorageUsed}
                  bookCount={enrichedBooks.length}
                  onManagePress={handleManageStorage}
                />
              )}
            </>
          )}

          {/* =============== BROWSE CTA =============== */}
          <View style={styles.bottomCta}>
            <Text style={styles.bottomCtaText}>Looking for more?</Text>
            <TouchableOpacity style={styles.browseButtonOutline} onPress={handleBrowse}>
              <BrowseIcon size={18} color={COLORS.accent} />
              <Text style={styles.browseButtonOutlineText}>Browse Library</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  libraryButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 182, 12, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F4B60C',
  },
  libraryButtonTextActive: {
    color: '#F4B60C',
    fontSize: 10,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  libraryIcon: {
    width: 14,
    height: 16,
    position: 'relative',
  },
  libraryIconBack: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 10,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(244, 182, 12, 0.5)',
    backgroundColor: 'transparent',
  },
  libraryIconFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#F4B60C',
    backgroundColor: 'rgba(244, 182, 12, 0.1)',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },

  // Screen title
  screenTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },

  // Search bar
  searchBarContainer: {
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    gap: scale(10),
    minHeight: scale(44),
  },
  searchInput: {
    flex: 1,
    fontSize: scale(15),
    color: COLORS.textPrimary,
    paddingVertical: scale(4),
  },

  // Tab bar
  tabBarContainer: {
    marginBottom: scale(16),
  },
  tabBar: {
    paddingHorizontal: scale(20),
    gap: scale(8),
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: scale(6),
  },
  tabActive: {
    backgroundColor: 'rgba(244, 182, 12, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 182, 12, 0.3)',
  },
  tabText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(244, 182, 12, 0.2)',
  },
  tabBadgeText: {
    fontSize: scale(10),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabBadgeTextActive: {
    color: COLORS.accent,
  },

  // Sections
  section: {
    marginBottom: scale(24),
  },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sectionAction: {
    fontSize: scale(14),
    fontWeight: '500',
    color: COLORS.accent,
  },

  // Horizontal sections
  horizontalSection: {
    marginBottom: scale(24),
  },
  horizontalList: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },

  // Horizontal cards
  horizontalCard: {
    width: HORIZONTAL_CARD_WIDTH,
  },
  horizontalCardCoverContainer: {
    width: HORIZONTAL_CARD_COVER,
    height: HORIZONTAL_CARD_COVER,
    borderRadius: scale(10),
    overflow: 'hidden',
    marginBottom: scale(8),
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  horizontalCardCover: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  horizontalCardProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  horizontalCardProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  cardProgressText: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    fontSize: scale(11),
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  horizontalCardTitle: {
    fontSize: scale(12),
    fontWeight: '500',
    color: '#fff',
    lineHeight: scale(16),
  },
  horizontalCardSubtitle: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // Download list
  downloadList: {
    paddingHorizontal: scale(16),
  },

  // Book row
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    gap: scale(12),
  },
  bookCoverContainer: {
    position: 'relative',
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  bookCover: {
    width: '100%',
    height: '100%',
    borderRadius: scale(8),
  },
  statusBadge: {
    position: 'absolute',
    bottom: scale(4),
    right: scale(4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedBadge: {
    backgroundColor: COLORS.accent,
  },
  streamBadge: {
    backgroundColor: 'rgba(100, 150, 255, 0.9)',
  },
  completedBadge: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: scale(15),
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  bookAuthor: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
    marginTop: scale(2),
  },
  bookMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: scale(4),
  },
  bookMeta: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
  },
  bookProgress: {
    fontSize: scale(12),
    color: COLORS.accent,
    fontWeight: '500',
  },
  playButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Series card
  seriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scale(20),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: COLORS.cardBg,
    borderRadius: scale(12),
    gap: scale(12),
  },
  seriesCoversContainer: {
    width: scale(70),
    height: scale(70),
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesInfo: {
    flex: 1,
  },
  seriesName: {
    fontSize: scale(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: scale(4),
  },
  seriesStats: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginBottom: scale(6),
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(24),
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(24),
    gap: scale(8),
  },
  browseButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#000000',
  },

  // Bottom CTA
  bottomCta: {
    alignItems: 'center',
    paddingVertical: scale(32),
    paddingHorizontal: scale(20),
  },
  bottomCtaText: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
    marginBottom: scale(12),
  },
  browseButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: scale(20),
    gap: scale(8),
  },
  browseButtonOutlineText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: COLORS.accent,
  },

  // Empty tab state
  emptyTabContainer: {
    alignItems: 'center',
    paddingVertical: scale(60),
    paddingHorizontal: scale(40),
  },
  emptyTabTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptyTabSubtitle: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: scale(20),
  },

  // Hero section (In Progress tab)
  heroSection: {
    paddingHorizontal: scale(20),
    marginBottom: scale(24),
  },
  heroCard: {
    width: '100%',
    height: scale(200),
    borderRadius: scale(16),
    overflow: 'hidden',
    backgroundColor: COLORS.cardBg,
  },
  heroCover: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  heroContent: {
    position: 'absolute',
    left: scale(16),
    bottom: scale(16),
    right: scale(70),
  },
  heroLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginBottom: scale(4),
  },
  heroTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: scale(2),
  },
  heroAuthor: {
    fontSize: scale(13),
    color: COLORS.textSecondary,
    marginBottom: scale(8),
  },
  heroProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  heroProgressBar: {
    flex: 1,
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: scale(2),
  },
  heroProgressText: {
    fontSize: scale(11),
    color: COLORS.textSecondary,
  },
  heroPlayButton: {
    position: 'absolute',
    right: scale(16),
    bottom: scale(16),
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Person cards (authors, narrators)
  personCard: {
    width: scale(90),
    alignItems: 'center',
  },
  personAvatar: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(8),
    overflow: 'hidden',
  },
  personImage: {
    width: '100%',
    height: '100%',
  },
  personName: {
    fontSize: scale(12),
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  personMeta: {
    fontSize: scale(10),
    color: COLORS.textSecondary,
    marginTop: scale(2),
  },

  // Favorite series card
  favoriteSeriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scale(20),
    marginBottom: scale(10),
    padding: scale(12),
    backgroundColor: COLORS.cardBg,
    borderRadius: scale(12),
    gap: scale(12),
  },
  seriesImageContainer: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  seriesImage: {
    width: '100%',
    height: '100%',
  },
  favoriteSeriesInfo: {
    flex: 1,
  },
  favoriteSeriesName: {
    fontSize: scale(14),
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  favoriteSeriesMeta: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginTop: scale(2),
  },
});

export default MyLibraryScreen;
