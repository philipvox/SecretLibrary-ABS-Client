/**
 * src/features/author/screens/AuthorDetailScreen.tsx
 *
 * Author detail screen using library cache for instant loading.
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

type AuthorDetailRouteParams = {
  AuthorDetail: { authorName: string };
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BG_COLOR = '#1a1a1a';
const CARD_COLOR = '#2a2a2a';
const ACCENT = '#CCFF00';
const CARD_RADIUS = 5;
const AVATAR_SIZE = SCREEN_WIDTH * 0.3;

type SortType = 'title-asc' | 'title-desc' | 'recent';

export function AuthorDetailScreen() {
  const route = useRoute<RouteProp<AuthorDetailRouteParams, 'AuthorDetail'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { authorName } = route.params;
  const [sortBy, setSortBy] = useState<SortType>('title-asc');

  const { getAuthor, isLoaded } = useLibraryCache();
  const { loadBook } = usePlayerStore();

  // Get author data from cache - instant!
  const authorInfo = useMemo(() => {
    if (!isLoaded || !authorName) return null;
    return getAuthor(authorName);
  }, [isLoaded, authorName, getAuthor]);

  const sortedBooks = useMemo(() => {
    if (!authorInfo?.books) return [];
    const sorted = [...authorInfo.books];
    switch (sortBy) {
      case 'title-asc':
        return sorted.sort((a, b) =>
          ((a.media?.metadata as any)?.title || '').localeCompare(
            (b.media?.metadata as any)?.title || ''
          )
        );
      case 'title-desc':
        return sorted.sort((a, b) =>
          ((b.media?.metadata as any)?.title || '').localeCompare(
            (a.media?.metadata as any)?.title || ''
          )
        );
      case 'recent':
        return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      default:
        return sorted;
    }
  }, [authorInfo?.books, sortBy]);

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

  // Generate initials
  const initials = authorName
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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

  if (!authorInfo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Author</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="person-outline" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
          <Text style={styles.emptyTitle}>Author not found</Text>
          <Text style={styles.emptySubtitle}>This author may have been removed</Text>
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
        <Text style={styles.headerTitle}>Author</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Author Info */}
        <View style={styles.authorHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
          <Text style={styles.authorName}>{authorInfo.name}</Text>
          <Text style={styles.bookCount}>
            {authorInfo.bookCount} {authorInfo.bookCount === 1 ? 'book' : 'books'}
          </Text>
        </View>

        {/* Sort Toggle */}
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>Books by Author</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortButtons}>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'title-asc' && styles.sortButtonActive]}
                onPress={() => setSortBy('title-asc')}
              >
                <Icon name="arrow-up" size={14} color={sortBy === 'title-asc' ? '#000' : 'rgba(255,255,255,0.6)'} set="ionicons" />
                <Text style={[styles.sortButtonText, sortBy === 'title-asc' && styles.sortButtonTextActive]}>A-Z</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'title-desc' && styles.sortButtonActive]}
                onPress={() => setSortBy('title-desc')}
              >
                <Icon name="arrow-down" size={14} color={sortBy === 'title-desc' ? '#000' : 'rgba(255,255,255,0.6)'} set="ionicons" />
                <Text style={[styles.sortButtonText, sortBy === 'title-desc' && styles.sortButtonTextActive]}>Z-A</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
                onPress={() => setSortBy('recent')}
              >
                <Icon name="time-outline" size={14} color={sortBy === 'recent' ? '#000' : 'rgba(255,255,255,0.6)'} set="ionicons" />
                <Text style={[styles.sortButtonText, sortBy === 'recent' && styles.sortButtonTextActive]}>Recent</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Book List */}
        <View style={styles.bookList}>
          {sortedBooks.map((book) => {
            const metadata = getMetadata(book);
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
                  <Text style={styles.bookTitle} numberOfLines={2}>{metadata.title || 'Unknown'}</Text>
                  {metadata.narratorName && (
                    <Text style={styles.bookNarrator} numberOfLines={1}>
                      Narrated by {metadata.narratorName.replace(/^Narrated by\s*/i, '')}
                    </Text>
                  )}
                  {metadata.seriesName && (
                    <Text style={styles.bookSeries} numberOfLines={1}>{metadata.seriesName}</Text>
                  )}
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
  authorHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  initialsText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000',
  },
  authorName: {
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
    marginRight: 12,
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
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bookNarrator: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  bookSeries: {
    fontSize: 12,
    color: ACCENT,
    marginTop: 2,
  },
});
