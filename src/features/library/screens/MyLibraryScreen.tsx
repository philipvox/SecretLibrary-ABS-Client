/**
 * src/features/library/screens/MyLibraryScreen.tsx
 *
 * User's Library screen (Audible-style):
 * - "Your Downloads" section: Downloaded books sorted newest to oldest
 * - "Your Library" section: Favorited/hearted books
 * - Empty state directs to Discover tab
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { autoDownloadService, DownloadedBook, DownloadStatus } from '@/features/downloads/services/autoDownloadService';
import { useLibraryCache, getCoverUrl } from '@/core/cache';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { EmptyState, HeartButton, BookListItem } from '@/shared/components';
import { LibraryItem } from '@/core/types';
import { LibraryBackground } from '../components/LibraryBackground';
import { formatDuration, formatFileSize } from '@/shared/utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

const PADDING = scale(20);
const BG_COLOR = '#000000';
const ACCENT = '#C8FF00';
const CARD_COLOR = '#1a1a1a';

export function MyLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { loadBook, currentBook: playerCurrentBook, isLoading: isPlayerLoading } = usePlayerStore();

  // Library favorites (hearts)
  const { libraryIds } = useMyLibraryStore();
  const { items: cachedItems, isLoaded } = useLibraryCache();

  // Downloads state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloads, setDownloads] = useState<DownloadedBook[]>([]);
  const [downloadStatuses, setDownloadStatuses] = useState<Map<string, DownloadStatus>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());

  // Load downloads
  const loadDownloads = useCallback(() => {
    const allDownloads = autoDownloadService.getAllDownloads();
    // Sort by downloadedAt descending (newest first)
    allDownloads.sort((a, b) => b.downloadedAt - a.downloadedAt);
    setDownloads(allDownloads);
  }, []);

  // Subscribe to download status changes
  useEffect(() => {
    loadDownloads();

    const unsubStatus = autoDownloadService.onStatus((bookId, status) => {
      setDownloadStatuses(prev => new Map(prev).set(bookId, status));
      if (status === 'completed') {
        loadDownloads();
      }
    });

    const unsubProgress = autoDownloadService.onProgress((bookId, progress) => {
      setDownloadProgress(prev => new Map(prev).set(bookId, progress));
    });

    return () => {
      unsubStatus();
      unsubProgress();
    };
  }, [loadDownloads]);

  // Get library items (hearted books)
  const libraryItems = useMemo(() => {
    if (!isLoaded) return [];
    return cachedItems.filter(item => libraryIds.includes(item.id));
  }, [cachedItems, libraryIds, isLoaded]);

  // Get total download size
  const totalDownloadSize = useMemo(() => {
    return downloads.reduce((sum, d) => sum + d.fileSize, 0);
  }, [downloads]);

  // Cover URLs for background
  const backgroundCoverUrls = useMemo(() => {
    // Prefer downloaded books for background
    if (downloads.length > 0) {
      return downloads.slice(0, 3).map(d => apiClient.getItemCoverUrl(d.id));
    }
    // Fall back to library items
    return libraryItems.slice(0, 3).map(item => getCoverUrl(item.id));
  }, [downloads, libraryItems]);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    loadDownloads();
    setIsRefreshing(false);
  }, [loadDownloads]);

  // Handle download item press - go to book detail
  const handleDownloadPress = useCallback((download: DownloadedBook) => {
    navigation.navigate('BookDetail', { id: download.id });
  }, [navigation]);

  // Handle download play press
  const handleDownloadPlay = useCallback(async (download: DownloadedBook) => {
    try {
      const fullBook = await apiClient.getItem(download.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch (err) {
      console.error('Failed to play downloaded book:', err);
    }
  }, [loadBook]);

  // Handle library item press - go to book detail
  const handleLibraryItemPress = useCallback((book: LibraryItem) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // Handle library item play
  const handleLibraryItemPlay = useCallback(async (book: LibraryItem) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch (err) {
      await loadBook(book, { autoPlay: true, showPlayer: false });
    }
  }, [loadBook]);

  // Handle library item download (for favorites not yet downloaded)
  const handleLibraryItemDownload = useCallback(async (book: LibraryItem) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await autoDownloadService.startDownload(fullBook);
    } catch (err) {
      // Fallback to partial book data
      await autoDownloadService.startDownload(book);
    }
  }, []);

  // Navigate to Discover
  const handleGoToDiscover = useCallback(() => {
    navigation.navigate('Browse');
  }, [navigation]);

  // Remove download
  const handleRemoveDownload = useCallback((downloadId: string) => {
    const download = downloads.find(d => d.id === downloadId);
    if (!download) return;

    Alert.alert(
      'Remove Download',
      `Remove "${download.title}" from downloads? This will free up space on your device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await autoDownloadService.removeDownload(downloadId);
            loadDownloads();
          },
        },
      ]
    );
  }, [downloads, loadDownloads]);

  // Render a download item
  const renderDownloadItem = (download: DownloadedBook) => {
    const coverUrl = download.coverPath || apiClient.getItemCoverUrl(download.id);
    const isPlaying = playerCurrentBook?.id === download.id;
    const status = downloadStatuses.get(download.id) || 'completed';
    const progress = downloadProgress.get(download.id) || 1;

    return (
      <TouchableOpacity
        key={download.id}
        style={styles.downloadItem}
        onPress={() => handleDownloadPress(download)}
        activeOpacity={0.8}
      >
        {/* Cover */}
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <Icon name="volume-high" size={12} color={ACCENT} set="ionicons" />
            </View>
          )}
          {/* Downloaded checkmark */}
          <View style={styles.downloadedBadge}>
            <Icon name="checkmark" size={10} color={ACCENT} set="ionicons" />
          </View>
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>{download.title}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemSize}>{formatFileSize(download.fileSize)}</Text>
            {download.duration > 0 && (
              <>
                <Text style={styles.itemDot}>•</Text>
                <Text style={styles.itemDuration}>{formatDuration(download.duration)}</Text>
              </>
            )}
          </View>
          {status === 'downloading' && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          )}
        </View>

        {/* Play button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => handleDownloadPlay(download)}
        >
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color="#000"
            set="ionicons"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const hasContent = downloads.length > 0 || libraryItems.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Background */}
      <LibraryBackground coverUrls={backgroundCoverUrls} />

      {!hasContent ? (
        <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
          <EmptyState
            title="Your library is empty"
            description="Browse and download books to listen offline"
            icon="library"
          />
          <TouchableOpacity style={styles.discoverButton} onPress={handleGoToDiscover}>
            <Icon name="compass-outline" size={20} color="#000" set="ionicons" />
            <Text style={styles.discoverButtonText}>Browse Library</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + scale(18),
              paddingBottom: 100 + insets.bottom
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={ACCENT}
            />
          }
        >
          {/* Page Header */}
          <Text style={styles.pageTitle}>Downloads</Text>

          {/* Your Downloads Section */}
          {downloads.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Your Downloads</Text>
                  <Text style={styles.sectionSubtitle}>
                    {downloads.length} {downloads.length === 1 ? 'book' : 'books'} • {formatFileSize(totalDownloadSize)}
                  </Text>
                </View>
              </View>
              <View style={styles.downloadsList}>
                {downloads.map(renderDownloadItem)}
              </View>
            </View>
          )}

          {/* Your Library Section (Favorites) */}
          {libraryItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Favorites</Text>
                <Text style={styles.sectionCount}>
                  {libraryItems.length} {libraryItems.length === 1 ? 'book' : 'books'}
                </Text>
              </View>
              {libraryItems.map(book => (
                <BookListItem
                  key={book.id}
                  book={book}
                  onPress={() => handleLibraryItemPress(book)}
                  onDownloadPress={() => handleLibraryItemDownload(book)}
                  showProgress={true}
                  showSwipe={true}
                  isLoadingThisBook={isPlayerLoading && playerCurrentBook?.id === book.id}
                  downloadStatus={autoDownloadService.getStatus(book.id)}
                  downloadProgress={autoDownloadService.getProgress(book.id)}
                />
              ))}
            </View>
          )}

          {/* Empty downloads prompt */}
          {downloads.length === 0 && libraryItems.length > 0 && (
            <View style={styles.downloadPrompt}>
              <Icon name="cloud-download-outline" size={32} color="rgba(255,255,255,0.3)" set="ionicons" />
              <Text style={styles.downloadPromptText}>
                Download books to listen offline
              </Text>
              <TouchableOpacity style={styles.smallDiscoverButton} onPress={handleGoToDiscover}>
                <Text style={styles.smallDiscoverButtonText}>Browse Library</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PADDING,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  discoverButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },

  // Page header
  pageTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: PADDING,
    marginBottom: scale(20),
  },

  // Section
  section: {
    marginBottom: scale(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: scale(12),
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  sectionCount: {
    fontSize: scale(12),
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // Downloads list
  downloadsList: {
    paddingHorizontal: PADDING,
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  coverContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#262626',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  playingIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 3,
  },
  downloadedBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    padding: 3,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSize: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  itemDot: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 6,
  },
  itemDuration: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  // Download prompt
  downloadPrompt: {
    alignItems: 'center',
    paddingHorizontal: PADDING,
    paddingVertical: scale(24),
    marginHorizontal: PADDING,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginTop: scale(8),
  },
  downloadPromptText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  smallDiscoverButton: {
    backgroundColor: 'rgba(200,255,0,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  smallDiscoverButtonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MyLibraryScreen;
