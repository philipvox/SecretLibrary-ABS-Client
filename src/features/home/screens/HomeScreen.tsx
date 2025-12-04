/**
 * src/features/home/screens/HomeScreen.tsx
 *
 * Main home screen with Now Playing card and carousels
 * Anima layout: 402px base width, gap-6 (24px) between sections
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Text,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';

// Hooks
import { useHomeData } from '../hooks/useHomeData';

// Components
import { HomeBackground } from '../components/HomeBackground';
import { NowPlayingCard } from '../components/NowPlayingCard';
import { SectionHeader } from '../components/SectionHeader';
import { HorizontalCarousel } from '../components/HorizontalCarousel';
import { BookCard } from '../components/BookCard';
import { SeriesCard } from '../components/SeriesCard';
import { PlaylistCard } from '../components/PlaylistCard';
import { RecentlyListenedItem } from '../components/RecentlyListenedItem';

// Design constants
import { COLORS, LAYOUT } from '../homeDesign';

// Types
import { SeriesWithBooks, PlaylistDisplay } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    currentBook,
    currentProgress,
    recentlyListened,
    recentBooks,
    userSeries,
    userPlaylists,
    isLoading,
    isRefreshing,
    refresh,
  } = useHomeData();

  const {
    isPlaying,
    playbackRate,
    sleepTimer,
    loadBook,
    play,
    pause,
    skipForward,
    skipBackward,
  } = usePlayerStore();

  // Open full player screen
  const openPlayer = useCallback(() => {
    usePlayerStore.setState({ isPlayerVisible: true });
  }, []);

  const currentCoverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : undefined;

  const handleBookPress = useCallback(
    async (book: LibraryItem) => {
      try {
        const fullBook = await apiClient.getItem(book.id);
        await loadBook(fullBook, { autoPlay: false });
      } catch {
        await loadBook(book, { autoPlay: false });
      }
    },
    [loadBook]
  );

  const handleSeriesPress = useCallback(
    (series: SeriesWithBooks) => {
      navigation.navigate('SeriesDetail', { id: series.id, name: series.name });
    },
    [navigation]
  );

  const handlePlaylistPress = useCallback(
    (playlist: PlaylistDisplay) => {
      console.log('Playlist pressed:', playlist.id);
    },
    []
  );

  const handleViewAllBooks = useCallback(() => {
    navigation.navigate('LibraryTab');
  }, [navigation]);

  const handleViewAllSeries = useCallback(() => {
    navigation.navigate('DiscoverTab');
  }, [navigation]);

  const handleViewAllPlaylists = useCallback(() => {
    console.log('View all playlists');
  }, []);

  const handleNowPlayingPress = useCallback(() => {
    // Navigate to player
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Convert sleepTimer from seconds to minutes
  const sleepTimerMinutes = sleepTimer ? Math.round(sleepTimer / 60) : null;

  if (isLoading && !currentBook && recentBooks.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={COLORS.playButton} />
      </View>
    );
  }

  if (!currentBook && recentBooks.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={styles.emptyTitle}>No Books Yet</Text>
        <Text style={styles.emptySubtitle}>
          Start listening to see your books here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <HomeBackground coverUrl={currentCoverUrl} />

      {/* Fixed gradient overlay - part of background, doesn't scroll */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 1)']}
        locations={[0, 0.6, 1]}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <ScrollView
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + scale(18),
            paddingBottom: insets.bottom + LAYOUT.tabBarHeight + scale(20),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={COLORS.playButton}
          />
        }
      >
        {/* Now Playing Card */}
        {currentBook && (
          <View style={styles.nowPlayingContainer}>
            <NowPlayingCard
              book={currentBook}
              progress={currentProgress}
              isPlaying={isPlaying}
              playbackSpeed={playbackRate}
              sleepTimer={sleepTimerMinutes}
              onPress={handleNowPlayingPress}
              onLongPress={openPlayer}
              onPlay={handlePlayPause}
              onSkipBack={skipBackward}
              onSkipForward={skipForward}
            />
          </View>
        )}

        {/* Recently Listened Section - List view */}
        {recentlyListened.length > 0 && (
          <View style={styles.recentlyListenedSection}>
            <SectionHeader title="Recently Listened" />
            {recentlyListened.map((book) => (
              <RecentlyListenedItem
                key={book.id}
                book={book}
                onPress={() => handleBookPress(book)}
                isFavorite={true}
              />
            ))}
          </View>
        )}

        {/* Your Books Section */}
        {recentBooks.length > 0 && (
          <View style={styles.booksSection}>
            <SectionHeader title="Your Books" onViewAll={handleViewAllBooks} />
            <HorizontalCarousel
              data={recentBooks}
              keyExtractor={(book) => book.id}
              itemWidth={scale(110)}
              gap={scale(10)}
              contentPadding={scale(29)}
              renderItem={(book) => (
                <BookCard
                  book={book}
                  onPress={() => handleBookPress(book)}
                  isFavorite={true}
                />
              )}
            />
          </View>
        )}

        {/* Your Series Section - gap:20px from Anima */}
        {userSeries.length > 0 && (
          <View style={styles.seriesSection}>
            <SectionHeader title="Your Series" onViewAll={handleViewAllSeries} />
            <HorizontalCarousel
              data={userSeries}
              keyExtractor={(series) => series.id}
              itemWidth={scale(110)}
              gap={scale(10)}
              contentPadding={scale(29)}
              renderItem={(series) => (
                <SeriesCard
                  series={series}
                  onPress={() => handleSeriesPress(series)}
                />
              )}
            />
          </View>
        )}

        {/* Your Playlists Section - gap:16px from Anima */}
        {userPlaylists.length > 0 && (
          <View style={styles.playlistsSection}>
            <SectionHeader title="Your Playlists" onViewAll={handleViewAllPlaylists} />
            <HorizontalCarousel
              data={userPlaylists}
              keyExtractor={(playlist) => playlist.id}
              itemWidth={scale(110)}
              gap={scale(10)}
              contentPadding={scale(29)}
              renderItem={(playlist) => (
                <PlaylistCard
                  playlist={playlist}
                  onPress={() => handlePlaylistPress(playlist)}
                />
              )}
            />
          </View>
        )}
      </ScrollView>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)', '#000000']}
        locations={[0, 0.5, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  nowPlayingContainer: {
    alignItems: 'center',
    paddingHorizontal: scale(10),
  },
  backgroundGradient: {
    position: 'absolute',
    top: '45%', // Start gradient at 45% from top
    left: 0,
    right: 0,
    height: '55%', // Cover remaining 55% of screen
  },
  recentlyListenedSection: {
    marginTop: scale(30),
  },
  booksSection: {
    marginTop: scale(24),
  },
  // Anima: gap-[23px] between books and series
  seriesSection: {
    marginTop: scale(23),
  },
  // Anima: gap-[16px] between series and playlists (slightly less)
  playlistsSection: {
    marginTop: scale(16),
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LAYOUT.bottomGradientHeight,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export { HomeScreen as default };
export { COLORS as HOME_CONFIG } from '../homeDesign';
