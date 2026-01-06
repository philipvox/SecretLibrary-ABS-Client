/**
 * src/features/home/components/TextListSection.tsx
 *
 * Typography-focused list sections for Home screen
 * Clean, minimal design with large titles and subtle metadata
 *
 * Design:
 * - Large section headers (40px, light weight)
 * - Tabs for switching between views
 * - Play button for books, progress count for series
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { getCoverUrl } from '@/core/cache';
import { apiClient } from '@/core/api';
import { logger } from '@/shared/utils/logger';
import { colors, wp, hp, moderateScale, spacing, radius } from '@/shared/theme';
import { useThemeColors, useIsDarkMode } from '@/shared/theme/themeStore';
import { SeriesHeartButton } from '@/shared/components';
import { SeriesWithBooks } from '../types';

// Layout constants
const MARGIN_H = wp(5);
const ROW_GAP = hp(2.8);

// Fanned series card constants
const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 16;
const GAP = 12;
const SERIES_CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;
const COVER_SIZE_FANNED = 60;
const FAN_OFFSET = 18;
const FAN_ROTATION = 8;
const FAN_VERTICAL_OFFSET = 6;
const MAX_VISIBLE_BOOKS = 5;

/**
 * Fade-in wrapper for staggered list animations
 * Based on NN/g: 100-200ms for simple transitions feels responsive
 */
const FadeInRow = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

/**
 * Format time since last listened
 * Returns natural format: "30 sec ago", "5 min ago", "2 hours ago", "3 days ago", "1 week ago"
 */
function formatTimeSince(lastUpdate?: number): string {
  // No timestamp provided
  if (!lastUpdate || lastUpdate <= 0) return '';

  const now = Date.now();
  const diff = now - lastUpdate;

  // If timestamp is in the future or very recent (within 10 sec), show "just now"
  if (diff < 0 || diff < 10000) return 'just now';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`;
  if (weeks > 0) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  return `${seconds} sec ago`;
}

/**
 * Play button icon (simple white triangle, no circle)
 */
const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 5v14l11-7L8 5z"
      fill="#FFFFFF"
    />
  </Svg>
);

// Cover image size for book rows
const COVER_SIZE = wp(10);

/**
 * Section header with pill badge style
 */
const SectionBadge = ({ title, textColor, bgColor }: { title: string; textColor: string; bgColor: string }) => (
  <View style={[styles.badge, { backgroundColor: bgColor }]}>
    <Text style={[styles.badgeText, { color: textColor }]}>{title}</Text>
  </View>
);

// =============================================================================
// FANNED SERIES CARD (2-column grid)
// =============================================================================

interface FannedSeriesCardProps {
  series: SeriesWithBooks;
  onPress: () => void;
  themeColors: ReturnType<typeof useThemeColors>;
  isDarkMode: boolean;
}

const FannedSeriesCard = React.memo(function FannedSeriesCard({
  series,
  onPress,
  themeColors,
  isDarkMode,
}: FannedSeriesCardProps) {
  // Get cover URLs for up to 5 books
  const bookCovers = useMemo(() => {
    return (series.books || []).slice(0, MAX_VISIBLE_BOOKS).map(book => apiClient.getItemCoverUrl(book.id));
  }, [series.books]);

  const numCovers = bookCovers.length;
  const cardBgColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <TouchableOpacity
      style={[styles.fannedSeriesCard, { backgroundColor: cardBgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Heart button - top right */}
      <SeriesHeartButton
        seriesName={series.name}
        size={10}
        showCircle
        style={styles.fannedHeartButton}
      />

      {/* Fanned covers */}
      <View style={styles.fannedCoverFan}>
        {numCovers > 0 ? (
          <View style={[
            styles.fannedFanContainer,
            { width: COVER_SIZE_FANNED + (numCovers - 1) * FAN_OFFSET }
          ]}>
            {bookCovers.map((coverUrl, idx) => {
              const middleIndex = (numCovers - 1) / 2;
              const rotation = (idx - middleIndex) * FAN_ROTATION;
              const distanceFromCenter = Math.abs(idx - middleIndex);
              const zIndex = numCovers - Math.floor(distanceFromCenter);
              const scaleValue = 1 - (distanceFromCenter * 0.12);
              const coverSize = COVER_SIZE_FANNED * scaleValue;
              const sizeOffset = (COVER_SIZE_FANNED - coverSize) / 2;
              const verticalOffset = sizeOffset + (distanceFromCenter * FAN_VERTICAL_OFFSET);
              const horizontalOffset = idx * FAN_OFFSET + sizeOffset;

              return (
                <Image
                  key={idx}
                  source={coverUrl}
                  style={[
                    styles.fannedCover,
                    {
                      width: coverSize,
                      height: coverSize,
                      left: horizontalOffset,
                      top: verticalOffset,
                      zIndex,
                      transform: [{ rotate: `${rotation}deg` }],
                    },
                  ]}
                  contentFit="cover"
                  transition={150}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Series name */}
      <Text style={[styles.fannedSeriesName, { color: themeColors.text }]} numberOfLines={2}>
        {series.name}
      </Text>
      <Text style={[styles.fannedBookCount, { color: themeColors.textSecondary }]}>
        {series.totalBooks} {series.totalBooks === 1 ? 'book' : 'books'}
      </Text>
    </TouchableOpacity>
  );
});

// =============================================================================
// BOOKS LIST (Continue Listening)
// =============================================================================

interface BooksListProps {
  books: LibraryItem[];
  onBookPress: (book: LibraryItem) => void;
  onBookLongPress?: (book: LibraryItem) => void;
  maxItems?: number;
}

interface ThemedColors {
  text: string;
  textSecondary: string;
  textTertiary: string;
  background: string;
}

const BookRow = ({
  book,
  onCoverPress,
  onDetailsPress,
  themeColors,
}: {
  book: LibraryItem;
  onCoverPress: () => void;
  onDetailsPress: () => void;
  themeColors: ThemedColors;
}) => {
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Unknown';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || '';

  // Get lastUpdate from various possible locations in the API response
  // AudiobookShelf returns timestamps in seconds (Unix timestamp)
  const bookAny = book as any;
  const rawLastUpdate =
    bookAny.progressLastUpdate ||
    bookAny.userMediaProgress?.lastUpdate ||
    bookAny.mediaProgress?.lastUpdate ||
    bookAny.recentEpisode?.progress?.lastUpdate;

  // Debug: log the book data to see what fields exist (only first book to reduce noise)
  if (__DEV__ && title === 'This Inevitable Ruin') {
    logger.debug('[BookRow] Book:', title);
    logger.debug('[BookRow] rawLastUpdate:', rawLastUpdate, 'type:', typeof rawLastUpdate);
    logger.debug('[BookRow] progressLastUpdate:', bookAny.progressLastUpdate);
    logger.debug('[BookRow] userMediaProgress:', JSON.stringify(bookAny.userMediaProgress, null, 2));
    logger.debug('[BookRow] Available top-level fields:', Object.keys(bookAny));
  }

  // Convert to milliseconds if needed
  // AudiobookShelf API typically returns timestamps in MILLISECONDS already
  // But Unix timestamps in SECONDS (~10 digits like 1735500000) need *1000
  let lastUpdateMs: number | undefined;
  if (rawLastUpdate && rawLastUpdate > 0) {
    // Threshold: timestamps before Jan 1, 2001 in ms (978307200000) are likely in seconds
    // Current timestamps in seconds are around 1.7 billion (10 digits)
    // Current timestamps in ms are around 1.7 trillion (13 digits)
    if (rawLastUpdate < 10000000000) {
      // Definitely seconds (less than year 2286 in seconds)
      lastUpdateMs = rawLastUpdate * 1000;
    } else {
      // Already in milliseconds
      lastUpdateMs = rawLastUpdate;
    }
  }

  const timeSince = formatTimeSince(lastUpdateMs);
  const coverUrl = getCoverUrl(book.id);

  return (
    <View style={styles.bookRow}>
      {/* Cover image - tap to play, long press for details */}
      <TouchableOpacity
        onPress={onCoverPress}
        onLongPress={onDetailsPress}
        delayLongPress={400}
        activeOpacity={0.7}
        accessibilityLabel={`Play ${title}`}
        accessibilityRole="button"
        accessibilityHint="Tap to play, hold for details"
      >
        <View style={styles.coverContainer}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.coverImage}
            contentFit="cover"
          />
          <View style={styles.coverOverlay} />
          <View style={styles.playIconContainer}>
            <PlayIcon size={wp(4)} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Content - tap for details */}
      <TouchableOpacity
        style={styles.bookContent}
        onPress={onDetailsPress}
        activeOpacity={0.7}
        accessibilityLabel={`${title} by ${author}. Tap for details.`}
        accessibilityRole="button"
      >
        {author ? <Text style={[styles.author, { color: themeColors.textSecondary }]}>{author}</Text> : null}
        <View style={styles.titleRow}>
          <Text style={[styles.bookTitle, { color: themeColors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {timeSince ? <Text style={[styles.timeSince, { color: themeColors.textTertiary }]}>{timeSince}</Text> : null}
        </View>
      </TouchableOpacity>
    </View>
  );
};

export function BooksList({ books, onBookPress, maxItems = 5 }: BooksListProps) {
  const themeColors = useThemeColors();
  if (books.length === 0) return null;

  const displayBooks = books.slice(0, maxItems);

  return (
    <View style={styles.section}>
      <SectionBadge title="Books" textColor={themeColors.background} bgColor={themeColors.text} />
      <View style={styles.list}>
        {displayBooks.map((book) => (
          <BookRow
            key={book.id}
            book={book}
            onCoverPress={() => onBookPress(book)}
            onDetailsPress={() => onBookPress(book)}
            themeColors={themeColors}
          />
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// TABBED HOME CONTENT (Last Played / Downloaded / Favorites)
// One set of tabs controls both books and series below
// =============================================================================

type HomeTab = 'inProgress' | 'downloaded' | 'finished' | 'favorites';

const HOME_TAB_ORDER: HomeTab[] = ['inProgress', 'downloaded', 'finished', 'favorites'];
const HOME_TAB_LABELS: Record<HomeTab, string> = {
  inProgress: 'In Progress',
  downloaded: 'Downloaded',
  finished: 'Finished',
  favorites: 'Favorites',
};

interface TabbedHomeContentProps {
  /** Books in progress (recently listened) */
  lastPlayedBooks: LibraryItem[];
  /** Downloaded books */
  downloadedBooks: LibraryItem[];
  /** Favorite books */
  favoriteBooks?: LibraryItem[];
  /** Finished books */
  finishedBooks?: LibraryItem[];
  /** Series sorted by last listened */
  lastPlayedSeries: SeriesWithBooks[];
  /** Series with downloaded books */
  downloadedSeries: SeriesWithBooks[];
  /** Set of downloaded book IDs for counting downloads per series */
  downloadedBookIds: Set<string>;
  /** Cover tap: loads book paused */
  onCoverPress: (book: LibraryItem) => void;
  /** Title tap or cover long press: opens book details */
  onDetailsPress: (book: LibraryItem) => void;
  onSeriesPress: (series: SeriesWithBooks) => void;
  /** Search query */
  searchQuery?: string;
  /** Search change handler */
  onSearchChange?: (query: string) => void;
  maxBooks?: number;
  maxSeries?: number;
}

/**
 * Series row for Downloaded tab - shows download count
 */
const DownloadedSeriesRow = ({
  series,
  downloadedBookIds,
  onPress,
  themeColors,
}: {
  series: SeriesWithBooks;
  downloadedBookIds: Set<string>;
  onPress: () => void;
  themeColors: ThemedColors;
}) => {
  const author = getSeriesAuthor(series);
  const downloadedCount = series.books.filter(b => downloadedBookIds.has(b.id)).length;
  const progressText = `${downloadedCount}/${series.totalBooks}`;

  return (
    <TouchableOpacity
      style={styles.seriesRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${series.name} by ${author}, ${downloadedCount} of ${series.totalBooks} downloaded`}
      accessibilityRole="button"
    >
      <View style={styles.progressCount}>
        <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>{progressText}</Text>
      </View>
      <View style={styles.seriesContent}>
        {author ? <Text style={[styles.author, { color: themeColors.textSecondary }]}>{author}</Text> : null}
        <Text style={[styles.seriesTitle, { color: themeColors.text }]} numberOfLines={1}>
          {series.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Series row - shows completion progress
 */
const SeriesRowWithProgress = ({
  series,
  onPress,
  themeColors,
}: {
  series: SeriesWithBooks;
  onPress: () => void;
  themeColors: ThemedColors;
}) => {
  const author = getSeriesAuthor(series);
  const progressText = `${series.booksCompleted}/${series.totalBooks}`;

  return (
    <TouchableOpacity
      style={styles.seriesRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${series.name} by ${author}, ${series.booksCompleted} of ${series.totalBooks} complete`}
      accessibilityRole="button"
    >
      <View style={styles.progressCount}>
        <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>{progressText}</Text>
      </View>
      <View style={styles.seriesContent}>
        {author ? <Text style={[styles.author, { color: themeColors.textSecondary }]}>{author}</Text> : null}
        <Text style={[styles.seriesTitle, { color: themeColors.text }]} numberOfLines={1}>
          {series.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Gap between header labels
const HEADER_GAP = wp(12);

export function TabbedHomeContent({
  lastPlayedBooks,
  downloadedBooks,
  favoriteBooks = [],
  finishedBooks = [],
  lastPlayedSeries,
  downloadedSeries,
  downloadedBookIds,
  onCoverPress,
  onDetailsPress,
  onSeriesPress,
  searchQuery = '',
  onSearchChange,
  maxBooks = 5,
  maxSeries = 3,
}: TabbedHomeContentProps) {
  const [activeTab, setActiveTab] = useState<HomeTab>('inProgress');
  const [contentKey, setContentKey] = useState(0);
  const [, setTimeRefresh] = useState(0); // Force re-render for time updates
  const themeColors = useThemeColors();
  const isDarkMode = useIsDarkMode();

  // Live update the "time ago" display every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRefresh(t => t + 1);
    }, 30000); // Update every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // Switch tab - instant header change, content fades in
  const switchTab = useCallback((tab: HomeTab) => {
    setActiveTab(tab);
    setContentKey(k => k + 1);
  }, []);

  // Get data for current tab
  const getTabBooks = () => {
    switch (activeTab) {
      case 'inProgress': return lastPlayedBooks;
      case 'downloaded': return downloadedBooks;
      case 'finished': return finishedBooks;
      case 'favorites': return favoriteBooks;
      default: return lastPlayedBooks;
    }
  };

  // Filter books by search query
  const filterBySearch = (items: LibraryItem[]) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(book => {
      const metadata = book.media?.metadata as any;
      const title = metadata?.title?.toLowerCase() || '';
      const author = metadata?.authorName?.toLowerCase() || metadata?.authors?.[0]?.name?.toLowerCase() || '';
      return title.includes(query) || author.includes(query);
    });
  };

  const books = filterBySearch(getTabBooks());
  const series = activeTab === 'inProgress' ? lastPlayedSeries : downloadedSeries;
  const displayBooks = books.slice(0, maxBooks);
  const displaySeries = series.slice(0, maxSeries);

  // Check if completely empty
  const hasAnyContent =
    lastPlayedBooks.length > 0 || downloadedBooks.length > 0 ||
    lastPlayedSeries.length > 0 || downloadedSeries.length > 0;

  if (!hasAnyContent) return null;

  return (
    <View style={styles.section}>
      {/* Tab bar - scrollable like Library page */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        style={styles.tabBarContainer}
      >
        {HOME_TAB_ORDER.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => switchTab(tab)}
            activeOpacity={0.7}
            style={styles.tabItem}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab ? themeColors.text : themeColors.textTertiary },
              ]}
            >
              {HOME_TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search bar - minimal line style */}
      {onSearchChange && (
        <View style={[styles.searchContainer, { borderBottomColor: themeColors.border }]}>
          <Search size={wp(3.5)} color={themeColors.textTertiary} strokeWidth={1.5} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search..."
            placeholderTextColor={themeColors.textTertiary}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={wp(3.5)} color={themeColors.textTertiary} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content - fades in on tab change */}
      <View style={styles.contentArea}>
        {/* Books list */}
        {displayBooks.length > 0 ? (
          <View style={styles.list}>
            {displayBooks.map((book, index) => (
              <FadeInRow key={`${contentKey}-${book.id}`} delay={index * 30}>
                <BookRow
                  book={book}
                  onCoverPress={() => onCoverPress(book)}
                  onDetailsPress={() => onDetailsPress(book)}
                  themeColors={themeColors}
                />
              </FadeInRow>
            ))}
          </View>
        ) : (
          <FadeInRow key={`${contentKey}-empty-books`} delay={0}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
              No {HOME_TAB_LABELS[activeTab].toLowerCase()} books
            </Text>
          </FadeInRow>
        )}

        {/* Series section header */}
        <FadeInRow key={`${contentKey}-series-header`} delay={displayBooks.length * 30 + 30}>
          <Text style={[styles.seriesSectionTitle, { color: themeColors.text }]}>
            Series
          </Text>
        </FadeInRow>

        {/* Series grid - 2-column fanned cards */}
        {displaySeries.length > 0 ? (
          <FadeInRow key={`${contentKey}-series-grid`} delay={displayBooks.length * 30 + 60}>
            <View style={styles.fannedSeriesGrid}>
              {displaySeries.map((item) => (
                <FannedSeriesCard
                  key={item.id}
                  series={item}
                  onPress={() => onSeriesPress(item)}
                  themeColors={themeColors}
                  isDarkMode={isDarkMode}
                />
              ))}
            </View>
          </FadeInRow>
        ) : (
          <FadeInRow key={`${contentKey}-empty-series`} delay={displayBooks.length * 30 + 60}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
              No {HOME_TAB_LABELS[activeTab].toLowerCase()} series
            </Text>
          </FadeInRow>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// SERIES LIST
// =============================================================================

interface SeriesListProps {
  series: SeriesWithBooks[];
  onSeriesPress: (series: SeriesWithBooks) => void;
  maxItems?: number;
}

/**
 * Get author name from series (from first book)
 */
function getSeriesAuthor(series: SeriesWithBooks): string {
  if (series.books.length === 0) return '';
  const metadata = series.books[0].media?.metadata as any;
  if (!metadata) return '';
  if (metadata.authorName) return metadata.authorName;
  if (metadata.authors?.length > 0) {
    return metadata.authors.map((a: any) => a.name).join(', ');
  }
  return '';
}

const SeriesRow = ({
  series,
  onPress,
  themeColors,
}: {
  series: SeriesWithBooks;
  onPress: () => void;
  themeColors: ThemedColors;
}) => {
  const author = getSeriesAuthor(series);
  const progressText = `${series.booksCompleted}/${series.totalBooks}`;

  return (
    <TouchableOpacity
      style={styles.seriesRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${series.name} by ${author}, ${series.booksCompleted} of ${series.totalBooks} complete`}
      accessibilityRole="button"
    >
      {/* Progress count */}
      <View style={styles.progressCount}>
        <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>{progressText}</Text>
      </View>

      {/* Content */}
      <View style={styles.seriesContent}>
        {author ? <Text style={[styles.author, { color: themeColors.textSecondary }]}>{author}</Text> : null}
        <Text style={[styles.seriesTitle, { color: themeColors.text }]} numberOfLines={1}>
          {series.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export function SeriesList({ series, onSeriesPress, maxItems = 5 }: SeriesListProps) {
  const themeColors = useThemeColors();
  if (series.length === 0) return null;

  const displaySeries = series.slice(0, maxItems);

  return (
    <View style={styles.section}>
      <SectionBadge title="Series" textColor={themeColors.background} bgColor={themeColors.text} />
      <View style={styles.list}>
        {displaySeries.map((item) => (
          <SeriesRow
            key={item.id}
            series={item}
            onPress={() => onSeriesPress(item)}
            themeColors={themeColors}
          />
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  section: {
    marginTop: hp(3),
    paddingHorizontal: MARGIN_H,
  },

  // Header tab row - large text tabs side by side
  headerTabRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: hp(3),
  },
  headerTab: {
    fontSize: 36,
    fontWeight: '400',
    // color set via themeColors in JSX
  },
  headerTabActive: {
    // color set via themeColors.text in JSX
  },
  headerTabInactive: {
    // color set via themeColors.textTertiary in JSX
  },
  peekingTab: {
    marginRight: wp(-18), // Push off screen to be half cut off
  },
  seriesSectionHeader: {
    marginTop: hp(4),
    marginBottom: hp(2),
  },

  // Empty state
  emptyText: {
    fontSize: moderateScale(14),
    // color set via themeColors.textTertiary in JSX
    marginTop: hp(2),
  },

  // Badge header
  badge: {
    alignSelf: 'flex-start',
    // backgroundColor set via themeColors.text in JSX
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: wp(2),
    marginBottom: hp(2),
  },
  badgeText: {
    // color set via themeColors.background in JSX
    fontSize: moderateScale(14),
    fontWeight: '600',
  },

  // List container
  list: {
    gap: ROW_GAP,
  },

  // Book row
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Cover image with play overlay
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: wp(1.5),
    overflow: 'hidden',
    marginRight: wp(3),
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  playIconContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  bookTitle: {
    flex: 1,
    // color set via themeColors.text in JSX
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  timeSince: {
    // color set via themeColors.textTertiary in JSX
    fontSize: moderateScale(14),
    marginLeft: wp(3),
    flexShrink: 0,
  },

  // Series row
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCount: {
    width: wp(10),
    marginRight: wp(2),
  },
  progressText: {
    // color set via themeColors.textSecondary in JSX
    fontSize: moderateScale(10),
    fontWeight: '500',
  },
  seriesContent: {
    flex: 1,
  },
  seriesTitle: {
    // color set via themeColors.text in JSX
    fontSize: moderateScale(16),
    fontWeight: '500',
    letterSpacing: -0.3,
  },

  // Shared
  author: {
    // color set via themeColors.textSecondary in JSX
    fontSize: moderateScale(11),
    marginBottom: hp(0.2),
  },

  // Tab bar - scrollable like Library page
  tabBarContainer: {
    marginHorizontal: -MARGIN_H,
    marginBottom: hp(2.5),
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: wp(6),
    paddingHorizontal: MARGIN_H,
  },
  tabItem: {
    minHeight: 44,
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: moderateScale(26),
    fontWeight: '400',
  },

  // Search bar - minimal line style
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: hp(0.8),
    marginBottom: hp(2),
    gap: wp(2),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(13),
    paddingVertical: 0,
    height: hp(3),
  },

  // Content area
  contentArea: {
    minHeight: hp(30),
  },

  // Series section title (inside tabs)
  seriesSectionTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginTop: hp(3),
    marginBottom: hp(1.5),
  },

  // Fanned series card styles (2-column grid)
  fannedSeriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -MARGIN_H,
    paddingHorizontal: PADDING,
    gap: GAP,
  },
  fannedSeriesCard: {
    width: SERIES_CARD_WIDTH,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  fannedHeartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  fannedCoverFan: {
    height: COVER_SIZE_FANNED + 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fannedFanContainer: {
    position: 'relative',
    height: COVER_SIZE_FANNED,
  },
  fannedCover: {
    position: 'absolute',
    width: COVER_SIZE_FANNED,
    height: COVER_SIZE_FANNED,
    borderRadius: 5,
    backgroundColor: 'rgba(128,128,128,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  fannedSeriesName: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    lineHeight: moderateScale(17),
    textAlign: 'center',
  },
  fannedBookCount: {
    fontSize: moderateScale(11),
    textAlign: 'center',
    marginTop: 2,
  },
});
