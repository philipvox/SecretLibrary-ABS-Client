/**
 * src/features/series/screens/SeriesDetailScreen.tsx
 *
 * Enhanced series detail screen with progress tracking, batch downloads,
 * and per-book status indicators.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { SeriesHeartButton } from '@/shared/components';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';

import { SeriesProgressHeader } from '../components/SeriesProgressHeader';
import { BatchActionButtons } from '../components/BatchActionButtons';
import { SeriesBookRow } from '../components/SeriesBookRow';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, wp, hp, spacing, radius } from '@/shared/theme';

type SeriesDetailRouteParams = {
  SeriesDetail: { seriesName: string };
};

const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);

const BG_COLOR = colors.backgroundPrimary;
const CARD_COLOR = colors.backgroundTertiary;
const ACCENT = colors.accent;
const CARD_RADIUS = radius.sm;

// Stacked covers constants
const STACK_COVER_SIZE = SCREEN_WIDTH * 0.35;
const STACK_OFFSET = 12;
const STACK_ROTATION = 6;

type SortType = 'asc' | 'desc';

// Get sequence from book metadata - returns null if unknown
function getSequence(item: LibraryItem): number | null {
  const metadata = (item.media?.metadata as any) || {};

  // First check series array (preferred - has explicit sequence)
  if (metadata.series?.length > 0) {
    const primarySeries = metadata.series[0];
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  // Fallback: check seriesName for #N pattern
  const seriesName = metadata.seriesName || '';
  const match = seriesName.match(/#([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }

  // Fallback: check title for "Book N" pattern
  const titleMatch = (metadata.title || '').match(/Book\s*(\d+)/i);
  if (titleMatch) {
    return parseInt(titleMatch[1], 10);
  }

  // No sequence found
  return null;
}

// Get sequence for sorting (returns 999 for unknown to sort at end)
function getSequenceForSort(item: LibraryItem): number {
  return getSequence(item) ?? 999;
}

// Stacked book covers component - memoized to prevent flashing
const StackedCovers = React.memo(function StackedCovers({ bookIds }: { bookIds: string[] }) {
  const stackBooks = useMemo(() => bookIds.slice(0, Math.min(3, bookIds.length)), [bookIds]);
  const count = stackBooks.length;

  // Memoize cover URLs to prevent re-fetching
  const coverUrls = useMemo(() =>
    stackBooks.map(id => apiClient.getItemCoverUrl(id)),
    [stackBooks]
  );

  if (count === 0) {
    return (
      <View style={stackStyles.container}>
        <View style={[stackStyles.cover, stackStyles.placeholder]}>
          <Text style={stackStyles.placeholderText}>📚</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={stackStyles.container}>
      {stackBooks.map((bookId, index) => {
        const reverseIndex = count - 1 - index;
        const rotation = (reverseIndex - Math.floor(count / 2)) * STACK_ROTATION;
        const translateX = (reverseIndex - Math.floor(count / 2)) * STACK_OFFSET;
        const zIndex = count - reverseIndex;

        return (
          <View
            key={bookId}
            style={[
              stackStyles.coverWrapper,
              {
                zIndex,
                transform: [{ translateX }, { rotate: `${rotation}deg` }],
              },
            ]}
          >
            <Image
              source={coverUrls[index]}
              style={stackStyles.cover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
        );
      })}
    </View>
  );
});

const stackStyles = StyleSheet.create({
  container: {
    width: STACK_COVER_SIZE + STACK_OFFSET * 4,
    height: STACK_COVER_SIZE * 1.1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  coverWrapper: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cover: {
    width: STACK_COVER_SIZE,
    height: STACK_COVER_SIZE,
    borderRadius: CARD_RADIUS,
    backgroundColor: CARD_COLOR,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
  },
});

// Background component
function SeriesBackground({ coverUrl }: { coverUrl: string | null }) {
  if (!coverUrl) {
    return (
      <View style={bgStyles.container}>
        <View style={bgStyles.baseColor} />
      </View>
    );
  }

  return (
    <View style={bgStyles.container}>
      <View style={bgStyles.baseColor} />
      <View style={bgStyles.imageContainer}>
        <Image
          source={coverUrl}
          style={bgStyles.image}
          contentFit="cover"
          blurRadius={25}
        />
        <BlurView intensity={40} style={bgStyles.blur} tint="dark" />
        <View style={bgStyles.brightnessOverlay} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', BG_COLOR]}
          locations={[0, 0.5, 1]}
          style={bgStyles.fadeGradient}
        />
      </View>
    </View>
  );
}

const bgStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  baseColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_COLOR,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
    transform: [{ scale: 1.2 }],
    opacity: 0.7,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  fadeGradient: {
    ...StyleSheet.absoluteFillObject,
  },
});

export function SeriesDetailScreen() {
  const route = useRoute<RouteProp<SeriesDetailRouteParams, 'SeriesDetail'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { seriesName } = route.params;

  const [sortOrder, setSortOrder] = useState<SortType>('asc');
  const [showDownloadedOnly, setShowDownloadedOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, boolean>>({});

  const { getSeries, isLoaded, refreshCache } = useLibraryCache();
  const { downloads } = useDownloads();
  const currentBookId = usePlayerStore((s) => s.currentBook?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const { loadBook } = usePlayerStore();

  // Get series data from cache
  const seriesInfo = useMemo(() => {
    if (!isLoaded || !seriesName) return null;
    return getSeries(seriesName);
  }, [isLoaded, seriesName, getSeries]);

  // Sort books by sequence
  const sortedBooks = useMemo(() => {
    if (!seriesInfo?.books) return [];
    const sorted = [...seriesInfo.books];
    sorted.sort((a, b) => {
      const seqA = getSequenceForSort(a);
      const seqB = getSequenceForSort(b);
      return sortOrder === 'asc' ? seqA - seqB : seqB - seqA;
    });
    return sorted;
  }, [seriesInfo?.books, sortOrder]);

  // Get download statuses for all books
  useEffect(() => {
    const checkStatuses = async () => {
      const statuses: Record<string, boolean> = {};
      for (const book of sortedBooks) {
        const status = await downloadManager.getDownloadStatus(book.id);
        statuses[book.id] = status?.status === 'complete';
      }
      setDownloadStatuses(statuses);
    };
    if (sortedBooks.length > 0) {
      checkStatuses();
    }
  }, [sortedBooks, downloads]);

  // Filter books if showing downloaded only
  const displayedBooks = useMemo(() => {
    if (!showDownloadedOnly) return sortedBooks;
    return sortedBooks.filter(book => downloadStatuses[book.id]);
  }, [sortedBooks, showDownloadedOnly, downloadStatuses]);

  // Calculate progress stats
  const progressStats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let inProgressBook: LibraryItem | null = null;
    let inProgressPercent = 0;

    sortedBooks.forEach(book => {
      const progress = (book as any).userMediaProgress?.progress || 0;
      if (progress >= 0.95) {
        completed++;
      } else if (progress > 0) {
        inProgress++;
        if (!inProgressBook) {
          inProgressBook = book;
          inProgressPercent = Math.round(progress * 100);
        }
      }
    });

    return { completed, inProgress, inProgressBook, inProgressPercent };
  }, [sortedBooks]);

  // Find next book to listen to
  const nextBook = useMemo(() => {
    return sortedBooks.find(book => {
      const progress = (book as any).userMediaProgress?.progress || 0;
      return progress < 0.95;
    }) || null;
  }, [sortedBooks]);

  // Find up next book (for highlighting - first incomplete that isn't currently playing)
  const upNextBook = useMemo(() => {
    return sortedBooks.find(book => {
      const progress = (book as any).userMediaProgress?.progress || 0;
      return progress < 0.95 && book.id !== currentBookId;
    }) || null;
  }, [sortedBooks, currentBookId]);

  // Get books to download (not downloaded, in sequence order)
  const booksToDownload = useMemo(() => {
    return sortedBooks.filter(book => !downloadStatuses[book.id]);
  }, [sortedBooks, downloadStatuses]);

  // Check if all downloaded
  const allDownloaded = booksToDownload.length === 0;

  // Check if series is complete
  const seriesComplete = progressStats.completed === sortedBooks.length;

  // Check if next book is downloaded
  const nextBookDownloaded = nextBook ? downloadStatuses[nextBook.id] || false : false;

  // Auto-scroll to current or next book
  useEffect(() => {
    if (displayedBooks.length === 0) return;

    const targetBook = currentBookId
      ? displayedBooks.find(b => b.id === currentBookId)
      : upNextBook;

    if (targetBook) {
      const index = displayedBooks.findIndex(b => b.id === targetBook.id);
      if (index > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.3,
          });
        }, 300);
      }
    }
  }, [displayedBooks, currentBookId, upNextBook]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main' as never);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleContinueSeries = useCallback(async () => {
    if (!nextBook) return;
    await loadBook(nextBook, { autoPlay: true, showPlayer: true });
  }, [nextBook, loadBook]);

  // Loading/error states
  if (!isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!seriesInfo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Series</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTitle}>Series not found</Text>
          <Text style={styles.emptySubtitle}>This series may have been removed</Text>
        </View>
      </View>
    );
  }

  const bookIds = sortedBooks.map(b => b.id);
  const firstBookCoverUrl = bookIds[0] ? apiClient.getItemCoverUrl(bookIds[0]) : null;

  // Calculate total duration
  const totalDuration = sortedBooks.reduce((sum, book) => sum + ((book.media as any)?.duration || 0), 0);
  const formatTotalDuration = () => {
    const hours = Math.floor(totalDuration / 3600);
    return `${hours}h`;
  };

  const renderBookItem = ({ item, index }: { item: LibraryItem; index: number }) => {
    const isNowPlaying = item.id === currentBookId;
    const isUpNext = item.id === upNextBook?.id && !isNowPlaying;
    const seq = getSequence(item);

    return (
      <SeriesBookRow
        book={item}
        sequenceNumber={seq}
        isNowPlaying={isNowPlaying}
        isUpNext={isUpNext}
        onPress={() => handleBookPress(item.id)}
      />
    );
  };

  const ListHeader = () => (
    <>
      {/* Series Info with Stacked Covers */}
      <View style={styles.seriesHeader}>
        <StackedCovers bookIds={bookIds} />
        <View style={styles.seriesNameRow}>
          <Text style={styles.seriesName}>{seriesInfo.name}</Text>
          <SeriesHeartButton seriesName={seriesInfo.name} size={24} />
        </View>
        <Text style={styles.bookCount}>
          {seriesInfo.bookCount} {seriesInfo.bookCount === 1 ? 'book' : 'books'} · {formatTotalDuration()}
        </Text>
      </View>

      {/* Progress Header */}
      <SeriesProgressHeader
        books={sortedBooks}
        completedCount={progressStats.completed}
        inProgressCount={progressStats.inProgress}
        nextBook={nextBook}
        currentBook={progressStats.inProgressBook}
        onNextBookPress={(book) => handleBookPress(book.id)}
        onPlayPress={async (book) => {
          await loadBook(book, { autoPlay: true, showPlayer: true });
        }}
      />

      {/* Batch Action Buttons */}
      <BatchActionButtons
        booksToDownload={booksToDownload}
        nextBook={nextBook}
        nextBookDownloaded={nextBookDownloaded}
        allDownloaded={allDownloaded}
        seriesComplete={seriesComplete}
        totalBooks={sortedBooks.length}
        inProgressBook={progressStats.inProgressBook}
        inProgressPercent={progressStats.inProgressPercent}
        onContinue={handleContinueSeries}
      />

      {/* Sort Row with Filter Toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.sectionTitle}>
          Books{showDownloadedOnly ? ` (${displayedBooks.length})` : ''}
        </Text>
        <View style={styles.sortControls}>
          {/* Downloaded Only Toggle */}
          <TouchableOpacity
            style={[
              styles.filterToggle,
              showDownloadedOnly && styles.filterToggleActive,
            ]}
            onPress={() => setShowDownloadedOnly(!showDownloadedOnly)}
          >
            <Ionicons
              name={showDownloadedOnly ? 'checkmark-circle' : 'download-outline'}
              size={scale(14)}
              color={showDownloadedOnly ? '#000' : 'rgba(255,255,255,0.6)'}
            />
            <Text style={[
              styles.filterToggleText,
              showDownloadedOnly && styles.filterToggleTextActive,
            ]}>
              Downloaded
            </Text>
          </TouchableOpacity>

          {/* Sort Toggle */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            <Ionicons
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color="#000"
            />
            <Text style={styles.sortButtonText}>
              {sortOrder === 'asc' ? `1→${sortedBooks.length}` : `${sortedBooks.length}→1`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const ListEmpty = () => (
    <View style={styles.emptyListContainer}>
      <Ionicons name="cloud-download-outline" size={scale(40)} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyListTitle}>No downloaded books</Text>
      <Text style={styles.emptyListSubtitle}>
        Download books to see them here when filtering
      </Text>
      <TouchableOpacity
        style={styles.downloadFirstButton}
        onPress={() => {
          if (sortedBooks[0]) {
            downloadManager.queueDownload(sortedBooks[0]);
          }
        }}
      >
        <Ionicons name="download" size={scale(16)} color="#000" />
        <Text style={styles.downloadFirstButtonText}>Download First Book</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Blurred background */}
      <SeriesBackground coverUrl={firstBookCoverUrl} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT + 10 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Series</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Book List */}
      <FlatList
        ref={flatListRef}
        data={displayedBooks}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={showDownloadedOnly ? ListEmpty : null}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={10}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
            progressViewOffset={20}
          />
        }
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
            });
          }, 100);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  seriesHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  seriesNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  seriesName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bookCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterToggleActive: {
    backgroundColor: ACCENT,
  },
  filterToggleText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  filterToggleTextActive: {
    color: '#000',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
  },
  emptyListContainer: {
    alignItems: 'center',
    paddingVertical: scale(40),
    paddingHorizontal: scale(20),
  },
  emptyListTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#fff',
    marginTop: scale(12),
  },
  emptyListSubtitle: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(4),
    textAlign: 'center',
  },
  downloadFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: scale(20),
    paddingHorizontal: scale(20),
    paddingVertical: scale(12),
    backgroundColor: ACCENT,
    borderRadius: scale(10),
  },
  downloadFirstButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000',
  },
});
