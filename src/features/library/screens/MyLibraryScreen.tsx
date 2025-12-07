/**
 * src/features/library/screens/MyLibraryScreen.tsx
 *
 * Your Library screen - shows downloaded books organized by series.
 * - Header bar with Profile, Discover icons + "Your Library" chip (active)
 * - Books grouped by series (downloaded books first within each series)
 * - Browse CTA at bottom
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache } from '@/core/cache';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { formatBytes } from '@/shared/utils/format';
import { DownloadItem } from '@/features/downloads/components/DownloadItem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

// Monospace font for titles (matching HomeScreen)
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

const COLORS = {
  background: '#000000',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  accent: '#c1f40c', // Lime green matching HomeScreen
  cardBg: 'rgba(255, 255, 255, 0.08)',
};

// Helper to extract metadata safely
function getMetadata(item: LibraryItem): any {
  return (item.media?.metadata as any) || {};
}

// Extract series name and sequence from metadata
function parseSeriesInfo(seriesName: string): { name: string; sequence?: number } {
  const match = seriesName.match(/^(.+?)\s*#([\d.]+)$/);
  if (match) {
    return { name: match[1].trim(), sequence: parseFloat(match[2]) };
  }
  return { name: seriesName, sequence: undefined };
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

// Checkmark for downloaded indicator
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

// Book cover thumbnail with downloaded badge
function BookCover({ itemId, title, isDownloaded }: { itemId: string; title: string; isDownloaded: boolean }) {
  const coverUrl = useCoverUrl(itemId);

  return (
    <View style={styles.bookCoverContainer}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={styles.bookCover} />
      ) : (
        <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
          <Text style={styles.bookCoverText}>{title.charAt(0)}</Text>
        </View>
      )}
      {isDownloaded && (
        <View style={styles.downloadedBadge}>
          <CheckIcon size={10} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

interface BookInfo {
  id: string;
  title: string;
  author: string;
  sequence?: number;
  totalBytes: number;
}

// Series section with horizontal scroll of books
function SeriesSection({
  seriesName,
  books,
  downloadedIds,
  onBookPress
}: {
  seriesName: string;
  books: BookInfo[];
  downloadedIds: Set<string>;
  onBookPress: (id: string) => void;
}) {
  // Sort books: downloaded first, then by sequence
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const aDownloaded = downloadedIds.has(a.id);
      const bDownloaded = downloadedIds.has(b.id);

      // Downloaded books first
      if (aDownloaded && !bDownloaded) return -1;
      if (!aDownloaded && bDownloaded) return 1;

      // Then by sequence
      const aSeq = a.sequence ?? 999;
      const bSeq = b.sequence ?? 999;
      return aSeq - bSeq;
    });
  }, [books, downloadedIds]);

  const downloadedCount = books.filter(b => downloadedIds.has(b.id)).length;

  return (
    <View style={styles.seriesSection}>
      <View style={styles.seriesTitleRow}>
        <Text style={styles.seriesTitle}>{seriesName}</Text>
        <Text style={styles.seriesCount}>{downloadedCount}/{books.length} downloaded</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.seriesBooksScroll}
      >
        {sortedBooks.map((book) => (
          <TouchableOpacity
            key={book.id}
            style={styles.seriesBookItem}
            onPress={() => onBookPress(book.id)}
            activeOpacity={0.7}
          >
            <BookCover
              itemId={book.id}
              title={book.title}
              isDownloaded={downloadedIds.has(book.id)}
            />
            <Text style={styles.seriesBookTitle} numberOfLines={2}>{book.title}</Text>
            {book.sequence && (
              <Text style={styles.seriesBookSequence}>Book {book.sequence}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function MyLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { items: cachedItems, isLoaded, getSeries, getItem } = useLibraryCache();
  const { downloads, isLoading, pauseDownload, resumeDownload, deleteDownload } = useDownloads();

  // Separate active downloads from completed
  const activeDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'downloading' || d.status === 'pending' || d.status === 'paused'),
    [downloads]
  );

  const completedDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'complete'),
    [downloads]
  );

  // Get total size of completed downloads
  const totalSize = useMemo(() => {
    return completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);
  }, [completedDownloads]);

  // Enrich downloads with book metadata from library cache
  const enrichedBooks = useMemo(() => {
    if (!isLoaded) return [];
    return completedDownloads.map((download) => {
      const item = getItem(download.itemId);
      const metadata = item ? getMetadata(item) : {};
      const seriesName = metadata.seriesName || '';
      const { name: cleanSeriesName, sequence } = seriesName ? parseSeriesInfo(seriesName) : { name: '', sequence: undefined };

      return {
        id: download.itemId,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || 'Unknown Author',
        seriesName: cleanSeriesName,
        sequence,
        totalBytes: download.totalBytes || 0,
      };
    });
  }, [completedDownloads, getItem, isLoaded]);

  // Group books by series and get full series from library cache
  const { seriesGroups, standaloneBooks } = useMemo(() => {
    const seriesMap = new Map<string, BookInfo[]>();
    const standalone: BookInfo[] = [];
    const processedSeries = new Set<string>();

    for (const book of enrichedBooks) {
      if (book.seriesName) {
        if (!processedSeries.has(book.seriesName)) {
          processedSeries.add(book.seriesName);

          // Get the full series from library cache
          const seriesInfo = getSeries(book.seriesName);
          if (seriesInfo && seriesInfo.books.length > 0) {
            // Use all books from the series, not just downloaded ones
            const allBooksInSeries: BookInfo[] = seriesInfo.books.map((item) => {
              const meta = getMetadata(item);
              const { sequence } = meta.seriesName ? parseSeriesInfo(meta.seriesName) : { sequence: undefined };
              const downloadInfo = completedDownloads.find(d => d.itemId === item.id);
              return {
                id: item.id,
                title: meta.title || 'Unknown Title',
                author: meta.authorName || 'Unknown Author',
                sequence,
                totalBytes: downloadInfo?.totalBytes || 0,
              };
            });
            seriesMap.set(book.seriesName, allBooksInSeries);
          } else {
            // Series not in cache, just show the downloaded book
            seriesMap.set(book.seriesName, [book]);
          }
        }
      } else {
        standalone.push(book);
      }
    }

    return {
      seriesGroups: Array.from(seriesMap.entries()).map(([name, books]) => ({ name, books })),
      standaloneBooks: standalone,
    };
  }, [enrichedBooks, getSeries, completedDownloads]);

  // Set of downloaded item IDs for quick lookup
  const downloadedIds = useMemo(() => {
    return new Set(completedDownloads.map(d => d.itemId));
  }, [completedDownloads]);

  // Refresh - just trigger re-render, downloads update via subscription
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Brief delay to show refresh indicator
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  // Navigation handlers (matching HomeScreen)
  const handleProfilePress = useCallback(() => {
    navigation.navigate('Main', { screen: 'ProfileTab' });
  }, [navigation]);

  const handleDiscoverPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'DiscoverTab' });
  }, [navigation]);

  const handleHomePress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  const handleBrowse = useCallback(() => {
    navigation.navigate('DiscoverTab');
  }, [navigation]);

  const handleBookPress = useCallback((itemId: string) => {
    navigation.navigate('BookDetail', { id: itemId });
  }, [navigation]);

  const hasContent = completedDownloads.length > 0 || activeDownloads.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Fixed Top Header Bar - matching HomeScreen */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIcon} onPress={handleProfilePress}>
            <Ionicons name="person-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={handleDiscoverPress}>
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          {/* Your Library button - ACTIVE state (highlighted) */}
          <TouchableOpacity style={styles.libraryButtonActive} onPress={handleHomePress}>
            <Text style={styles.libraryButtonTextActive}>Your Library</Text>
            <View style={styles.libraryIcon}>
              <View style={styles.libraryIconBack} />
              <View style={styles.libraryIconFront} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {!hasContent ? (
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 70 }]}>
          <DownloadIcon size={scale(64)} />
          <Text style={styles.emptyTitle}>No Downloads</Text>
          <Text style={styles.emptySubtitle}>
            Download audiobooks for offline listening. Browse the library to find something to download.
          </Text>
          <TouchableOpacity style={styles.browseButton} onPress={handleBrowse}>
            <BrowseIcon size={20} color="#000" />
            <Text style={styles.browseButtonText}>Browse Library</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 70 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
            />
          }
        >
          {/* Active downloads/queue section */}
          {activeDownloads.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Downloading</Text>
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

          {/* Your Books section (standalone books first) */}
          {standaloneBooks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Books</Text>
              {standaloneBooks.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={styles.bookRow}
                  onPress={() => handleBookPress(book.id)}
                  activeOpacity={0.7}
                >
                  <BookCover
                    itemId={book.id}
                    title={book.title}
                    isDownloaded={true}
                  />
                  <View style={styles.bookInfo}>
                    <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                    <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
                    <Text style={styles.bookSize}>{formatBytes(book.totalBytes)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Your Series sections */}
          {seriesGroups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Series</Text>
              {seriesGroups.map((series) => (
                <SeriesSection
                  key={series.name}
                  seriesName={series.name}
                  books={series.books}
                  downloadedIds={downloadedIds}
                  onBookPress={handleBookPress}
                />
              ))}
            </View>
          )}

          {/* Browse CTA at bottom */}
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

  // Header - Fixed at top (matching HomeScreen)
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
  // Active library button (highlighted since we're on this page)
  libraryButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(193, 244, 12, 0.2)', // Lime green tint
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 8,
    borderWidth: 1,
    borderColor: '#c1f40c', // Lime green border
  },
  libraryButtonTextActive: {
    color: '#c1f40c', // Lime green text
    fontSize: 10,
    fontFamily: MONO_FONT,
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
    borderColor: 'rgba(193, 244, 12, 0.5)', // Lime green
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
    borderColor: '#c1f40c', // Lime green
    backgroundColor: 'rgba(193, 244, 12, 0.1)',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scale(100),
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  downloadList: {
    paddingHorizontal: scale(16),
  },
  // Series section styles
  seriesSection: {
    marginBottom: scale(20),
  },
  seriesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  seriesTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  seriesCount: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
  },
  seriesBooksScroll: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
  seriesBookItem: {
    width: scale(100),
  },
  seriesBookTitle: {
    fontSize: scale(12),
    color: COLORS.textPrimary,
    marginTop: scale(6),
  },
  seriesBookSequence: {
    fontSize: scale(10),
    color: COLORS.textSecondary,
    marginTop: scale(2),
  },
  // Book cover styles
  bookCoverContainer: {
    position: 'relative',
    width: scale(100),
    height: scale(100),
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  bookCover: {
    width: '100%',
    height: '100%',
    borderRadius: scale(8),
  },
  bookCoverPlaceholder: {
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCoverText: {
    fontSize: scale(28),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  downloadedBadge: {
    position: 'absolute',
    bottom: scale(4),
    right: scale(4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Standalone book row
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(8),
    gap: scale(12),
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
  bookSize: {
    fontSize: scale(12),
    color: COLORS.textSecondary,
    marginTop: scale(4),
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontSize: scale(18),
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
});

export default MyLibraryScreen;
