/**
 * src/features/book-detail/screens/BookDetailScreen.tsx
 *
 * Dark theme book detail screen matching home screen design
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useBookDetails } from '../hooks/useBookDetails';
import { OverviewTab } from '../components/OverviewTab';
import { ChaptersTab } from '../components/ChaptersTab';
import { LoadingSpinner, ErrorView } from '@/shared/components';
import { useCoverUrl } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { useDownloadStatus as useDownloadStatusHook } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useQueueStore, useIsInQueue } from '@/features/queue/stores/queueStore';

// Design constants matching HomeScreen - minimal accent usage
const ACCENT = '#c1f40c';
const ACCENT_SUBTLE = 'rgba(193,244,12,0.6)'; // Muted accent for less prominence
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });
const SCREEN_WIDTH = Dimensions.get('window').width;
const COVER_SIZE = SCREEN_WIDTH * 0.45;

type BookDetailRouteParams = {
  BookDetail: { id: string };
};

type TabType = 'overview' | 'chapters' | 'details';

export function BookDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<BookDetailRouteParams, 'BookDetail'>>();
  const navigation = useNavigation();
  const { id: bookId } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { book, isLoading, error, refetch } = useBookDetails(bookId);
  const { loadBook, currentBook, isPlaying, play, pause } = usePlayerStore();
  const {
    isDownloaded,
    isDownloading,
    isPending,
    progress: downloadProgress
  } = useDownloadStatusHook(bookId);
  const isThisBookPlaying = currentBook?.id === bookId && isPlaying;
  const isThisBookLoaded = currentBook?.id === bookId;
  const coverUrl = useCoverUrl(bookId);

  // Queue state
  const isInQueue = useIsInQueue(bookId);
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);

  const handlePlayPause = useCallback(async () => {
    if (!book) return;

    // If this book is already loaded, toggle play/pause
    if (isThisBookLoaded) {
      if (isPlaying) {
        await pause();
      } else {
        await play();
      }
      return;
    }

    // Otherwise, load and start playing this book
    try {
      await loadBook(book, { showPlayer: false });
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  }, [book, loadBook, isThisBookLoaded, isPlaying, play, pause]);

  const handleDownload = useCallback(() => {
    if (!book) return;
    if (isDownloaded || isDownloading || isPending) {
      return;
    }
    downloadManager.queueDownload(book);
  }, [book, isDownloaded, isDownloading, isPending]);

  const handleQueueToggle = useCallback(() => {
    if (!book || !isDownloaded) return;
    if (isInQueue) {
      removeFromQueue(bookId);
    } else {
      addToQueue(book);
    }
  }, [book, bookId, isDownloaded, isInQueue, addToQueue, removeFromQueue]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading...</Text>
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

  const playButtonText = hasProgress ? 'Continue' : 'Play';

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
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
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

      {/* Header - Only back button and queue indicator when queued */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        {/* Only show queue indicator when book is in queue */}
        {isInQueue && (
          <TouchableOpacity style={styles.queueIndicator} onPress={handleQueueToggle}>
            <Ionicons name="checkmark" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover and Info */}
        <View style={styles.coverSection}>
          {/* Title and Author above cover */}
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.author}>{author}</Text>

          <View style={styles.coverContainer}>
            <Image source={coverUrl} style={styles.cover} contentFit="cover" />
          </View>

          {/* Narrator below cover */}
          {narrator && <Text style={styles.narrator}>Narrated by {narrator}</Text>}

          {/* Progress */}
          {hasProgress && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{progressPercent}% Complete</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.5)" />
            <Text style={styles.statValue}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="list-outline" size={18} color="rgba(255,255,255,0.5)" />
            <Text style={styles.statValue}>{chapters.length} Chapters</Text>
          </View>
          {series && (
            <>
              <View style={styles.statDivider} />
              <TouchableOpacity
                style={[styles.statItem, { flexShrink: 1 }]}
                onPress={() => {
                  const seriesName = typeof series === 'object' ? series.name : series;
                  if (seriesName) {
                    (navigation as any).navigate('SeriesDetail', { seriesName });
                  }
                }}
              >
                <Text style={styles.seriesLink} numberOfLines={2}>
                  {typeof series === 'object' ? series.name : series}
                  {seriesSequence ? ` #${seriesSequence}` : ''}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Action Buttons - Download and Play */}
        <View style={styles.actionButtons}>
          {/* Download Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              isDownloaded && styles.actionButtonCompleted
            ]}
            onPress={handleDownload}
            disabled={isDownloading || isPending || isDownloaded}
            activeOpacity={0.7}
          >
            {isDownloaded ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={ACCENT} />
                <Text style={styles.actionButtonTextCompleted}>Downloaded</Text>
              </>
            ) : isDownloading || isPending ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.actionButtonText}>{Math.round(downloadProgress * 100)}%</Text>
              </>
            ) : (
              <>
                <Ionicons name="arrow-down-circle-outline" size={18} color="rgba(255,255,255,0.7)" />
                <Text style={styles.actionButtonText}>Download</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Play Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.playButton, isThisBookPlaying && styles.playButtonActive]}
            onPress={handlePlayPause}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isThisBookPlaying ? 'pause' : 'play'}
              size={18}
              color={isThisBookPlaying ? '#000' : 'rgba(255,255,255,0.7)'}
            />
            <Text style={[styles.actionButtonText, isThisBookPlaying && styles.playButtonTextActive]}>
              {isThisBookPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs with Queue (+) button */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsLeft}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chapters' && styles.tabActive]}
              onPress={() => setActiveTab('chapters')}
            >
              <Text style={[styles.tabText, activeTab === 'chapters' && styles.tabTextActive]}>
                Chapters
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'details' && styles.tabActive]}
              onPress={() => setActiveTab('details')}
            >
              <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                Details
              </Text>
            </TouchableOpacity>
          </View>

          {/* Queue (+) button - only show when downloaded and not yet in queue */}
          {isDownloaded && !isInQueue && (
            <TouchableOpacity style={styles.addToQueueButton} onPress={handleQueueToggle}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <OverviewTab book={book} />
          )}
          {activeTab === 'chapters' && (
            <ChaptersTab chapters={chapters} bookId={bookId} />
          )}
          {activeTab === 'details' && (
            <View style={styles.detailsTab}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>TITLE</Text>
                <Text style={styles.detailValue}>{title}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>AUTHOR</Text>
                <Text style={styles.detailValue}>{author}</Text>
              </View>
              {narrator && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>NARRATOR</Text>
                  <Text style={styles.detailValue}>{narrator}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DURATION</Text>
                <Text style={styles.detailValue}>{formatDuration(duration)}</Text>
              </View>
              {metadata.publishedYear && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PUBLISHED</Text>
                  <Text style={styles.detailValue}>{metadata.publishedYear}</Text>
                </View>
              )}
              {metadata.publisher && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PUBLISHER</Text>
                  <Text style={styles.detailValue}>{metadata.publisher}</Text>
                </View>
              )}
              {genres.length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>GENRES</Text>
                  <View style={styles.genrePills}>
                    {genres.map((genre: string, idx: number) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.genrePill}
                        onPress={() => (navigation as any).navigate('GenreDetail', { genreName: genre })}
                      >
                        <Text style={styles.genrePillText}>#{genre.toLowerCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
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
    marginTop: 12,
    fontFamily: MONO_FONT,
    fontSize: 12,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollView: {
    flex: 1,
  },

  // Cover Section
  coverSection: {
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE * 1.1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  author: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 4,
  },
  narrator: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },

  // Progress
  progressSection: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.7)', // Subtle white instead of green
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    letterSpacing: 0.2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
  },
  seriesLink: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
    textAlign: 'center',
    maxWidth: 180,
  },

  // Action Buttons - Download and Sample (same size pills)
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    gap: 8,
    minWidth: 120,
  },
  actionButtonCompleted: {
    backgroundColor: 'rgba(193,244,12,0.1)',
  },
  actionButtonText: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.7)',
  },
  actionButtonTextCompleted: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    color: ACCENT,
  },
  playButton: {
    // Same base styling from actionButton
  },
  playButtonActive: {
    backgroundColor: ACCENT,
  },
  playButtonTextActive: {
    color: '#000',
  },

  // Genre Pills (in Details tab)
  genrePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  genrePillText: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabsLeft: {
    flexDirection: 'row',
  },
  addToQueueButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 14,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: 'rgba(255,255,255,0.8)', // Subtle white instead of green
  },
  tabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    paddingTop: 20,
  },

  // Details Tab
  detailsTab: {
    paddingHorizontal: 20,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
  },
});
