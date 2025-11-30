/**
 * src/features/series/screens/SeriesDetailScreen.tsx
 *
 * Series detail screen using library cache for instant loading.
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
} from 'react-native';
import { Image } from 'expo-image';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { LibraryItem } from '@/core/types';

type SeriesDetailRouteParams = {
  SeriesDetail: { seriesName: string };
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BG_COLOR = '#1a1a1a';
const CARD_COLOR = '#2a2a2a';
const ACCENT = '#CCFF00';
const CARD_RADIUS = 5;

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

export function SeriesDetailScreen() {
  const route = useRoute<RouteProp<SeriesDetailRouteParams, 'SeriesDetail'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { seriesName } = route.params;
  const [sortOrder, setSortOrder] = useState<SortType>('asc');

  const { getSeries, isLoaded } = useLibraryCache();
  const { loadBook } = usePlayerStore();

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

  const handleBookPress = useCallback(async (book: LibraryItem) => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: false });
    } catch {
      await loadBook(book, { autoPlay: false });
    }
  }, [loadBook]);

  const getMetadata = (item: LibraryItem) => (item.media?.metadata as any) || {};

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

  // Get cover from first book
  const firstBookId = sortedBooks[0]?.id;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

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
      >
        {/* Series Info */}
        <View style={styles.seriesHeader}>
          {firstBookId && (
            <Image
              source={apiClient.getItemCoverUrl(firstBookId)}
              style={styles.coverImage}
              contentFit="cover"
              transition={150}
            />
          )}
          {!firstBookId && (
            <View style={[styles.coverImage, styles.coverPlaceholder]}>
              <Text style={styles.coverPlaceholderText}>📚</Text>
            </View>
          )}
          <Text style={styles.seriesName}>{seriesInfo.name}</Text>
          <Text style={styles.bookCount}>
            {seriesInfo.bookCount} {seriesInfo.bookCount === 1 ? 'book' : 'books'}
          </Text>
        </View>

        {/* Sort Toggle */}
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>Books in Series</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[styles.sortButton, sortOrder === 'asc' && styles.sortButtonActive]}
              onPress={() => setSortOrder('asc')}
            >
              <Icon name="arrow-up" size={14} color={sortOrder === 'asc' ? '#000' : 'rgba(255,255,255,0.6)'} set="ionicons" />
              <Text style={[styles.sortButtonText, sortOrder === 'asc' && styles.sortButtonTextActive]}>1→{sortedBooks.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortOrder === 'desc' && styles.sortButtonActive]}
              onPress={() => setSortOrder('desc')}
            >
              <Icon name="arrow-down" size={14} color={sortOrder === 'desc' ? '#000' : 'rgba(255,255,255,0.6)'} set="ionicons" />
              <Text style={[styles.sortButtonText, sortOrder === 'desc' && styles.sortButtonTextActive]}>{sortedBooks.length}→1</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Book List */}
        <View style={styles.bookList}>
          {sortedBooks.map((book, index) => {
            const metadata = getMetadata(book);
            const sequence = getSequence(book);
            return (
              <TouchableOpacity
                key={book.id}
                style={styles.bookItem}
                onPress={() => handleBookPress(book)}
                activeOpacity={0.7}
              >
                <Image
                  source={apiClient.getItemCoverUrl(book.id)}
                  style={styles.bookCover}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.bookInfo}>
                  <View style={styles.sequenceBadge}>
                    <Text style={styles.sequenceText}>
                      {sequence < 999 ? `#${sequence}` : `#${index + 1}`}
                    </Text>
                  </View>
                  <Text style={styles.bookTitle} numberOfLines={2}>{metadata.title || 'Unknown'}</Text>
                  <Text style={styles.bookAuthor} numberOfLines={1}>{metadata.authorName || 'Unknown Author'}</Text>
                </View>
                <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" set="ionicons" />
              </TouchableOpacity>
            );
          })}
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
  coverImage: {
    width: SCREEN_WIDTH * 0.4,
    aspectRatio: 1,
    borderRadius: CARD_RADIUS,
    backgroundColor: CARD_COLOR,
    marginBottom: 16,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 48,
  },
  seriesName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
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
  bookList: {
    paddingHorizontal: 16,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginBottom: 8,
  },
  bookCover: {
    width: 60,
    height: 60,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#333',
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  sequenceBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sequenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});
