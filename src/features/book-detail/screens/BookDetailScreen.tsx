/**
 * src/features/book-detail/screens/BookDetailScreen.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useBookDetails } from '../hooks/useBookDetails';
import { OverviewTab } from '../components/OverviewTab';
import { ChaptersTab } from '../components/ChaptersTab';
import { LoadingSpinner, ErrorView, HeartButton } from '@/shared/components';
import { Icon } from '@/shared/components/Icon';
import { useCoverUrl } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { autoDownloadService, DownloadStatus } from '@/features/downloads';
import { theme } from '@/shared/theme';

type BookDetailRouteParams = {
  BookDetail: { id: string };
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const COVER_SIZE = SCREEN_WIDTH * 0.38;

type TabType = 'overview' | 'chapters' | 'details';

// Hook for download status
function useDownloadStatus(bookId: string) {
  const [status, setStatus] = useState<DownloadStatus>(() =>
    autoDownloadService.getStatus(bookId)
  );
  const [progress, setProgress] = useState<number>(() =>
    autoDownloadService.getProgress(bookId)
  );

  useEffect(() => {
    setStatus(autoDownloadService.getStatus(bookId));
    setProgress(autoDownloadService.getProgress(bookId));

    const unsubProgress = autoDownloadService.onProgress((id, pct) => {
      if (id === bookId) setProgress(pct);
    });
    const unsubStatus = autoDownloadService.onStatus((id, newStatus) => {
      if (id === bookId) setStatus(newStatus);
    });

    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, [bookId]);

  return { status, progress };
}

export function BookDetailScreen() {
  const route = useRoute<RouteProp<BookDetailRouteParams, 'BookDetail'>>();
  const navigation = useNavigation();
  const { id: bookId } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { book, isLoading, error, refetch } = useBookDetails(bookId);
  const { loadBook } = usePlayerStore();
  const { status: downloadStatus } = useDownloadStatus(bookId);
  const coverUrl = useCoverUrl(bookId);

  // ALL HOOKS MUST BE BEFORE EARLY RETURNS
  const handlePlay = useCallback(async () => {
    if (!book) return;
    try {
      await loadBook(book);
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  }, [book, loadBook]);

  const handleDownload = useCallback(() => {
    if (!book) return;
    if (downloadStatus === 'completed' || downloadStatus === 'downloading' || downloadStatus === 'queued') {
      return;
    }
    autoDownloadService.startDownload(book);
  }, [book, downloadStatus]);

  // Early returns AFTER all hooks
  if (isLoading) {
    return <LoadingSpinner text="Loading book details..." />;
  }

  if (error || !book) {
    return <ErrorView message="Failed to load book details" onRetry={refetch} />;
  }

  // Derived values (not hooks, safe after early returns)
  const metadata = book.media.metadata as any;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authorName || 'Unknown Author';
  const rawNarrator = metadata.narratorName || '';
  const narrator = rawNarrator.replace(/^Narrated by\s*/i, '').trim() || null;
  const genres = metadata.genres || [];
  const chapters = book.media.chapters || [];

  let duration = book.media.duration || 0;
  if (!duration && book.media.audioFiles?.length) {
    duration = book.media.audioFiles.reduce((sum: number, f: any) => sum + (f.duration || 0), 0);
  }

  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;

  const renderDownloadIcon = () => {
    if (downloadStatus === 'completed') {
      return <Icon name="checkmark-circle" size={22} color="#22c55e" set="ionicons" />;
    }
    if (downloadStatus === 'downloading' || downloadStatus === 'queued') {
      return <ActivityIndicator size="small" color={theme.colors.text.secondary} />;
    }
    return <Icon name="download-outline" size={22} color={theme.colors.text.secondary} set="ionicons" />;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const playButtonText = hasProgress ? 'Continue' : 'Play Now';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={theme.colors.text.primary} set="ionicons" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleDownload}
            disabled={downloadStatus === 'downloading' || downloadStatus === 'queued'}
            style={styles.headerButton}
          >
            {renderDownloadIcon()}
          </TouchableOpacity>
          <HeartButton bookId={book.id} size={24} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Top Section - Cover + Info */}
        <View style={styles.topSection}>
          <View style={styles.coverContainer}>
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
          </View>

          <View style={styles.infoSide}>
            <Text style={styles.title} numberOfLines={3}>{title}</Text>
            <Text style={styles.authorLabel}>
              Author: <Text style={styles.authorName}>{author}</Text>
            </Text>
            {narrator && (
              <Text style={styles.narratorLabel}>
                Narrator: <Text style={styles.narratorName}>{narrator}</Text>
              </Text>
            )}

            {genres.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsLabel}>Tags</Text>
                <View style={styles.tagsRow}>
                  {genres.slice(0, 2).map((genre: string, idx: number) => (
                    <View key={idx} style={styles.tag}>
                      <Text style={styles.tagText}>#{genre.toLowerCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Chapters</Text>
            <Text style={styles.statValue}>{chapters.length}</Text>
          </View>
        </View>

        {/* Action Buttons - NN/g: Primary actions should be prominent */}
        <View style={styles.actionButtons}>
          {/* Download Button - Prominent when not downloaded */}
          {downloadStatus !== 'completed' ? (
            <TouchableOpacity
              style={[
                styles.downloadButton,
                (downloadStatus === 'downloading' || downloadStatus === 'queued') && styles.downloadButtonDisabled
              ]}
              onPress={handleDownload}
              disabled={downloadStatus === 'downloading' || downloadStatus === 'queued'}
            >
              {downloadStatus === 'downloading' || downloadStatus === 'queued' ? (
                <>
                  <ActivityIndicator size="small" color={theme.colors.text.secondary} />
                  <Text style={styles.downloadButtonTextDisabled}>
                    {downloadStatus === 'downloading' ? 'Downloading...' : 'Queued'}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="download-outline" size={20} color={theme.colors.primary[500]} set="ionicons" />
                  <Text style={styles.downloadButtonText}>Download</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.downloadedIndicator}>
              <Icon name="checkmark-circle" size={20} color="#22c55e" set="ionicons" />
              <Text style={styles.downloadedText}>Downloaded</Text>
            </View>
          )}

          {/* Play Button - Always prominent */}
          <TouchableOpacity style={styles.playNowButton} onPress={handlePlay}>
            <Icon name="play" size={20} color="#FFFFFF" set="ionicons" />
            <Text style={styles.playNowText}>{playButtonText}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
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
              Chapters ({chapters.length})
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

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <OverviewTab book={book} />
          )}
          {activeTab === 'chapters' && (
            <ChaptersTab chapters={chapters} />
          )}
          {activeTab === 'details' && (
            <View style={styles.detailsTab}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Title</Text>
                <Text style={styles.detailValue}>{title}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Author</Text>
                <Text style={styles.detailValue}>{author}</Text>
              </View>
              {narrator && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Narrator</Text>
                  <Text style={styles.detailValue}>{narrator}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{formatDuration(duration)}</Text>
              </View>
              {metadata.publishedYear && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Published</Text>
                  <Text style={styles.detailValue}>{metadata.publishedYear}</Text>
                </View>
              )}
              {metadata.publisher && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Publisher</Text>
                  <Text style={styles.detailValue}>{metadata.publisher}</Text>
                </View>
              )}
              {metadata.language && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Language</Text>
                  <Text style={styles.detailValue}>{metadata.language}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  headerButton: {
    width: 44,  // NN/g: Minimum 44px touch target
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  scrollView: {
    flex: 1,
  },
  topSection: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[5],
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE * 1.1,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  infoSide: {
    flex: 1,
    marginLeft: theme.spacing[4],
    paddingTop: theme.spacing[1],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    lineHeight: 26,
    marginBottom: theme.spacing[2],
  },
  authorLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1],
  },
  authorName: {
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  narratorLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  narratorName: {
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  tagsSection: {
    marginTop: theme.spacing[3],
  },
  tagsLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[2],
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[2],
  },
  tag: {
    backgroundColor: theme.colors.neutral[100],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radius.full,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[3],
  },
  statItem: {
    marginRight: theme.spacing[6],
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[1],
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  // NN/g: Action buttons should be prominent and have clear affordances
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
    gap: theme.spacing[3],
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // NN/g: Touch target
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.colors.primary[500],
    backgroundColor: 'transparent',
    gap: theme.spacing[2],
  },
  downloadButtonDisabled: {
    borderColor: theme.colors.neutral[300],
    backgroundColor: theme.colors.neutral[100],
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary[500],
  },
  downloadButtonTextDisabled: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  downloadedIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.neutral[100],
    gap: theme.spacing[2],
  },
  downloadedText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#16a34a',
  },
  playNowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // NN/g: Touch target
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.full,
    gap: theme.spacing[2],
  },
  playNowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  tab: {
    paddingVertical: theme.spacing[3],
    marginRight: theme.spacing[5],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.text.primary,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  tabContent: {
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[32] + 80,
  },
  detailsTab: {
    paddingHorizontal: theme.spacing[5],
  },
  detailRow: {
    marginBottom: theme.spacing[4],
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: theme.colors.text.primary,
    lineHeight: 22,
  },
});