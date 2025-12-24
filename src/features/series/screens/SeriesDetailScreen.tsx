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
import {
  ChevronLeft,
  BookOpen,
  CheckCircle,
  Download,
  ArrowUp,
  ArrowDown,
  CloudDownload,
  Bell,
  BellOff,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { SeriesHeartButton } from '@/shared/components';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useWishlistStore, useIsSeriesTracked } from '@/features/wishlist';
import { useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';

import { SeriesProgressHeader } from '../components/SeriesProgressHeader';
import { BatchActionButtons } from '../components/BatchActionButtons';
import { SeriesBookRow } from '../components/SeriesBookRow';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, wp, hp, spacing, radius } from '@/shared/theme';
import { useRenderTracker, useLifecycleTracker } from '@/utils/perfDebug';

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

// Get raw sequence from book metadata - returns null if unknown
function getRawSequence(item: LibraryItem): number | null {
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

// Get publication date for sorting (timestamp or 0)
function getPublishDate(item: LibraryItem): number {
  const metadata = (item.media?.metadata as any) || {};
  // Try publishedDate first (format: YYYY-MM-DD or similar)
  if (metadata.publishedDate) {
    const date = new Date(metadata.publishedDate);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  // Try publishedYear
  if (metadata.publishedYear) {
    return new Date(metadata.publishedYear, 0, 1).getTime();
  }
  return 0;
}

// Get title for sorting
function getTitle(item: LibraryItem): string {
  const metadata = (item.media?.metadata as any) || {};
  return (metadata.title || '').toLowerCase();
}

// Check if a series has meaningful sequence numbers
// Returns false if all books have the same sequence (likely server default)
function hasRealSequences(books: LibraryItem[]): boolean {
  if (books.length <= 1) return true; // Single book, show sequence if present

  const sequences = books.map(getRawSequence).filter(s => s !== null);
  if (sequences.length === 0) return false; // No sequences at all

  // If all sequences are the same (e.g., all "1"), it's not a real sequence
  const uniqueSequences = new Set(sequences);
  return uniqueSequences.size > 1;
}

// Get sequence for display - returns null if this book shouldn't show a sequence
// (Uses series context to detect fake sequences)
function getSequenceForDisplay(item: LibraryItem, allBooks: LibraryItem[]): number | null {
  if (!hasRealSequences(allBooks)) {
    return null; // Don't show sequence if all books have the same one
  }
  return getRawSequence(item);
}

// Get sequence for sorting
// - If real sequences exist: use sequence number, unknowns sort to end
// - If no real sequences: sort by publication date, then title
function getSequenceForSort(item: LibraryItem, allBooks: LibraryItem[]): { primary: number; secondary: number; tertiary: string } {
  const hasReal = hasRealSequences(allBooks);

  if (hasReal) {
    // Real sequences: sort by sequence number, unknowns go to end (999)
    const seq = getRawSequence(item) ?? 999;
    return { primary: seq, secondary: 0, tertiary: '' };
  } else {
    // No real sequences: sort by publication date, then title
    const pubDate = getPublishDate(item);
    const title = getTitle(item);
    // Use 0 as primary to group all non-sequenced books together
    // Secondary is publication date (negative so earlier dates come first)
    // Tertiary is title for alphabetical fallback
    return { primary: 0, secondary: pubDate, tertiary: title };
  }
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
  // Performance tracking (dev only)
  if (__DEV__) {
    useRenderTracker('SeriesDetailScreen');
    useLifecycleTracker('SeriesDetailScreen');
  }

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

  // Track series functionality
  const isTracking = useIsSeriesTracked(seriesName);
  const { trackSeries, untrackSeries } = useWishlistStore();

  const handleTrackToggle = useCallback(() => {
    if (isTracking) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      untrackSeries(seriesName);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackSeries(seriesName);
    }
  }, [isTracking, seriesName, trackSeries, untrackSeries]);

  // Get series data from cache
  const seriesInfo = useMemo(() => {
    if (!isLoaded || !seriesName) return null;
    return getSeries(seriesName);
  }, [isLoaded, seriesName, getSeries]);

  // Sort books by sequence (or by publication date/title if no real sequences)
  const sortedBooks = useMemo(() => {
    if (!seriesInfo?.books) return [];
    const allBooks = seriesInfo.books;
    const sorted = [...allBooks];
    sorted.sort((a, b) => {
      const sortA = getSequenceForSort(a, allBooks);
      const sortB = getSequenceForSort(b, allBooks);

      // Primary sort (sequence or group)
      const primaryDiff = sortOrder === 'asc'
        ? sortA.primary - sortB.primary
        : sortB.primary - sortA.primary;
      if (primaryDiff !== 0) return primaryDiff;

      // Secondary sort (publication date)
      const secondaryDiff = sortOrder === 'asc'
        ? sortA.secondary - sortB.secondary
        : sortB.secondary - sortA.secondary;
      if (secondaryDiff !== 0) return secondaryDiff;

      // Tertiary sort (title, alphabetical)
      return sortOrder === 'asc'
        ? sortA.tertiary.localeCompare(sortB.tertiary)
        : sortB.tertiary.localeCompare(sortA.tertiary);
    });
    return sorted;
  }, [seriesInfo?.books, sortOrder]);

  // Check if series has real sequences (for display purposes)
  const seriesHasRealSequences = useMemo(() => {
    if (!seriesInfo?.books) return true;
    return hasRealSequences(seriesInfo.books);
  }, [seriesInfo?.books]);

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
            <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Series</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Series not found</Text>
          <Text style={styles.emptySubtitle}>This series may have been removed</Text>
        </View>
      </View>
    );
  }

  // Memoize bookIds to prevent re-creating array on every render
  const bookIds = useMemo(() => sortedBooks.map(b => b.id), [sortedBooks]);

  // Memoize cover URL to prevent background image flickering
  const firstBookCoverUrl = useMemo(
    () => bookIds[0] ? apiClient.getItemCoverUrl(bookIds[0]) : null,
    [bookIds]
  );

  // Calculate total duration
  const totalDuration = sortedBooks.reduce((sum, book) => sum + ((book.media as any)?.duration || 0), 0);
  const formatTotalDuration = () => {
    const hours = Math.floor(totalDuration / 3600);
    return `${hours}h`;
  };

  // Memoized render function for book items to prevent flickering
  const renderBookItem = useCallback(({ item, index }: { item: LibraryItem; index: number }) => {
    const isNowPlaying = item.id === currentBookId;
    const isUpNext = item.id === upNextBook?.id && !isNowPlaying;
    // Use getSequenceForDisplay to hide sequence if all books have the same one
    const seq = getSequenceForDisplay(item, sortedBooks);

    return (
      <SeriesBookRow
        book={item}
        sequenceNumber={seq}
        isNowPlaying={isNowPlaying}
        isUpNext={isUpNext}
        onPress={() => handleBookPress(item.id)}
      />
    );
  }, [currentBookId, upNextBook?.id, sortedBooks, handleBookPress]);

  // Memoized header component to prevent flickering
  const ListHeader = useMemo(() => (
    <>
      {/* Series Info with Stacked Covers */}
      <View style={styles.seriesHeader}>
        <StackedCovers bookIds={bookIds} />
        <View style={styles.seriesNameRow}>
          <Text style={styles.seriesName}>{seriesInfo.name}</Text>
          <SeriesHeartButton seriesName={seriesInfo.name} size={24} />
        </View>

        {/* Track Button */}
        <TouchableOpacity
          style={[
            styles.trackButton,
            isTracking && styles.trackButtonActive
          ]}
          onPress={handleTrackToggle}
          activeOpacity={0.7}
        >
          {isTracking ? (
            <BellOff size={scale(16)} color="#000" strokeWidth={2} />
          ) : (
            <Bell size={scale(16)} color={ACCENT} strokeWidth={2} />
          )}
          <Text style={[
            styles.trackButtonText,
            isTracking && styles.trackButtonTextActive
          ]}>
            {isTracking ? 'Tracking' : 'Track Series'}
          </Text>
        </TouchableOpacity>
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
        hasRealSequences={seriesHasRealSequences}
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
            {showDownloadedOnly ? (
              <CheckCircle size={scale(14)} color="#000" strokeWidth={2} />
            ) : (
              <Download size={scale(14)} color="rgba(255,255,255,0.6)" strokeWidth={2} />
            )}
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
            {sortOrder === 'asc' ? (
              <ArrowUp size={14} color="#000" strokeWidth={2.5} />
            ) : (
              <ArrowDown size={14} color="#000" strokeWidth={2.5} />
            )}
            <Text style={styles.sortButtonText}>
              {sortOrder === 'asc' ? `1→${sortedBooks.length}` : `${sortedBooks.length}→1`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  ), [
    bookIds,
    seriesInfo.name,
    seriesInfo.bookCount,
    isTracking,
    handleTrackToggle,
    sortedBooks,
    progressStats,
    nextBook,
    handleBookPress,
    loadBook,
    booksToDownload,
    nextBookDownloaded,
    allDownloaded,
    seriesComplete,
    handleContinueSeries,
    seriesHasRealSequences,
    showDownloadedOnly,
    displayedBooks.length,
    sortOrder,
  ]);

  const ListEmpty = () => (
    <View style={styles.emptyListContainer}>
      <CloudDownload size={scale(40)} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
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
        <Download size={scale(16)} color="#000" strokeWidth={2} />
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
          <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2} />
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
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: ACCENT,
    marginTop: scale(12),
    marginBottom: scale(8),
  },
  trackButtonActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  trackButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: ACCENT,
  },
  trackButtonTextActive: {
    color: '#000',
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
