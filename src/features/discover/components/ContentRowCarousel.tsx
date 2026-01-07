/**
 * src/features/discover/components/ContentRowCarousel.tsx
 *
 * Flexible content row with multiple display modes:
 * - featured: 2x2 large grid (high importance)
 * - carousel: Horizontal scroll with medium cards
 * - compact: Horizontal scroll with smaller cards
 * - grid: Standard 2x2 grid (default)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { scale, spacing, radius, layout, wp } from '@/shared/theme';
import { useThemeColors, useColors } from '@/shared/theme/themeStore';
import { CompleteBadgeOverlay } from '@/features/completion';
import { BookSummary, ContentRow, RowDisplayMode } from '../types';
import { haptics } from '@/core/native/haptics';

// Format time ago (e.g., "30 sec ago", "5 min ago", "2 hours ago")
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

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
  if (seconds > 10) return `${seconds} sec ago`;
  return 'just now';
}

// Grid layout - 2 columns with square covers
const GRID_GAP = 12;
const HORIZONTAL_PADDING = layout.screenPaddingH;
const CARD_WIDTH = Math.floor((wp(100) - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2);
const COVER_HEIGHT = CARD_WIDTH; // Square covers

// Carousel layout - horizontal scrolling cards
const CAROUSEL_CARD_WIDTH = scale(140);
const CAROUSEL_COVER_HEIGHT = scale(140);

// Compact layout - smaller horizontal cards
const COMPACT_CARD_WIDTH = scale(100);
const COMPACT_COVER_HEIGHT = scale(100);

interface BookCardProps {
  book: BookSummary;
  onPress: () => void;
  textColor: string;
  textSecondaryColor: string;
  bgColor: string;
  accentColor: string;
}

// Serendipity badge colors
const SERENDIPITY_BG = 'rgba(147, 51, 234, 0.9)'; // Purple
const SERENDIPITY_TEXT = '#FFFFFF';

// Grid card for 2x2 layout (featured/default)
const GridBookCard = React.memo(function GridBookCard({ book, onPress, textColor, textSecondaryColor, bgColor }: BookCardProps) {
  const coverUrl = useCoverUrl(book.id);
  const author = book.author || 'Unknown';
  const narrator = book.narrator || '';
  const timeAgo = book.lastPlayedAt ? formatTimeAgo(book.lastPlayedAt) : '';
  const progress = book.progress || 0;
  const hasProgress = progress > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Cover container */}
      <View style={[styles.coverContainer, { backgroundColor: bgColor }]}>
        <Image
          source={coverUrl || book.coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        <CompleteBadgeOverlay bookId={book.id} size="small" />
        {book.isSerendipity && (
          <View style={styles.serendipityBadge}>
            <Text style={styles.serendipityIcon}>✨</Text>
          </View>
        )}
        {/* Last played badge on cover */}
        {timeAgo ? (
          <View style={styles.timeAgoBadge}>
            <Text style={styles.timeAgoBadgeText}>{timeAgo}</Text>
          </View>
        ) : null}

        {/* Progress bar across bottom */}
        {hasProgress && (
          <View style={styles.progressBottomTrack}>
            <LinearGradient
              colors={['#FFFFFF', 'rgba(255,255,255,0.7)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBottomBar, { width: `${progress * 100}%` }]}
            />
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
        {book.title}
      </Text>

      <Text style={[styles.credits, { color: textSecondaryColor }]} numberOfLines={1}>
        {author}{narrator ? ` | ${narrator}` : ''}
      </Text>
    </TouchableOpacity>
  );
});

// Carousel card for horizontal scroll layout
const CarouselBookCard = React.memo(function CarouselBookCard({ book, onPress, textColor, textSecondaryColor, bgColor, accentColor }: BookCardProps) {
  const coverUrl = useCoverUrl(book.id);

  return (
    <TouchableOpacity style={styles.carouselCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.carouselCoverContainer, { backgroundColor: bgColor }]}>
        <Image
          source={coverUrl || book.coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        <CompleteBadgeOverlay bookId={book.id} size="small" />
        {book.progress !== undefined && book.progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${book.progress * 100}%`, backgroundColor: accentColor }]} />
          </View>
        )}
        {book.isSerendipity && (
          <View style={styles.serendipityBadge}>
            <Text style={styles.serendipityIcon}>✨</Text>
          </View>
        )}
      </View>
      <Text style={[styles.carouselTitle, { color: textColor }]} numberOfLines={2}>
        {book.title}
      </Text>
      <Text style={[styles.carouselAuthor, { color: textSecondaryColor }]} numberOfLines={1}>
        {book.author}
      </Text>
    </TouchableOpacity>
  );
});

// Compact card for smaller horizontal scroll
const CompactBookCard = React.memo(function CompactBookCard({ book, onPress, textColor, textSecondaryColor, bgColor, accentColor }: BookCardProps) {
  const coverUrl = useCoverUrl(book.id);

  return (
    <TouchableOpacity style={styles.compactCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.compactCoverContainer, { backgroundColor: bgColor }]}>
        <Image
          source={coverUrl || book.coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        <CompleteBadgeOverlay bookId={book.id} size="small" />
        {book.progress !== undefined && book.progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${book.progress * 100}%`, backgroundColor: accentColor }]} />
          </View>
        )}
      </View>
      <Text style={[styles.compactTitle, { color: textColor }]} numberOfLines={2}>
        {book.title}
      </Text>
    </TouchableOpacity>
  );
});

interface ContentRowCarouselProps {
  row: ContentRow;
  onSeeAll?: () => void;
}

export function ContentRowCarousel({ row, onSeeAll }: ContentRowCarouselProps) {
  const navigation = useNavigation<any>();
  const themeColors = useThemeColors();
  const colors = useColors();
  const accent = colors.accent.primary;

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSeeAll = useCallback(() => {
    if (onSeeAll) {
      onSeeAll();
    } else if (row.filterType) {
      // Navigate to FilteredBooksScreen with filter params
      navigation.navigate('FilteredBooks', {
        title: row.title,
        filterType: row.filterType,
        genre: row.filterParams?.genre,
        minMatchPercent: row.filterParams?.minMatchPercent,
      });
    } else if (row.seeAllRoute) {
      navigation.navigate(row.seeAllRoute);
    }
  }, [navigation, onSeeAll, row.seeAllRoute, row.filterType, row.filterParams, row.title]);

  // Handle tapping the source attribution link (e.g., the book name in "Because you finished X")
  const handleSourcePress = useCallback(() => {
    if (row.sourceAttribution?.itemId) {
      navigation.navigate('BookDetail', { id: row.sourceAttribution.itemId });
    }
  }, [navigation, row.sourceAttribution]);

  if (row.items.length === 0) {
    return null;
  }

  // Take first 4 items for 2x2 grid
  const gridItems = row.items.slice(0, 4);

  // Parse title to make source item tappable
  // e.g., "Because you finished The Blade Itself" -> prefix + tappable item title
  const renderTitle = () => {
    const { sourceAttribution } = row;

    // If no source attribution or no item ID to link to, show plain title
    if (!sourceAttribution || !sourceAttribution.itemId) {
      return (
        <Text style={[styles.rowTitle, { color: themeColors.text }]}>
          {row.title || 'Top Picks'}
        </Text>
      );
    }

    // Parse the title to extract prefix and linkable text
    const { itemTitle, type } = sourceAttribution;
    let prefix = '';
    let linkText = itemTitle;

    switch (type) {
      case 'finished':
        prefix = 'Because you finished ';
        break;
      case 'listening':
        prefix = 'More like ';
        break;
      default:
        // For author/narrator/genre, just show plain title
        return (
          <Text style={[styles.rowTitle, { color: themeColors.text }]}>
            {row.title || 'Top Picks'}
          </Text>
        );
    }

    return (
      <Text style={[styles.rowTitle, { color: themeColors.text }]}>
        {prefix}
        <Text
          style={[styles.sourceLink, { color: themeColors.accent }]}
          onPress={handleSourcePress}
        >
          {linkText}
        </Text>
      </Text>
    );
  };

  // Determine display mode - use explicit mode or derive from type
  const displayMode: RowDisplayMode = row.displayMode || 'grid';

  // Get items based on display mode
  const displayItems = displayMode === 'grid' || displayMode === 'featured'
    ? row.items.slice(0, 4)  // 2x2 grid = 4 items
    : row.items.slice(0, 10); // Carousel/compact = more items

  // Render content based on display mode
  const renderContent = () => {
    switch (displayMode) {
      case 'carousel':
        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {displayItems.map((book) => (
              <CarouselBookCard
                key={book.id}
                book={book}
                onPress={() => handleBookPress(book.id)}
                textColor={themeColors.text}
                textSecondaryColor={themeColors.textSecondary}
                bgColor={themeColors.backgroundSecondary}
                accentColor={accent}
              />
            ))}
          </ScrollView>
        );

      case 'compact':
        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compactContent}
          >
            {displayItems.map((book) => (
              <CompactBookCard
                key={book.id}
                book={book}
                onPress={() => handleBookPress(book.id)}
                textColor={themeColors.text}
                textSecondaryColor={themeColors.textSecondary}
                bgColor={themeColors.backgroundSecondary}
                accentColor={accent}
              />
            ))}
          </ScrollView>
        );

      case 'featured':
      case 'grid':
      default:
        return (
          <View style={styles.grid}>
            {displayItems.map((book) => (
              <GridBookCard
                key={book.id}
                book={book}
                onPress={() => handleBookPress(book.id)}
                textColor={themeColors.text}
                textSecondaryColor={themeColors.textSecondary}
                bgColor={themeColors.backgroundSecondary}
                accentColor={accent}
              />
            ))}
          </View>
        );
    }
  };

  // Determine "View More" threshold based on display mode
  const viewMoreThreshold = displayMode === 'grid' || displayMode === 'featured' ? 4 : 10;

  return (
    <View style={styles.container}>
      {/* Header with optional subtitle */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {renderTitle()}
          {row.subtitle && (
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              {row.subtitle}
            </Text>
          )}
        </View>
        {row.totalCount > viewMoreThreshold && (
          <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllButton}>
            <Text style={[styles.seeAllText, { color: themeColors.textSecondary }]}>View More</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content based on display mode */}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.md,
  },
  rowTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sourceLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  seeAllButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  seeAllText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    marginBottom: spacing.md,
  },
  coverContainer: {
    width: '100%',
    height: COVER_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  // Progress bar across bottom of cover
  progressBottomTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(3),
  },
  progressBottomBar: {
    height: '100%',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(3),
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressBar: {
    height: '100%',
    // backgroundColor set dynamically via accentColor prop
  },
  serendipityBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: SERENDIPITY_BG,
    borderRadius: radius.sm,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  serendipityIcon: {
    fontSize: scale(12),
    color: SERENDIPITY_TEXT,
  },
  timeAgoBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: radius.sm,
    paddingHorizontal: scale(6),
    paddingVertical: scale(3),
  },
  timeAgoBadgeText: {
    fontSize: scale(10),
    fontWeight: '500',
    color: '#FFFFFF',
  },
  title: {
    fontSize: scale(14),
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  credits: {
    fontSize: scale(12),
    marginTop: scale(2),
  },

  // Title container for header with subtitle
  titleContainer: {
    flex: 1,
  },
  subtitle: {
    fontSize: scale(12),
    marginTop: scale(2),
  },

  // Carousel layout styles
  carouselContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: spacing.md,
  },
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
  },
  carouselCoverContainer: {
    width: CAROUSEL_CARD_WIDTH,
    height: CAROUSEL_COVER_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  carouselTitle: {
    fontSize: scale(13),
    fontWeight: '600',
    marginTop: spacing.sm,
    lineHeight: scale(17),
  },
  carouselAuthor: {
    fontSize: scale(11),
    marginTop: scale(2),
  },

  // Compact layout styles
  compactContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: spacing.sm,
  },
  compactCard: {
    width: COMPACT_CARD_WIDTH,
  },
  compactCoverContainer: {
    width: COMPACT_CARD_WIDTH,
    height: COMPACT_COVER_HEIGHT,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  compactTitle: {
    fontSize: scale(11),
    fontWeight: '500',
    marginTop: spacing.xs,
    lineHeight: scale(14),
  },
});
