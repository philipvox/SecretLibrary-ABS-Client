/**
 * src/features/home/screens/HomeScreen.tsx
 *
 * Redesigned home screen:
 * - Top bar: Profile, Discover, Your Library
 * - Now Playing: Large cover, title/author, controls
 * - Downloaded books section
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  RefreshControl,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { useRobustSeekControl } from '@/features/player/hooks/useRobustSeekControl';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { BookCard } from '@/shared/components/BookCard';
import { useHomeData } from '../hooks/useHomeData';
import { useQueue } from '@/features/queue/stores/queueStore';

// Monospace font for titles
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

// Button assets
const RewindButtonImage = require('../assets/rewind-button.png');
const FastForwardButtonImage = require('../assets/fast-forward-button.png');
const PlayButtonImage = require('../assets/play-button.png');
const PauseButtonImage = require('../assets/pause-button.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH * 0.75;
const ACCENT = '#c1f40c';
const REWIND_COLOR = '#ff4444';
const BUTTON_SIZE = 58; // All buttons same size

// Format seek time with appropriate units
const formatSeekTime = (seconds: number): string => {
  const absSeconds = Math.abs(Math.round(seconds));
  if (absSeconds >= 300) { // 5+ minutes
    const mins = Math.floor(absSeconds / 60);
    return `${mins}m`;
  }
  return `${absSeconds}s`;
};

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    currentBook,
    currentProgress,
    isRefreshing,
    refresh,
  } = useHomeData();

  const {
    currentBook: playerCurrentBook,
    isPlaying,
    isLoading: isPlayerLoading,
    loadBook,
    play,
    pause,
  } = usePlayerStore();

  const {
    startContinuousSeek,
    stopContinuousSeek,
    seekDirection,
    seekMagnitude,
    isSeeking,
  } = useRobustSeekControl();

  // Queue state
  const queue = useQueue();
  const hasQueue = queue.length > 0;

  // Downloaded books from downloads hook
  const { downloads } = useDownloads();
  const getItem = useLibraryCache((s) => s.getItem);
  const [downloadedBooks, setDownloadedBooks] = useState<LibraryItem[]>([]);

  // Load full book data for completed downloads
  useEffect(() => {
    const loadDownloadedBooks = async () => {
      const completedDownloads = downloads.filter((d) => d.status === 'complete');
      const books: LibraryItem[] = [];

      for (const download of completedDownloads.slice(0, 10)) {
        // Try to get from cache first
        const cachedBook = getItem(download.itemId);
        if (cachedBook) {
          books.push(cachedBook);
        } else {
          // Fetch from API if not in cache
          try {
            const book = await apiClient.getItem(download.itemId);
            books.push(book);
          } catch {
            // Skip if can't load
          }
        }
      }

      setDownloadedBooks(books);
    };

    loadDownloadedBooks();
  }, [downloads, getItem]);

  // Get author from book metadata - check multiple field paths
  const getAuthor = (book: LibraryItem | null): string => {
    if (!book) return '';
    const metadata = book.media?.metadata as any;
    if (!metadata) return '';

    // Try authorName first (formatted string)
    if (metadata.authorName) return metadata.authorName;

    // Try authors array
    if (metadata.authors?.length > 0) {
      return metadata.authors.map((a: any) => a.name).join(', ');
    }

    return '';
  };

  const currentCoverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : undefined;
  const currentTitle = currentBook?.media?.metadata?.title || 'No book selected';
  const currentAuthor = getAuthor(currentBook);
  const progressPercent = currentProgress?.progress ? Math.round(currentProgress.progress * 100) : 0;

  // Navigation handlers
  const handleProfilePress = () => navigation.navigate('Main', { screen: 'ProfileTab' });
  const handleDiscoverPress = () => navigation.navigate('Main', { screen: 'DiscoverTab' });
  const handleLibraryPress = () => navigation.navigate('Main', { screen: 'LibraryTab' });
  const handleQueuePress = () => navigation.navigate('QueueScreen');

  // Player controls
  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else if (currentBook) {
      if (playerCurrentBook?.id === currentBook.id) {
        await play();
      } else {
        try {
          const fullBook = await apiClient.getItem(currentBook.id);
          await loadBook(fullBook, { autoPlay: true, showPlayer: false });
        } catch {
          await loadBook(currentBook, { autoPlay: true, showPlayer: false });
        }
      }
    }
  }, [isPlaying, pause, play, currentBook, playerCurrentBook, loadBook]);

  const handleSkipBackPressIn = useCallback(async () => {
    await startContinuousSeek('backward');
  }, [startContinuousSeek]);

  const handleSkipBackPressOut = useCallback(async () => {
    await stopContinuousSeek();
  }, [stopContinuousSeek]);

  const handleSkipForwardPressIn = useCallback(async () => {
    await startContinuousSeek('forward');
  }, [startContinuousSeek]);

  const handleSkipForwardPressOut = useCallback(async () => {
    await stopContinuousSeek();
  }, [stopContinuousSeek]);

  // Cover tap opens book details
  const handleCoverPress = useCallback(() => {
    if (currentBook) {
      navigation.navigate('BookDetail', { id: currentBook.id });
    }
  }, [currentBook, navigation]);

  // Book list item press - always goes to BookDetail
  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Blurred cover background */}
      {currentCoverUrl && (
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={currentCoverUrl}
            style={styles.backgroundImage}
            contentFit="cover"
            blurRadius={60}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      {!currentCoverUrl && (
        <LinearGradient
          colors={['#2d3a2d', '#1a1f1a', '#0d0f0d']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Fixed Top Header Bar */}
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
          {/* Queue indicator - shows when queue has items */}
          {hasQueue && (
            <TouchableOpacity style={styles.queueIndicatorButton} onPress={handleQueuePress}>
              <Ionicons name="list" size={14} color="#000" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.libraryButton} onPress={handleLibraryPress}>
            <Text style={styles.libraryButtonText}>Your Library</Text>
            <View style={styles.libraryIcon}>
              <View style={styles.libraryIconBack} />
              <View style={styles.libraryIconFront} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60, paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={ACCENT} />
        }
      >

        {/* Now Playing Section */}
        {currentBook && (
          <View style={styles.nowPlaying}>
            {/* Title and Author */}
            <Text style={styles.bookTitle} numberOfLines={1}>{currentTitle}</Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>{currentAuthor}</Text>

            {/* Large Cover - No queue button per spec */}
            <TouchableOpacity style={styles.coverContainer} onPress={handleCoverPress} activeOpacity={0.9}>
              <Image
                source={currentCoverUrl}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>

            {/* Control Buttons - Under cover: Rewind, FastForward, Play */}
            <View style={styles.controls}>
              <TouchableOpacity
                onPressIn={handleSkipBackPressIn}
                onPressOut={handleSkipBackPressOut}
                activeOpacity={0.8}
              >
                <Image
                  source={RewindButtonImage}
                  style={styles.controlButtonImage}
                  contentFit="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPressIn={handleSkipForwardPressIn}
                onPressOut={handleSkipForwardPressOut}
                activeOpacity={0.8}
              >
                <Image
                  source={FastForwardButtonImage}
                  style={styles.controlButtonImage}
                  contentFit="contain"
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.8}>
                <Image
                  source={isPlaying ? PauseButtonImage : PlayButtonImage}
                  style={styles.controlButtonImage}
                  contentFit="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Seek indicators and Progress Bar */}
        {currentBook && (
          <View style={styles.progressSection}>
            {/* Full-width Progress Bar with background line */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground} />
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            {/* Seek indicators - aligned below progress bar */}
            <View style={styles.seekIndicators}>
              <Text style={[
                styles.seekIndicatorText,
                styles.seekIndicatorRewind,
                isSeeking && seekDirection === 'backward' && styles.seekIndicatorRewindActive
              ]}>
                -{formatSeekTime(seekMagnitude)}
              </Text>
              <Text style={styles.progressPercentCenter}>{progressPercent}%</Text>
              <Text style={[
                styles.seekIndicatorText,
                isSeeking && seekDirection === 'forward' && styles.seekIndicatorForwardActive
              ]}>
                +{formatSeekTime(seekMagnitude)}
              </Text>
            </View>
          </View>
        )}

        {/* Downloaded Books Section - Using BookCard */}
        {downloadedBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              <TouchableOpacity onPress={handleLibraryPress}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {downloadedBooks.slice(0, 5).map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onPress={() => handleBookPress(book.id)}
                showListeningProgress={true}
              />
            ))}
          </View>
        )}

        {/* Empty state when no downloads */}
        {downloadedBooks.length === 0 && (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No downloaded books</Text>
            <Text style={styles.emptySubtext}>Search for books to download</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header - Fixed at top
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
  queueIndicatorButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 8,
  },
  libraryButtonText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: MONO_FONT,
    letterSpacing: 0.2,
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
    borderColor: 'rgba(255,255,255,0.5)',
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
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Now Playing
  nowPlaying: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bookTitle: {
    fontSize: 14,
    fontFamily: MONO_FONT,
    fontWeight: '400',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  bookAuthor: {
    fontSize: 12,
    fontFamily: 'System',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 20,
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  cover: {
    width: '100%',
    height: '100%',
  },

  // Controls - Under cover: Rewind, FastForward, Play (all same size)
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 12,
  },
  controlButtonImage: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },

  // Progress section with seek indicators
  progressSection: {
    width: '100%',
    marginTop: 20,
  },
  seekIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  seekIndicatorText: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    color: 'transparent', // Hidden by default
    letterSpacing: 0.2,
    minWidth: 50,
  },
  seekIndicatorRewind: {
    textAlign: 'left',
  },
  seekIndicatorRewindActive: {
    color: REWIND_COLOR, // Red when rewinding
  },
  seekIndicatorForwardActive: {
    color: ACCENT, // Green when fast-forwarding
  },
  progressPercentCenter: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Progress bar - Full width with background line
  progressBarContainer: {
    width: '100%',
    height: 7,
    position: 'relative',
  },
  progressBarBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 7,
    backgroundColor: ACCENT,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },

  // Section
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: MONO_FONT,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.3,
  },
  viewAllText: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Empty state
  emptySection: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});

export { HomeScreen as default };
