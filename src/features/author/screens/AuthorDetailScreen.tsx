/**
 * src/features/author/screens/AuthorDetailScreen.tsx
 *
 * Enhanced author detail screen based on UX research.
 * Features:
 * - Continue Listening section (in-progress books)
 * - Expandable bio with "Read more"
 * - Series grouping
 * - Related Authors discovery
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
import { useLibraryCache, getAllAuthors } from '@/core/cache';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale } from '@/shared/theme';

type AuthorDetailRouteParams = {
  AuthorDetail: { authorName: string } | { name: string };
};

const BG_COLOR = colors.backgroundPrimary;
const ACCENT = colors.accent;
const AVATAR_SIZE = scale(120);
const BIO_TRUNCATE_LENGTH = 150;

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

export function AuthorDetailScreen() {
  const route = useRoute<RouteProp<AuthorDetailRouteParams, 'AuthorDetail'>>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { loadBook } = usePlayerStore();

  // Handle both param formats
  const authorName = (route.params as any).authorName || (route.params as any).name;

  const [sortBy, setSortBy] = useState<SortType>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bioExpanded, setBioExpanded] = useState(false);

  const { getAuthor, isLoaded } = useLibraryCache();

  // Get author data from cache
  const authorInfo = useMemo(() => {
    if (!isLoaded || !authorName) return null;
    return getAuthor(authorName);
  }, [isLoaded, authorName, getAuthor]);

  // Extract unique genres from author's books
  const genres = useMemo(() => {
    if (!authorInfo?.books) return [];
    const genreSet = new Set<string>();
    authorInfo.books.forEach(book => {
      const metadata = getMetadata(book);
      if (metadata?.genres) {
        metadata.genres.forEach((g: string) => genreSet.add(g));
      }
    });
    return Array.from(genreSet).slice(0, 5);
  }, [authorInfo?.books]);

  // In-progress books (Continue Listening)
  const inProgressBooks = useMemo(() => {
    if (!authorInfo?.books) return [];
    return authorInfo.books
      .filter(book => {
        const progress = getProgress(book);
        return progress > 0 && progress < 0.95;
      })
      .sort((a, b) => {
        const aTime = (a as any).userMediaProgress?.lastUpdate || 0;
        const bTime = (b as any).userMediaProgress?.lastUpdate || 0;
        return bTime - aTime;
      });
  }, [authorInfo?.books]);

  // Group books by series
  const seriesGroups = useMemo(() => {
    if (!authorInfo?.books) return [];

    const seriesMap = new Map<string, LibraryItem[]>();
    const standalone: LibraryItem[] = [];

    authorInfo.books.forEach(book => {
      const metadata = getMetadata(book);
      const seriesName = metadata?.seriesName;

      if (seriesName) {
        const cleanSeriesName = seriesName.split('#')[0].trim();
        if (!seriesMap.has(cleanSeriesName)) {
          seriesMap.set(cleanSeriesName, []);
        }
        seriesMap.get(cleanSeriesName)!.push(book);
      } else {
        standalone.push(book);
      }
    });

    const groups: { name: string; books: LibraryItem[]; bookCount: number }[] = [];

    seriesMap.forEach((books, name) => {
      const sortedBooks = books.sort((a, b) => {
        const aSeq = parseFloat((getMetadata(a)?.seriesName || '').match(/#([\d.]+)/)?.[1] || '999');
        const bSeq = parseFloat((getMetadata(b)?.seriesName || '').match(/#([\d.]+)/)?.[1] || '999');
        return aSeq - bSeq;
      });
      groups.push({ name, books: sortedBooks, bookCount: books.length });
    });

    groups.sort((a, b) => a.name.localeCompare(b.name));

    if (standalone.length > 0) {
      groups.push({ name: 'Standalone Books', books: standalone, bookCount: standalone.length });
    }

    return groups;
  }, [authorInfo?.books]);

  // Sorted books for list view
  const sortedBooks = useMemo(() => {
    if (!authorInfo?.books) return [];
    const sorted = [...authorInfo.books];
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
  }, [authorInfo?.books, sortBy, sortDirection]);

  // Related authors (same genres)
  const relatedAuthors = useMemo(() => {
    if (!isLoaded || genres.length === 0) return [];

    const allAuthors = getAllAuthors();
    const authorGenreSet = new Set(genres);

    return allAuthors
      .filter(a => a.name !== authorName)
      .map(author => {
        // Calculate genre overlap
        const authorGenres = new Set<string>();
        author.books?.forEach(book => {
          const metadata = getMetadata(book);
          metadata?.genres?.forEach((g: string) => authorGenres.add(g));
        });

        let overlap = 0;
        authorGenres.forEach(g => {
          if (authorGenreSet.has(g)) overlap++;
        });

        return { ...author, overlap };
      })
      .filter(a => a.overlap > 0 && a.bookCount > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 6);
  }, [isLoaded, genres, authorName]);

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

  const handleSeriesPress = useCallback((seriesName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const handleAuthorPress = useCallback((name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.push('AuthorDetail', { authorName: name });
  }, [navigation]);

  // Generate initials
  const initials = authorName
    .split(' ')
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Get author image URL
  const authorImageUrl = useMemo(() => {
    if (authorInfo?.id && authorInfo?.imagePath) {
      return apiClient.getAuthorImageUrl(authorInfo.id);
    }
    return null;
  }, [authorInfo?.id, authorInfo?.imagePath]);

  // Bio handling
  const shouldTruncateBio = (authorInfo?.description?.length || 0) > BIO_TRUNCATE_LENGTH;
  const displayBio = bioExpanded || !shouldTruncateBio
    ? authorInfo?.description
    : authorInfo?.description?.slice(0, BIO_TRUNCATE_LENGTH) + '...';

  // Render book list item with progress
  const renderBookItem = useCallback((book: LibraryItem, showNarrator = true) => {
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
            {showNarrator && metadata?.narratorName && (
              <>
                <Text style={styles.bookMetaDot}>•</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('NarratorDetail', { narratorName: metadata.narratorName })}
                >
                  <Text style={styles.bookNarrator} numberOfLines={1}>{metadata.narratorName}</Text>
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
          <Ionicons name={progress > 0 ? 'play' : 'play'} size={scale(18)} color="#000" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [handleBookPress, handlePlayBook, navigation]);

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

  // Render related author card
  const renderRelatedAuthor = useCallback((author: any) => {
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
        style={styles.relatedAuthor}
        onPress={() => handleAuthorPress(author.name)}
        activeOpacity={0.7}
      >
        <View style={styles.relatedAuthorAvatar}>
          {imageUrl ? (
            <Image source={imageUrl} style={styles.relatedAuthorImage} contentFit="cover" />
          ) : (
            <Text style={styles.relatedAuthorInitials}>{authorInitials}</Text>
          )}
        </View>
        <Text style={styles.relatedAuthorName} numberOfLines={1}>{author.name}</Text>
        <Text style={styles.relatedAuthorBooks}>{author.bookCount} books</Text>
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
  if (!authorInfo) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT }]}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Author</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={scale(48)} color="rgba(255,255,255,0.3)" />
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
      <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Author</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Author Header */}
        <View style={styles.entityHeader}>
          <View style={styles.avatarContainer}>
            {authorImageUrl ? (
              <Image
                source={authorImageUrl}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.initialsText}>{initials}</Text>
            )}
          </View>
          <Text style={styles.entityName}>{authorInfo.name}</Text>
          <Text style={styles.entityStats}>
            {authorInfo.bookCount} {authorInfo.bookCount === 1 ? 'book' : 'books'} in library
          </Text>

          {/* Genre chips */}
          {genres.length > 0 && (
            <View style={styles.genreRow}>
              {genres.map(genre => (
                <TouchableOpacity
                  key={genre}
                  style={styles.genreChip}
                  onPress={() => handleGenrePress(genre)}
                >
                  <Text style={styles.genreChipText}>{genre}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Bio with Read more */}
          {authorInfo.description && (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{displayBio}</Text>
              {shouldTruncateBio && (
                <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)}>
                  <Text style={styles.bioToggle}>
                    {bioExpanded ? 'Read less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

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

        {/* Series Section */}
        {seriesGroups.length > 0 && seriesGroups.some(g => g.name !== 'Standalone Books') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Series</Text>
            {seriesGroups
              .filter(g => g.name !== 'Standalone Books')
              .map(series => (
                <TouchableOpacity
                  key={series.name}
                  style={styles.seriesRow}
                  onPress={() => handleSeriesPress(series.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.seriesCovers}>
                    {series.books.slice(0, 3).map((book, idx) => (
                      <Image
                        key={book.id}
                        source={apiClient.getItemCoverUrl(book.id)}
                        style={[
                          styles.seriesCoverSmall,
                          { marginLeft: idx > 0 ? -scale(20) : 0, zIndex: 3 - idx }
                        ]}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                  <View style={styles.seriesInfo}>
                    <Text style={styles.seriesName}>{series.name}</Text>
                    <Text style={styles.seriesBooks}>
                      {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={scale(20)} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ))}
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

        {/* Related Authors Section */}
        {relatedAuthors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Similar Authors</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {relatedAuthors.map(author => renderRelatedAuthor(author))}
            </ScrollView>
          </View>
        )}
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
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initialsText: {
    fontSize: scale(48),
    fontWeight: '700',
    color: '#000',
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
    marginBottom: scale(12),
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: scale(16),
  },
  genreChip: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(16),
  },
  genreChipText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.8)',
  },
  bioContainer: {
    paddingHorizontal: scale(20),
  },
  bioText: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.7)',
    lineHeight: scale(20),
    textAlign: 'center',
  },
  bioToggle: {
    fontSize: scale(14),
    color: ACCENT,
    fontWeight: '500',
    marginTop: scale(4),
    textAlign: 'center',
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

  // Series Row
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scale(20),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
  },
  seriesCovers: {
    flexDirection: 'row',
    marginRight: scale(12),
  },
  seriesCoverSmall: {
    width: scale(45),
    height: scale(45),
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: BG_COLOR,
  },
  seriesInfo: {
    flex: 1,
  },
  seriesName: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#fff',
  },
  seriesBooks: {
    fontSize: scale(12),
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
  bookNarrator: {
    fontSize: scale(12),
    color: '#4A90D9',
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

  // Related Authors
  relatedAuthor: {
    width: scale(90),
    alignItems: 'center',
  },
  relatedAuthorAvatar: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(8),
    overflow: 'hidden',
  },
  relatedAuthorImage: {
    width: '100%',
    height: '100%',
  },
  relatedAuthorInitials: {
    fontSize: scale(24),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  relatedAuthorName: {
    fontSize: scale(12),
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  relatedAuthorBooks: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },
});
