/**
 * src/features/home/screens/HomeScreen.tsx
 *
 * Redesigned Home Screen with CD disc-centric design
 *
 * Layout:
 * 1. HomeHeader (Title + Time / Author)
 * 2. CD Disc Hero Section (70%w disc)
 * 3. Pills Row (Sleep timer / Speed)
 * 4. Continue Listening (24%w compact cards)
 * 5. Recently Added (list rows in card container)
 * 6. Your Series (series from downloads/in-progress)
 *
 * Note: Mini player is now global (rendered in AppNavigator)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { usePlayerStore, SleepTimerSheet, SpeedSheet } from '@/features/player';
import { useCoverUrl } from '@/core/cache';
import { colors, wp, hp } from '@/shared/theme';
import { useImageColors } from '@/shared/hooks/useImageColors';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';

// Components
import { HomeHeader } from '../components/HomeHeader';
import { HomeDiscSection } from '../components/HomeDiscSection';
import { HomePillsRow } from '../components/HomePillsRow';
import { ContinueListeningSection } from '../components/ContinueListeningSection';
import { RecentlyAddedSection } from '../components/RecentlyAddedSection';
import { YourSeriesSection } from '../components/YourSeriesSection';
import { SectionHeader } from '../components/SectionHeader';
import { EmptySection } from '../components/EmptySection';
import { QueuePanel } from '@/features/queue/components/QueuePanel';

// Types
import { SeriesWithBooks } from '../types';

// Hooks
import { useHomeData } from '../hooks/useHomeData';

const ACCENT = colors.accent;

export function HomeScreen() {
  useScreenLoadTime('HomeScreen');
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollY = useSharedValue(0);

  // Home data
  const {
    currentBook,
    currentProgress,
    recentlyListened,
    recentBooks,
    userSeries,
    isRefreshing,
    refresh,
  } = useHomeData();

  // Player state
  const {
    currentBook: playerCurrentBook,
    isPlaying,
    isLoading: isPlayerLoading,
    position,
    duration,
    playbackRate,
    sleepTimer,
    loadBook,
    play,
    pause,
    togglePlayer,
    setPlaybackRate,
    setSleepTimer,
    clearSleepTimer,
    seekTo,
  } = usePlayerStore();

  // Cover URL for current book
  const coverUrl = useCoverUrl(currentBook?.id || '');

  // Extract colors from cover image
  const imageColors = useImageColors(coverUrl);
  const accentColor = imageColors?.dominant || colors.accent;
  const backgroundTint = imageColors?.darkMuted || colors.backgroundTertiary;

  // Local state for sheet visibility
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);

  // Get book metadata
  const getMetadata = (book: LibraryItem | null) => {
    if (!book) return { title: null, author: null };
    const metadata = book.media?.metadata as any;
    const title = metadata?.title || null;
    const author = metadata?.authorName || metadata?.authors?.[0]?.name || null;
    return { title, author };
  };

  const { title, author } = getMetadata(currentBook);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  // Scroll handler for mini player visibility
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Navigation handlers
  const handleLibraryPress = () => navigation.navigate('Main', { screen: 'LibraryTab' });

  // Open full player for current book
  const handleDiscPress = useCallback(async () => {
    if (!currentBook) return;

    // If the book is already loaded in the player, just open it
    if (playerCurrentBook?.id === currentBook.id) {
      togglePlayer();
    } else {
      // Load the book and open the player
      try {
        const fullBook = await apiClient.getItem(currentBook.id);
        await loadBook(fullBook, { autoPlay: false, showPlayer: true });
      } catch {
        await loadBook(currentBook, { autoPlay: false, showPlayer: true });
      }
    }
  }, [currentBook, playerCurrentBook, togglePlayer, loadBook]);

  // Play/Pause
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

  // Skip back 30 seconds
  const handleSkipBack = useCallback(() => {
    const newPosition = Math.max(0, position - 30);
    seekTo?.(newPosition);
  }, [position, seekTo]);

  // Resume a book from Continue Listening
  const handleResumeBook = useCallback(async (book: LibraryItem) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      await loadBook(book, { autoPlay: true, showPlayer: false });
    }
  }, [loadBook]);

  // View book details
  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  // Play a recently added book
  const handlePlayBook = useCallback(async (book: LibraryItem) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      await loadBook(book, { autoPlay: true, showPlayer: false });
    }
  }, [loadBook]);

  // Navigate to series detail
  const handleSeriesPress = useCallback((series: SeriesWithBooks) => {
    navigation.navigate('SeriesDetail', { seriesName: series.name });
  }, [navigation]);

  // Pills handlers
  const handleSleepPress = () => setShowSleepSheet(true);
  const handleSpeedPress = () => setShowSpeedSheet(true);
  const handleQueuePress = () => setShowQueuePanel(true);

  // Continue Listening - exclude current book
  const continueListeningBooks = useMemo(() => {
    if (!currentBook) return recentlyListened.slice(0, 15);
    return recentlyListened.filter(book => book.id !== currentBook.id).slice(0, 15);
  }, [recentlyListened, currentBook]);

  // Progress value
  const progressValue = duration > 0 ? position / duration : 0;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Scrollable content with background */}
      <Animated.ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={ACCENT} />
        }
      >
        {/* Background: Blurred cover + gradient overlay - scrolls with content */}
        <View style={styles.backgroundContainer}>
          {coverUrl && (
            <Image
              source={coverUrl}
              style={StyleSheet.absoluteFill}
              blurRadius={50}
              contentFit="cover"
            />
          )}
          {/* BlurView overlay for Android (blurRadius only works on iOS) */}
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Gradient: smooth fade to black */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0)',      // Transparent at top
              'rgba(0,0,0,0)',      // Stay transparent longer
              'rgba(0,0,0,0.2)',    // Very gentle fade start
              'rgba(0,0,0,0.5)',    // Gradual
              'rgba(0,0,0,0.8)',    // Getting darker
              'rgba(0,0,0,1)',      // Solid black
            ]}
            locations={[0, 0.25, 0.4, 0.55, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Content overlaid on background - pulled up with negative margin */}
        <View style={[styles.contentOverlay, { paddingTop: insets.top + 8 }]}>
          {/* Header: Title + Time / Author */}
          <HomeHeader
          title={title}
          author={author}
          currentTime={position}
          isPlaying={isPlaying}
        />

        {/* CD Disc Hero Section */}
        <HomeDiscSection
          coverUrl={coverUrl}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          onPress={handleDiscPress}
          bookTitle={title || undefined}
          authorName={author || undefined}
        />

        {/* Pills Row: Sleep / Queue / Speed */}
        <HomePillsRow
          sleepTimer={sleepTimer}
          playbackSpeed={playbackRate}
          onSleepPress={handleSleepPress}
          onSpeedPress={handleSpeedPress}
          onQueuePress={handleQueuePress}
          visible={!!currentBook}
        />

        {/* Continue Listening Section */}
        {continueListeningBooks.length > 0 ? (
          <ContinueListeningSection
            books={continueListeningBooks}
            onBookPress={handleResumeBook}
            onBookLongPress={(book) => handleBookPress(book.id)}
            onViewAll={handleLibraryPress}
          />
        ) : (
          <View style={styles.section}>
            <SectionHeader
              title="Continue Listening"
              onViewAll={handleLibraryPress}
              showViewAll={false}
            />
            <EmptySection
              title="Start listening"
              description="Your in-progress books will appear here"
              ctaLabel="Browse Library"
              onCTAPress={handleLibraryPress}
            />
          </View>
        )}

        {/* Recently Added Section */}
        {recentBooks.length > 0 && (
          <RecentlyAddedSection
            books={recentBooks}
            onBookPress={(book) => handleBookPress(book.id)}
            onPlayPress={handlePlayBook}
            maxItems={5}
          />
        )}

        {/* Your Series Section - No Play button per NNGroup research */}
        {userSeries.length > 0 && (
          <YourSeriesSection
            series={userSeries}
            onSeriesPress={handleSeriesPress}
            maxItems={5}
          />
        )}
        </View>
      </Animated.ScrollView>

      {/* Shared Sheet Components */}
      <SleepTimerSheet visible={showSleepSheet} onClose={() => setShowSleepSheet(false)} />
      <SpeedSheet visible={showSpeedSheet} onClose={() => setShowSpeedSheet(false)} />

      {/* Queue Panel */}
      {showQueuePanel && (
        <View style={styles.queueOverlay}>
          <TouchableOpacity
            style={styles.queueBackdrop}
            activeOpacity={1}
            onPress={() => setShowQueuePanel(false)}
            accessibilityLabel="Close queue"
            accessibilityRole="button"
          />
          <View style={styles.queueContainer}>
            <QueuePanel
              onClose={() => setShowQueuePanel(false)}
              maxHeight={hp(60)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundContainer: {
    height: hp(65), // Background takes up top portion
    overflow: 'hidden',
  },
  contentOverlay: {
    marginTop: -hp(65), // Pull content up to overlay on background
  },
  section: {
    marginTop: wp(4),
  },
  queueOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  queueBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  queueContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
});

export { HomeScreen as default };
