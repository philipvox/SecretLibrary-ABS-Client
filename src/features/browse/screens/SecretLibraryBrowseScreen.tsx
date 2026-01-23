/**
 * src/features/browse/screens/SecretLibraryBrowseScreen.tsx
 *
 * Secret Library Browse screen with editorial design.
 * Features collections, personalized recommendations, series gallery,
 * top authors, and browse grid.
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { secretLibraryColors as staticColors } from '@/shared/theme/secretLibrary';
import { useSecretLibraryColors } from '@/shared/theme';
import { useLibraryCache } from '@/core/cache';
import { useSpineCacheStatus } from '@/features/home';
import { logger } from '@/shared/utils/logger';

// Components
import { BrowseTopNav } from '../components/BrowseTopNav';
import { TopPickHero } from '../components/TopPickHero';
import { TasteTextList } from '../components/TasteTextList';
import { RecentlyAddedSection } from '../components/RecentlyAddedSection';
import { SeriesGallery } from '../components/SeriesGallery';
import { AuthorsTextList } from '../components/AuthorsTextList';
import { BrowseGrid } from '../components/BrowseGrid';
import { BrowseFooter } from '../components/BrowseFooter';
import { ScreenLoadingOverlay } from '@/shared/components';
import { useNavigationWithLoading, useAutoHideLoading } from '@/shared/hooks';

// Performance timing
const PERF_TAG = '[Browse Perf]';

// Bottom padding for mini player
const MINI_PLAYER_HEIGHT = 80;

export function SecretLibraryBrowseScreen() {
  const renderStart = useRef(Date.now());
  const [mounted, setMounted] = useState(false);

  const insets = useSafeAreaInsets();
  const { navigateWithLoading, navigation } = useNavigationWithLoading();
  const scrollRef = useRef<ScrollView>(null);

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  // Data hooks - measure time
  const hookStart = Date.now();
  const { refreshCache, isLoading: cacheLoading } = useLibraryCache();
  const { isPopulated: spineCacheReady, cacheSize: spineCacheSize } = useSpineCacheStatus();
  const hookTime = Date.now() - hookStart;

  // Log mount timing
  useEffect(() => {
    const mountTime = Date.now() - renderStart.current;
    logger.debug(`${PERF_TAG} Screen mounted in ${mountTime}ms (hooks: ${hookTime}ms)`);
    setMounted(true);

    return () => {
      logger.debug(`${PERF_TAG} Screen unmounted`);
    };
  }, []);

  // Hide global loading when data is ready AND screen is focused
  // This is essential for tab screens that stay mounted
  const isDataReady = mounted && spineCacheReady && !cacheLoading;
  useAutoHideLoading(isDataReady);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    await refreshCache();
  }, [refreshCache]);

  // Navigation handlers
  const handleMoodPress = useCallback(() => {
    navigation.navigate('MoodDiscovery');
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  const handleLogoLongPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'ProfileTab' });
  }, [navigation]);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSeriesPress = useCallback((seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const handleAuthorPress = useCallback((authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  }, [navigation]);

  const handleViewAllSeries = useCallback(() => {
    navigateWithLoading('SeriesList');
  }, [navigateWithLoading]);

  const handleViewAllAuthors = useCallback(() => {
    navigateWithLoading('AuthorsList');
  }, [navigateWithLoading]);

  const handleViewAllBooks = useCallback(() => {
    navigateWithLoading('AllBooks');
  }, [navigateWithLoading]);

  const handleBrowseItemPress = useCallback((type: 'genres' | 'narrators' | 'series' | 'duration') => {
    switch (type) {
      case 'genres':
        navigateWithLoading('GenresList');
        break;
      case 'narrators':
        navigateWithLoading('NarratorsList');
        break;
      case 'series':
        navigateWithLoading('SeriesList');
        break;
      case 'duration':
        navigateWithLoading('DurationFilter');
        break;
    }
  }, [navigateWithLoading]);

  const isRefreshing = cacheLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <StatusBar barStyle="light-content" backgroundColor={staticColors.black} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* Safe area for top nav - always dark to match header */}
      <View style={[styles.safeAreaTop, { height: insets.top, backgroundColor: staticColors.black }]} />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: MINI_PLAYER_HEIGHT + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gray}
          />
        }
      >
        {/* Top Navigation */}
        <BrowseTopNav
          onMoodPress={handleMoodPress}
          onClose={handleClose}
          onLogoPress={handleLogoPress}
          onLogoLongPress={handleLogoLongPress}
        />

        {/* Top Pick Hero */}
        <TopPickHero onBookPress={handleBookPress} />

        {/* Based on Your Taste - Hero section */}
        <TasteTextList
          onBookPress={handleBookPress}
        />

        {/* Recently Added */}
        <RecentlyAddedSection
          onBookPress={handleBookPress}
          onViewAll={handleViewAllBooks}
        />

        {/* Top Authors */}
        <AuthorsTextList
          onAuthorPress={handleAuthorPress}
          onViewAll={handleViewAllAuthors}
        />

        {/* Series Gallery */}
        <SeriesGallery
          onSeriesPress={handleSeriesPress}
          onViewAll={handleViewAllSeries}
        />

        {/* Browse Grid */}
        <BrowseGrid
          onItemPress={handleBrowseItemPress}
        />

        {/* Footer */}
        <BrowseFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.white,
  },
  safeAreaTop: {
    backgroundColor: staticColors.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
