/**
 * src/features/narrator/screens/NarratorDetailScreen.tsx
 *
 * Narrator detail screen using library cache for instant loading.
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
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryCache } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { BookCard } from '@/shared/components/BookCard';
import { LibraryItem } from '@/core/types';

type NarratorDetailRouteParams = {
  NarratorDetail: { narratorName: string };
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BG_COLOR = '#1a1a1a';
const CARD_COLOR = '#2a2a2a';
const ACCENT = '#CCFF00';
const AVATAR_SIZE = SCREEN_WIDTH * 0.3;

type SortType = 'title' | 'recent' | 'published';
type SortDirection = 'asc' | 'desc';

export function NarratorDetailScreen() {
  const route = useRoute<RouteProp<NarratorDetailRouteParams, 'NarratorDetail'>>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { narratorName } = route.params;
  const [sortBy, setSortBy] = useState<SortType>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { getNarrator, isLoaded } = useLibraryCache();

  // Get narrator data from cache - instant!
  const narratorInfo = useMemo(() => {
    if (!isLoaded || !narratorName) return null;
    return getNarrator(narratorName);
  }, [isLoaded, narratorName, getNarrator]);

  const sortedBooks = useMemo(() => {
    if (!narratorInfo?.books) return [];
    const sorted = [...narratorInfo.books];
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'title':
        return sorted.sort((a, b) =>
          direction * ((a.media?.metadata as any)?.title || '').localeCompare(
            (b.media?.metadata as any)?.title || ''
          )
        );
      case 'recent':
        return sorted.sort((a, b) => direction * ((a.addedAt || 0) - (b.addedAt || 0)));
      case 'published':
        return sorted.sort((a, b) => {
          const aYear = parseInt((a.media?.metadata as any)?.publishedYear || '0', 10);
          const bYear = parseInt((b.media?.metadata as any)?.publishedYear || '0', 10);
          return direction * (aYear - bYear);
        });
      default:
        return sorted;
    }
  }, [narratorInfo?.books, sortBy, sortDirection]);

  const handleSortPress = (type: SortType) => {
    if (sortBy === type) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortDirection('asc');
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main' as never);
    }
  };

  // Navigate to BookDetail - per spec, all book taps go to detail
  const handleBookPress = useCallback((book: LibraryItem) => {
    (navigation as any).navigate('BookDetail', { id: book.id });
  }, [navigation]);

  // Generate initials
  const initials = narratorName
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

  if (!narratorInfo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Narrator</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="mic-outline" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
          <Text style={styles.emptyTitle}>Narrator not found</Text>
          <Text style={styles.emptySubtitle}>This narrator may have been removed</Text>
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
        <Text style={styles.headerTitle}>Narrator</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Narrator Info */}
        <View style={styles.narratorHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
          <Text style={styles.narratorName}>{narratorInfo.name}</Text>
          <Text style={styles.bookCount}>
            {narratorInfo.bookCount} {narratorInfo.bookCount === 1 ? 'book' : 'books'}
          </Text>
        </View>

        {/* Sort Toggle */}
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>Books Narrated</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortButtons}>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
                onPress={() => handleSortPress('title')}
              >
                <Icon
                  name={sortBy === 'title' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'swap-vertical'}
                  size={14}
                  color={sortBy === 'title' ? '#000' : 'rgba(255,255,255,0.6)'}
                  set="ionicons"
                />
                <Text style={[styles.sortButtonText, sortBy === 'title' && styles.sortButtonTextActive]}>
                  {sortBy === 'title' ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A') : 'Title'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
                onPress={() => handleSortPress('recent')}
              >
                <Icon
                  name={sortBy === 'recent' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'time-outline'}
                  size={14}
                  color={sortBy === 'recent' ? '#000' : 'rgba(255,255,255,0.6)'}
                  set="ionicons"
                />
                <Text style={[styles.sortButtonText, sortBy === 'recent' && styles.sortButtonTextActive]}>Recent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'published' && styles.sortButtonActive]}
                onPress={() => handleSortPress('published')}
              >
                <Icon
                  name={sortBy === 'published' ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'calendar-outline'}
                  size={14}
                  color={sortBy === 'published' ? '#000' : 'rgba(255,255,255,0.6)'}
                  set="ionicons"
                />
                <Text style={[styles.sortButtonText, sortBy === 'published' && styles.sortButtonTextActive]}>Published</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Book List - Using BookCard with state-aware icons */}
        <View style={styles.bookList}>
          {sortedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onPress={() => handleBookPress(book)}
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
  narratorHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#4A90D9', // Different color for narrators
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  initialsText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  narratorName: {
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
});
