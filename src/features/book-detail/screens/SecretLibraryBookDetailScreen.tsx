/**
 * src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx
 *
 * Secret Library Book Detail Screen
 * Clean editorial design with hero, progress, description, and chapters.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Share,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { PlayIcon, PauseIcon } from '@/features/player/components/PlayerIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

import { useBookDetails } from '../hooks/useBookDetails';
import { ErrorView, BookDetailSkeleton, Loading, SkullRefreshControl, TopNav, TopNavCloseIcon, TopNavShareIcon } from '@/shared/components';
import { useCoverUrl, useLibraryCache } from '@/core/cache';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';

// Extended metadata with narrator fields
interface ExtendedBookMetadata extends BookMetadata {
  narratorName?: string;
}

// Helper to get book metadata safely
// Note: Does NOT require audioFiles - works with cache items that only have metadata
function getBookMetadata(book: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!book?.media?.metadata) return null;
  return book.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration safely
// Note: Does NOT require audioFiles - works with cache items that only have duration
function getBookDuration(book: LibraryItem | null | undefined): number {
  return book?.media?.duration || 0;
}
import { usePlayerStore, useCurrentChapterIndex } from '@/features/player';
import { useQueueStore, useQueue } from '@/features/queue/stores/queueStore';
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useNormalizedChapters } from '@/shared/hooks';
import { haptics } from '@/core/native/haptics';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { userApi, apiClient } from '@/core/api';
import { useAuth } from '@/core/auth';
import { sqliteCache } from '@/core/services/sqliteCache';
import { playbackCache } from '@/core/services/playbackCache';
import { useIsFinished, useMarkFinished, useBookProgress } from '@/core/hooks/useUserBooks';
import { finishedBooksSync } from '@/core/services/finishedBooksSync';
import { useProgressStore, useIsInLibrary } from '@/core/stores/progressStore';
import { logger } from '@/shared/utils/logger';
import {
  secretLibraryColors as staticColors,
  secretLibraryFonts as fonts,
} from '@/shared/theme/secretLibrary';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { BookSpineVertical, BookSpineVerticalData } from '@/features/home/components/BookSpineVertical';
import { useBookRowLayout } from '@/features/home/hooks/useBookRowLayout';
// MIGRATED: Now using new spine system via adapter
import { getTypographyForGenres, getSeriesStyle } from '@/features/home/utils/spine/adapter';
import { SeriesSwipeContainer, SeriesNavigationArrows } from '../components/SeriesSwipeContainer';

// =============================================================================
// TYPES
// =============================================================================

type BookDetailRouteParams = {
  BookDetail: { id: string };
};

// =============================================================================
// ICONS
// =============================================================================

interface IconProps {
  color?: string;
  size?: number;
}

const QueueIcon = ({ color = '#000', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

const QueueCheckIcon = ({ color = '#000', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const DownloadIcon = ({ color = '#000', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M12 15V3" />
  </Svg>
);

const CheckIcon = ({ color = '#000', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const DoubleCheckIcon = ({ color = '#000', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const ResetIcon = ({ color = '#000', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
  </Svg>
);

const BookmarkIcon = ({ color = '#000', size = 14, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2}>
    <Path d="M5 4C5 2.89543 5.89543 2 7 2H17C18.1046 2 19 2.89543 19 4V21C19 21.3746 18.7907 21.7178 18.4576 21.8892C18.1245 22.0606 17.7236 22.0315 17.4188 21.8137L12 17.8619L6.58124 21.8137C6.27642 22.0315 5.87549 22.0606 5.54242 21.8892C5.20935 21.7178 5 21.3746 5 21V4Z" />
  </Svg>
);

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

function formatChapterDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function splitTitle(title: string): { line1: string; line2: string } {
  const words = title.split(' ');
  // Only split if more than 3 words
  if (words.length <= 3) {
    return { line1: title, line2: '' };
  }
  const midPoint = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, midPoint).join(' '),
    line2: words.slice(midPoint).join(' '),
  };
}

// =============================================================================
// DROP CAP PARAGRAPH COMPONENT
// =============================================================================

interface DropCapParagraphProps {
  text: string;
  expanded: boolean;
  onToggleExpand: () => void;
  colors: ReturnType<typeof useSecretLibraryColors>;
}

// Layout constants for drop cap
// Key math: 3 lines beside drop cap must equal box height
// boxSize (60) / linesForDropCap (3) = lineHeight (20)
const DROP_CAP_CONFIG = {
  boxSize: scale(60),       // Square container for ornate woodcut initial
  boxGap: scale(10),        // Gap between drop cap and text
  linesForDropCap: 3,       // Drop cap spans 3 lines
  fontSize: scale(14),      // Body text font size
  lineHeight: scale(20),    // 60px / 3 lines = 20px per line
};

/**
 * Drop Cap Paragraph - uses onTextLayout to measure exact line breaks
 *
 * Layout:
 * ┌──────────┬────────────────────────────────────┐
 * │  Drop    │  Text beside (exactly 2 lines)     │
 * │  Cap     │                                    │
 * ├──────────┴────────────────────────────────────┤
 * │  Full width text continuation below           │
 * └───────────────────────────────────────────────┘
 */
function DropCapParagraph({ text, expanded, onToggleExpand, colors }: DropCapParagraphProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [textSplit, setTextSplit] = useState<{ beside: string; below: string } | null>(null);

  const firstLetter = text.charAt(0);
  const restOfText = text.substring(1);

  // Calculate width available for text beside drop cap
  const horizontalPadding = scale(24) * 2;
  const besideWidth = screenWidth - horizontalPadding - DROP_CAP_CONFIG.boxSize - DROP_CAP_CONFIG.boxGap;

  // Handle text layout measurement
  const handleTextLayout = useCallback((event: any) => {
    const { lines } = event.nativeEvent;
    if (!lines || lines.length === 0 || textSplit) return;

    // Get text from first N lines (where N = linesForDropCap)
    const linesToTake = Math.min(DROP_CAP_CONFIG.linesForDropCap, lines.length);
    let besideText = '';
    for (let i = 0; i < linesToTake; i++) {
      besideText += lines[i].text;
    }

    // Rest goes below
    const belowText = restOfText.substring(besideText.length).trim();

    setTextSplit({
      beside: besideText,
      below: belowText,
    });
  }, [restOfText, textSplit]);

  return (
    <View style={[styles.aboutSection, { borderBottomColor: colors.grayLine }]}>
      {/* Hidden text for measurement - positioned off-screen */}
      {!textSplit && (
        <Text
          style={[
            styles.dropCapText,
            {
              position: 'absolute',
              top: -9999,
              left: 0,
              width: besideWidth,
              color: colors.black,
            },
          ]}
          onTextLayout={handleTextLayout}
        >
          {restOfText}
        </Text>
      )}

      {/* Row 1: Drop cap + text beside it */}
      <View style={styles.dropCapRow}>
        {/* Box 1: Drop cap letter */}
        <View style={styles.dropCapBox}>
          <Text style={[styles.dropCap, { color: colors.black }]}>{firstLetter}</Text>
        </View>

        {/* Box 2: Text beside drop cap (exactly 3 lines) */}
        <Text
          style={[styles.dropCapText, { width: besideWidth, color: colors.black }]}
          android_hyphenationFrequency="full"
        >
          {textSplit?.beside || restOfText.substring(0, 120)}
        </Text>
      </View>

      {/* Box 3: Full-width text below */}
      {(textSplit?.below || '').length > 0 && (
        <Text
          style={[styles.descriptionText, { color: colors.black }]}
          numberOfLines={expanded ? undefined : 3}
          android_hyphenationFrequency="full"
        >
          {textSplit?.below}
        </Text>
      )}

      {/* Only show Read more if there's enough below text to be truncated (roughly 3+ lines) */}
      {(textSplit?.below || '').length > 150 && (
        <TouchableOpacity onPress={onToggleExpand}>
          <Text style={[styles.readMore, { color: colors.black }]}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SecretLibraryBookDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<BookDetailRouteParams, 'BookDetail'>>();
  const navigation = useNavigation<any>();
  const { id: bookId } = route.params;

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<'chapters' | 'series'>('chapters');
  const [seriesViewMode, setSeriesViewMode] = useState<'book' | 'shelf'>('book');
  const [chaptersExpanded, setChaptersExpanded] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const chaptersYRef = useRef<number>(0);

  // Data
  const { book, isLoading, error, refetch } = useBookDetails(bookId);
  const coverUrl = useCoverUrl(bookId);

  // Player state
  const { loadBook, currentBook, isPlaying, play, pause, position, togglePlayer } = usePlayerStore();
  const isThisBookPlaying = currentBook?.id === bookId && isPlaying;
  const isThisBookLoaded = currentBook?.id === bookId;

  // Queue state
  const queue = useQueue();
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const isInQueue = queue.some((q) => q.bookId === bookId);

  // Download state
  const { isDownloaded, isDownloading, isPending, isPaused, progress: downloadProgress } = useDownloadStatus(bookId);
  const { queueDownload } = useDownloads();

  // Progress and finished state (single source of truth: SQLite)
  const { isFinished: isMarkedFinished } = useIsFinished(bookId);
  const { progress: localProgress, currentTime: localCurrentTime, duration: localDuration } = useBookProgress(bookId);
  const markFinished = useMarkFinished();
  const [isMarkingProgress, setIsMarkingProgress] = useState(false);

  // Library membership state
  const isInLibrary = useIsInLibrary(bookId);
  const addToLibrary = useProgressStore((s) => s.addToLibrary);
  const removeFromLibrary = useProgressStore((s) => s.removeFromLibrary);

  // Auth context (for potential future use)
  const { serverUrl } = useAuth();

  // Get cached spine data reactively (has correct progress/duration from library cache)
  // This selector is reactive - updates when spine cache updates
  const cachedSpineData = useSpineCacheStore((s) => s.cache.get(bookId));

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Navigate back
  const handleClose = useCallback(() => {
    haptics.selection();
    navigation.goBack();
  }, [navigation]);

  // Navigate to Library (bookspine view)
  const handleLogoPress = useCallback(() => {
    haptics.selection();
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  // Play/resume handler
  const handlePlay = useCallback(async () => {
    haptics.buttonPress();
    if (isThisBookLoaded) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
      togglePlayer(); // Open player
    } else if (book) {
      // loadBook will show player by default (showPlayer: true)
      await loadBook(book);
    }
  }, [book, isThisBookLoaded, isPlaying, loadBook, play, pause, togglePlayer]);

  // Queue handler
  const handleQueueToggle = useCallback(async () => {
    if (!book) return;
    haptics.selection();
    if (isInQueue) {
      removeFromQueue(bookId);
    } else {
      await addToQueue(book);
    }
  }, [book, bookId, isInQueue, addToQueue, removeFromQueue]);

  // Download handler - supports pause/resume
  const handleDownload = useCallback(async () => {
    if (!book) return;

    // If downloading, pause it
    if (isDownloading && !isPaused) {
      haptics.toggle();
      await downloadManager.pauseDownload(bookId);
      return;
    }

    // If paused, resume it
    if (isPaused) {
      haptics.toggle();
      await downloadManager.resumeDownload(bookId);
      return;
    }

    // If pending (queued), cancel it
    if (isPending) {
      haptics.warning();
      await downloadManager.cancelDownload(bookId);
      return;
    }

    // If not downloaded, queue it
    if (!isDownloaded) {
      haptics.selection();
      await queueDownload(book);
    }
  }, [book, bookId, isDownloaded, isDownloading, isPaused, isPending, queueDownload]);

  // Library toggle handler
  const handleLibraryToggle = useCallback(async () => {
    haptics.selection();
    if (isInLibrary) {
      await removeFromLibrary(bookId);
    } else {
      await addToLibrary(bookId);
    }
  }, [bookId, isInLibrary, addToLibrary, removeFromLibrary]);

  // Mark as finished handler - syncs to SQLite (single source of truth) and ABS
  const handleMarkFinished = useCallback(async () => {
    if (!book || isMarkingProgress) return;
    setIsMarkingProgress(true);
    haptics.buttonPress();
    try {
      const bookDuration = getBookDuration(book) || 0;

      // Update local SQLite (single source of truth)
      await markFinished.mutateAsync({ bookId, isFinished: true, source: 'manual' });

      // Sync to ABS server in background
      finishedBooksSync.syncBook(bookId, true, bookDuration).catch((err) => {
        logger.warn('Server sync failed:', err);
      });

      await refetch(); // Refresh to update progress display
    } catch (error) {
      logger.error('Failed to mark as finished:', error);
    } finally {
      setIsMarkingProgress(false);
    }
  }, [book, bookId, isMarkingProgress, markFinished, refetch]);

  // Unmark finished handler - removes finished status while keeping progress
  const handleUnmarkFinished = useCallback(async () => {
    if (!book || isMarkingProgress) return;
    setIsMarkingProgress(true);
    haptics.buttonPress();
    try {
      // Update local SQLite - unmark as finished
      await markFinished.mutateAsync({ bookId, isFinished: false });

      // Sync to ABS server in background
      const bookDuration = getBookDuration(book) || 0;
      finishedBooksSync.syncBook(bookId, false, bookDuration).catch((err) => {
        logger.warn('Server sync failed:', err);
      });

      await refetch(); // Refresh to update progress display
    } catch (error) {
      logger.error('Failed to unmark as finished:', error);
    } finally {
      setIsMarkingProgress(false);
    }
  }, [book, bookId, isMarkingProgress, markFinished, refetch]);

  // Clear progress handler - syncs to SQLite and ABS
  const handleClearProgress = useCallback(async () => {
    if (!book || isMarkingProgress) return;

    Alert.alert(
      'Clear Progress?',
      'This will reset your listening position to the beginning.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsMarkingProgress(true);
            haptics.buttonPress();
            try {
              const bookDuration = getBookDuration(book) || 0;

              // Update local SQLite - reset position to 0
              await sqliteCache.updateUserBookProgress(bookId, 0, bookDuration, 0);

              // If book was marked finished, also unmark it
              if (isMarkedFinished || localProgress >= 0.95) {
                await markFinished.mutateAsync({ bookId, isFinished: false });
              }

              // Sync to ABS server
              await userApi.markAsNotStarted(bookId).catch((err) => {
                logger.warn('Server sync failed:', err);
              });

              // Mark as synced
              await sqliteCache.markUserBookSynced(bookId, { progress: true, finished: true });

              await refetch(); // Refresh to update progress display
            } catch (error) {
              logger.error('Failed to clear progress:', error);
            } finally {
              setIsMarkingProgress(false);
            }
          },
        },
      ]
    );
  }, [book, bookId, isMarkingProgress, isMarkedFinished, localProgress, markFinished, refetch]);

  // Share handler
  const handleShare = useCallback(async () => {
    haptics.selection();
    const metadata = getBookMetadata(book);
    const title = metadata?.title || 'Unknown Title';
    const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';

    const message = author
      ? `Check out "${title}" by ${author}`
      : `Check out "${title}"`;

    try {
      await Share.share({
        message,
        title,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }, [book]);

  // Scroll to chapters
  const handleScrollToChapters = useCallback(() => {
    haptics.selection();
    scrollViewRef.current?.scrollTo({ y: chaptersYRef.current, animated: true });
  }, []);

  // Navigate to series
  const handleSeriesPress = useCallback(() => {
    const metadata = getBookMetadata(book);
    const seriesData = metadata?.series?.[0];
    // Get series name from either format:
    // - seriesData could be an object with .name property
    // - seriesData could be a plain string
    // - metadata.seriesName is a fallback string format
    const seriesNameRaw = (typeof seriesData === 'object' ? seriesData?.name : seriesData)
      || metadata?.seriesName || '';

    console.log('[BookDetail] handleSeriesPress:', {
      seriesData,
      seriesNameRaw,
      metadataSeriesName: metadata?.seriesName,
      metadataSeries: metadata?.series,
    });

    if (seriesNameRaw) {
      haptics.selection();
      // Strip #N suffix and pass as seriesName (what SeriesDetailScreen expects)
      const cleanSeriesName = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
      console.log('[BookDetail] Navigating to SeriesDetail with:', cleanSeriesName);
      navigation.navigate('SeriesDetail', { seriesName: cleanSeriesName });
    } else {
      console.warn('[BookDetail] No series name found, cannot navigate');
    }
  }, [book, navigation]);

  // Navigate to genre page
  const handleGenrePress = useCallback((genreName: string) => {
    haptics.selection();
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  // Seek to chapter
  const handleChapterPress = useCallback(async (chapterIndex: number) => {
    if (!book) return;
    haptics.selection();

    const chapters = book.media?.chapters || [];
    const chapter = chapters[chapterIndex];
    if (!chapter) return;

    // If this book isn't loaded, load it first then seek
    if (!isThisBookLoaded) {
      await loadBook(book, { startPosition: chapter.start, showPlayer: true });
    } else {
      // Book is loaded, just seek to chapter start
      const { seekTo } = usePlayerStore.getState();
      seekTo(chapter.start);
      togglePlayer(); // Open player
    }
  }, [book, isThisBookLoaded, loadBook, togglePlayer]);

  // Book metadata
  const metadata = getBookMetadata(book);
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata?.narratorName ||
    (metadata?.narrators && metadata.narrators.length > 0
      ? metadata.narrators.join(', ')
      : '');
  const description = metadata?.description || '';
  const publisher = metadata?.publisher || '';
  const publishedYear = metadata?.publishedYear || '';
  const language = metadata?.language || 'English';

  // Series info
  const seriesInfo = useMemo(() => {
    // Try array format first (metadata.series[0])
    if (metadata?.series && metadata.series.length > 0) {
      const seriesEntry = metadata.series[0];
      const name = seriesEntry.name || seriesEntry;
      const sequence = seriesEntry.sequence ? parseFloat(seriesEntry.sequence) : undefined;
      if (name && typeof name === 'string') {
        return { name, sequence };
      }
    }
    // Try string format (metadata.seriesName with #N)
    const seriesNameRaw = metadata?.seriesName || '';
    if (seriesNameRaw) {
      const seqMatch = seriesNameRaw.match(/#([\d.]+)/);
      if (seqMatch) {
        const sequence = parseFloat(seqMatch[1]);
        const name = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
        return { name, sequence };
      }
      return { name: seriesNameRaw, sequence: undefined };
    }
    return null;
  }, [metadata]);

  // Series books from cache (for Series tab)
  const { getSeries } = useLibraryCache();
  const seriesBooks = useMemo(() => {
    if (!seriesInfo?.name) return [];
    const cachedSeries = getSeries(seriesInfo.name);
    return cachedSeries?.books || [];
  }, [seriesInfo?.name, getSeries]);

  // Convert series books to spine data for shelf view
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);
  const seriesSpineData = useMemo((): BookSpineVerticalData[] => {
    return seriesBooks.map((item) => {
      const itemMeta = getBookMetadata(item);
      const cached = getSpineData(item.id);
      const itemProgress = item.userMediaProgress?.progress || 0;
      const seqMatch = itemMeta?.seriesName?.match(/#([\d.]+)/);

      const base: BookSpineVerticalData = {
        id: item.id,
        title: itemMeta?.title || 'Unknown',
        author: itemMeta?.authorName || 'Unknown Author',
        progress: itemProgress,
        genres: itemMeta?.genres || [],
        tags: [],
        duration: getBookDuration(item),
        seriesName: seriesInfo?.name,
        seriesSequence: seqMatch ? parseFloat(seqMatch[1]) : undefined,
      };

      if (cached?.backgroundColor && cached?.textColor) {
        return { ...base, backgroundColor: cached.backgroundColor, textColor: cached.textColor };
      }
      return base;
    });
  }, [seriesBooks, getSpineData, seriesInfo?.name]);

  // Get spine layouts for shelf view
  const seriesSpineLayouts = useBookRowLayout(seriesSpineData, {
    scaleFactor: 0.75,
    enableLeaning: true,
  });

  // Handle spine press in shelf view
  const handleSeriesSpinePress = useCallback((spineBook: BookSpineVerticalData) => {
    if (spineBook.id !== bookId) {
      haptics.selection();
      navigation.push('BookDetail', { id: spineBook.id });
    }
  }, [bookId, navigation]);

  // Chapters
  const chapters = book?.media?.chapters || [];

  // Duration - try multiple sources (spine cache is most reliable):
  // 1. Spine cache (same source as book spines on home page)
  // 2. media.duration
  // 3. Sum of audioFiles
  // 4. Last chapter's end time
  let duration = cachedSpineData?.duration || 0;
  if (!duration) {
    duration = getBookDuration(book) || 0;
  }
  if (!duration && book?.media?.audioFiles?.length) {
    duration = book.media.audioFiles.reduce((sum: number, f: any) => sum + (f.duration || 0), 0);
  }
  if (!duration && chapters.length > 0) {
    // Use the last chapter's end time as total duration
    const lastChapter = chapters[chapters.length - 1];
    duration = lastChapter?.end || 0;
  }
  const formattedDuration = formatDuration(duration);
  const chapterCount = chapters.length;

  // Progress - try multiple sources:
  // 1. Player state (if this book is currently loaded - most accurate)
  // 2. Memory cache (instant - populated during app startup for top 5 books)
  // 3. Local SQLite (single source of truth for playback)
  // 4. Spine cache (same as book spines on home page)
  // 5. Server progress
  const serverProgress = book?.userMediaProgress?.progress || 0;
  const serverCurrentTime = book?.userMediaProgress?.currentTime || 0;
  const cachedProgress = cachedSpineData?.progress || 0;

  // Get progress from memory cache (instant - pre-populated for recently played books)
  const memoryCachedData = playbackCache.getProgress(bookId);
  const memoryCachedProgress = memoryCachedData ? memoryCachedData.progress : 0;
  const memoryCachedTime = memoryCachedData ? memoryCachedData.currentTime : 0;

  // If this book is loaded in the player, use player's position
  const playerProgress = isThisBookLoaded && duration > 0 ? position / duration : 0;
  const playerCurrentTime = isThisBookLoaded ? position : 0;

  // DEBUG: Log progress sources (dev only)
  if (__DEV__ && false) { // Set to true to debug progress issues
    console.log(`[BookDetail] ${bookId} progress:`, {
      playerProgress: `${(playerProgress * 100).toFixed(1)}%`,
      memoryCached: memoryCachedData ? `${(memoryCachedProgress * 100).toFixed(1)}%` : 'NOT IN CACHE',
      localProgress: `${(localProgress * 100).toFixed(1)}%`,
      spineCache: `${(cachedProgress * 100).toFixed(1)}%`,
      serverProgress: `${(serverProgress * 100).toFixed(1)}%`,
    });
  }

  // Prioritize: player state → memory cache → local SQLite → spine cache → server
  const progress = playerProgress > 0 ? playerProgress :
                   memoryCachedProgress > 0 ? memoryCachedProgress :
                   localProgress > 0 ? localProgress :
                   cachedProgress > 0 ? cachedProgress :
                   serverProgress;
  const currentTime = playerCurrentTime > 0 ? playerCurrentTime :
                      memoryCachedTime > 0 ? memoryCachedTime :
                      localCurrentTime > 0 ? localCurrentTime :
                      cachedProgress > 0 ? cachedProgress * duration :
                      serverCurrentTime;
  // Check both server state and local SQLite for finished status
  const isFinished = book?.userMediaProgress?.isFinished || progress >= 0.95 || isMarkedFinished;
  const timeListened = currentTime;
  const timeRemaining = duration - currentTime;
  const progressPercent = Math.round(progress * 100);

  // Get normalized chapter names
  const normalizedChapters = useNormalizedChapters(chapters, { bookTitle: title });

  // Current chapter for loaded book
  const currentChapterIndex = useCurrentChapterIndex();
  const playingChapterIndex = isThisBookLoaded ? currentChapterIndex : -1;

  // Calculate saved chapter based on currentTime (for books not currently playing)
  const savedChapterIndex = useMemo(() => {
    if (playingChapterIndex >= 0) return playingChapterIndex;
    if (!chapters.length || currentTime <= 0) return 0;
    // Find which chapter currentTime falls into
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentTime >= chapters[i].start) return i;
    }
    return 0;
  }, [chapters, currentTime, playingChapterIndex]);

  // Calculate which chapters to show (collapse read chapters)
  const { visibleChapters, hiddenCount } = useMemo(() => {
    if (chaptersExpanded || normalizedChapters.length <= 5) {
      return { visibleChapters: normalizedChapters.map((_, i) => i), hiddenCount: 0 };
    }

    // Show: 3 chapters before current, current, and all after current
    const currentIdx = savedChapterIndex;
    const startIdx = Math.max(0, currentIdx - 3);
    const visible = normalizedChapters.map((_, i) => i).filter(i => i >= startIdx);
    const hidden = startIdx;

    return { visibleChapters: visible, hiddenCount: hidden };
  }, [normalizedChapters, savedChapterIndex, chaptersExpanded]);

  // Title split
  const { line1, line2 } = useMemo(() => splitTitle(title), [title]);

  // Get spine typography - USE CACHED TYPOGRAPHY for consistency
  // This ensures book detail shows the EXACT same font as the book spine on home screen
  const spineTypography = useMemo(() => {
    // FIRST: Use pre-computed typography from spine cache (computed at app startup)
    // This is the SAME typography used by BookSpineVertical.tsx
    if (cachedSpineData?.typography) {
      return cachedSpineData.typography;
    }

    // FALLBACK: Recalculate if not in cache (e.g., book just added to library)
    const seriesName = cachedSpineData?.seriesName;
    const genres = cachedSpineData?.genres || metadata?.genres || [];

    // Check if in a series AND has cached series name
    if (seriesName) {
      const seriesStyle = getSeriesStyle(seriesName);
      if (seriesStyle?.typography) {
        return seriesStyle.typography;
      }
    }

    // Genre-based typography (fallback path)
    return getTypographyForGenres(genres, bookId);
  }, [cachedSpineData?.typography, cachedSpineData?.seriesName, cachedSpineData?.genres, metadata?.genres, bookId]);

  // Use spine typography fontFamily directly - it's already platform-specific
  // (spineCalculations.ts converts to 'System'/'Georgia' on iOS, 'sans-serif'/'serif' on Android)
  const titleFontFamily = spineTypography.fontFamily || Platform.select({ ios: 'Georgia', android: 'serif' });
  const titleFontWeight = spineTypography.titleWeight || spineTypography.fontWeight || '500';
  const titleFontStyle = spineTypography.fontStyle || 'normal';
  const titleTransform = spineTypography.titleTransform || 'none';

  // Apply text transform
  const displayTitle = useMemo(() => {
    if (titleTransform === 'uppercase') {
      return title.toUpperCase();
    }
    return title;
  }, [title, titleTransform]);

  const { displayLine1, displayLine2 } = useMemo(() => {
    if (titleTransform === 'uppercase') {
      return { displayLine1: line1.toUpperCase(), displayLine2: line2.toUpperCase() };
    }
    return { displayLine1: line1, displayLine2: line2 };
  }, [line1, line2, titleTransform]);

  // Loading state
  if (isLoading && !book) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
        <Loading size={80} color={colors.black} />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.white }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />
        <ErrorView message={error.message} onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />

      {/* Header - Restored with Queue/Library pills */}
      <TopNav
        variant={isDarkMode ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: 'transparent' }}
        pills={[
          {
            key: 'library',
            label: isInLibrary ? 'In Library' : 'Add',
            icon: <BookmarkIcon color={isInLibrary ? colors.white : colors.black} size={10} filled={isInLibrary} />,
            active: isInLibrary,
            onPress: handleLibraryToggle,
          },
          {
            key: 'queue',
            label: isInQueue ? 'Queued' : 'Queue',
            icon: isInQueue
              ? <QueueCheckIcon color={colors.white} size={10} />
              : <QueueIcon color={colors.black} size={10} />,
            active: isInQueue,
            onPress: handleQueueToggle,
          },
        ]}
        circleButtons={[
          {
            key: 'share',
            icon: <TopNavShareIcon color={colors.black} size={14} />,
            onPress: handleShare,
          },
          {
            key: 'close',
            icon: <TopNavCloseIcon color={colors.black} size={14} />,
            onPress: handleClose,
          },
        ]}
      />

      <SeriesSwipeContainer book={book!}>
        <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: insets.bottom + scale(40) }}
            showsVerticalScrollIndicator={false}
          >

        {/* Hero Section - Centered Cover */}
        <View style={styles.hero}>
          {/* Centered Cover */}
          <View style={styles.heroCover}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
            ) : (
              <View style={[styles.coverImage, styles.coverPlaceholder]}>
                <Text style={styles.coverPlaceholderText}>
                  {title.substring(0, 3).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Split Title with Series Navigation Arrows */}
          <View style={styles.titleContainer}>
            <SeriesNavigationArrows />
            <Text style={[
              styles.titleLine1,
              {
                fontFamily: titleFontFamily,
                fontWeight: titleFontWeight as any,
                color: colors.black,
              }
            ]}>
              {displayLine1}
            </Text>
            {displayLine2 ? (
              <Text style={[
                styles.titleLine2,
                {
                  fontFamily: titleFontFamily,
                  fontWeight: titleFontWeight as any,
                  color: colors.black,
                }
              ]}>
                {displayLine2}
              </Text>
            ) : null}
          </View>

          {/* Byline: By Author · Narrated by Narrator */}
          <View style={styles.byline}>
            <Text style={[styles.bylineText, { color: colors.gray }]}>By </Text>
            {author.split(',').map((name: string, idx: number, arr: string[]) => (
              <React.Fragment key={idx}>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    navigation.navigate('AuthorDetail', { authorName: name.trim() });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bylineLink, { color: colors.black }]}>{name.trim()}</Text>
                </TouchableOpacity>
                {idx < arr.length - 1 && <Text style={[styles.bylineText, { color: colors.gray }]}>, </Text>}
              </React.Fragment>
            ))}
            {narrator ? (
              <>
                <Text style={[styles.bylineDot, { color: colors.gray }]}> · </Text>
                <Text style={[styles.bylineText, { color: colors.gray }]}>Narrated by </Text>
                {narrator.split(',').map((name: string, idx: number, arr: string[]) => (
                  <React.Fragment key={idx}>
                    <TouchableOpacity
                      onPress={() => {
                        haptics.selection();
                        navigation.navigate('NarratorDetail', { narratorName: name.trim() });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.bylineLink, { color: colors.black }]}>{name.trim()}</Text>
                    </TouchableOpacity>
                    {idx < arr.length - 1 && <Text style={[styles.bylineText, { color: colors.gray }]}>, </Text>}
                  </React.Fragment>
                ))}
              </>
            ) : null}
          </View>

          {/* Series Link */}
          {seriesInfo && (
            <TouchableOpacity onPress={handleSeriesPress} activeOpacity={0.7} style={styles.seriesRow}>
              <Text style={[styles.seriesLink, { color: colors.gray }]}>
                {seriesInfo.name}{seriesInfo.sequence ? ` · Book ${seriesInfo.sequence}` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Meta Grid: Duration | Chapters (clickable) | Year */}
        <View style={[styles.metaGrid, { borderColor: colors.grayLine }]}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: colors.gray }]}>Duration</Text>
            <Text style={[styles.metaValue, { color: colors.black }]}>{formattedDuration}</Text>
          </View>
          <TouchableOpacity style={[styles.metaItemCenter, { borderColor: colors.grayLine }]} onPress={handleScrollToChapters} activeOpacity={0.7}>
            <Text style={[styles.metaLabel, { color: colors.gray }]}>Chapters</Text>
            <Text style={[styles.metaValue, styles.metaValueLink, { color: colors.black }]}>{chapterCount}</Text>
          </TouchableOpacity>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: colors.gray }]}>Published</Text>
            <Text style={[styles.metaValue, { color: colors.black }]}>{publishedYear || '—'}</Text>
          </View>
        </View>

        {/* Action Buttons: Play + Download */}
        <View style={styles.actionRow}>
          {/* Play Button - 30% width */}
          <TouchableOpacity style={[styles.btnPlay, { backgroundColor: colors.black }]} onPress={handlePlay}>
            <PlayIcon color={colors.white} size={16} />
            <Text style={[styles.btnText, styles.btnTextActive, { color: colors.white }]}>
              {isThisBookPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          {/* Download Button - 70% width - supports pause/resume */}
          <TouchableOpacity
            style={[
              styles.btnDownload,
              { borderColor: colors.black },
              (isDownloaded || isDownloading || isPaused) && [styles.btnDownloadActive, { backgroundColor: colors.black, borderColor: colors.black }],
            ]}
            onPress={handleDownload}
            disabled={isDownloaded}
          >
            {isDownloaded ? (
              <>
                <CheckIcon color={colors.white} size={16} />
                <Text style={[styles.btnText, styles.btnTextActive, { color: colors.white }]}>Downloaded</Text>
              </>
            ) : isPaused ? (
              <Text style={[styles.btnText, { color: colors.white }]}>Paused - {Math.round(downloadProgress * 100)}%</Text>
            ) : isDownloading ? (
              <Text style={[styles.btnText, { color: colors.white }]}>{Math.round(downloadProgress * 100)}% - Tap to pause</Text>
            ) : isPending ? (
              <Text style={[styles.btnText, { color: colors.black }]}>Queued - Tap to cancel</Text>
            ) : (
              <>
                <DownloadIcon color={colors.black} size={16} />
                <Text style={[styles.btnText, { color: colors.black }]}>Download</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Progress Section - Compact */}
        <View style={styles.progressSection}>
          {/* Progress header: left = label + %, right = mark as finished */}
          <View style={styles.progressHeader}>
            <View style={styles.progressLeft}>
              <Text style={[styles.progressLabel, { color: colors.gray }]}>Progress</Text>
              <Text style={[styles.progressPercent, { color: colors.black }]}>
                {isFinished ? 'Complete' : `${progressPercent}%`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.markFinishedBtn}
              onPress={isFinished ? handleUnmarkFinished : handleMarkFinished}
              activeOpacity={0.7}
            >
              <Text style={[styles.markFinishedText, { color: colors.gray }]}>
                {isFinished ? 'Unmark Finished' : 'Mark as Finished'}
              </Text>
              <DoubleCheckIcon color={isFinished ? colors.black : colors.gray} size={12} />
            </TouchableOpacity>
          </View>
          {/* Progress bar */}
          <View style={[styles.progressBar, { backgroundColor: colors.grayLine }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.black }]} />
          </View>
          {/* Time stats with inline clear button */}
          <View style={styles.progressTimes}>
            <View style={styles.timeWithClear}>
              <TouchableOpacity
                onPress={handleClearProgress}
                accessibilityLabel="Clear progress"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ResetIcon color={colors.gray} size={12} />
              </TouchableOpacity>
              <Text style={[styles.timeText, { color: colors.gray }]}>{formatDuration(timeListened)} listened</Text>
            </View>
            <Text style={[styles.timeText, { color: colors.gray }]}>{formatDuration(timeRemaining)} remaining</Text>
          </View>
        </View>

        {/* About Section - with Drop Cap (3-box layout) */}
        {description ? (
          <DropCapParagraph
            text={description}
            expanded={descriptionExpanded}
            onToggleExpand={() => setDescriptionExpanded(!descriptionExpanded)}
            colors={colors}
          />
        ) : null}

        {/* Genre Pills - Under About Section */}
        {(metadata?.genres || []).length > 0 && (
          <View style={styles.genreRow}>
            {(metadata?.genres || []).map((genre: string, idx: number) => (
              <TouchableOpacity
                key={`genre-${idx}`}
                style={[styles.genrePill, { borderColor: colors.grayLine }]}
                onPress={() => handleGenrePress(genre)}
                activeOpacity={0.7}
              >
                <Text style={[styles.genrePillText, { color: colors.gray }]}>{genre}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Chapters/Series Section */}
        <View
          style={styles.chaptersSection}
          onLayout={(e) => { chaptersYRef.current = e.nativeEvent.layout.y; }}
        >
          {/* Tab Header */}
          <View style={styles.contentTabsRow}>
            <TouchableOpacity
              style={[
                styles.contentTab,
                activeContentTab === 'chapters' && styles.contentTabActive,
              ]}
              onPress={() => setActiveContentTab('chapters')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.contentTabText,
                { color: activeContentTab === 'chapters' ? colors.black : colors.gray },
              ]}>
                Chapters
              </Text>
              <Text style={[styles.contentTabCount, { color: colors.gray }]}>
                {chapterCount}
              </Text>
            </TouchableOpacity>

            {seriesInfo && seriesBooks.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.contentTab,
                  activeContentTab === 'series' && styles.contentTabActive,
                ]}
                onPress={() => setActiveContentTab('series')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.contentTabText,
                  { color: activeContentTab === 'series' ? colors.black : colors.gray },
                ]}>
                  Series
                </Text>
                <Text style={[styles.contentTabCount, { color: colors.gray }]}>
                  {seriesBooks.length}
                </Text>
              </TouchableOpacity>
            )}

            {/* View Mode Toggle - only for Series tab */}
            {activeContentTab === 'series' && seriesBooks.length > 1 && (
              <TouchableOpacity
                style={styles.viewModeToggle}
                onPress={() => setSeriesViewMode(seriesViewMode === 'book' ? 'shelf' : 'book')}
              >
                <Text style={[styles.viewModeText, { color: colors.black }]}>
                  {seriesViewMode === 'book' ? 'Book' : 'Shelf'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Chapters Content */}
          {activeContentTab === 'chapters' && (
            <>
              {/* Show earlier chapters button */}
              {hiddenCount > 0 && (
                <TouchableOpacity
                  style={[styles.showEarlierBtn, { borderBottomColor: colors.grayLine }]}
                  onPress={() => setChaptersExpanded(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.showEarlierText, { color: colors.gray }]}>
                    Show {hiddenCount} earlier {hiddenCount === 1 ? 'chapter' : 'chapters'}
                  </Text>
                </TouchableOpacity>
              )}
              {visibleChapters.map((index) => {
                const chapter = normalizedChapters[index];
                const chapterStart = chapters[index]?.start ?? 0;
                const chapterEnd = chapters[index]?.end ?? 0;
                const chapterDuration = chapterEnd > chapterStart ? chapterEnd - chapterStart : 0;
                const isCurrentChapter = index === playingChapterIndex || (playingChapterIndex < 0 && index === savedChapterIndex);
                const isComplete = progress >= 1 || (index < savedChapterIndex);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.chapterItem, { borderBottomColor: colors.grayLine }]}
                    onPress={() => handleChapterPress(index)}
                    activeOpacity={0.7}
                  >
                    {/* Circular badge number */}
                    <View style={[
                      styles.chapterBadge,
                      { borderColor: colors.grayLine, backgroundColor: colors.white },
                      isCurrentChapter && styles.chapterBadgeActive,
                      isComplete && !isCurrentChapter && [styles.chapterBadgeComplete, { borderColor: colors.grayLine, backgroundColor: colors.grayLine }],
                    ]}>
                      <Text style={[
                        styles.chapterBadgeText,
                        { color: colors.gray },
                        isCurrentChapter && styles.chapterBadgeTextActive,
                        isComplete && !isCurrentChapter && styles.chapterBadgeTextComplete,
                      ]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.chapterInfo}>
                      <Text
                        style={[styles.chapterTitle, { color: colors.black }, isCurrentChapter && styles.chapterTitleActive]}
                        numberOfLines={1}
                      >
                        {chapter.displayTitle || `Chapter ${index + 1}`}
                      </Text>
                      <Text style={[styles.chapterDuration, { color: colors.gray }]}>
                        {formatChapterDuration(chapterDuration)}
                      </Text>
                    </View>
                    <View style={styles.chapterStatus}>
                      {isCurrentChapter ? (
                        isThisBookPlaying ? (
                          <PauseIcon color={colors.orange} size={12} />
                        ) : (
                          <PlayIcon color={colors.orange} size={12} />
                        )
                      ) : isComplete ? (
                        <CheckIcon color={colors.gray} size={14} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Series Content - Book View */}
          {activeContentTab === 'series' && seriesViewMode === 'book' && seriesBooks.map((seriesBook, index) => {
            const seriesBookMeta = getBookMetadata(seriesBook);
            const isCurrentBook = seriesBook.id === bookId;
            const seriesBookProgress = seriesBook.userMediaProgress?.progress || 0;
            const isSeriesBookFinished = seriesBookProgress >= 0.95;
            const seriesSeqMatch = seriesBookMeta?.seriesName?.match(/#([\d.]+)/);
            const seriesSeq = seriesSeqMatch ? parseFloat(seriesSeqMatch[1]) : index + 1;
            const seriesBookDuration = getBookDuration(seriesBook);
            const coverUrl = apiClient.getItemCoverUrl(seriesBook.id, { width: 80, height: 80 });

            return (
              <TouchableOpacity
                key={seriesBook.id}
                style={[
                  styles.seriesBookItem,
                  { borderBottomColor: colors.grayLine },
                  isCurrentBook && { backgroundColor: colors.grayLight },
                ]}
                onPress={() => {
                  if (!isCurrentBook) {
                    haptics.selection();
                    navigation.push('BookDetail', { id: seriesBook.id });
                  }
                }}
                activeOpacity={isCurrentBook ? 1 : 0.7}
              >
                {/* Cover image */}
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.seriesCover}
                />
                {/* Book number badge */}
                <View style={[
                  styles.seriesBadge,
                  { borderColor: colors.grayLine, backgroundColor: colors.white },
                  isCurrentBook && styles.chapterBadgeActive,
                  isSeriesBookFinished && !isCurrentBook && [styles.chapterBadgeComplete, { borderColor: colors.grayLine, backgroundColor: colors.grayLine }],
                ]}>
                  <Text style={[
                    styles.seriesBadgeText,
                    { color: colors.gray },
                    isCurrentBook && styles.chapterBadgeTextActive,
                    isSeriesBookFinished && !isCurrentBook && styles.chapterBadgeTextComplete,
                  ]}>
                    {seriesSeq}
                  </Text>
                </View>
                <View style={styles.seriesBookInfo}>
                  <Text
                    style={[
                      styles.chapterTitle,
                      { color: colors.black },
                      isCurrentBook && styles.chapterTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {seriesBookMeta?.title || 'Unknown Title'}
                  </Text>
                  <Text style={[styles.chapterDuration, { color: colors.gray }]}>
                    {formatDuration(seriesBookDuration)}
                  </Text>
                </View>
                <View style={styles.chapterStatus}>
                  {isCurrentBook ? (
                    <View style={[styles.currentBookDot, { backgroundColor: colors.orange }]} />
                  ) : isSeriesBookFinished ? (
                    <CheckIcon color={colors.gray} size={14} />
                  ) : seriesBookProgress > 0 ? (
                    <Text style={[styles.seriesProgress, { color: colors.gray }]}>
                      {Math.round(seriesBookProgress * 100)}%
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Series Content - Shelf View */}
          {activeContentTab === 'series' && seriesViewMode === 'shelf' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfContent}
            >
              {seriesSpineLayouts.map((layout) => {
                const isCurrentBook = layout.book.id === bookId;
                return (
                  <View key={layout.book.id} style={styles.spineWrapper}>
                    <BookSpineVertical
                      book={layout.book}
                      width={layout.width}
                      height={layout.height}
                      onPress={() => handleSeriesSpinePress(layout.book)}
                      style={isCurrentBook ? { borderWidth: 2, borderColor: colors.orange } : undefined}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
          </ScrollView>
        </SkullRefreshControl>
      </SeriesSwipeContainer>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.grayLight,
  },
  scrollView: {
    flex: 1,
  },

  // Hero - Centered layout
  hero: {
    alignItems: 'center',
    paddingTop: scale(8),
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
  },
  heroCover: {
    width: scale(320),
    height: scale(320),
    marginBottom: scale(20),
    shadowColor: staticColors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: staticColors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: scale(48),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: -2,
  },

  // Title - Split headline
  titleContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: scale(12),
  },
  titleLine1: {
    fontSize: scale(28),
    letterSpacing: 0.5,
    color: staticColors.black,
    textAlign: 'center',
    lineHeight: scale(32),
  },
  titleLine2: {
    fontSize: scale(28),
    letterSpacing: 0.5,
    color: staticColors.black,
    textAlign: 'center',
    lineHeight: scale(32),
  },

  // Byline
  byline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  bylineText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    color: staticColors.gray,
  },
  bylineLink: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    color: staticColors.black,
    textDecorationLine: 'underline',
  },
  bylineDot: {
    fontSize: scale(13),
    color: staticColors.gray,
  },

  // Series
  seriesRow: {
    marginTop: scale(4),
  },
  seriesLink: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(14),
    fontStyle: 'italic',
    color: staticColors.gray,
    textDecorationLine: 'underline',
  },

  // Genre Pills
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: scale(12),
    paddingHorizontal: scale(24),
    justifyContent: 'flex-start',
  },
  genrePill: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    borderRadius: scale(16),
  },
  genrePillText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: staticColors.gray,
  },

  // Meta Grid
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: staticColors.grayLine,
    marginHorizontal: scale(24),
  },
  metaItem: {
    flex: 1,
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  metaItemCenter: {
    flex: 1,
    paddingVertical: scale(16),
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: staticColors.grayLine,
  },
  metaLabel: {
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginBottom: scale(4),
  },
  metaValue: {
    fontSize: scale(16),
    fontWeight: '600',
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  metaValueLink: {
    textDecorationLine: 'underline',
  },

  // Progress Section - Compact
  progressSection: {
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  progressLabel: {
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  progressPercent: {
    fontSize: scale(11),
    fontWeight: '600',
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  markFinishedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  markFinishedText: {
    fontSize: scale(11),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  progressBar: {
    height: scale(3),
    backgroundColor: staticColors.grayLine,
    borderRadius: scale(2),
    marginBottom: scale(8),
  },
  progressFill: {
    height: '100%',
    backgroundColor: staticColors.black,
    borderRadius: scale(2),
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeWithClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  timeText: {
    fontSize: scale(10),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  // Action Row - Download (70%) + Play (30%)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
    paddingHorizontal: scale(24),
    paddingVertical: scale(16),
  },
  btnDownload: {
    flex: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: staticColors.black,
    paddingVertical: scale(14),
    borderRadius: scale(6),
  },
  btnDownloadActive: {
    backgroundColor: staticColors.black,
    borderColor: staticColors.black,
  },
  btnPlay: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: staticColors.black,
    paddingVertical: scale(14),
    borderRadius: scale(6),
  },
  btnText: {
    color: staticColors.black,
    fontSize: scale(14),
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  btnTextActive: {
    color: staticColors.white,
  },

  // About Section - with proper Drop Cap
  aboutSection: {
    paddingHorizontal: scale(24),
    paddingTop: scale(24),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(22),
    fontWeight: '400',
    color: staticColors.black,
    marginBottom: scale(16),
  },
  // Drop cap row - drop cap + text beside it (Box 1 + Box 2)
  dropCapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Box 1: Container for the drop cap letter (SQUARE)
  dropCapBox: {
    width: scale(60),        // Must match DROP_CAP_CONFIG.boxSize
    height: scale(60),       // Square: height = width
    marginRight: scale(5),   // Must match DROP_CAP_CONFIG.boxGap
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // The drop cap letter itself - decorative woodcut initial
  // Uses TypographerWoodcutInitialsOne font for ornate book-style drop caps
  // Note: Font name must match internal TTF name exactly for Android
  dropCap: {
    fontFamily: 'TypographerWoodcutInitialsOne',
    fontSize: scale(60),     // Sized to fill the square
    lineHeight: scale(60),   // Match fontSize for proper centering
    color: staticColors.black,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  // Box 2: Text beside the drop cap (3 lines that match drop cap height)
  // lineHeight must equal boxSize / linesForDropCap (60 / 3 = 20)
  dropCapText: {
    fontSize: scale(14),
    lineHeight: scale(20),  // 3 lines × 20px = 60px = drop cap box height
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    textAlign: 'justify',
  },
  // Box 3: Full-width text below the drop cap row
  descriptionText: {
    fontSize: scale(14),
    lineHeight: scale(22),
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    textAlign: 'justify',
  },
  readMore: {
    fontSize: scale(12),
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginTop: scale(16),
    textDecorationLine: 'underline',
  },

  // Chapters Section
  chaptersSection: {
    paddingHorizontal: scale(24),
    paddingVertical: scale(20),
  },
  chaptersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: scale(16),
  },
  // Content Tabs (Chapters | Series)
  contentTabsRow: {
    flexDirection: 'row',
    gap: scale(24),
    marginBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
    paddingBottom: scale(12),
  },
  contentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  contentTabActive: {
    // Active state handled via text color
  },
  contentTabText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(18),
    fontWeight: '400',
  },
  contentTabCount: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
  },
  // Series-specific styles
  currentBookDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  seriesProgress: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
  },
  // View mode toggle (Book/Shelf) - single underlined text toggle, aligned right
  viewModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  viewModeText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    textDecorationLine: 'underline',
  },
  // Series book item with cover
  seriesBookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
    gap: scale(10),
  },
  seriesCover: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(4),
  },
  seriesBadge: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    backgroundColor: staticColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesBadgeText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(11),
    fontWeight: '500',
    color: staticColors.gray,
  },
  seriesBookInfo: {
    flex: 1,
  },
  // Shelf view styles
  shelfContent: {
    paddingVertical: scale(16),
    gap: scale(8),
    alignItems: 'flex-end',
  },
  spineWrapper: {
    justifyContent: 'flex-end',
  },
  chapterCount: {
    fontSize: scale(11),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Show earlier chapters button
  showEarlierBtn: {
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  showEarlierText: {
    fontSize: scale(12),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    textDecorationLine: 'underline',
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
    gap: scale(14),
  },
  chapterBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    backgroundColor: staticColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterBadgeActive: {
    borderColor: staticColors.orange,
    backgroundColor: staticColors.orange,
  },
  chapterBadgeComplete: {
    borderColor: staticColors.grayLine,
    backgroundColor: staticColors.grayLine,
  },
  chapterBadgeText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(13),
    fontWeight: '500',
    color: staticColors.gray,
  },
  chapterBadgeTextActive: {
    color: staticColors.white,
    fontWeight: '600',
  },
  chapterBadgeTextComplete: {
    color: staticColors.gray,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: scale(14),
    fontWeight: '500',
    color: staticColors.black,
    marginBottom: scale(2),
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  chapterTitleActive: {
    color: staticColors.orange,
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: scale(11),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  chapterStatus: {
    width: scale(24),
    height: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SecretLibraryBookDetailScreen;
