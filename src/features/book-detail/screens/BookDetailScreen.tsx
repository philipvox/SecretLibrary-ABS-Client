/**
 * src/features/book-detail/screens/BookDetailScreen.tsx
 *
 * Redesigned book detail screen matching the new design spec:
 * - Genre tags at top (yellow text)
 * - Large centered title
 * - Two-column author/narrator display with labels
 * - Smaller cover (~50% width)
 * - Two pill buttons (Download/Stream)
 * - Overview & Chapters tabs with "Add to Queue" link
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  ChevronLeft,
  Play,
  Pause,
  CheckCircle,
  PlusCircle,
  ArrowDown,
  Plus,
  BookOpen,
  BookCheck,
  Clock,
  List,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useBookDetails } from '../hooks/useBookDetails';
import { OverviewTab } from '../components/OverviewTab';
import { ChaptersTab } from '../components/ChaptersTab';
import { ErrorView, BookDetailSkeleton, Snackbar, useSnackbar } from '@/shared/components';
import { useCoverUrl } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { userApi } from '@/core/api/endpoints/user';
import { useDownloadStatus as useDownloadStatusHook } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';
import { useIsFinished, useMarkFinished } from '@/core/hooks/useUserBooks';
import { finishedBooksSync } from '@/core/services/finishedBooksSync';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { useColors, useThemeMode, accentColors, scale, wp, hp, spacing, radius, layout } from '@/shared/theme';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';
import { logger } from '@/shared/utils/logger';

// Design constants
const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);
const COVER_SIZE = scale(280); // Centered cover (~45% height)

type BookDetailRouteParams = {
  BookDetail: { id: string };
};

type TabType = 'overview' | 'chapters';

// Format bytes to human readable string
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}


export function BookDetailScreen() {
  useScreenLoadTime('BookDetailScreen');
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<BookDetailRouteParams, 'BookDetail'>>();
  const navigation = useNavigation<any>();
  const { id: bookId } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Theme colors - supports light/dark mode
  const themeColors = useColors();
  const { isDark } = useThemeMode();
  const COLORS = {
    background: themeColors.background.primary,
    textPrimary: themeColors.text.primary,
    textSecondary: themeColors.text.secondary,
    textTertiary: themeColors.text.tertiary,
    border: themeColors.border.default,
    surface: themeColors.surface.default,
    accent: accentColors.gold,
  };

  const { book, isLoading, error, refetch } = useBookDetails(bookId);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);
  const { loadBook, currentBook, isPlaying, play, pause, position } = usePlayerStore();
  const {
    isDownloaded,
    isDownloading,
    isPending,
    isPaused,
    progress: downloadProgress,
    bytesDownloaded,
    totalBytes,
  } = useDownloadStatusHook(bookId);
  const isThisBookPlaying = currentBook?.id === bookId && isPlaying;
  const isThisBookLoaded = currentBook?.id === bookId;
  const coverUrl = useCoverUrl(bookId);

  // Queue state
  const queue = useQueueStore((s) => s.queue);
  const isInQueue = useIsInQueue(bookId);
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const reorderQueue = useQueueStore((s) => s.reorderQueue);

  // Snackbar for feedback - must be before handlers that use showError
  const { snackbarProps, showUndo, showSuccess, showError } = useSnackbar();

  // Get queue position (1-indexed)
  const queuePosition = useMemo(() => {
    const index = queue.findIndex(item => item.bookId === bookId);
    return index >= 0 ? index + 1 : 0;
  }, [queue, bookId]);

  // Calculate current position from progress or player state
  const currentPosition = useMemo(() => {
    if (isThisBookLoaded) {
      return position || 0;
    }
    const progress = (book as any)?.userMediaProgress?.progress || 0;
    const duration = (book?.media as any)?.duration || 0;
    return progress * duration;
  }, [isThisBookLoaded, position, book]);

  // Playback handlers
  const handlePlay = useCallback(async () => {
    if (!book) return;
    try {
      await loadBook(book, { showPlayer: false });
    } catch (err) {
      logger.error('Failed to start playback:', err);
      showError('Failed to start playback');
    }
  }, [book, loadBook, showError]);

  const handlePause = useCallback(async () => {
    await pause();
  }, [pause]);

  const handleStream = useCallback(async () => {
    if (!book) return;
    try {
      // Stream without downloading
      await loadBook(book, { showPlayer: false });
    } catch (err) {
      logger.error('Failed to stream:', err);
      Alert.alert('Streaming Error', 'Could not start streaming. Check your connection.');
    }
  }, [book, loadBook]);

  const handlePlayFromBeginning = useCallback(async () => {
    if (!book) return;
    try {
      await loadBook(book, { showPlayer: false, startPosition: 0 });
    } catch (err) {
      logger.error('Failed to restart playback:', err);
      showError('Failed to restart playback');
    }
  }, [book, loadBook, showError]);

  // Download handlers
  const handleDownload = useCallback(() => {
    if (!book) return;
    if (isDownloaded || isDownloading || isPending) return;
    downloadManager.queueDownload(book);
  }, [book, isDownloaded, isDownloading, isPending]);

  const handlePauseDownload = useCallback(() => {
    downloadManager.pauseDownload(bookId);
  }, [bookId]);

  const handleResumeDownload = useCallback(() => {
    downloadManager.resumeDownload(bookId);
  }, [bookId]);

  const handleCancelDownload = useCallback(() => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => downloadManager.cancelDownload(bookId) },
      ]
    );
  }, [bookId]);

  const handleDeleteDownload = useCallback(() => {
    Alert.alert(
      'Delete Download',
      'This will remove the downloaded file. You can download it again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => downloadManager.deleteDownload(bookId) },
      ]
    );
  }, [bookId]);

  // Queue handlers
  const handleAddToQueue = useCallback(() => {
    if (!book) return;
    addToQueue(book);
  }, [book, addToQueue]);

  const handleRemoveFromQueue = useCallback(() => {
    removeFromQueue(bookId);
  }, [bookId, removeFromQueue]);

  const handleMoveToTop = useCallback(() => {
    const currentIndex = queue.findIndex(item => item.bookId === bookId);
    if (currentIndex > 0) {
      reorderQueue(currentIndex, 0);
    }
  }, [queue, bookId, reorderQueue]);

  // Mark as finished/not started handlers
  const [isMarkingFinished, setIsMarkingFinished] = useState(false);
  const { isFinished: isMarkedFinished } = useIsFinished(bookId);
  const markFinished = useMarkFinished();

  const handleMarkAsFinished = useCallback(async () => {
    if (isMarkingFinished || !book) return;
    setIsMarkingFinished(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Update local SQLite (single source of truth)
      await markFinished.mutateAsync({ bookId, isFinished: true, source: 'manual' });

      // Show snackbar with undo option
      showUndo('Marked as finished', async () => {
        await markFinished.mutateAsync({ bookId, isFinished: false });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 5000);

      // Get book duration for proper progress update
      const bookDuration = (book.media as any)?.duration || 0;

      // Sync to server in background
      finishedBooksSync.syncBook(bookId, true, bookDuration).catch((err) => {
        logger.warn('Server sync failed:', err);
      });

      // Refetch to update progress display
      refetch();
    } catch (err) {
      logger.error('Failed to mark as finished:', err);
      showError('Failed to mark as finished');
    } finally {
      setIsMarkingFinished(false);
    }
  }, [bookId, book, isMarkingFinished, refetch, markFinished, showUndo, showError]);

  const handleMarkAsNotStarted = useCallback(async () => {
    if (isMarkingFinished) return;
    Alert.alert(
      'Remove from Finished?',
      'This will remove the book from your reading history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsMarkingFinished(true);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Update local SQLite (single source of truth)
              await markFinished.mutateAsync({ bookId, isFinished: false });

              // Show feedback
              showSuccess('Removed from history');

              // Sync to server in background
              finishedBooksSync.syncBook(bookId, false).catch((err) => {
                logger.warn('Server sync failed:', err);
              });

              refetch();
            } catch (err) {
              logger.error('Failed to reset progress:', err);
              showError('Failed to remove from history');
            } finally {
              setIsMarkingFinished(false);
            }
          },
        },
      ]
    );
  }, [bookId, isMarkingFinished, refetch, markFinished, showSuccess, showError]);

  // Handle download button press
  const handleDownloadPress = useCallback(() => {
    if (isDownloading || isPending) {
      if (isPaused) {
        downloadManager.resumeDownload(bookId);
      } else {
        downloadManager.pauseDownload(bookId);
      }
    } else if (isDownloaded) {
      Alert.alert(
        'Delete Download',
        'This will remove the downloaded file. You can download it again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => downloadManager.deleteDownload(bookId) },
        ]
      );
    } else {
      handleDownload();
    }
  }, [isDownloading, isPending, isPaused, isDownloaded, bookId, handleDownload]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <BookDetailSkeleton style={{ paddingTop: insets.top + TOP_NAV_HEIGHT + 50 }} />
      </View>
    );
  }

  if (error || !book) {
    return <ErrorView message="Failed to load book details" onRetry={refetch} />;
  }

  // Derived values - handle both cached and expanded API data
  const metadata = book.media.metadata as any;
  const title = metadata.title || 'Unknown Title';

  // Author: try authorName, then authors array (expanded), then fallback
  let author = metadata.authorName || '';
  if (!author && metadata.authors?.length > 0) {
    author = metadata.authors.map((a: any) => a.name || a).filter(Boolean).join(', ');
  }
  if (!author) author = 'Unknown Author';

  // Narrator: try narratorName, then narrators array
  let rawNarrator = metadata.narratorName || '';
  if (!rawNarrator && metadata.narrators?.length > 0) {
    rawNarrator = metadata.narrators.map((n: any) => typeof n === 'string' ? n : n.name).filter(Boolean).join(', ');
  }
  const narrator = rawNarrator.replace(/^Narrated by\s*/i, '').trim() || null;

  const genres = metadata.genres || [];
  const chapters = book.media.chapters || [];

  // Series: try series array first (expanded), then seriesName string
  const series = metadata.series?.[0] || metadata.seriesName || null;
  const seriesSequence = metadata.series?.[0]?.sequence || null;

  let duration = book.media.duration || 0;
  if (!duration && book.media.audioFiles?.length) {
    duration = book.media.audioFiles.reduce((sum: number, f: any) => sum + (f.duration || 0), 0);
  }

  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;
  const progressPercent = Math.round(progress * 100);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Determine button states and text
  const showDownloadProgress = isDownloading || isPending || isPaused;
  // Check server state AND local SQLite for finished status
  const isCompleted = progress >= 0.95 || book.userMediaProgress?.isFinished === true || isMarkedFinished;

  const getPlayButtonContent = () => {
    if (isThisBookLoaded && isThisBookPlaying) {
      return { text: 'Pause', icon: 'pause' as const };
    }
    if (isDownloaded) {
      return { text: 'Play', icon: 'play' as const };
    }
    if (isCompleted) {
      return { text: 'Play Again', icon: 'play' as const };
    }
    if (hasProgress) {
      return { text: `Continue ${progressPercent}%`, icon: 'play' as const };
    }
    return { text: 'Stream', icon: 'play' as const };
  };

  const getDownloadButtonContent = () => {
    if (isDownloading || isPending) {
      return { text: isPaused ? 'Paused' : `${Math.round(downloadProgress * 100)}%`, showProgress: true };
    }
    if (isDownloaded) {
      return { text: 'Downloaded', showProgress: false };
    }
    return { text: 'Download', showProgress: false };
  };

  const downloadContent = getDownloadButtonContent();

  const playContent = getPlayButtonContent();

  const handlePlayPress = () => {
    if (isThisBookLoaded && isThisBookPlaying) {
      pause();
    } else if (isCompleted) {
      // CRITICAL FIX: When book is complete, always start from beginning
      // This prevents loading at position = duration which breaks playback
      handlePlayFromBeginning();
    } else if (isDownloaded) {
      handlePlay();
    } else {
      handleStream();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.textPrimary}
            colors={[COLORS.textPrimary]}
          />
        }
      >
        
        {/* Blurred cover background - scrolls with content */}
        {coverUrl && (
          <View style={styles.heroBackground}>
            <Image
              source={apiClient.getItemCoverUrl(bookId, { width: 800 })}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={Platform.OS === 'ios' ? 0 : 0}
              // blurRadius={25}
            />
            {/* BlurView for Android */}
            <BlurView intensity={0} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            {/* Smooth fade at bottom */}
            <LinearGradient
              colors={isDark
                ? ['transparent', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', COLORS.background]
                : ['transparent', 'transparent', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.7)', COLORS.background]
              }
              locations={[0, 0.5, 0.6, 0.8, .9]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}


        {/* Back button - absolute positioned */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + scale(8) }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={scale(24)} color={COLORS.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Genre Tags - horizontally scrollable, full width */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.heroGenreTags}
          style={[styles.genreScrollView, { marginTop: insets.top + scale(8) }]}
        >
          {genres.map((genre: string, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={styles.heroGenreTag}
              onPress={() => (navigation as any).navigate('GenreDetail', { genreName: genre })}
              activeOpacity={0.7}
              accessibilityLabel={`Genre: ${genre}`}
              accessibilityRole="button"
            >
              <Text style={styles.heroGenreTagText}>{genre}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cover Image - centered */}
        <View style={styles.coverSection}>
          <Image source={coverUrl} style={styles.cover} contentFit="cover" />

          {/* Series badge - top right of cover */}
          {series && (
            <TouchableOpacity
              style={[styles.seriesBadge, { backgroundColor: isDark ? COLORS.surface : '#FFFFFF' }]}
              onPress={() => {
                const seriesName = typeof series === 'string' ? series : series.name;
                if (seriesName) {
                  (navigation as any).navigate('SeriesDetail', { seriesName });
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel={`Series: ${typeof series === 'string' ? series : series.name}${seriesSequence ? `, Book ${seriesSequence}` : ''}`}
              accessibilityRole="button"
            >
              <Text style={[styles.seriesBadgeText, { color: COLORS.textPrimary }]} numberOfLines={1}>
                {typeof series === 'string' ? series : series.name}
                {seriesSequence ? ` #${seriesSequence}` : ''}
              </Text>
            </TouchableOpacity>
          )}

        </View>

        {/* Duration & Chapters - above title */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <Clock size={scale(14)} color={COLORS.textTertiary} strokeWidth={2} />
            <Text style={[styles.statsText, { color: COLORS.textTertiary }]}>{formatDuration(duration)}</Text>
            <Text style={[styles.statsDot, { color: COLORS.textTertiary }]}>·</Text>
            <List size={scale(14)} color={COLORS.textTertiary} strokeWidth={2} />
            <Text style={[styles.statsText, { color: COLORS.textTertiary }]}>{chapters.length} chapters</Text>
            {series && (
              <>
                <Text style={[styles.statsDot, { color: COLORS.textTertiary }]}>·</Text>
                <TouchableOpacity
                  onPress={() => {
                    const seriesName = typeof series === 'string' ? series : series.name;
                    if (seriesName) {
                      (navigation as any).navigate('SeriesDetail', { seriesName });
                    }
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.statsText, styles.seriesLink, { color: COLORS.textSecondary }]}>
                    {typeof series === 'string' ? series : series.name}
                    {seriesSequence ? ` #${seriesSequence}` : ''}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Title - scales to fit */}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: COLORS.textPrimary }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {title}
          </Text>
        </View>

        {/* Author & Narrator - centered side by side */}
        <View style={styles.creditContainer}>
          <View style={styles.creditRow}>
            <View style={styles.creditCell}>
              <Text style={[styles.creditLabel, { color: COLORS.textTertiary }]}>Written by</Text>
              <TouchableOpacity
                onPress={() => {
                  const firstAuthor = author.split(',')[0].trim();
                  (navigation as any).navigate('AuthorDetail', { authorName: firstAuthor });
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.creditValue, { color: COLORS.textPrimary }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {author}
                </Text>
              </TouchableOpacity>
            </View>
            {narrator && (
              <View style={styles.creditCell}>
                <Text style={[styles.creditLabel, { color: COLORS.textTertiary }]}>Narrated by</Text>
                <TouchableOpacity
                  onPress={() => {
                    const firstNarrator = narrator.split(',')[0].trim();
                    (navigation as any).navigate('NarratorDetail', { narratorName: firstNarrator });
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.creditValue, { color: COLORS.textPrimary }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {narrator}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Progress Bar (if in progress) */}
        {hasProgress && (
          <View style={styles.progressSection}>
            <View style={[styles.progressBar, { backgroundColor: COLORS.border }]}>
              <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: COLORS.textPrimary }]} />
            </View>
            <Text style={[styles.progressText, { color: COLORS.textSecondary }]}>{progressPercent}% complete · {formatDuration(duration * (1 - progress))} remaining</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <View style={styles.buttonRow}>
            {/* Queue Button (icon only) */}
            <TouchableOpacity
              style={[
                styles.iconButton,
                { borderColor: COLORS.border },
                isInQueue && { borderColor: COLORS.textSecondary, backgroundColor: COLORS.surface }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (isInQueue) {
                  handleRemoveFromQueue();
                } else {
                  handleAddToQueue();
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel={isInQueue ? 'Remove from queue' : 'Add to queue'}
              accessibilityRole="button"
            >
              {isInQueue ? (
                <CheckCircle size={scale(20)} color={COLORS.textPrimary} strokeWidth={2} />
              ) : (
                <Plus size={scale(20)} color={COLORS.textPrimary} strokeWidth={2} />
              )}
            </TouchableOpacity>

            {/* Download Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: COLORS.border },
                isDownloaded && { borderColor: COLORS.textSecondary, backgroundColor: COLORS.surface },
                isPaused && { borderColor: '#FF9800', backgroundColor: 'rgba(255,152,0,0.15)' }
              ]}
              onPress={handleDownloadPress}
              activeOpacity={0.8}
              accessibilityLabel={isDownloaded ? 'Downloaded, tap to delete' : downloadContent.text}
              accessibilityRole="button"
            >
              {isDownloaded ? (
                <CheckCircle size={scale(18)} color={COLORS.textPrimary} strokeWidth={2} />
              ) : isPaused ? (
                <Pause size={scale(18)} color="#FF9800" fill="#FF9800" strokeWidth={0} />
              ) : (isDownloading || isPending) ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <ArrowDown size={scale(18)} color={COLORS.textPrimary} strokeWidth={2} />
              )}
              <Text style={[styles.actionButtonText, { color: isPaused ? '#FF9800' : COLORS.textPrimary }]}>{downloadContent.text}</Text>
            </TouchableOpacity>

            {/* Primary Button - Play/Stream */}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: COLORS.textPrimary }]}
              onPress={handlePlayPress}
              activeOpacity={0.8}
              accessibilityLabel={playContent.text}
              accessibilityRole="button"
            >
              {playContent.icon === 'pause' ? (
                <Pause size={scale(18)} color={COLORS.background} fill={COLORS.background} strokeWidth={0} />
              ) : (
                <Play size={scale(18)} color={COLORS.background} fill={COLORS.background} strokeWidth={0} />
              )}
              <Text style={[styles.primaryButtonText, { color: COLORS.background }]}>{playContent.text}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs Row - Overview, Chapters, Book icon */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsLeft}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && { borderBottomColor: COLORS.textPrimary }]}
              onPress={() => setActiveTab('overview')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'overview' }}
              accessibilityLabel="Overview"
            >
              <Text style={[styles.tabText, { color: COLORS.textTertiary }, activeTab === 'overview' && { color: COLORS.textPrimary, fontWeight: '600' }]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chapters' && { borderBottomColor: COLORS.textPrimary }]}
              onPress={() => setActiveTab('chapters')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'chapters' }}
              accessibilityLabel="Chapters"
            >
              <Text style={[styles.tabText, { color: COLORS.textTertiary }, activeTab === 'chapters' && { color: COLORS.textPrimary, fontWeight: '600' }]}>
                Chapters
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mark as finished button */}
          <TouchableOpacity
            style={styles.finishedButton}
            onPress={isCompleted ? handleMarkAsNotStarted : handleMarkAsFinished}
            disabled={isMarkingFinished}
            activeOpacity={0.8}
            accessibilityLabel={isCompleted ? 'Remove from finished' : 'Mark as finished'}
            accessibilityRole="button"
          >
            <Text style={[styles.finishedText, { color: isCompleted ? accentColors.gold : COLORS.textTertiary }]}>
              {isCompleted ? 'Finished' : 'Mark read'}
            </Text>
            {isMarkingFinished ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : isCompleted ? (
              <BookCheck
                size={scale(20)}
                color={accentColors.gold}
                strokeWidth={2.5}
              />
            ) : (
              <BookOpen
                size={scale(20)}
                color={COLORS.textTertiary}
                strokeWidth={2}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <>
              <OverviewTab book={book} showFullDetails />
              {/* Genre Tags - below overview */}
              {genres.length > 0 && (
                <View style={styles.genreTagsRow}>
                  {genres.slice(0, 5).map((genre: string, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => (navigation as any).navigate('GenreDetail', { genreName: genre })}
                      activeOpacity={0.7}
                      accessibilityLabel={`Genre: ${genre}`}
                      accessibilityRole="button"
                      accessibilityHint="Double tap to view books in this genre"
                    >
                      <Text style={[styles.genreTag, { color: COLORS.textPrimary }]}>{genre}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
          {activeTab === 'chapters' && (
            <ChaptersTab
              chapters={chapters}
              currentPosition={currentPosition}
              bookId={bookId}
              book={book}
            />
          )}
        </View>
      </ScrollView>

      {/* Snackbar for feedback */}
      <Snackbar {...snackbarProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scale(550), // Covers hero area
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: scale(12),
    fontSize: scale(12),
  },

  scrollView: {
    flex: 1,
  },

  // Cover Section - centered with shadow
  coverSection: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    alignSelf: 'center',
    marginTop: scale(16),
    borderRadius: radius.md,
    overflow: 'hidden',
    // Drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    opacity: 0,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  // Back button - absolute positioned
  backButton: {
    position: 'absolute',
    left: scale(12),
    width: scale(44),
    height: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  // Genre scroll view - full width
  genreScrollView: {
    height: scale(44),
    zIndex: 20,
  },
  seriesBadge: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(16),
    maxWidth: scale(200),
    zIndex: 10,
    elevation: 5,
  },
  seriesBadgeText: {
    fontSize: scale(12),
    fontWeight: '600',
  },
  // Hero Genre Tags - horizontally scrollable
  heroGenreTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingLeft: scale(56),
    paddingRight: scale(16),
  },
  heroGenreTag: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroGenreTagText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Title - same width as button section
  titleContainer: {
    paddingHorizontal: scale(20),
    paddingTop: scale(4),
    marginBottom: scale(12),
  },
  title: {
    fontSize: scale(32),
    fontWeight: '700',
    textAlign: 'center',
  },

  // Credits - author & narrator centered side by side
  creditContainer: {
    paddingHorizontal: scale(20),
    marginBottom: scale(16),
  },
  creditRow: {
    flexDirection: 'row',
    gap: scale(20),
  },
  creditCell: {
    flex: 1,
    alignItems: 'center',
  },
  creditLabel: {
    fontSize: scale(11),
    fontWeight: '500',
    textTransform: 'capitalize',
    marginBottom: scale(4),
    textAlign: 'center',
  },
  creditValue: {
    fontSize: scale(15),
    fontWeight: '500',
    textAlign: 'center',
  },

  // Stats Row - duration & chapters
  statsContainer: {
    alignItems: 'center',
    marginTop: scale(8),
    marginBottom: scale(8),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  statsText: {
    fontSize: scale(13),
    fontWeight: '500',
  },
  statsDot: {
    fontSize: scale(13),
    marginHorizontal: scale(4),
  },
  seriesLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Button Container
  buttonContainer: {
    paddingHorizontal: scale(20),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(10),
  },

  // Action Button - outline style (Download)
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    gap: scale(8),
  },
  actionButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
  },

  // Primary Button - filled (Play/Stream)
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(48),
    borderRadius: scale(24),
    gap: scale(8),
  },
  primaryButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
  },

  // Icon Button - minimal, icon only (Queue)
  iconButton: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress Section
  progressSection: {
    paddingHorizontal: scale(20),
    marginBottom: scale(20),
  },
  progressBar: {
    height: scale(4),
    borderRadius: scale(2),
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(2),
  },
  progressText: {
    fontSize: scale(12),
  },

  // Genre Tags (in overview)
  genreTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    gap: scale(8),
    marginTop: scale(16),
    marginBottom: scale(12),
  },
  genreTag: {
    fontSize: scale(12),
    fontWeight: '500',
  },

  // Tabs Container
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    marginTop: scale(24),
  },
  tabsLeft: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: scale(14),
    marginRight: scale(24),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    // Colors now applied inline
  },
  tabText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  finishedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    height: scale(44),
    paddingHorizontal: scale(4),
  },
  finishedText: {
    fontSize: scale(12),
    fontWeight: '500',
  },
  tabContent: {
    paddingTop: scale(20),
  },
});
