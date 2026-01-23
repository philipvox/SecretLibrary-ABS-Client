/**
 * src/features/library/screens/SeriesListScreen.tsx
 *
 * Browse all series with favorite series shown first.
 * Uses color dots instead of cover images (Secret Library design).
 * Uses library cache for instant loading.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache, getAllSeries } from '@/core/cache';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { SeriesHeartButton, SkullRefreshControl, TopNav, TopNavBackIcon, BookIcon, ScreenLoadingOverlay } from '@/shared/components';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useTheme } from '@/shared/theme';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
// MIGRATED: Now using new spine system via adapter
import { hashString, SPINE_COLOR_PALETTE } from '@/features/home/utils/spine/adapter';

const PADDING = 16;
const MAX_PROGRESS_DOTS = 8;
const MAX_COLOR_DOTS = 8;

// Get deterministic color for a book based on its ID
function getBookDotColor(bookId: string): string {
  const hash = hashString(bookId);
  return SPINE_COLOR_PALETTE[hash % SPINE_COLOR_PALETTE.length];
}

// Progress dot component
function ProgressDot({ status, size = 5, accent, accentDim }: { status: 'completed' | 'in_progress' | 'not_started'; size?: number; accent: string; accentDim: string }) {
  const getColor = () => {
    switch (status) {
      case 'completed':
        return accent;
      case 'in_progress':
        return accentDim;
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
  const { colors, isDark } = useTheme();
  const accent = colors.accent.primary;
  const accentDim = accent + '80'; // 50% opacity
  const inputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mark as mounted after first render and hide global loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      globalLoading.hide();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const { refreshCache, isLoaded } = useLibraryCache();
  const favoriteSeriesNames = useMyLibraryStore((state) => state.favoriteSeriesNames);
  const hideSingleBookSeries = useMyLibraryStore((state) => state.hideSingleBookSeries);

  // Cache favorites for sorting - only update when screen is focused
  const [cachedFavorites, setCachedFavorites] = useState<string[]>(favoriteSeriesNames);

  useFocusEffect(
    useCallback(() => {
      // Update cached favorites when screen comes into focus
      setCachedFavorites(favoriteSeriesNames);
    }, [favoriteSeriesNames])
  );

  const allSeries = useMemo(() => getAllSeries(), [isLoaded]);

  // Filter series by search query and preferences
  const filteredSeries = useMemo(() => {
    let result = allSeries;

    // Filter out single-book series if setting is enabled
    if (hideSingleBookSeries) {
      result = result.filter(s => s.bookCount > 1);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(lowerQuery));
    }

    return result;
  }, [allSeries, searchQuery, hideSingleBookSeries]);

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

    // Move favorites to top (using cached list so order doesn't change until page revisit)
    sorted.sort((a, b) => {
      const aFav = cachedFavorites.includes(a.name);
      const bFav = cachedFavorites.includes(b.name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

    return sorted;
  }, [filteredSeries, sortBy, sortDirection, cachedFavorites]);

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
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background.primary} />

      {/* Loading overlay for initial load */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* TopNav with skull logo and integrated search bar */}
      <TopNav
        variant={isDark ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: colors.background.primary }}
        pills={[
          {
            key: 'series',
            label: 'Series',
            icon: <BookIcon size={10} color={colors.text.primary} />,
          },
        ]}
        circleButtons={[
          {
            key: 'back',
            icon: <TopNavBackIcon color={colors.text.primary} size={14} />,
            onPress: handleBack,
          },
        ]}
        searchBar={{
          value: searchQuery,
          onChangeText: setSearchQuery,
          placeholder: 'Search series...',
          inputRef: inputRef as React.RefObject<TextInput>,
        }}
      />

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text style={[styles.resultCount, { color: colors.text.secondary }]}>{sortedSeries.length} series</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[
              styles.sortButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
              sortBy === 'name' && { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' },
            ]}
            onPress={() => handleSortPress('name')}
          >
            <Icon
              name={sortBy === 'name' ? (sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown') : 'ArrowUpDown'}
              size={14}
              color={sortBy === 'name' ? colors.text.primary : colors.text.tertiary}
            />
            <Text style={[styles.sortButtonText, { color: colors.text.tertiary }, sortBy === 'name' && { color: colors.text.primary }]}>
              {sortBy === 'name' ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A') : 'Name'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sortButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
              sortBy === 'bookCount' && { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' },
            ]}
            onPress={() => handleSortPress('bookCount')}
          >
            <Icon
              name={sortBy === 'bookCount' ? (sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown') : 'Library'}
              size={14}
              color={sortBy === 'bookCount' ? colors.text.primary : colors.text.tertiary}
            />
            <Text style={[styles.sortButtonText, { color: colors.text.tertiary }, sortBy === 'bookCount' && { color: colors.text.primary }]}>Books</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SkullRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh}>
        <FlatList
          data={sortedSeries}
          keyExtractor={(item) => item.name}
          contentContainerStyle={[styles.list, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
        renderItem={({ item: series }) => {
          const isFavorite = favoriteSeriesNames.includes(series.name);

          // Get color dots from book IDs
          const bookIds = series.books.slice(0, MAX_COLOR_DOTS).map(b => b.id);
          const colorDots = bookIds.map(getBookDotColor);

          // Calculate progress
          const progress = getSeriesProgress(series.books);
          const hasProgress = progress.completed > 0 || progress.inProgress > 0;
          const isComplete = progress.completed === series.bookCount;
          const remainingDuration = progress.totalDuration - progress.totalListened;
          const dotsToShow = Math.min(series.bookCount, MAX_PROGRESS_DOTS);
          const showMoreIndicator = series.bookCount > MAX_PROGRESS_DOTS;

          // Get author from first book (only BookMetadata has authorName)
          const metadata = series.books[0]?.media?.metadata;
          const author = metadata && 'authorName' in metadata ? metadata.authorName || '' : '';

          return (
            <Pressable
              style={[
                styles.seriesCard,
                isDark ? styles.cardDark : styles.cardLight,
              ]}
              onPress={() => handleSeriesPress(series.name)}
            >
              {/* Left side: Name, author, count */}
              <View style={styles.seriesCardLeft}>
                <Text
                  style={[styles.seriesName, isDark && styles.seriesNameDark]}
                  numberOfLines={2}
                >
                  {series.name}
                </Text>

                {author && (
                  <Text style={styles.authorText} numberOfLines={1}>
                    {author}
                  </Text>
                )}

                <Text style={styles.bookCountText}>
                  {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
                </Text>

                {/* Progress Row - only show if there's progress */}
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
                        return <ProgressDot key={i} status={status} accent={accent} accentDim={accentDim} />;
                      })}
                      {showMoreIndicator && (
                        <Text style={[styles.moreText, { color: colors.text.tertiary }]}>+{series.bookCount - MAX_PROGRESS_DOTS}</Text>
                      )}
                    </View>
                    <Text style={[styles.progressCount, { color: accent }]}>
                      {progress.completed}/{series.bookCount}
                    </Text>
                  </View>
                )}

                {/* Remaining time - only show if there's progress */}
                {hasProgress && remainingDuration > 0 && (
                  <Text style={styles.remainingText}>
                    ~{formatDurationShort(remainingDuration)} left
                  </Text>
                )}
              </View>

              {/* Right side: Color dots + complete badge */}
              <View style={styles.seriesCardRight}>
                {/* Complete badge */}
                {isComplete && (
                  <View style={[styles.completeBadge, { backgroundColor: accent }]}>
                    <Icon name="Check" size={10} color={colors.text.inverse} />
                  </View>
                )}

                {/* Color Dots */}
                <View style={styles.colorDotsRow}>
                  {colorDots.map((color, index) => (
                    <View
                      key={`${index}-${color}`}
                      style={[styles.colorDot, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              </View>

              {/* Heart button - far right */}
              <View style={styles.heartContainer}>
                <SeriesHeartButton
                  seriesName={series.name}
                  size={18}
                  showCircle
                />
              </View>
            </Pressable>
          );
        }}
        />
      </SkullRefreshControl>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
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
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sortButtonTextActive: {
    // color applied inline
  },
  list: {
    paddingHorizontal: PADDING,
  },
  seriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative',
  },
  cardLight: {
    backgroundColor: secretLibraryColors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  cardDark: {
    backgroundColor: secretLibraryColors.black,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  seriesCardLeft: {
    flex: 1,
    marginRight: 16,
  },
  seriesCardRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  seriesName: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(17),
    color: secretLibraryColors.black,
    lineHeight: scale(22),
    marginBottom: 4,
  },
  seriesNameDark: {
    color: secretLibraryColors.white,
  },
  authorText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: secretLibraryColors.gray,
    marginBottom: 2,
  },
  bookCountText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: secretLibraryColors.gray,
  },
  colorDotsRow: {
    flexDirection: 'row',
    gap: 3,
    flexWrap: 'wrap',
    marginTop: 8,
    maxWidth: 100,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  moreText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(8),
    marginLeft: 2,
  },
  progressCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    fontWeight: '600',
  },
  remainingText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: secretLibraryColors.gray,
    marginTop: 4,
  },
  completeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});
