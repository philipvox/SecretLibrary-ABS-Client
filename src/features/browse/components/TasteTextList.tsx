/**
 * src/features/browse/components/TasteTextList.tsx
 *
 * "Based on Your Taste" section with toggle between list and shelf views.
 * - List mode: True inline flowing text with book cover thumbnails and superscript authors
 * - Shelf mode: Horizontal scroll of BookSpineVertical components (no animation)
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { logger } from '@/shared/utils/logger';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Plus, Check } from 'lucide-react-native';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { haptics } from '@/core/native/haptics';
import { BookSpineVertical, BookSpineVerticalData } from '@/features/home/components/BookSpineVertical';
import { useBookRowLayout } from '@/features/home/hooks/useBookRowLayout';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { usePersonalizedContent } from '@/features/discover/hooks/usePersonalizedContent';
import { useLibraryCache } from '@/core/cache';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { apiClient } from '@/core/api';
import { LibraryItem, BookMetadata } from '@/core/types';
import { scale } from '@/shared/theme';
import { useProgressStore } from '@/core/stores/progressStore';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useToast } from '@/shared/hooks/useToast';

// Extended metadata interface
interface ExtendedBookMetadata extends BookMetadata {
  tags?: string[];
}

// Helper to get book metadata safely
// Note: We access metadata directly without requiring audioFiles,
// since library cache items may not include audioFiles to save space
function getBookMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration safely
function getBookDuration(item: LibraryItem): number {
  return (item.media as any)?.duration || 0;
}

type ViewMode = 'list' | 'shelf';

interface TasteTextListProps {
  onBookPress?: (bookId: string) => void;
}

// Convert LibraryItem to BookSpineVerticalData (without cache - used for fallback)
function toSpineDataBasic(item: LibraryItem): BookSpineVerticalData {
  const metadata = getBookMetadata(item);
  const progress = item.userMediaProgress?.progress || 0;

  return {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || 'Unknown Author',
    progress,
    genres: metadata?.genres || [],
    tags: metadata?.tags || [],
    duration: getBookDuration(item),
    seriesName: metadata?.seriesName || metadata?.series?.[0]?.name,
  };
}

// Get author's last name for superscript display
function getAuthorLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

export function TasteTextList({ onBookPress }: TasteTextListProps) {
  const renderStart = useRef(Date.now());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [addedBooks, setAddedBooks] = useState<Set<string>>(new Set());
  const [listExpanded, setListExpanded] = useState(false);

  // Data hooks - measure cache access time
  const cacheStart = Date.now();
  const { items: libraryItems, isLoaded } = useLibraryCache();
  const { isFinished, hasBeenStarted, hasHistory } = useReadingHistory();
  const cacheTime = Date.now() - cacheStart;

  // Library and download state
  const librarySet = useProgressStore((state) => state.librarySet);
  const addToLibrary = useProgressStore((state) => state.addToLibrary);
  const { downloads } = useDownloads();
  const { showSuccess } = useToast();

  // Get set of downloaded book IDs
  const downloadedIds = useMemo(() => {
    return new Set(downloads.filter(d => d.status === 'complete').map(d => d.itemId));
  }, [downloads]);

  // Spine cache for colors
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);

  // Series filter for personalized content
  const isSeriesAppropriate = useMemo(() => {
    if (!libraryItems.length) return () => true;
    return createSeriesFilter({ allItems: libraryItems, isFinished, hasStarted: hasBeenStarted });
  }, [libraryItems, isFinished, hasBeenStarted]);

  // Convert to book summary (simplified)
  const convertToBookSummary = useCallback((item: LibraryItem) => {
    const metadata = getBookMetadata(item);
    return {
      id: item.id,
      title: metadata?.title || '',
      author: metadata?.authorName || '',
      coverUrl: apiClient.getItemCoverUrl(item.id, { width: 400, height: 400 }),
      duration: getBookDuration(item),
      genres: metadata?.genres || [],
      addedDate: item.addedAt || 0,
      isDownloaded: false,
    };
  }, []);

  // Get personalized recommendations - this can be slow
  const personalizedStart = Date.now();
  const { recommendationRows } = usePersonalizedContent({
    libraryItems,
    isLoaded,
    convertToBookSummary,
    isFinished,
    isSeriesAppropriate,
    hasHistory,
  });
  const personalizedTime = Date.now() - personalizedStart;

  // Log component timing
  useEffect(() => {
    const totalTime = Date.now() - renderStart.current;
    logger.debug(`[Browse Perf] TasteTextList mounted in ${totalTime}ms (cache: ${cacheTime}ms, personalized: ${personalizedTime}ms, hasHistory: ${hasHistory})`);
  }, []);

  // Get 10+ books from recommendations (no mid-series books)
  // Exclude books already in library, with listening history, or downloaded
  const recommendedBooks = useMemo(() => {
    const allItems: LibraryItem[] = [];
    const seenIds = new Set<string>();

    // Helper to check if book should be excluded
    const shouldExclude = (bookId: string, item: LibraryItem): boolean => {
      // Skip if already in user's library
      if (librarySet.has(bookId)) return true;

      // Skip if already downloaded
      if (downloadedIds.has(bookId)) return true;

      // Skip if has listening progress
      const progress = item.userMediaProgress?.progress || 0;
      if (progress > 0) return true;

      // Skip if finished
      if (isFinished(bookId)) return true;

      return false;
    };

    // First pass: collect from recommendation rows
    for (const row of recommendationRows) {
      for (const book of row.items) {
        if (seenIds.has(book.id)) continue;

        const fullItem = libraryItems.find((i) => i.id === book.id);
        if (!fullItem) continue;

        // Skip excluded books
        if (shouldExclude(book.id, fullItem)) continue;

        const metadata = getBookMetadata(fullItem);

        // Skip books from the middle of a series (only show #1 or standalone)
        const seriesInfo = metadata?.series?.[0];
        const sequence = seriesInfo?.sequence;
        if (sequence && parseFloat(sequence) > 1) {
          continue;
        }

        allItems.push(fullItem);
        seenIds.add(book.id);
      }
    }

    // If we don't have enough, add more from library (random unstarted books)
    if (allItems.length < 10) {
      for (const item of libraryItems) {
        if (seenIds.has(item.id)) continue;
        if (allItems.length >= 15) break;

        // Skip excluded books
        if (shouldExclude(item.id, item)) continue;

        const metadata = getBookMetadata(item);
        const seriesInfo = metadata?.series?.[0];
        const sequence = seriesInfo?.sequence;
        if (sequence && parseFloat(sequence) > 1) continue;

        allItems.push(item);
        seenIds.add(item.id);
      }
    }

    return allItems.slice(0, 15); // Max 15 for display
  }, [recommendationRows, libraryItems, librarySet, downloadedIds, isFinished]);

  // Handle book press
  const handleBookPress = useCallback(
    (bookId: string) => {
      onBookPress?.(bookId);
    },
    [onBookPress]
  );

  // Handle spine press
  const handleSpinePress = useCallback(
    (book: BookSpineVerticalData) => {
      onBookPress?.(book.id);
    },
    [onBookPress]
  );

  // Convert to spine data for shelf view (with cached colors)
  const spineDataList = useMemo(
    () => recommendedBooks.map((item) => {
      const cached = getSpineData(item.id);
      const basic = toSpineDataBasic(item);

      // Add cached colors if available
      if (cached) {
        return {
          ...basic,
          backgroundColor: cached.backgroundColor,
          textColor: cached.textColor,
        };
      }
      return basic;
    }),
    [recommendedBooks, getSpineData]
  );

  // Get layouts for shelf view using shared hook
  // Use smaller scale for carousel context (0.5 gives ~160px height)
  const shelfLayouts = useBookRowLayout(spineDataList, {
    scaleFactor: 0.5,
    enableLeaning: true,
  });

  // Toggle handler
  const toggleView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // Handle add to library press - MUST be before early return (React hooks rule)
  const handleAddToLibrary = useCallback(async (bookId: string, bookTitle: string) => {
    haptics.success();
    try {
      await addToLibrary(bookId);
      setAddedBooks(prev => new Set(prev).add(bookId));
      showSuccess(`Added "${bookTitle}" to library`);
    } catch (error) {
      // Silent fail - store handles errors
    }
  }, [addToLibrary, showSuccess]);

  if (!isLoaded || recommendedBooks.length === 0) {
    return null;
  }

  // Format duration in hours
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0h';
    const hours = Math.round(seconds / 3600);
    return `${hours}h`;
  };

  // Build the list view (matches book list style from screenshot)
  const renderListView = () => {
    // Show 3 items initially, all when expanded
    const displayBooks = listExpanded ? recommendedBooks.slice(0, 10) : recommendedBooks.slice(0, 3);
    const hasMore = recommendedBooks.length > 3;

    return (
      <View style={styles.listContainer}>
        {displayBooks.map((book, index) => {
          const metadata = getBookMetadata(book);
          const title = metadata?.title || 'Unknown';
          const seriesInfo = metadata?.series?.[0];
          const seriesText = seriesInfo
            ? `${seriesInfo.name}${seriesInfo.sequence ? ` #${seriesInfo.sequence}` : ''}`
            : null;
          const duration = getBookDuration(book);
          const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 120, height: 120 });
          const isLast = index === displayBooks.length - 1;

          return (
            <Pressable
              key={book.id}
              style={styles.listItem}
              onPress={() => handleBookPress(book.id)}
            >
              <Image source={{ uri: coverUrl }} style={styles.listCover} />
              <View style={styles.listInfo}>
                <View style={styles.listTitleRow}>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {duration > 0 && (
                    <Text style={styles.listTitleDuration}> · {formatDuration(duration)}</Text>
                  )}
                </View>
                {seriesText && (
                  <Text style={styles.listSeries} numberOfLines={1}>{seriesText}</Text>
                )}
              </View>
              {/* Add to Library pill */}
              {addedBooks.has(book.id) ? (
                <View style={[styles.addToLibraryPill, styles.addedPill]}>
                  <Check size={scale(12)} color={secretLibraryColors.gold} strokeWidth={2.5} />
                  <Text style={[styles.addToLibraryText, styles.addedText]}>Added</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addToLibraryPill}
                  onPress={() => handleAddToLibrary(book.id, title)}
                  activeOpacity={0.8}
                >
                  <Plus size={scale(12)} color={secretLibraryColors.gray} strokeWidth={2} />
                  <Text style={styles.addToLibraryText}>Add</Text>
                </TouchableOpacity>
              )}
              {!isLast && <View style={styles.listSeparator} />}
            </Pressable>
          );
        })}
        {/* Show more / Show less button */}
        {hasMore && (
          <TouchableOpacity
            style={styles.showMoreBtn}
            onPress={() => setListExpanded(!listExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.showMoreText}>
              {listExpanded ? 'Show less' : 'Show more'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}><Text style={styles.titleItalic}>Your Taste</Text></Text>
        <View style={styles.headerRight}>
          {/* View toggle */}
          <View style={styles.toggle}>
            <Pressable onPress={() => toggleView('shelf')}>
              <Text style={[styles.toggleText, viewMode === 'shelf' && styles.toggleActive]}>
                Shelf
              </Text>
            </Pressable>
            <Text style={styles.toggleDivider}> / </Text>
            <Pressable onPress={() => toggleView('list')}>
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleActive]}>
                List
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'list' ? (
        renderListView()
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfContent}
        >
          {shelfLayouts.map((layout) => (
            <View key={layout.book.id} style={styles.spineWrapper}>
              <BookSpineVertical
                book={layout.book}
                width={layout.width}
                height={layout.height}
                leanAngle={layout.leanAngle}
                onPress={handleSpinePress}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: secretLibraryColors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(32),
    color: secretLibraryColors.white,
  },
  titleItalic: {
    fontStyle: 'italic',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: secretLibraryColors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  toggleActive: {
    color: secretLibraryColors.white,
    textDecorationLine: 'underline',
  },
  toggleDivider: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: secretLibraryColors.gray,
  },
  // List view styles
  listContainer: {
    paddingHorizontal: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listCover: {
    width: scale(48),
    height: scale(48),
    borderRadius: 4,
    backgroundColor: secretLibraryColors.gray,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  listTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
    color: secretLibraryColors.white,
    flexShrink: 1,
  },
  listTitleDuration: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: secretLibraryColors.gray,
  },
  listSeries: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: secretLibraryColors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addToLibraryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  addToLibraryText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: secretLibraryColors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addedPill: {
    backgroundColor: 'rgba(243, 182, 12, 0.15)', // gold with transparency
  },
  addedText: {
    color: secretLibraryColors.gold,
  },
  listSeparator: {
    position: 'absolute',
    bottom: 0,
    left: scale(48) + 12,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  showMoreBtn: {
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  showMoreText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: secretLibraryColors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
  },
  shelfContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
  spineWrapper: {
    // No additional styling needed
  },
});
