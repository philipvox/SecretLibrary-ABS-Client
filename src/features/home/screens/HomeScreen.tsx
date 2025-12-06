/**
 * src/features/home/screens/HomeScreen.tsx
 *
 * Redesigned home screen matching the new layout:
 * - Top bar: Profile, Discover, Your Library
 * - Now Playing: Large cover, title/author, controls
 * - Recently Added section
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
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { useRobustSeekControl } from '@/features/player/hooks/useRobustSeekControl';
import { autoDownloadService, DownloadStatus } from '@/features/downloads/services/autoDownloadService';
import { useHomeData } from '../hooks/useHomeData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH * 0.75; // 303/402 from design
const ACCENT = '#c1f40c'; // Exact color from design
const CONTROL_SIZE = 58; // Control button size

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    currentBook,
    currentProgress,
    recentBooks,
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
  } = useRobustSeekControl();

  // Download status tracking
  const [downloadStatuses, setDownloadStatuses] = useState<Map<string, DownloadStatus>>(new Map());

  useEffect(() => {
    const unsubStatus = autoDownloadService.onStatus((bookId, status) => {
      setDownloadStatuses(prev => new Map(prev).set(bookId, status));
    });
    return () => unsubStatus();
  }, []);

  const currentCoverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : undefined;
  const currentTitle = currentBook?.media?.metadata?.title || 'No book selected';
  const currentAuthor = currentBook?.media?.metadata?.authorName || '';
  const progressPercent = currentProgress?.progress ? Math.round(currentProgress.progress * 100) : 0;

  // Navigation handlers
  const handleProfilePress = () => navigation.navigate('Main', { screen: 'ProfileTab' });
  const handleDiscoverPress = () => navigation.navigate('Main', { screen: 'DiscoverTab' });
  const handleLibraryPress = () => navigation.navigate('Main', { screen: 'LibraryTab' });

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

  // Add to library (heart/favorite)
  const handleAddPress = useCallback(() => {
    // TODO: Add to favorites
  }, []);

  // Book list item press
  const handleBookPress = useCallback((book: LibraryItem) => {
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  const handleDownloadBook = useCallback(async (book: LibraryItem) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await autoDownloadService.startDownload(fullBook);
    } catch {
      await autoDownloadService.startDownload(book);
    }
  }, []);

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
          {/* Dark overlay for readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      {/* Fallback gradient when no cover */}
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

        <TouchableOpacity style={styles.libraryButton} onPress={handleLibraryPress}>
          <Text style={styles.libraryButtonText}>Your Library</Text>
          {/* Book icon matching design */}
          <View style={styles.libraryIcon}>
            <View style={styles.libraryIconLeft} />
            <View style={styles.libraryIconRight} />
            <View style={styles.libraryIconMiddle} />
          </View>
        </TouchableOpacity>
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

            {/* Large Cover */}
            <TouchableOpacity style={styles.coverContainer} onPress={handleCoverPress} activeOpacity={0.9}>
              <Image
                source={currentCoverUrl}
                style={styles.cover}
                contentFit="cover"
                transition={200}
              />
              {/* Add button */}
              <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
                <Ionicons name="add-circle-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Control Buttons - Glass effect squares */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPressIn={handleSkipBackPressIn}
                onPressOut={handleSkipBackPressOut}
                activeOpacity={0.8}
              >
                {/* Double chevron back */}
                <View style={styles.doubleChevron}>
                  <Ionicons name="chevron-back" size={22} color={ACCENT} style={{ marginRight: -8 }} />
                  <Ionicons name="chevron-back" size={22} color={ACCENT} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPressIn={handleSkipForwardPressIn}
                onPressOut={handleSkipForwardPressOut}
                activeOpacity={0.8}
              >
                {/* Double chevron forward */}
                <View style={styles.doubleChevron}>
                  <Ionicons name="chevron-forward" size={22} color={ACCENT} style={{ marginRight: -8 }} />
                  <Ionicons name="chevron-forward" size={22} color={ACCENT} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.playButton} onPress={handlePlayPause} activeOpacity={0.8}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={26}
                  color="#000"
                  style={!isPlaying && { marginLeft: 2 }}
                />
              </TouchableOpacity>
            </View>

            {/* Progress percentage */}
            <Text style={styles.progressText}>{progressPercent}%</Text>
          </View>
        )}

        {/* Full-width Progress Bar */}
        {currentBook && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        )}

        {/* Recently Added Section */}
        {recentBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              <TouchableOpacity onPress={handleLibraryPress}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentBooks.slice(0, 5).map((book) => {
              const bookCoverUrl = apiClient.getItemCoverUrl(book.id);
              const bookTitle = book.media?.metadata?.title || 'Unknown';
              const bookAuthor = book.media?.metadata?.authorName || '';
              const bookProgress = book.userMediaProgress?.progress || 0;
              const status = downloadStatuses.get(book.id) || autoDownloadService.getStatus(book.id);

              return (
                <TouchableOpacity
                  key={book.id}
                  style={styles.bookItem}
                  onPress={() => handleBookPress(book)}
                  activeOpacity={0.7}
                >
                  <Image source={bookCoverUrl} style={styles.bookCover} contentFit="cover" />
                  <View style={styles.bookInfo}>
                    <Text style={styles.bookItemTitle} numberOfLines={1}>{bookTitle}</Text>
                    <Text style={styles.bookItemProgress}>
                      {Math.round(bookProgress * 100)}% Completed
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.bookAddButton}
                    onPress={() => handleDownloadBook(book)}
                  >
                    {status === 'completed' ? (
                      <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
                    ) : status === 'downloading' || status === 'queued' ? (
                      <Ionicons name="cloud-download" size={22} color={ACCENT} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={22} color="rgba(255,255,255,0.4)" />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
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
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', // #ffffff24 from design
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 8,
  },
  libraryButtonText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  // Custom book icon matching design (3 rounded rectangles)
  libraryIcon: {
    width: 15,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryIconLeft: {
    width: 5,
    height: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#fff',
    marginRight: 2,
  },
  libraryIconRight: {
    width: 5,
    height: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#fff',
  },
  libraryIconMiddle: {
    position: 'absolute',
    width: 5,
    height: 13,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#fff',
  },

  // Now Playing
  nowPlaying: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  bookTitle: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 16,
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
  addButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 18,
  },

  // Controls - Glass effect squares matching design
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  controlButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  doubleChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 10,
  },

  // Progress text
  progressText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#fff',
    marginTop: 16,
  },
  // Progress bar - Full width matching design
  progressBarContainer: {
    width: '100%',
    height: 7,
    marginTop: 16,
    backgroundColor: 'transparent',
  },
  progressBarFill: {
    height: 7,
    backgroundColor: ACCENT,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },

  // Section - matching design
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
    fontWeight: '600',
    color: '#fff',
  },
  viewAllText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#fff',
  },

  // Book Item - matching design layout
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookCover: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bookItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bookItemAuthor: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  bookItemProgress: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  bookAddButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export { HomeScreen as default };
