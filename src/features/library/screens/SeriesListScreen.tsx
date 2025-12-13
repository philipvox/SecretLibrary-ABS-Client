/**
 * src/features/library/screens/SeriesListScreen.tsx
 *
 * Browse all series with favorite series shown first.
 * Uses library cache for instant loading.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache, getAllSeries } from '@/core/cache';
import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { SeriesHeartButton } from '@/shared/components';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, wp, spacing, radius } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const BG_COLOR = colors.backgroundPrimary;
const CARD_COLOR = colors.backgroundTertiary;
const ACCENT = colors.accent;
const ACCENT_DIM = 'rgba(243,182,12,0.5)';
const PADDING = 16;
const GAP = 12;
const COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / COLUMNS;
const COVER_SIZE = CARD_WIDTH * 0.55;
const MAX_VISIBLE_BOOKS = 10;
const MAX_PROGRESS_DOTS = 8;

// Progress dot component
function ProgressDot({ status, size = 5 }: { status: 'completed' | 'in_progress' | 'not_started'; size?: number }) {
  const getColor = () => {
    switch (status) {
      case 'completed':
        return ACCENT;
      case 'in_progress':
        return ACCENT_DIM;
      default:
        return 'rgba(255,255,255,0.25)';
    }
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getColor(),
      }}
    />
  );
}

// Calculate series progress
function getSeriesProgress(books: any[]) {
  if (!books || books.length === 0) {
    return { completed: 0, inProgress: 0, notStarted: 0, totalListened: 0, totalDuration: 0 };
  }

  let completed = 0;
  let inProgress = 0;
  let totalListened = 0;
  let totalDuration = 0;

  books.forEach(book => {
    const progress = book.userMediaProgress?.progress || 0;
    const duration = book.media?.duration || 0;
    totalDuration += duration;
    totalListened += duration * progress;

    if (progress >= 0.95) {
      completed++;
    } else if (progress > 0) {
      inProgress++;
    }
  });

  const notStarted = books.length - completed - inProgress;
  return { completed, inProgress, notStarted, totalListened, totalDuration };
}

function formatDurationShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type SortType = 'name' | 'bookCount';
type SortDirection = 'asc' | 'desc';

export function SeriesListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refreshCache, isLoaded } = useLibraryCache();
  const favoriteSeriesNames = useMyLibraryStore((state) => state.favoriteSeriesNames);

  const allSeries = useMemo(() => getAllSeries(), [isLoaded]);

  // Filter series by search query
  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) return allSeries;
    const lowerQuery = searchQuery.toLowerCase();
    return allSeries.filter(s => s.name.toLowerCase().includes(lowerQuery));
  }, [allSeries, searchQuery]);

  const sortedSeries = useMemo(() => {
    const sorted = [...filteredSeries];
    const direction = sortDirection === 'asc' ? 1 : -1;

    // Sort
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => direction * a.name.localeCompare(b.name));
        break;
      case 'bookCount':
        sorted.sort((a, b) => direction * (a.bookCount - b.bookCount));
        break;
    }

    // Move favorites to top
    sorted.sort((a, b) => {
      const aFav = favoriteSeriesNames.includes(a.name);
      const bFav = favoriteSeriesNames.includes(b.name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

    return sorted;
  }, [filteredSeries, sortBy, sortDirection, favoriteSeriesNames]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  const handleSeriesPress = (seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  };

  const handleSortPress = (type: SortType) => {
    if (sortBy === type) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortDirection('asc');
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCache();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache]);

  if (!isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.5)" set="ionicons" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search series..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Icon name="close-circle" size={18} color="rgba(255,255,255,0.5)" set="ionicons" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text style={styles.resultCount}>{sortedSeries.length} series</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
            onPress={() => handleSortPress('name')}
          >
            <Icon
              name={sortBy === 'name' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'swap-vertical'}
              size={14}
              color={sortBy === 'name' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
            <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
              {sortBy === 'name' ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A') : 'Name'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'bookCount' && styles.sortButtonActive]}
            onPress={() => handleSortPress('bookCount')}
          >
            <Icon
              name={sortBy === 'bookCount' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'library-outline'}
              size={14}
              color={sortBy === 'bookCount' ? '#000' : 'rgba(255,255,255,0.6)'}
              set="ionicons"
            />
            <Text style={[styles.sortButtonText, sortBy === 'bookCount' && styles.sortButtonTextActive]}>Books</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sortedSeries}
        keyExtractor={(item) => item.name}
        numColumns={2}
        contentContainerStyle={[styles.grid, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
        renderItem={({ item: series }) => {
          const isFavorite = favoriteSeriesNames.includes(series.name);
          const bookCovers = series.books.slice(0, MAX_VISIBLE_BOOKS).map(b => apiClient.getItemCoverUrl(b.id));
          const numCovers = bookCovers.length;
          const stackOffset = numCovers > 1
            ? (CARD_WIDTH - COVER_SIZE) / (numCovers - 1)
            : 0;

          // Calculate progress
          const progress = getSeriesProgress(series.books);
          const hasProgress = progress.completed > 0 || progress.inProgress > 0;
          const isComplete = progress.completed === series.bookCount;
          const remainingDuration = progress.totalDuration - progress.totalListened;
          const dotsToShow = Math.min(series.bookCount, MAX_PROGRESS_DOTS);
          const showMoreIndicator = series.bookCount > MAX_PROGRESS_DOTS;

          return (
            <TouchableOpacity
              style={styles.seriesCard}
              onPress={() => handleSeriesPress(series.name)}
              activeOpacity={0.7}
            >
              {/* Stacked covers - horizontal spread */}
              <View style={styles.stackContainer}>
                {bookCovers.map((coverUrl, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.stackCover,
                      {
                        left: idx * stackOffset,
                        zIndex: numCovers - idx,
                      },
                    ]}
                  >
                    <Image
                      source={coverUrl}
                      style={styles.coverImage}
                      contentFit="cover"
                      transition={150}
                    />
                  </View>
                ))}
                {/* Complete badge */}
                {isComplete && (
                  <View style={styles.completeBadge}>
                    <Icon name="checkmark" size={10} color="#000" set="ionicons" />
                  </View>
                )}
              </View>

              <View style={styles.titleRow}>
                <Text style={styles.seriesName} numberOfLines={2}>{series.name}</Text>
                <SeriesHeartButton
                  seriesName={series.name}
                  size={12}
                  style={styles.heartButton}
                />
              </View>

              {/* Progress dots - only show if there's progress */}
              {hasProgress && (
                <View style={styles.progressRow}>
                  <View style={styles.progressDots}>
                    {Array.from({ length: dotsToShow }).map((_, i) => {
                      let status: 'completed' | 'in_progress' | 'not_started';
                      if (i < progress.completed) {
                        status = 'completed';
                      } else if (i < progress.completed + progress.inProgress) {
                        status = 'in_progress';
                      } else {
                        status = 'not_started';
                      }
                      return <ProgressDot key={i} status={status} />;
                    })}
                    {showMoreIndicator && (
                      <Text style={styles.moreText}>+{series.bookCount - MAX_PROGRESS_DOTS}</Text>
                    )}
                  </View>
                  <Text style={styles.progressCount}>
                    {progress.completed}/{series.bookCount}
                  </Text>
                </View>
              )}

              {/* Book count or remaining time */}
              <Text style={styles.bookCountText} numberOfLines={1}>
                {hasProgress && remainingDuration > 0
                  ? `~${formatDurationShort(remainingDuration)} left`
                  : `${series.bookCount} ${series.bookCount === 1 ? 'book' : 'books'}`
                }
              </Text>

              {isFavorite && <View style={styles.favoriteBadge} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    paddingBottom: 12,
  },
  resultCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: CARD_COLOR,
  },
  sortButtonActive: {
    backgroundColor: ACCENT,
  },
  sortButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#000',
  },
  grid: {
    paddingHorizontal: PADDING,
  },
  columnWrapper: {
    gap: GAP,
    marginBottom: GAP,
  },
  seriesCard: {
    width: CARD_WIDTH,
  },
  stackContainer: {
    width: CARD_WIDTH,
    height: COVER_SIZE,
    marginBottom: 8,
  },
  stackCover: {
    position: 'absolute',
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: CARD_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  seriesName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 14,
    paddingRight: 4,
  },
  heartButton: {
    height: 26,
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 2,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  moreText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 2,
  },
  progressCount: {
    fontSize: 10,
    fontWeight: '600',
    color: ACCENT,
  },
  bookCountText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  completeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
});
