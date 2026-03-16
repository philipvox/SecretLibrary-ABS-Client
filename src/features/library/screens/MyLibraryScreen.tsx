/**
 * src/features/library/screens/MyLibraryScreen.tsx
 *
 * My Library screen - container component with tab navigation.
 * Tab content is delegated to extracted tab components.
 * Data enrichment is handled by useLibraryData hook.
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  TextInput,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Search, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '@/core/api';
import { useLibraryCache } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';
import { scale, spacing, useTheme } from '@/shared/theme';
import { SectionSkeleton, BookCardSkeleton, SkullRefreshControl, useBookContextMenu } from '@/shared/components';
import { SortPicker } from '../components/SortPicker';
import { useLibraryViewStore } from '../stores/libraryViewStore';
import { LibraryTabBar } from '../components/LibraryTabBar';
import { LibraryEmptyState } from '../components/LibraryEmptyState';
import {
  AllBooksTab,
  DownloadedTab,
  InProgressTab,
  FavoritesTab,
  CompletedTab,
} from '../components/tabs';
import { useLibraryData } from '../hooks/useLibraryData';
import { TabType, EnrichedBook } from '../types';

// Compass icon for browse/discover
const CompassIcon = ({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} />
    <Path
      d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export function MyLibraryScreen() {
  useScreenLoadTime('MyLibraryScreen');
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { loadBook } = usePlayerStore();
  const { showMenu } = useBookContextMenu();
  const { getItem } = useLibraryCache();

  // Tab, sort, and search state
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const sort = useLibraryViewStore((s) => s.sort);
  const setSort = useLibraryViewStore((s) => s.setSort);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get all library data from hook
  const {
    _enrichedBooks,
    filteredBooks,
    favoritedBooks,
    serverInProgressBooks,
    seriesGroups,
    favoriteAuthorData,
    favoriteSeriesData,
    favoriteNarratorData,
    activeDownloads,
    continueListeningItems,
    totalStorageUsed,
    _isLoaded,
    isLoading,
    hasDownloading,
    hasPaused,
    hasAnyContent,
    isMarkedFinished,
    refetchContinueListening,
    loadCache,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    currentLibraryId,
  } = useLibraryData({ activeTab, sort, searchQuery });

  // DEBUG: Log filtered books on every render
  console.log(`[MyLibrary] isLoading=${isLoading}, books=${filteredBooks.length}, first3:`,
    filteredBooks.slice(0, 3).map(b => b.title)
  );

  // Load spine manifest on mount to ensure spines render correctly
  useEffect(() => {
    useLibraryCache.getState().loadSpineManifest();
  }, []);

  // Handlers
  const handleRefresh = useCallback(async () => {
    if (!currentLibraryId) return;
    setIsRefreshing(true);
    try {
      await Promise.all([loadCache(currentLibraryId, true), refetchContinueListening()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentLibraryId, loadCache, refetchContinueListening]);

  const handleBrowse = () => {
    // Use jumpTo for tab switching when already inside the tab navigator
    const parent = navigation.getParent();
    if (parent?.jumpTo) {
      parent.jumpTo('DiscoverTab');
    } else {
      navigation.navigate('Main', { screen: 'DiscoverTab' });
    }
  };
  const handleBookPress = useCallback((itemId: string) => {
    const item = getItem(itemId);
    if (item) showMenu(item);
  }, [getItem, showMenu]);
  const handleSeriesPress = (seriesName: string) => navigation.navigate('SeriesDetail', { seriesName });
  const handleAuthorPress = (authorName: string) => navigation.navigate('AuthorDetail', { name: authorName });
  const handleNarratorPress = (narratorName: string) => navigation.navigate('NarratorDetail', { name: narratorName });
  const handleManageStorage = () => navigation.navigate('Main', { screen: 'ProfileTab' });

  const handleResumeBook = useCallback(async (book: EnrichedBook) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      if (book.item) {
        await loadBook(book.item, { autoPlay: true, showPlayer: false });
      }
    }
  }, [loadBook]);

  const handlePlayBook = useCallback(async (book: EnrichedBook) => {
    if (book.progress >= 0.95) {
      Alert.alert('Restart Book?', 'This book is completed. Would you like to start from the beginning?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: async () => {
            try {
              const fullBook = await apiClient.getItem(book.id);
              await loadBook(fullBook, { autoPlay: true, showPlayer: false, startPosition: 0 });
            } catch {
              if (book.item) {
                await loadBook(book.item, { autoPlay: true, showPlayer: false, startPosition: 0 });
              }
            }
          },
        },
      ]);
    } else {
      try {
        const fullBook = await apiClient.getItem(book.id);
        await loadBook(fullBook, { autoPlay: true, showPlayer: false });
      } catch {
        if (book.item) {
          await loadBook(book.item, { autoPlay: true, showPlayer: false });
        }
      }
    }
  }, [loadBook]);

  const handleContinueListeningPlay = useCallback(async () => {
    const heroBook = continueListeningItems[0];
    if (!heroBook) return;
    try {
      const fullBook = await apiClient.getItem(heroBook.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      await loadBook(heroBook, { autoPlay: true, showPlayer: false });
    }
  }, [continueListeningItems, loadBook]);

  const handlePauseAll = useCallback(() => {
    activeDownloads.forEach(d => {
      if (d.status === 'downloading') pauseDownload(d.itemId);
    });
  }, [activeDownloads, pauseDownload]);

  const handleResumeAll = useCallback(() => {
    activeDownloads.forEach(d => {
      if (d.status === 'paused') resumeDownload(d.itemId);
    });
  }, [activeDownloads, resumeDownload]);

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'favorites':
        return (
          <FavoritesTab
            favoritedBooks={favoritedBooks}
            favoriteAuthorData={favoriteAuthorData}
            favoriteSeriesData={favoriteSeriesData}
            favoriteNarratorData={favoriteNarratorData}
            onBookPress={handleBookPress}
            onBookPlay={handlePlayBook}
            onSeriesPress={handleSeriesPress}
            onAuthorPress={handleAuthorPress}
            onNarratorPress={handleNarratorPress}
            isMarkedFinished={isMarkedFinished}
            onBrowse={handleBrowse}
          />
        );
      case 'in-progress':
        return (
          <InProgressTab
            books={serverInProgressBooks}
            onBookPress={handleBookPress}
            onBookPlay={handlePlayBook}
            onResumeBook={handleResumeBook}
            onSeriesPress={handleSeriesPress}
            isMarkedFinished={isMarkedFinished}
            onBrowse={handleBrowse}
          />
        );
      case 'downloaded':
        return (
          <DownloadedTab
            books={filteredBooks}
            seriesGroups={seriesGroups}
            activeDownloads={activeDownloads}
            totalStorageUsed={totalStorageUsed}
            onBookPress={handleBookPress}
            onBookPlay={handlePlayBook}
            onSeriesPress={handleSeriesPress}
            onDownloadPause={pauseDownload}
            onDownloadResume={resumeDownload}
            onDownloadDelete={deleteDownload}
            onPauseAll={handlePauseAll}
            onResumeAll={handleResumeAll}
            onManageStorage={handleManageStorage}
            isMarkedFinished={isMarkedFinished}
            hasDownloading={hasDownloading}
            hasPaused={hasPaused}
            onBrowse={handleBrowse}
          />
        );
      case 'completed':
        // Handled separately above with its own FlatList for virtualization
        return null;
      default:
        return (
          <AllBooksTab
            books={filteredBooks}
            continueListeningBook={continueListeningItems[0] || null}
            activeDownloads={activeDownloads}
            favoriteSeriesData={favoriteSeriesData}
            favoriteAuthorData={favoriteAuthorData}
            favoriteNarratorData={favoriteNarratorData}
            onBookPress={handleBookPress}
            onBookPlay={handlePlayBook}
            onContinueListeningPlay={handleContinueListeningPlay}
            onSeriesPress={handleSeriesPress}
            onAuthorPress={handleAuthorPress}
            onNarratorPress={handleNarratorPress}
            onDownloadPause={pauseDownload}
            onDownloadResume={resumeDownload}
            onDownloadDelete={deleteDownload}
            onPauseAll={handlePauseAll}
            onResumeAll={handleResumeAll}
            isMarkedFinished={isMarkedFinished}
            hasDownloading={hasDownloading}
            hasPaused={hasPaused}
            onBrowse={handleBrowse}
          />
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + scale(8) }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.background.secondary }]}>
          <Search size={scale(18)} color={colors.text.secondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search library..."
            placeholderTextColor={colors.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <XCircle size={scale(18)} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort & Browse Row */}
        <View style={styles.sortRow}>
          <SortPicker selected={sort} onSelect={setSort} bookCount={filteredBooks.length} />
          <TouchableOpacity
            style={[styles.browseButton, { backgroundColor: colors.background.secondary }]}
            onPress={handleBrowse}
          >
            <CompassIcon size={scale(18)} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <LibraryTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <SectionSkeleton />
          <View style={styles.skeletonRow}>
            <BookCardSkeleton />
            <BookCardSkeleton />
            <BookCardSkeleton />
          </View>
        </View>
      ) : !hasAnyContent ? (
        <LibraryEmptyState tab={activeTab} onAction={handleBrowse} />
      ) : activeTab === 'completed' ? (
        // CompletedTab has its own FlatList for virtualization
        <CompletedTab
          books={filteredBooks}
          onBookPress={handleBookPress}
          onBookPlay={handlePlayBook}
          isMarkedFinished={isMarkedFinished}
          onBrowse={handleBrowse}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        // Other tabs use ScrollView (can be refactored later for virtualization)
        <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {renderTabContent()}
          </ScrollView>
        </SkullRefreshControl>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: scale(16),
    paddingBottom: scale(4),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    minHeight: scale(40),
    gap: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: scale(14),
    paddingVertical: scale(4),
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scale(6),
  },
  browseButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // No top padding - content starts immediately after tab bar
  },
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});

export default MyLibraryScreen;
