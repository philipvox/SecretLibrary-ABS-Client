/**
 * src/features/browse/screens/BrowseScreen.tsx
 *
 * Discover screen - Browse the full server library (Audible-style)
 * - Grid view of all books from server
 * - Filter by Genre, Author, Series
 * - Download status indicators
 * - Tap to view book details and download
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '@/core/api';
import { useLibraryCache, getAllGenres, getAllAuthors, getAllSeries } from '@/core/cache';
import { autoDownloadService, DownloadStatus } from '@/features/downloads/services/autoDownloadService';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner } from '@/shared/components';
import { LibraryItem } from '@/core/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BG_COLOR = '#000000';
const CARD_COLOR = '#1a1a1a';
const ACCENT = '#C8FF00';

// Grid constants
const PADDING = 16;
const GAP = 10;
const NUM_COLUMNS = 3;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const COVER_HEIGHT = CARD_WIDTH * 1.0; // Square covers

type SortOption = 'title' | 'author' | 'recent' | 'duration';
type FilterType = 'all' | 'genre' | 'author' | 'series';

interface FilterState {
  type: FilterType;
  value: string | null;
}

// Book card with download indicator
const BookCard = React.memo(function BookCard({
  book,
  downloadStatus,
  downloadProgress,
  onPress,
}: {
  book: LibraryItem;
  downloadStatus: DownloadStatus;
  downloadProgress: number;
  onPress: () => void;
}) {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const metadata = (book.media?.metadata as any) || {};
  const title = metadata.title || 'Untitled';

  return (
    <TouchableOpacity style={styles.bookCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.coverContainer}>
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />

        {/* Download status overlay */}
        {downloadStatus === 'completed' && (
          <View style={styles.downloadedBadge}>
            <Icon name="checkmark-circle" size={16} color={ACCENT} set="ionicons" />
          </View>
        )}
        {downloadStatus === 'downloading' && (
          <View style={styles.downloadingOverlay}>
            <View style={styles.progressRing}>
              <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
            </View>
          </View>
        )}
        {downloadStatus === 'queued' && (
          <View style={styles.queuedBadge}>
            <Icon name="time-outline" size={14} color="#FFF" set="ionicons" />
          </View>
        )}
      </View>
      <Text style={styles.bookTitle} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );
});

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Library data from cache
  const { items: libraryItems, isLoaded, isLoading, refreshCache } = useLibraryCache();

  // Filter data
  const allGenres = useMemo(() => getAllGenres(), [isLoaded]);
  const allAuthors = useMemo(() => getAllAuthors(), [isLoaded]);
  const allSeries = useMemo(() => getAllSeries(), [isLoaded]);

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filter, setFilter] = useState<FilterState>({ type: 'all', value: null });
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Download status tracking
  const [downloadStatuses, setDownloadStatuses] = useState<Map<string, DownloadStatus>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());

  // Subscribe to download status changes
  useEffect(() => {
    const unsubStatus = autoDownloadService.onStatus((bookId, status) => {
      setDownloadStatuses(prev => new Map(prev).set(bookId, status));
    });

    const unsubProgress = autoDownloadService.onProgress((bookId, progress) => {
      setDownloadProgress(prev => new Map(prev).set(bookId, progress));
    });

    return () => {
      unsubStatus();
      unsubProgress();
    };
  }, []);

  // Filter and sort books
  const displayedBooks = useMemo(() => {
    if (!isLoaded || !libraryItems.length) return [];

    let filtered = [...libraryItems];

    // Apply filter
    if (filter.type !== 'all' && filter.value) {
      filtered = filtered.filter(book => {
        const metadata = (book.media?.metadata as any) || {};

        if (filter.type === 'genre') {
          const genres: string[] = metadata.genres || [];
          return genres.some(g => g.toLowerCase() === filter.value?.toLowerCase());
        }

        if (filter.type === 'author') {
          const author = metadata.authorName || '';
          return author.toLowerCase().includes(filter.value?.toLowerCase() || '');
        }

        if (filter.type === 'series') {
          const seriesInfo = metadata.series || [];
          return seriesInfo.some((s: any) =>
            (typeof s === 'object' ? s.name : s)?.toLowerCase() === filter.value?.toLowerCase()
          );
        }

        return true;
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      const metaA = (a.media?.metadata as any) || {};
      const metaB = (b.media?.metadata as any) || {};

      switch (sortBy) {
        case 'title':
          return (metaA.title || '').localeCompare(metaB.title || '');
        case 'author':
          return (metaA.authorName || '').localeCompare(metaB.authorName || '');
        case 'duration':
          return (b.media?.duration || 0) - (a.media?.duration || 0);
        case 'recent':
        default:
          return (b.addedAt || 0) - (a.addedAt || 0);
      }
    });

    return filtered;
  }, [libraryItems, isLoaded, filter, sortBy]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  // Handle book press - navigate to book detail page
  const handleBookPress = useCallback((book: LibraryItem) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // Navigate to search
  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  // Clear filter
  const handleClearFilter = useCallback(() => {
    setFilter({ type: 'all', value: null });
  }, []);

  // Apply filter
  const applyFilter = useCallback((type: FilterType, value: string) => {
    setFilter({ type, value });
    setShowFilterPanel(false);
  }, []);

  if (isLoading || !isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <LoadingSpinner text="Loading library..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, showFilterPanel && styles.headerButtonActive]}
            onPress={() => setShowFilterPanel(!showFilterPanel)}
          >
            <Icon name="filter" size={20} color={showFilterPanel ? '#000' : '#FFF'} set="ionicons" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleSearchPress}>
            <Icon name="search" size={20} color="#FFF" set="ionicons" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Panel */}
      {showFilterPanel && (
        <View style={styles.filterPanel}>
          {/* Sort options */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Sort by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['recent', 'title', 'author', 'duration'] as SortOption[]).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterChip, sortBy === option && styles.filterChipActive]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[styles.filterChipText, sortBy === option && styles.filterChipTextActive]}>
                    {option === 'recent' ? 'Recently Added' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Quick filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Filter by</Text>
            <View style={styles.filterGrid}>
              <TouchableOpacity
                style={styles.filterGridItem}
                onPress={() => navigation.navigate('GenresList')}
              >
                <Icon name="albums-outline" size={24} color={ACCENT} set="ionicons" />
                <Text style={styles.filterGridText}>Genres</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterGridItem}
                onPress={() => navigation.navigate('AuthorsList')}
              >
                <Icon name="person-outline" size={24} color={ACCENT} set="ionicons" />
                <Text style={styles.filterGridText}>Authors</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterGridItem}
                onPress={() => navigation.navigate('SeriesList')}
              >
                <Icon name="library-outline" size={24} color={ACCENT} set="ionicons" />
                <Text style={styles.filterGridText}>Series</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterGridItem}
                onPress={() => navigation.navigate('NarratorList')}
              >
                <Icon name="mic-outline" size={24} color={ACCENT} set="ionicons" />
                <Text style={styles.filterGridText}>Narrators</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Active filter indicator */}
      {filter.type !== 'all' && filter.value && (
        <View style={styles.activeFilter}>
          <Text style={styles.activeFilterText}>
            {filter.type}: {filter.value}
          </Text>
          <TouchableOpacity onPress={handleClearFilter} style={styles.clearFilterButton}>
            <Icon name="close-circle" size={18} color="#FFF" set="ionicons" />
          </TouchableOpacity>
        </View>
      )}

      {/* Book count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {displayedBooks.length} {displayedBooks.length === 1 ? 'book' : 'books'}
        </Text>
      </View>

      {/* Books Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.grid, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
      >
        {displayedBooks.map(book => (
          <BookCard
            key={book.id}
            book={book}
            downloadStatus={downloadStatuses.get(book.id) || autoDownloadService.getStatus(book.id)}
            downloadProgress={downloadProgress.get(book.id) || 0}
            onPress={() => handleBookPress(book)}
          />
        ))}

        {displayedBooks.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="library-outline" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
            <Text style={styles.emptyTitle}>No books found</Text>
            <Text style={styles.emptySubtitle}>
              {filter.type !== 'all'
                ? 'Try changing your filter'
                : 'Your server library is empty'}
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
    backgroundColor: BG_COLOR,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonActive: {
    backgroundColor: ACCENT,
  },

  // Filter Panel
  filterPanel: {
    backgroundColor: CARD_COLOR,
    paddingHorizontal: PADDING,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: ACCENT,
  },
  filterChipText: {
    fontSize: 14,
    color: '#FFF',
  },
  filterChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  filterGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  filterGridItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 6,
  },
  filterGridText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  // Active filter
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200,255,0,0.15)',
    paddingHorizontal: PADDING,
    paddingVertical: 10,
  },
  activeFilterText: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '500',
  },
  clearFilterButton: {
    padding: 4,
  },

  // Count bar
  countBar: {
    paddingHorizontal: PADDING,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },

  // Grid
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PADDING,
    gap: GAP,
  },

  // Book card
  bookCard: {
    width: CARD_WIDTH,
    marginBottom: 8,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#262626',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  bookTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
    marginTop: 6,
    lineHeight: 14,
  },

  // Download indicators
  downloadedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(200,255,0,0.2)',
    borderWidth: 3,
    borderColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },
  queuedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
  },

  // Empty state
  emptyState: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
