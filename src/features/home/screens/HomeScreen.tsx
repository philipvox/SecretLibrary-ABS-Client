/**
 * src/features/home/screens/HomeScreen.tsx
 *
 * Main home screen with Now Playing card and carousels
 * New design with glassmorphism and blurred background
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

// Design constants
import { COLORS, DIMENSIONS, LAYOUT, TYPOGRAPHY } from '../homeDesign';

// Types
import { SeriesWithBooks, PlaylistDisplay } from '../types';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Get home data
  const {
    currentBook,
    currentProgress,
    recentBooks,
    userSeries,
    userPlaylists,
    isLoading,
    isRefreshing,
    refresh,
  } = useHomeData();

  // Get player actions
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

  // Get cover URL for background
  const currentCoverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : undefined;

  // Navigation handlers
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
      // Navigate to playlist detail when implemented
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
    // Navigate to playlists list when implemented
    console.log('View all playlists');
  }, []);

  const handleNowPlayingPress = useCallback(() => {
    // Player screen is shown as overlay via PlayerScreen component
    // Just need to ensure book is loaded
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Loading state
  if (isLoading && !currentBook && recentBooks.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={COLORS.playButton} />
      </View>
    );
  }

  // Empty state
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

      {/* Blurred background */}
      <HomeBackground coverUrl={currentCoverUrl} />

      <ScrollView
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + DIMENSIONS.screenPadding,
            paddingBottom: insets.bottom + LAYOUT.tabBarHeight,
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
              sleepTimer={sleepTimer ? sleepTimer / 60 : null}
              onPress={handleNowPlayingPress}
              onPlay={handlePlayPause}
              onSkipBack={skipBackward}
              onSkipForward={skipForward}
            />
          </View>
        )}

        {/* Your Books Section */}
        {recentBooks.length > 0 && (
          <>
            <SectionHeader title="Your Books" onViewAll={handleViewAllBooks} />
            <HorizontalCarousel
              data={recentBooks}
              keyExtractor={(book) => book.id}
              itemWidth={DIMENSIONS.bookCardWidth}
              renderItem={(book) => (
                <BookCard
                  book={book}
                  onPress={() => handleBookPress(book)}
                  showProgress
                  progress={(book as any).userMediaProgress?.progress || 0}
                  isFavorite={true}
                />
              )}
            />
          </>
        )}

        {/* Your Series Section */}
        {userSeries.length > 0 && (
          <>
            <SectionHeader title="Your Series" onViewAll={handleViewAllSeries} />
            <HorizontalCarousel
              data={userSeries}
              keyExtractor={(series) => series.id}
              itemWidth={DIMENSIONS.seriesCardWidth}
              renderItem={(series) => (
                <SeriesCard
                  series={series}
                  onPress={() => handleSeriesPress(series)}
                />
              )}
            />
          </>
        )}

        {/* Your Playlists Section */}
        {userPlaylists.length > 0 && (
          <>
            <SectionHeader title="Your Playlists" onViewAll={handleViewAllPlaylists} />
            <HorizontalCarousel
              data={userPlaylists}
              keyExtractor={(playlist) => playlist.id}
              itemWidth={DIMENSIONS.playlistCardWidth}
              renderItem={(playlist) => (
                <PlaylistCard
                  playlist={playlist}
                  onPress={() => handlePlaylistPress(playlist)}
                />
              )}
            />
          </>
        )}
      </ScrollView>

      {/* Bottom fade gradient */}
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
    paddingHorizontal: DIMENSIONS.screenPadding,
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
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.cardSubtitle,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

// Legacy export for backwards compatibility
export { HomeScreen as default };

// Re-export config for other files that might import it
export { COLORS as HOME_CONFIG } from '../homeDesign';
