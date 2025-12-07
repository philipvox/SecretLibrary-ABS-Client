/**
 * src/features/discover/components/ContentRowCarousel.tsx
 *
 * Horizontal carousel using app design system constants.
 * Uses useCoverUrl for cached cover URLs.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ListRenderItem,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { COLORS, DIMENSIONS, LAYOUT } from '@/features/home/homeDesign';
import { BookSummary, ContentRow } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

// Card dimensions - smaller square covers with more spacing
const CARD_WIDTH = scale(100); // Smaller than default 125
const CARD_HEIGHT = CARD_WIDTH; // Square
const GAP = scale(14); // More spacing between cards
const PADDING = LAYOUT.carouselPaddingHorizontal;

// Format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

interface BookCardProps {
  book: BookSummary;
  onPress: () => void;
}

const DiscoverBookCard = React.memo(function DiscoverBookCard({ book, onPress }: BookCardProps) {
  // Use cached cover URL from library cache
  const coverUrl = useCoverUrl(book.id);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.coverContainer}>
        <Image
          source={coverUrl || book.coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        {/* Downloaded badge */}
        {book.isDownloaded && (
          <View style={styles.downloadedBadge}>
            <Icon name="checkmark-circle" size={14} color={COLORS.playButton} set="ionicons" />
          </View>
        )}
        {/* Progress bar */}
        {book.progress !== undefined && book.progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${book.progress * 100}%` }]} />
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{formatDuration(book.duration)}</Text>
    </TouchableOpacity>
  );
});

interface ContentRowCarouselProps {
  row: ContentRow;
  onSeeAll?: () => void;
}

export function ContentRowCarousel({ row, onSeeAll }: ContentRowCarouselProps) {
  const navigation = useNavigation<any>();

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  const handleSeeAll = useCallback(() => {
    if (onSeeAll) {
      onSeeAll();
    } else if (row.seeAllRoute) {
      navigation.navigate(row.seeAllRoute);
    }
  }, [navigation, onSeeAll, row.seeAllRoute]);

  const renderItem: ListRenderItem<BookSummary> = useCallback(
    ({ item }) => (
      <DiscoverBookCard book={item} onPress={() => handleBookPress(item.id)} />
    ),
    [handleBookPress]
  );

  const keyExtractor = useCallback((item: BookSummary) => item.id, []);

  if (row.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Row Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.rowTitle}>{row.title}</Text>
          {row.subtitle && (
            <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
          )}
        </View>
        {row.totalCount > row.items.length && (
          <TouchableOpacity onPress={handleSeeAll} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carousel */}
      <FlatList
        horizontal
        data={row.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        snapToInterval={CARD_WIDTH + GAP}
        decelerationRate="fast"
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + GAP,
          offset: (CARD_WIDTH + GAP) * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: DIMENSIONS.sectionGap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    marginBottom: LAYOUT.sectionHeaderMarginBottom,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: scale(12),
  },
  rowTitle: {
    fontSize: scale(13),
    fontFamily: MONO_FONT,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  rowSubtitle: {
    fontSize: scale(10),
    fontFamily: MONO_FONT,
    color: COLORS.textTertiary,
    marginTop: scale(2),
  },
  seeAllButton: {
    paddingVertical: scale(4),
    paddingHorizontal: scale(8),
  },
  seeAllText: {
    fontSize: scale(11),
    fontFamily: MONO_FONT,
    color: COLORS.textTertiary,
  },
  carouselContent: {
    paddingHorizontal: PADDING,
  },
  card: {
    width: CARD_WIDTH,
    marginRight: GAP,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: DIMENSIONS.coverRadius,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  downloadedBadge: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: scale(10),
    padding: scale(3),
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(3),
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.playButton,
  },
  title: {
    fontSize: scale(12),
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginTop: scale(6),
  },
  subtitle: {
    fontSize: scale(11),
    fontFamily: MONO_FONT,
    color: COLORS.textTertiary,
    marginTop: scale(2),
  },
});
