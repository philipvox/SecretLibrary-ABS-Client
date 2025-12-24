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
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  ChevronLeft,
  Play,
  Pause,
  ArrowDown,
  CheckCircle,
  Clock,
  List,
  PlusCircle,
  RotateCcw,
  CheckCheck,
  Music,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useBookDetails } from '../hooks/useBookDetails';
import { OverviewTab } from '../components/OverviewTab';
import { ChaptersTab } from '../components/ChaptersTab';
import { SeriesNavigator } from '../components/SeriesNavigator';
import { ErrorView, BookDetailSkeleton, Snackbar, useSnackbar } from '@/shared/components';
import { useCoverUrl } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { userApi } from '@/core/api/endpoints/user';
import { useDownloadStatus as useDownloadStatusHook } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';
import { useGalleryStore } from '@/features/reading-history-wizard';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, wp, hp, spacing, radius, layout } from '@/shared/theme';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';

// Design constants
const ACCENT = colors.accent;
const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);
const COVER_SIZE = SCREEN_WIDTH * 0.5; // 50% width per design spec

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
      console.error('Failed to start playback:', err);
    }
  }, [book, loadBook]);

  const handlePause = useCallback(async () => {
    await pause();
  }, [pause]);

  const handleStream = useCallback(async () => {
    if (!book) return;
    try {
      // Stream without downloading
      await loadBook(book, { showPlayer: false });
    } catch (err) {
      console.error('Failed to stream:', err);
      Alert.alert('Streaming Error', 'Could not start streaming. Check your connection.');
    }
  }, [book, loadBook]);

  const handlePlayFromBeginning = useCallback(async () => {
    if (!book) return;
    try {
      await loadBook(book, { showPlayer: false, startPosition: 0 });
    } catch (err) {
      console.error('Failed to restart playback:', err);
    }
  }, [book, loadBook]);

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
  const markBookInGallery = useGalleryStore((s) => s.markBook);
  const unmarkBookInGallery = useGalleryStore((s) => s.unmarkBook);
  const isMarkedInGallery = useGalleryStore((s) => s.isMarked(bookId));

  // Snackbar for feedback
  const { snackbarProps, showUndo, showSuccess, showError } = useSnackbar();

  const handleMarkAsFinished = useCallback(async () => {
    if (isMarkingFinished || !book) return;
    setIsMarkingFinished(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Update local reading history (galleryStore) - immediate UI update
      await markBookInGallery(bookId);

      // Show snackbar with undo option
      showUndo('Marked as finished', async () => {
        await unmarkBookInGallery(bookId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 5000);

      // Get book duration for proper progress update
      const bookDuration = (book.media as any)?.duration || 0;

      // Update server-side progress with duration (background)
      userApi.markAsFinished(bookId, bookDuration).catch((err) => {
        console.warn('Server sync failed:', err);
      });

      // Refetch to update progress display
      refetch();
    } catch (err) {
      console.error('Failed to mark as finished:', err);
      showError('Failed to mark as finished');
    } finally {
      setIsMarkingFinished(false);
    }
  }, [bookId, book, isMarkingFinished, refetch, markBookInGallery, unmarkBookInGallery, showUndo, showError]);

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

              // Remove from local reading history (galleryStore)
              await unmarkBookInGallery(bookId);

              // Show feedback
              showSuccess('Removed from history');

              // Reset server-side progress (background)
              userApi.markAsNotStarted(bookId).catch((err) => {
                console.warn('Server sync failed:', err);
              });

              refetch();
            } catch (err) {
              console.error('Failed to reset progress:', err);
              showError('Failed to remove from history');
            } finally {
              setIsMarkingFinished(false);
            }
          },
        },
      ]
    );
  }, [bookId, isMarkingFinished, refetch, unmarkBookInGallery, showSuccess, showError]);

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
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
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
  // Check both server state AND local galleryStore for finished status
  const isCompleted = progress >= 0.95 || book.userMediaProgress?.isFinished === true || isMarkedInGallery;

  const getPlayButtonContent = () => {
    if (isThisBookLoaded && isThisBookPlaying) {
      return { text: 'Pause', icon: 'pause' as const };
    }
    if (!isDownloaded) {
      return { text: 'Stream', icon: 'play' as const };
    }
    if (isCompleted) {
      return { text: 'Play Again', icon: 'play' as const };
    }
    if (hasProgress) {
      return { text: 'Resume', icon: 'play' as const };
    }
    return { text: 'Play', icon: 'play' as const };
  };

  const playContent = getPlayButtonContent();

  const handlePlayPress = () => {
    if (isThisBookLoaded && isThisBookPlaying) {
      pause();
    } else if (isDownloaded) {
      handlePlay();
    } else {
      handleStream();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Blurred cover background */}
      {coverUrl && (
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={coverUrl}
            style={styles.backgroundImage}
            contentFit="cover"
            blurRadius={60}
          />
          {/* BlurView for Android (blurRadius only works on iOS) */}
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      {!coverUrl && (
        <LinearGradient
          colors={['#2d3a2d', '#1a1f1a', '#0d0f0d']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Back button - minimal header */}
      <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT + 8 }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        {/* Genre Tags at top */}
        {genres.length > 0 && (
          <View style={styles.genreTagsRow}>
            {genres.slice(0, 3).map((genre: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                onPress={() => (navigation as any).navigate('GenreDetail', { genreName: genre })}
                activeOpacity={0.7}
                accessibilityLabel={`Genre: ${genre}`}
                accessibilityRole="button"
                accessibilityHint="Double tap to view books in this genre"
              >
                <Text style={styles.genreTag}>{genre}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Large Centered Title */}
        <Text style={[styles.title, genres.length === 0 && styles.titleNoGenres]} numberOfLines={3}>{title}</Text>

        {/* Author/Narrator Two-Column Section */}
        <View style={styles.creditsRow}>
          {/* Author Column */}
          <View style={styles.creditColumn}>
            <Text style={styles.creditLabel}>Written By:</Text>
            <TouchableOpacity
              onPress={() => {
                const firstAuthor = author.split(',')[0].trim();
                (navigation as any).navigate('AuthorDetail', { authorName: firstAuthor });
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Author: ${author}`}
              accessibilityRole="button"
              accessibilityHint="Double tap to view author details"
            >
              <Text style={styles.creditName} numberOfLines={1}>{author}</Text>
            </TouchableOpacity>
          </View>

          {/* Narrator Column */}
          {narrator && (
            <View style={styles.creditColumn}>
              <Text style={styles.creditLabel}>Narrated By:</Text>
              <TouchableOpacity
                onPress={() => {
                  const firstNarrator = narrator.split(',')[0].trim();
                  (navigation as any).navigate('NarratorDetail', { narratorName: firstNarrator });
                }}
                activeOpacity={0.7}
                accessibilityLabel={`Narrator: ${narrator}`}
                accessibilityRole="button"
                accessibilityHint="Double tap to view narrator details"
              >
                <Text style={styles.creditName} numberOfLines={1}>{narrator}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Cover Image - 50% width */}
        <View style={styles.coverSection}>
          <View style={styles.coverContainer}>
            <Image source={coverUrl} style={styles.cover} contentFit="cover" />
          </View>
        </View>

        {/* Two Pill Buttons - Download and Stream/Play */}
        <View style={styles.pillButtonsRow}>
          {/* Download Button */}
          {showDownloadProgress ? (
            <TouchableOpacity
              style={styles.pillButton}
              onPress={handleDownloadPress}
              activeOpacity={0.7}
              accessibilityLabel={isPending ? 'Download preparing' : isPaused ? `Download paused at ${Math.round(downloadProgress * 100)}%` : `Downloading ${Math.round(downloadProgress * 100)}%`}
              accessibilityRole="button"
              accessibilityHint={isPaused ? 'Double tap to resume download' : 'Double tap to pause download'}
            >
              <View style={styles.downloadProgressContainer}>
                <View style={styles.downloadProgressRow}>
                  {isPending ? (
                    <ActivityIndicator size="small" color={ACCENT} style={{ marginRight: scale(6) }} />
                  ) : isPaused ? (
                    <Play size={scale(16)} color={ACCENT} fill={ACCENT} strokeWidth={0} />
                  ) : (
                    <Pause size={scale(16)} color={ACCENT} strokeWidth={2} />
                  )}
                  <Text style={styles.pillButtonText}>
                    {isPending ? 'Preparing...' : isPaused ? 'Paused' : `${Math.round(downloadProgress * 100)}%`}
                  </Text>
                </View>
                <View style={styles.downloadProgressTrack}>
                  <View style={[styles.downloadProgressFill, { width: `${downloadProgress * 100}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.pillButton, isDownloaded && styles.pillButtonDownloaded]}
              onPress={handleDownloadPress}
              activeOpacity={0.7}
              accessibilityLabel={isDownloaded ? 'Downloaded' : 'Download'}
              accessibilityRole="button"
              accessibilityHint={isDownloaded ? 'Double tap to delete download' : 'Double tap to download for offline listening'}
            >
              {isDownloaded ? (
                <CheckCircle size={scale(18)} color={ACCENT} strokeWidth={2} />
              ) : (
                <ArrowDown size={scale(18)} color="#fff" strokeWidth={2} />
              )}
              <Text style={[styles.pillButtonText, isDownloaded && styles.pillButtonTextAccent]}>
                {isDownloaded ? 'Downloaded' : 'Download'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Stream/Play Button */}
          <TouchableOpacity
            style={[styles.pillButton, styles.pillButtonPrimary]}
            onPress={handlePlayPress}
            activeOpacity={0.7}
            accessibilityLabel={playContent.text}
            accessibilityRole="button"
            accessibilityHint={isThisBookPlaying ? 'Double tap to pause' : 'Double tap to play'}
          >
            {playContent.icon === 'pause' ? (
              <Pause size={scale(18)} color="#000" strokeWidth={2} />
            ) : (
              <Play size={scale(18)} color="#000" fill="#000" strokeWidth={0} />
            )}
            <Text style={styles.pillButtonTextDark}>{playContent.text}</Text>
          </TouchableOpacity>
        </View>

        {/* Duration & Chapters Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Clock size={scale(16)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            <Text style={styles.infoText}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.infoDivider} />
          <TouchableOpacity
            style={styles.infoItem}
            onPress={() => setActiveTab('chapters')}
            activeOpacity={0.7}
            accessibilityLabel={`${chapters.length} chapters`}
            accessibilityRole="button"
            accessibilityHint="Double tap to view chapters"
          >
            <List size={scale(16)} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            <Text style={styles.infoText}>{chapters.length} Chapters</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar (if in progress) */}
        {hasProgress && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressText}>{progressPercent}% Complete</Text>
              <Text style={styles.progressTimeRemaining}>
                {formatDuration(duration * (1 - progress))} remaining
              </Text>
            </View>
          </View>
        )}

        {/* Series Navigation */}
        <SeriesNavigator book={book} />

        {/* Action Links Row */}
        <View style={styles.actionLinksRow}>
          {/* Add to Queue */}
          <TouchableOpacity
            style={styles.actionLink}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (isInQueue) {
                handleRemoveFromQueue();
              } else {
                handleAddToQueue();
              }
            }}
            activeOpacity={0.7}
            accessibilityLabel={isInQueue ? `In queue at position ${queuePosition}` : 'Add to queue'}
            accessibilityRole="button"
          >
            {isInQueue ? (
              <CheckCircle size={scale(18)} color={ACCENT} strokeWidth={2} />
            ) : (
              <PlusCircle size={scale(18)} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            )}
            <Text style={[styles.actionLinkText, isInQueue && styles.actionLinkTextActive]}>
              {isInQueue ? `Queue #${queuePosition}` : 'Add to Queue'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.actionLinkDivider} />

          {/* Mark as Finished / Reset Progress */}
          <TouchableOpacity
            style={styles.actionLink}
            onPress={isCompleted ? handleMarkAsNotStarted : handleMarkAsFinished}
            disabled={isMarkingFinished}
            activeOpacity={0.7}
            accessibilityLabel={isCompleted ? 'Reset progress' : 'Mark as finished'}
            accessibilityRole="button"
          >
            {isMarkingFinished ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : isCompleted ? (
              <RotateCcw size={scale(18)} color={ACCENT} strokeWidth={2} />
            ) : (
              <CheckCheck size={scale(18)} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            )}
            <Text style={[styles.actionLinkText, isCompleted && styles.actionLinkTextActive]}>
              {isCompleted ? 'Completed' : 'Mark Finished'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs Row - Overview, Chapters */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsLeft}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
              onPress={() => setActiveTab('overview')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'overview' }}
              accessibilityLabel="Overview"
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chapters' && styles.tabActive]}
              onPress={() => setActiveTab('chapters')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'chapters' }}
              accessibilityLabel="Chapters"
            >
              <Text style={[styles.tabText, activeTab === 'chapters' && styles.tabTextActive]}>
                Chapters
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <OverviewTab book={book} showFullDetails />
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
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: scale(12),
    fontSize: scale(12),
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  // Header - minimal, just back button
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: scale(12),
    zIndex: 100,
  },
  headerButton: {
    width: scale(44),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: scale(44),
  },

  scrollView: {
    flex: 1,
  },

  // Genre Tags at top
  genreTagsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: scale(100),
    paddingHorizontal: scale(20),
    gap: SCREEN_WIDTH * 0.05, // 5% screen width spacing
    marginBottom: SCREEN_HEIGHT * 0.02, // 2% screen height
  },
  genreTag: {
    fontSize: scale(12),
    color: ACCENT,
    fontWeight: '500',
  },

  // Large Centered Title
  title: {
    fontSize: scale(24),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: scale(20),
    marginBottom: SCREEN_HEIGHT * 0.02,
    letterSpacing: 0.3,
  },
  titleNoGenres: {
    paddingTop: scale(100), // Add top padding when no genres
  },

  // Two-column Author/Narrator section
  creditsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: scale(20),
    gap: SCREEN_WIDTH * 0.08, // 8% screen width gap
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  creditColumn: {
    alignItems: 'center',
  },
  creditLabel: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.6)',
    marginBottom: SCREEN_HEIGHT * 0.005, // 0.5% screen height
  },
  creditName: {
    fontSize: scale(14),
    color: ACCENT,
    fontWeight: '500',
    maxWidth: SCREEN_WIDTH * 0.35,
  },

  // Cover Section - 50% width
  coverSection: {
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE * 1.1,
    borderRadius: COVER_SIZE * 0.02, // 2% of cover width
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  cover: {
    width: '100%',
    height: '100%',
  },

  // Two Pill Buttons Row
  pillButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
    gap: SCREEN_WIDTH * 0.03, // 3% screen width gap
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  pillButton: {
    width: SCREEN_WIDTH * 0.4, // 40% screen width each
    height: SCREEN_HEIGHT * 0.05, // 5% screen height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: scale(100), // Fully rounded pill
    gap: scale(8),
  },
  pillButtonDownloaded: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(244,182,12,0.1)',
  },
  pillButtonPrimary: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  pillButtonText: {
    fontSize: scale(14),
    color: '#fff',
    fontWeight: '600',
  },
  pillButtonTextAccent: {
    color: ACCENT,
  },
  pillButtonTextDark: {
    fontSize: scale(14),
    color: '#000',
    fontWeight: '600',
  },

  // Download progress inside pill button
  downloadProgressContainer: {
    flex: 1,
    paddingHorizontal: scale(12),
  },
  downloadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(4),
    gap: scale(6),
  },
  downloadProgressTrack: {
    height: scale(3),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },

  // Info Row (Duration & Chapters)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
    marginBottom: SCREEN_HEIGHT * 0.02,
    gap: scale(16),
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  infoDivider: {
    width: 1,
    height: scale(16),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  infoText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.7)',
  },

  // Progress Section
  progressSection: {
    paddingHorizontal: scale(20),
    marginBottom: SCREEN_HEIGHT * 0.02,
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: scale(8),
  },
  progressText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  progressTimeRemaining: {
    fontSize: scale(11),
    color: ACCENT,
    fontWeight: '500',
  },

  // Tabs Container with Add to Queue link
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    borderBottomColor: ACCENT,
  },
  tabText: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Action Links Row (Queue, Mark Finished, etc.)
  actionLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    marginTop: scale(8),
    marginBottom: scale(4),
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
  },
  actionLinkText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  actionLinkTextActive: {
    color: ACCENT,
    fontWeight: '600',
  },
  actionLinkDivider: {
    width: 1,
    height: scale(20),
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: scale(8),
  },
  tabContent: {
    paddingTop: scale(20),
  },
});
