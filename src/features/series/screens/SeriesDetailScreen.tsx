/**
 * src/features/series/screens/SeriesDetailScreen.tsx
 *
 * Series detail screen with stacked book covers and blurred background.
 * Dark theme matching app aesthetic.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { SeriesHeartButton } from '@/shared/components';
import { BookCard } from '@/shared/components/BookCard';
import { LibraryItem } from '@/core/types';

type SeriesDetailRouteParams = {
  SeriesDetail: { seriesName: string };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BG_COLOR = '#000000';
const CARD_COLOR = '#2a2a2a';
const ACCENT = '#CCFF00';
const CARD_RADIUS = 5;

// Stacked covers constants
const STACK_COVER_SIZE = SCREEN_WIDTH * 0.35;
const STACK_OFFSET = 12;
const STACK_ROTATION = 6;

type SortType = 'asc' | 'desc';

// Get sequence from book metadata
function getSequence(item: LibraryItem): number {
  const metadata = (item.media?.metadata as any) || {};
  const seriesName = metadata.seriesName || '';
  const match = seriesName.match(/#([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  // Try to get sequence from title
  const titleMatch = (metadata.title || '').match(/Book\s*(\d+)/i);
  if (titleMatch) {
    return parseInt(titleMatch[1], 10);
  }
  return 999;
}

// Stacked book covers component
function StackedCovers({ bookIds }: { bookIds: string[] }) {
  // Take up to 3 books for the stack
  const stackBooks = bookIds.slice(0, Math.min(3, bookIds.length));
  const count = stackBooks.length;

  if (count === 0) {
    return (
      <View style={stackStyles.container}>
        <View style={[stackStyles.cover, stackStyles.placeholder]}>
          <Text style={stackStyles.placeholderText}>📚</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={stackStyles.container}>
      {stackBooks.map((bookId, index) => {
        // Reverse order so first book is on top
        const reverseIndex = count - 1 - index;
        const rotation = (reverseIndex - Math.floor(count / 2)) * STACK_ROTATION;
        const translateX = (reverseIndex - Math.floor(count / 2)) * STACK_OFFSET;
        const zIndex = count - reverseIndex;

        return (
          <View
            key={bookId}
            style={[
              stackStyles.coverWrapper,
              {
                zIndex,
                transform: [
                  { translateX },
                  { rotate: `${rotation}deg` },
                ],
              },
            ]}
          >
            <Image
              source={apiClient.getItemCoverUrl(bookId)}
              style={stackStyles.cover}
              contentFit="cover"
              transition={150}
            />
          </View>
        );
      })}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  container: {
    width: STACK_COVER_SIZE + STACK_OFFSET * 4,
    height: STACK_COVER_SIZE * 1.1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  coverWrapper: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cover: {
    width: STACK_COVER_SIZE,
    height: STACK_COVER_SIZE,
    borderRadius: CARD_RADIUS,
    backgroundColor: CARD_COLOR,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
  },
});

// Background component using first book cover
function SeriesBackground({ coverUrl }: { coverUrl: string | null }) {
  if (!coverUrl) {
    return (
      <View style={bgStyles.container}>
        <View style={bgStyles.baseColor} />
      </View>
    );
  }

  return (
    <View style={bgStyles.container}>
      <View style={bgStyles.baseColor} />
      <View style={bgStyles.imageContainer}>
        <Image
          source={coverUrl}
          style={bgStyles.image}
          contentFit="cover"
          blurRadius={25}
        />
        <BlurView intensity={40} style={bgStyles.blur} tint="dark" />
        <View style={bgStyles.brightnessOverlay} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', BG_COLOR]}
          locations={[0, 0.5, 1]}
          style={bgStyles.fadeGradient}
        />
      </View>
    </View>
  );
}

const bgStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  baseColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_COLOR,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
    transform: [{ scale: 1.2 }],
    opacity: 0.7,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  fadeGradient: {
    ...StyleSheet.absoluteFillObject,
  },
});

export function SeriesDetailScreen() {
  const route = useRoute<RouteProp<SeriesDetailRouteParams, 'SeriesDetail'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { seriesName } = route.params;
  const [sortOrder, setSortOrder] = useState<SortType>('asc');

  const { getSeries, isLoaded, refreshCache } = useLibraryCache();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get series data from cache - instant!
  const seriesInfo = useMemo(() => {
    if (!isLoaded || !seriesName) return null;
    return getSeries(seriesName);
  }, [isLoaded, seriesName, getSeries]);

  const sortedBooks = useMemo(() => {
    if (!seriesInfo?.books) return [];
    const sorted = [...seriesInfo.books];
    sorted.sort((a, b) => {
      const seqA = getSequence(a);
      const seqB = getSequence(b);
      return sortOrder === 'asc' ? seqA - seqB : seqB - seqA;
    });
    return sorted;
  }, [seriesInfo?.books, sortOrder]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main' as never);
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

  const handleBookPress = useCallback((bookId: string) => {
    (navigation as any).navigate('BookDetail', { id: bookId });
  }, [navigation]);

  // Loading/error states
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

  if (!seriesInfo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Series</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="book-outline" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
          <Text style={styles.emptyTitle}>Series not found</Text>
          <Text style={styles.emptySubtitle}>This series may have been removed</Text>
        </View>
      </View>
    );
  }

  // Get book IDs for stacked covers and background
  const bookIds = sortedBooks.map(b => b.id);
  const firstBookCoverUrl = bookIds[0] ? apiClient.getItemCoverUrl(bookIds[0]) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Blurred background from first book */}
      <SeriesBackground coverUrl={firstBookCoverUrl} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Series</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
            progressViewOffset={20}
          />
        }
      >
        {/* Series Info with Stacked Covers */}
        <View style={styles.seriesHeader}>
          <StackedCovers bookIds={bookIds} />
          <View style={styles.seriesNameRow}>
            <Text style={styles.seriesName}>{seriesInfo.name}</Text>
            <SeriesHeartButton seriesName={seriesInfo.name} size={24} />
          </View>
          <Text style={styles.bookCount}>
            {seriesInfo.bookCount} {seriesInfo.bookCount === 1 ? 'book' : 'books'}
          </Text>
        </View>

        {/* Sort Toggle */}
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>Books in Series</Text>
          <TouchableOpacity
            style={styles.sortButtonActive}
            onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            <Icon
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color="#000"
              set="ionicons"
            />
            <Text style={styles.sortButtonTextActive}>
              {sortOrder === 'asc' ? `1→${sortedBooks.length}` : `${sortedBooks.length}→1`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Book List */}
        <View style={styles.bookList}>
          {sortedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onPress={() => handleBookPress(book.id)}
              showListeningProgress={true}
            />
          ))}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  seriesHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  seriesNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  seriesName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bookCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sortButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  sortButtonTextActive: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
  },
  bookList: {
    // BookListItem has its own padding
  },
});
