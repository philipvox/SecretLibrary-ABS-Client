/**
 * src/features/browse/components/TopPickHero.tsx
 *
 * Top Pick Hero section for the Browse page.
 * Matches the centered editorial design of SecretLibraryBookDetailScreen.
 */

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { logger } from '@/shared/utils/logger';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { PlayIcon, PauseIcon } from '@/features/player/components/PlayerIcons';
import { useNavigation } from '@react-navigation/native';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { haptics } from '@/core/native/haptics';
import { usePlayerStore } from '@/features/player';
import { usePersonalizedContent } from '@/features/discover/hooks/usePersonalizedContent';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { LibraryItem, BookMetadata } from '@/core/types';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { getTypographyForGenres, getSeriesStyle } from '@/features/home/utils/spine/adapter';

// Extended metadata interface with narrator
interface ExtendedBookMetadata extends BookMetadata {
  narratorName?: string;
}

// =============================================================================
// ICONS
// =============================================================================

interface IconProps {
  color?: string;
  size?: number;
}

const DownloadIcon = ({ color = '#000', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M12 15V3" />
  </Svg>
);

const CheckIcon = ({ color = '#000', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

// =============================================================================
// HELPERS
// =============================================================================

function getBookMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

function getBookDuration(item: LibraryItem): number {
  return (item.media as any)?.duration || 0;
}

function getChapterCount(item: LibraryItem): number {
  return (item.media as any)?.chapters?.length || 0;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

function splitTitle(title: string): { line1: string; line2: string } {
  const words = title.split(' ');
  // Only split if more than 3 words
  if (words.length <= 3) {
    return { line1: title, line2: '' };
  }
  const midPoint = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, midPoint).join(' '),
    line2: words.slice(midPoint).join(' '),
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

interface TopPickHeroProps {
  onBookPress?: (bookId: string) => void;
}

export function TopPickHero({ onBookPress }: TopPickHeroProps) {
  const renderStart = useRef(Date.now());
  const navigation = useNavigation<any>();

  // Library data
  const cacheStart = Date.now();
  const { items: libraryItems, isLoaded } = useLibraryCache();
  const { isFinished, hasBeenStarted, hasHistory } = useReadingHistory();
  const cacheTime = Date.now() - cacheStart;

  // Player state
  const loadBook = usePlayerStore((s) => s.loadBook);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

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

  // Get personalized recommendations - same source as "Your Taste" section
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
    logger.debug(`[Browse Perf] TopPickHero mounted in ${totalTime}ms (cache: ${cacheTime}ms, personalized: ${personalizedTime}ms, rows: ${recommendationRows.length})`);
  }, []);

  // Get the top pick book from personalized recommendations (same as "Your Taste")
  const topPickData = useMemo(() => {
    // Find first valid book from recommendation rows
    for (const row of recommendationRows) {
      for (const book of row.items) {
        const fullItem = libraryItems.find((i) => i.id === book.id);
        if (!fullItem) continue;

        // Skip if has listening progress or finished
        const progress = fullItem.userMediaProgress?.progress || 0;
        if (progress > 0 || isFinished(book.id)) continue;

        // Skip mid-series books
        const metadata = getBookMetadata(fullItem);
        const seriesInfo = metadata?.series?.[0];
        const sequence = seriesInfo?.sequence;
        if (sequence && parseFloat(sequence) > 1) continue;

        return {
          item: fullItem,
          source: 'recommendation' as const,
        };
      }
    }

    // Fallback: First unfinished book from library
    for (const item of libraryItems) {
      const progress = item.userMediaProgress?.progress || 0;
      if (!isFinished(item.id) && progress < 0.95) {
        return {
          item,
          source: 'library' as const,
        };
      }
    }

    return null;
  }, [recommendationRows, libraryItems, isFinished]);

  // Get book details
  const book = topPickData?.item;
  const bookId = book?.id || '';
  const metadata = book ? getBookMetadata(book) : null;
  const coverUrl = book ? apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 }) : null;
  const duration = book ? getBookDuration(book) : 0;
  const progress = book?.userMediaProgress?.progress || 0;
  const chapterCount = book ? getChapterCount(book) : 0;

  // Split title for display
  const title = metadata?.title || 'Unknown';
  const { line1, line2 } = splitTitle(title);
  const author = metadata?.authorName || 'Unknown Author';
  const narrator = metadata?.narratorName || '';
  const genres = metadata?.genres || [];
  const publishedYear = metadata?.publishedYear || '';

  // Series info
  const seriesInfo = metadata?.series?.[0];

  // Get cached spine data for typography (same as book detail page)
  const cachedSpineData = useSpineCacheStore((s) => s.cache.get(bookId));

  // Get spine typography - USE CACHED TYPOGRAPHY for consistency
  // This ensures browse hero shows the EXACT same font as the book spine on home screen
  const spineTypography = useMemo(() => {
    // FIRST: Use pre-computed typography from spine cache (computed at app startup)
    if (cachedSpineData?.typography) {
      return cachedSpineData.typography;
    }

    // FALLBACK: Recalculate if not in cache
    const seriesName = cachedSpineData?.seriesName || seriesInfo?.name;

    // Check if in a series AND has cached series name
    if (seriesName) {
      const seriesStyle = getSeriesStyle(seriesName);
      if (seriesStyle?.typography) {
        return seriesStyle.typography;
      }
    }

    // Genre-based typography (fallback path)
    return getTypographyForGenres(genres, bookId);
  }, [cachedSpineData?.typography, cachedSpineData?.seriesName, seriesInfo?.name, genres, bookId]);

  // Use spine typography fontFamily directly
  const titleFontFamily = spineTypography.fontFamily || Platform.select({ ios: 'Georgia', android: 'serif' });
  const titleFontWeight = spineTypography.titleWeight || spineTypography.fontWeight || '500';
  const titleTransform = spineTypography.titleTransform || 'none';

  // Apply text transform to title
  const { displayLine1, displayLine2 } = useMemo(() => {
    if (titleTransform === 'uppercase') {
      return { displayLine1: line1.toUpperCase(), displayLine2: line2.toUpperCase() };
    }
    return { displayLine1: line1, displayLine2: line2 };
  }, [line1, line2, titleTransform]);

  // Download status
  const {
    isDownloaded,
    isDownloading,
    isPending,
    isPaused,
    progress: downloadProgress,
  } = useDownloadStatus(book?.id || '');

  // Check if this book is currently loaded and playing
  const isCurrentBook = currentBook?.id === book?.id;
  const isCurrentlyPlaying = isCurrentBook && isPlaying;

  // Handle cover press
  const handleCoverPress = useCallback(() => {
    if (!book) return;
    haptics.selection();
    onBookPress?.(book.id);
  }, [book, onBookPress]);

  // Handle author press
  const handleAuthorPress = useCallback(() => {
    if (!author) return;
    haptics.selection();
    navigation.navigate('AuthorDetail', { authorName: author });
  }, [author, navigation]);

  // Handle series press
  const handleSeriesPress = useCallback(() => {
    if (!seriesInfo?.name) return;
    haptics.selection();
    navigation.navigate('SeriesDetail', { seriesName: seriesInfo.name });
  }, [seriesInfo, navigation]);

  // Handle narrator press
  const handleNarratorPress = useCallback((narratorName: string) => {
    haptics.selection();
    navigation.navigate('NarratorDetail', { narratorName: narratorName.trim() });
  }, [navigation]);

  // Handle genre press
  const handleGenrePress = useCallback((genre: string) => {
    haptics.selection();
    navigation.navigate('GenreDetail', { genreName: genre });
  }, [navigation]);

  // Handle play button
  const handlePlay = useCallback(async () => {
    if (!book) return;
    haptics.buttonPress();

    if (isCurrentlyPlaying) {
      await pause();
      return;
    }

    if (isCurrentBook) {
      await play();
      return;
    }

    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      navigation.navigate('BookDetail', { id: book.id });
    }
  }, [book, loadBook, navigation, isCurrentlyPlaying, isCurrentBook, play, pause]);

  // Handle download button
  const handleDownload = useCallback(async () => {
    if (!book) return;
    haptics.buttonPress();

    if (isDownloaded) return;

    if (isDownloading) {
      haptics.toggle();
      await downloadManager.pauseDownload(book.id);
      return;
    }

    if (isPaused) {
      haptics.toggle();
      await downloadManager.resumeDownload(book.id);
      return;
    }

    if (isPending) {
      haptics.warning();
      await downloadManager.cancelDownload(book.id);
      return;
    }

    try {
      const fullBook = await apiClient.getItem(book.id);
      haptics.success();
      await downloadManager.queueDownload(fullBook);
    } catch {
      // Silent fail
    }
  }, [book, isDownloaded, isDownloading, isPaused, isPending]);

  // Don't render if no book
  if (!isLoaded || !book || !metadata) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Label - matches Your Taste styling */}
      <View style={styles.header}>
        <Text style={styles.title}><Text style={styles.titleItalic}>Top Pick</Text></Text>
      </View>

      {/* Hero Section - Centered like book detail */}
      <View style={styles.hero}>
        {/* Centered Cover */}
        <TouchableOpacity style={styles.heroCover} onPress={handleCoverPress} activeOpacity={0.9}>
          <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
        </TouchableOpacity>

        {/* Title + Author inline row with circle buttons */}
        <View style={styles.titleRow}>
          <View style={styles.titleInfo}>
            <Text
              style={[
                styles.titleInline,
                {
                  fontFamily: titleFontFamily,
                  fontWeight: titleFontWeight as any,
                }
              ]}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {displayLine1}{displayLine2 ? ` ${displayLine2}` : ''}
            </Text>
            <TouchableOpacity onPress={handleAuthorPress} activeOpacity={0.7}>
              <Text style={styles.authorInline}>{author}</Text>
            </TouchableOpacity>
            {/* Series Link */}
            {seriesInfo && (
              <TouchableOpacity onPress={handleSeriesPress} activeOpacity={0.7}>
                <Text style={styles.seriesLink}>
                  {seriesInfo.name}{seriesInfo.sequence ? ` · Book ${seriesInfo.sequence}` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Circle Buttons */}
          <View style={styles.circleButtons}>
            {/* Download Circle */}
            <TouchableOpacity
              style={[
                styles.circleBtn,
                (isDownloaded || isDownloading || isPaused) && styles.circleBtnActive,
              ]}
              onPress={handleDownload}
              disabled={isDownloaded}
            >
              {isDownloaded ? (
                <CheckIcon color={secretLibraryColors.black} size={20} />
              ) : (
                <DownloadIcon color={secretLibraryColors.white} size={20} />
              )}
            </TouchableOpacity>

            {/* Play Circle */}
            <TouchableOpacity style={[styles.circleBtn, styles.circleBtnActive]} onPress={handlePlay}>
              {isCurrentlyPlaying ? (
                <PauseIcon color={secretLibraryColors.black} size={20} />
              ) : (
                <PlayIcon color={secretLibraryColors.black} size={20} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: secretLibraryColors.black,
    paddingBottom: scale(8),
  },
  // Header - matches TasteTextList
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    paddingTop: 8,
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

  // Hero - Centered cover, left-aligned text
  hero: {
    alignItems: 'center',
    paddingTop: scale(8),
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
  },
  heroCover: {
    width: scale(280),
    height: scale(280),
    marginTop: scale(8),
    marginBottom: scale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },

  // Title row - inline with circle buttons
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  titleInfo: {
    flex: 1,
    marginRight: scale(16),
  },
  titleInline: {
    fontSize: scale(22),
    letterSpacing: 0.3,
    color: secretLibraryColors.white,
    lineHeight: scale(26),
    marginBottom: scale(4),
  },
  authorInline: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: secretLibraryColors.gray,
    marginBottom: scale(4),
  },
  seriesLink: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(13),
    fontStyle: 'italic',
    color: secretLibraryColors.gray,
    textDecorationLine: 'underline',
    marginTop: scale(2),
  },

  // Circle buttons
  circleButtons: {
    flexDirection: 'row',
    gap: scale(12),
  },
  circleBtn: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: 1,
    borderColor: secretLibraryColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnActive: {
    backgroundColor: secretLibraryColors.white,
    borderColor: secretLibraryColors.white,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: scale(24),
    marginTop: scale(16),
  },

  // Match percent
  matchPercent: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: secretLibraryColors.gold,
    marginTop: scale(8),
    fontWeight: '600',
  },

  // Genre Pills
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginTop: scale(12),
  },
  genrePill: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderWidth: 1,
    borderColor: secretLibraryColors.gray,
    borderRadius: scale(16),
  },
  genrePillText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: secretLibraryColors.grayLight,
  },

  // Meta Grid
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: secretLibraryColors.gray,
    marginHorizontal: scale(24),
  },
  metaItem: {
    flex: 2,
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  metaItemRight: {
    flex: 1,
    paddingVertical: scale(16),
    alignItems: 'center',
    borderLeftWidth: 1,
    borderColor: secretLibraryColors.gray,
  },
  metaLabel: {
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: secretLibraryColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginBottom: scale(4),
  },
  metaValue: {
    fontSize: scale(16),
    fontWeight: '600',
    color: secretLibraryColors.white,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },

});
