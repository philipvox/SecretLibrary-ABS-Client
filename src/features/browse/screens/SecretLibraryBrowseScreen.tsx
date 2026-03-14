/**
 * src/features/browse/screens/SecretLibraryBrowseScreen.tsx
 *
 * Secret Library Browse screen — single continuous scroll combining
 * personalized recommendations, discovery, and curated collections.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { secretLibraryColors as staticColors } from '@/shared/theme/secretLibrary';
import { useSecretLibraryColors } from '@/shared/theme';
import { useLibraryCache } from '@/core/cache';
import { useSpineCacheStatus } from '@/features/home';
import { logger } from '@/shared/utils/logger';

// Central filter hook — filters library once, sections receive pre-filtered items
import { useBrowseLibrary } from '../hooks/useBrowseLibrary';

// Components
import { BrowseTopNav } from '../components/BrowseTopNav';
import { BrowseContent } from '../components/BrowseContent';
import { TagFilterSheet } from '../components/TagFilterSheet';
import { BookContextMenu } from '@/shared/components/BookContextMenu';
import { ScreenLoadingOverlay, useBookContextMenu } from '@/shared/components';
import { useNavigationWithLoading, useAutoHideLoading } from '@/shared/hooks';

// Performance timing
const PERF_TAG = '[Browse Perf]';

export function SecretLibraryBrowseScreen() {
  const [mounted, setMounted] = useState(false);
  const [tagFilterSheetVisible, setTagFilterSheetVisible] = useState(false);
  const [sheetBookId, setSheetBookId] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const { navigateWithLoading, navigation } = useNavigationWithLoading();

  // Book context menu
  const { showMenu } = useBookContextMenu();

  // Theme-aware colors
  const colors = useSecretLibraryColors();

  // Data hooks — filter library once, pass to sections as props
  const { refreshCache, isLoading: cacheLoading, getItem } = useLibraryCache();
  const { filteredItems } = useBrowseLibrary();
  const { isPopulated: spineCacheReady } = useSpineCacheStatus();

  // Set mounted on first render
  useEffect(() => {
    logger.debug(`${PERF_TAG} Screen mounted`);
    setMounted(true);

    return () => {
      logger.debug(`${PERF_TAG} Screen unmounted`);
    };
  }, []);

  // Hide global loading when data is ready AND screen is focused
  const isDataReady = mounted && spineCacheReady && !cacheLoading;
  useAutoHideLoading(isDataReady, { debug: false, debugTag: 'BrowsePage' });

  // Safety timeout - force hide loading after 5 seconds if something is stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      import('@/shared/stores/globalLoadingStore').then(({ globalLoading }) => {
        globalLoading.hide();
      });
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  // Refresh handler — fire-and-forget; don't block UI on full cache reload
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshCache().finally(() => setIsRefreshing(false));
  }, [refreshCache]);

  // Navigation handlers
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
    setSheetBookId(bookId);
  }, []);

  const handleViewBookDetails = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleBookLongPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSeriesPress = useCallback((seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const handleAuthorPress = useCallback((authorName: string) => {
    navigation.navigate('AuthorDetail', { authorName });
  }, [navigation]);

  const handleCollectionPress = useCallback((collectionId: string) => {
    navigation.navigate('CollectionDetail', { collectionId });
  }, [navigation]);

  const handleViewAllCollections = useCallback(() => {
    navigateWithLoading('CollectionsList');
  }, [navigateWithLoading]);

  const handleViewAllBooks = useCallback(() => {
    navigation.navigate('FilteredBooks', {
      title: 'All Books',
      filterType: 'all_books',
    });
  }, [navigation]);

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

  const handleTagFilterPress = useCallback(() => {
    setTagFilterSheetVisible(true);
  }, []);

  const handleCloseTagFilterSheet = useCallback(() => {
    setTagFilterSheetVisible(false);
  }, []);

  const handleMoodPress = useCallback((moodKey: string) => {
    const title = moodKey.charAt(0).toUpperCase() + moodKey.slice(1).replace('-', ' ');
    navigation.navigate('FilteredBooks', {
      title: `${title} Books`,
      filterType: 'feeling',
      feeling: moodKey,
    });
  }, [navigation]);

  const handleVibePress = useCallback((slug: string) => {
    const title = slug.split('-').map((w, i) => {
      if (['of', 'the', 'a', 'an', 'and', 'on', 'in'].includes(w) && i > 0) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
    navigation.navigate('FilteredBooks', {
      title,
      filterType: 'tag',
      tag: `dna:comp-vibe:${slug}`,
    });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: staticColors.black }]}>
      <StatusBar barStyle="light-content" backgroundColor={staticColors.black} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* Safe area for top nav */}
      <View style={[styles.safeAreaTop, { height: insets.top, backgroundColor: staticColors.black }]} />

      {/* Top Navigation */}
      <BrowseTopNav
        onClose={handleClose}
        onLogoPress={handleLogoPress}
        onLogoLongPress={handleLogoLongPress}
        onTagFilterPress={handleTagFilterPress}
      />

      {/* Unified Browse Content */}
      <BrowseContent
        filteredItems={filteredItems}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onBookPress={handleBookPress}
        onBookLongPress={handleBookLongPress}
        onSeriesPress={handleSeriesPress}
        onAuthorPress={handleAuthorPress}
        onCollectionPress={handleCollectionPress}
        onViewAllCollections={handleViewAllCollections}
        onViewAllBooks={handleViewAllBooks}
        onVibePress={handleVibePress}
        onBrowseItemPress={handleBrowseItemPress}
        onMoodPress={handleMoodPress}
      />

      {/* Tag Filter Sheet */}
      <TagFilterSheet
        visible={tagFilterSheetVisible}
        onClose={handleCloseTagFilterSheet}
      />

      {/* Book Context Menu (tap on spine/cover) */}
      <BookContextMenu
        book={sheetBookId ? getItem(sheetBookId) || null : null}
        visible={!!sheetBookId}
        onClose={() => setSheetBookId(null)}
        onViewDetails={(book) => handleViewBookDetails(book.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.black,
  },
  safeAreaTop: {
    backgroundColor: staticColors.black,
  },
});
