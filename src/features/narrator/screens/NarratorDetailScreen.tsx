/**
 * src/features/narrator/screens/NarratorDetailScreen.tsx
 *
 * Enhanced narrator detail screen based on UX research.
 * Features:
 * - Continue Listening section (in-progress books)
 * - Frequently Collaborates With (top authors)
 * - Top Genres with counts
 * - Book list with progress bars
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale } from '@/shared/theme';

type NarratorDetailRouteParams = {
  NarratorDetail: { narratorName: string } | { name: string };
};

const BG_COLOR = colors.backgroundPrimary;
const ACCENT = colors.accent;
const NARRATOR_COLOR = '#4A90D9';
const AVATAR_SIZE = scale(120);

type SortType = 'title' | 'recent' | 'duration' | 'progress';
type SortDirection = 'asc' | 'desc';

// Helper to get metadata
const getMetadata = (item: LibraryItem) => item.media?.metadata as any;

// Helper to get progress
const getProgress = (item: LibraryItem): number => {
  const progress = (item as any).userMediaProgress;
  if (!progress) return 0;
  return progress.progress || 0;
};

// Helper to format duration
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Helper to format time remaining
const formatTimeRemaining = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
};

export function NarratorDetailScreen() {
  const route = useRoute<RouteProp<NarratorDetailRouteParams, 'NarratorDetail'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { loadBook } = usePlayerStore();

  // Handle both param formats
  const narratorName = (route.params as any).narratorName || (route.params as any).name;

  const [sortBy, setSortBy] = useState<SortType>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { getNarrator, getAuthor, isLoaded } = useLibraryCache();

  // Get narrator data from cache
  const narratorInfo = useMemo(() => {
    if (!isLoaded || !narratorName) return null;
    return getNarrator(narratorName);
  }, [isLoaded, narratorName, getNarrator]);

  // Extract unique genres with counts
  const genresWithCounts = useMemo(() => {
    if (!narratorInfo?.books) return [];
    const genreMap = new Map<string, number>();
    narratorInfo.books.forEach(book => {
      const metadata = getMetadata(book);
      if (metadata?.genres) {
        metadata.genres.forEach((g: string) => {
          genreMap.set(g, (genreMap.get(g) || 0) + 1);
        });
      }
    });
    return Array.from(genreMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [narratorInfo?.books]);

  // Top authors (frequently collaborates with)
  const topAuthors = useMemo(() => {
    if (!narratorInfo?.books || !isLoaded) return [];
    const authorMap = new Map<string, { name: string; bookCount: number }>();

    narratorInfo.books.forEach(book => {
      const metadata = getMetadata(book);
      const authorName = metadata?.authorName;
      if (authorName) {
        const existing = authorMap.get(authorName);
        if (existing) {
          existing.bookCount++;
        } else {
          authorMap.set(authorName, { name: authorName, bookCount: 1 });
        }
      }
    });

    return Array.from(authorMap.values())
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 6)
      .map(author => {
        const authorData = getAuthor(author.name);
        return {
          ...author,
          id: authorData?.id,
          imagePath: authorData?.imagePath,
        };
      });
  }, [narratorInfo?.books, isLoaded, getAuthor]);

  // In-progress books (Continue Listening)
  const inProgressBooks = useMemo(() => {
    if (!narratorInfo?.books) return [];
    return narratorInfo.books
      .filter(book => {
        const progress = getProgress(book);
        return progress > 0 && progress < 0.95;
      })
      .sort((a, b) => {
        const aTime = (a as any).userMediaProgress?.lastUpdate || 0;
        const bTime = (b as any).userMediaProgress?.lastUpdate || 0;
        return bTime - aTime;
      });
  }, [narratorInfo?.books]);

  // Sorted books for list view
  const sortedBooks = useMemo(() => {
    if (!narratorInfo?.books) return [];
    const sorted = [...narratorInfo.books];
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'title':
        return sorted.sort((a, b) =>
          direction * (getMetadata(a)?.title || '').localeCompare(getMetadata(b)?.title || '')
        );
      case 'recent':
        return sorted.sort((a, b) => direction * ((b.addedAt || 0) - (a.addedAt || 0)));
      case 'duration':
        return sorted.sort((a, b) => {
          const aDur = (a.media as any)?.duration || 0;
          const bDur = (b.media as any)?.duration || 0;
          return direction * (aDur - bDur);
        });
      case 'progress':
        return sorted.sort((a, b) => direction * (getProgress(b) - getProgress(a)));
      default:
        return sorted;
    }
  }, [narratorInfo?.books, sortBy, sortDirection]);

  const handleSortPress = (type: SortType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      navigation.navigate('Main');
    }
  };

  const handleBookPress = useCallback((book: LibraryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('BookDetail', { id: book.id });
  }, [navigation]);

  const handlePlayBook = useCallback((book: LibraryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loadBook(book.id);
  }, [loadBook]);

  const handleGenrePress = useCallback((genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('GenreDetail', { genre });
  }, [navigation]);

  const handleAuthorPress = useCallback((name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AuthorDetail', { authorName: name });
  }, [navigation]);

  // Generate initials
  const initials = narratorName
    .split(' ')
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Render book list item with progress
  const renderBookItem = useCallback((book: LibraryItem) => {
    const metadata = getMetadata(book);
    const progress = getProgress(book);
    const duration = (book.media as any)?.duration || 0;
    const isCompleted = progress >= 0.95;
    const seriesMatch = metadata?.seriesName?.match(/^(.+?)\s*#([\d.]+)$/);
    const seriesName = seriesMatch ? seriesMatch[1] : null;
    const sequence = seriesMatch ? seriesMatch[2] : null;

    return (
      <TouchableOpacity
        key={book.id}
        style={styles.bookItem}
        onPress={() => handleBookPress(book)}
        activeOpacity={0.7}
      >
        <View style={styles.bookCoverContainer}>
          <Image
            source={apiClient.getItemCoverUrl(book.id)}
            style={styles.bookCover}
            contentFit="cover"
          />
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={scale(16)} color={ACCENT} />
            </View>
          )}
        </View>

        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={1}>{metadata?.title}</Text>
          {seriesName && (
            <Text style={styles.bookSeries} numberOfLines={1}>
              {seriesName} #{sequence}
            </Text>
          )}
          <View style={styles.bookMetaRow}>
            <Text style={styles.bookMeta}>{formatDuration(duration)}</Text>
            {metadata?.authorName && (
              <>
                <Text style={styles.bookMetaDot}>•</Text>
                <TouchableOpacity
                  onPress={() => handleAuthorPress(metadata.authorName)}
                >
                  <Text style={styles.bookAuthor} numberOfLines={1}>{metadata.authorName}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Progress bar */}
          {progress > 0 && !isCompleted && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {formatTimeRemaining(duration * (1 - progress))}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.playButton}
          onPress={() => handlePlayBook(book)}
        >
          <Ionicons name="play" size={scale(18)} color="#000" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [handleBookPress, handlePlayBook, handleAuthorPress]);

  // Render continue listening card
  const renderContinueListeningCard = useCallback(({ item }: { item: LibraryItem }) => {
    const metadata = getMetadata(item);
    const progress = getProgress(item);
    const duration = (item.media as any)?.duration || 0;

    return (
      <TouchableOpacity
        style={styles.continueCard}
        onPress={() => handleBookPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.continueCoverContainer}>
          <Image
            source={apiClient.getItemCoverUrl(item.id)}
            style={styles.continueCover}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.continueGradient}
          />
          <View style={styles.continueProgress}>
            <View style={[styles.continueProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.continueProgressText}>{Math.round(progress * 100)}%</Text>
        </View>
        <Text style={styles.continueTitle} numberOfLines={2}>{metadata?.title}</Text>
        <Text style={styles.continueRemaining}>
          {formatTimeRemaining(duration * (1 - progress))}
        </Text>
      </TouchableOpacity>
    );
  }, [handleBookPress]);

  // Render collaborating author card
  const renderAuthorCard = useCallback((author: any) => {
    const imageUrl = author.id && author.imagePath
      ? apiClient.getAuthorImageUrl(author.id)
      : null;
    const authorInitials = author.name
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <TouchableOpacity
        key={author.name}
        style={styles.authorCard}
        onPress={() => handleAuthorPress(author.name)}
        activeOpacity={0.7}
      >
        <View style={styles.authorAvatar}>
          {imageUrl ? (
            <Image source={imageUrl} style={styles.authorImage} contentFit="cover" />
          ) : (
            <Text style={styles.authorInitials}>{authorInitials}</Text>
          )}
        </View>
        <Text style={styles.authorName} numberOfLines={1}>{author.name}</Text>
        <Text style={styles.authorBooks}>{author.bookCount} books</Text>
      </TouchableOpacity>
    );
  }, [handleAuthorPress]);

  // Loading state
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

  // Not found state
  if (!narratorInfo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT }]}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Narrator</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="mic-outline" size={scale(48)} color="rgba(255,255,255,0.3)" />
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
      <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Narrator</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Narrator Header */}
        <View style={styles.entityHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="mic" size={scale(48)} color="#fff" />
          </View>
          <Text style={styles.entityName}>{narratorInfo.name}</Text>
          <Text style={styles.entityStats}>
            {narratorInfo.bookCount} {narratorInfo.bookCount === 1 ? 'book' : 'books'} narrated
          </Text>
        </View>

        {/* Top Genres */}
        {genresWithCounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Genres</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.genreList}
            >
              {genresWithCounts.map(genre => (
                <TouchableOpacity
                  key={genre.name}
                  style={styles.genreChip}
                  onPress={() => handleGenrePress(genre.name)}
                >
                  <Text style={styles.genreChipText}>{genre.name}</Text>
                  <View style={styles.genreCount}>
                    <Text style={styles.genreCountText}>{genre.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Continue Listening Section */}
        {inProgressBooks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Listening</Text>
            <FlatList
              data={inProgressBooks}
              renderItem={renderContinueListeningCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Frequently Collaborates With */}
        {topAuthors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequently Collaborates With</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {topAuthors.map(author => renderAuthorCard(author))}
            </ScrollView>
          </View>
        )}

        {/* All Books Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Books</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.sortButtons}>
                {(['title', 'recent', 'duration', 'progress'] as SortType[]).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sortButton, sortBy === type && styles.sortButtonActive]}
                    onPress={() => handleSortPress(type)}
                  >
                    {sortBy === type && (
                      <Ionicons
                        name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={scale(12)}
                        color="#000"
                      />
                    )}
                    <Text style={[styles.sortButtonText, sortBy === type && styles.sortButtonTextActive]}>
                      {type === 'title' ? 'Title' :
                       type === 'recent' ? 'Recent' :
                       type === 'duration' ? 'Duration' : 'Progress'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.bookList}>
            {sortedBooks.map(book => renderBookItem(book))}
          </View>
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
    paddingHorizontal: scale(12),
    paddingBottom: scale(12),
  },
  headerButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scale(17),
    fontWeight: '600',
    color: '#fff',
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
    fontSize: scale(16),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    color: '#fff',
    fontSize: scale(18),
    fontWeight: '600',
    marginTop: scale(16),
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: scale(14),
    marginTop: scale(4),
    textAlign: 'center',
  },

  // Entity Header
  entityHeader: {
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: scale(10),
    paddingBottom: scale(24),
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: NARRATOR_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
    overflow: 'hidden',
  },
  entityName: {
    fontSize: scale(24),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(4),
  },
  entityStats: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
  },

  // Sections
  section: {
    marginBottom: scale(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  horizontalList: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },

  // Genre chips with counts
  genreList: {
    paddingHorizontal: scale(20),
    gap: scale(10),
    flexDirection: 'row',
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: scale(14),
    paddingRight: scale(8),
    paddingVertical: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(20),
    gap: scale(8),
  },
  genreChipText: {
    fontSize: scale(13),
    color: '#fff',
    fontWeight: '500',
  },
  genreCount: {
    backgroundColor: NARRATOR_COLOR,
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  genreCountText: {
    fontSize: scale(11),
    fontWeight: '600',
    color: '#fff',
  },

  // Continue Listening Cards
  continueCard: {
    width: scale(140),
  },
  continueCoverContainer: {
    width: scale(140),
    height: scale(140),
    borderRadius: scale(8),
    overflow: 'hidden',
    marginBottom: scale(8),
    position: 'relative',
  },
  continueCover: {
    width: '100%',
    height: '100%',
  },
  continueGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: scale(60),
  },
  continueProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  continueProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  continueProgressText: {
    position: 'absolute',
    bottom: scale(8),
    right: scale(8),
    fontSize: scale(12),
    fontWeight: '700',
    color: '#fff',
  },
  continueTitle: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#fff',
    lineHeight: scale(18),
  },
  continueRemaining: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },

  // Author Cards
  authorCard: {
    width: scale(90),
    alignItems: 'center',
  },
  authorAvatar: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(8),
    overflow: 'hidden',
  },
  authorImage: {
    width: '100%',
    height: '100%',
  },
  authorInitials: {
    fontSize: scale(24),
    fontWeight: '600',
    color: '#000',
  },
  authorName: {
    fontSize: scale(12),
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  authorBooks: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },

  // Sort Buttons
  sortButtons: {
    flexDirection: 'row',
    gap: scale(8),
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sortButtonActive: {
    backgroundColor: ACCENT,
  },
  sortButtonText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#000',
  },

  // Book List
  bookList: {
    paddingHorizontal: scale(20),
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  bookCoverContainer: {
    position: 'relative',
    width: scale(60),
    height: scale(60),
    borderRadius: scale(6),
    overflow: 'hidden',
    marginRight: scale(12),
  },
  bookCover: {
    width: '100%',
    height: '100%',
  },
  completedBadge: {
    position: 'absolute',
    top: scale(2),
    right: scale(2),
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#fff',
    marginBottom: scale(2),
  },
  bookSeries: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(2),
  },
  bookMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookMeta: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  bookMetaDot: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.3)',
    marginHorizontal: scale(6),
  },
  bookAuthor: {
    fontSize: scale(12),
    color: ACCENT,
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(6),
    gap: scale(8),
  },
  progressBar: {
    flex: 1,
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
  progressText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  playButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(8),
  },
});
