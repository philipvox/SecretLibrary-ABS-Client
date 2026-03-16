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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { PlayIcon, PauseIcon } from '@/features/player/components/PlayerIcons';
import { useNavigation } from '@react-navigation/native';
import { secretLibraryColors, secretLibraryDarkColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { apiClient } from '@/core/api';
import { CoverStars } from '@/shared/components/CoverStars';
import { haptics } from '@/core/native/haptics';
import { usePlayerStore } from '@/features/player';
import { usePersonalizedContent } from '@/features/discover/hooks/usePersonalizedContent';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { LibraryItem, BookMetadata } from '@/core/types';
import { useSpineCacheStore, getTypographyForGenres, getSeriesStyle } from '@/shared/spine';
import { useProgressStore, useIsInLibrary } from '@/core/stores/progressStore';

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

const _LibraryPlusIcon = ({ color = '#000', size = 14 }: IconProps) => (
  <Svg width={size * 1.5} height={size} viewBox="0 0 36 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    {/* Library books (shifted left) */}
    <Path d="m12 6 4 14" />
    <Path d="M8 6v14" />
    <Path d="M4 8v12" />
    <Path d="M0 4v16" />
    {/* Plus sign (right side, large) */}
    <Path d="M28 12v0M24 12h8" strokeWidth={3} />
    <Path d="M28 8v8" strokeWidth={3} />
  </Svg>
);

const _LibraryCheckIcon = ({ color = '#000', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {/* Library books */}
    <Path d="m16 6 4 14" />
    <Path d="M12 6v14" />
    <Path d="M8 8v12" />
    <Path d="M4 4v16" />
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

function _formatDuration(seconds: number): string {
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
  items: LibraryItem[];
  onBookPress?: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
  variant?: 'forYou' | 'discover';
  headerHeight?: number;
  onCoverUrl?: (url: string | null) => void;
}

export function TopPickHero({ items, onBookPress, onBookLongPress, variant = 'forYou', headerHeight, onCoverUrl }: TopPickHeroProps) {
  const renderStart = useRef(Date.now());
  const navigation = useNavigation<any>();

  // Library data
  const cacheStart = Date.now();
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
    if (!items.length) return () => true;
    return createSeriesFilter({ allItems: items, isFinished, hasStarted: hasBeenStarted });
  }, [items, isFinished, hasBeenStarted]);

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
    libraryItems: items,
    isLoaded: items.length > 0,
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
    // For discover variant: pick an unstarted book from deeper in recommendations
    // to surface a "hidden gem" rather than the obvious top pick
    const startIndex = variant === 'discover' ? 2 : 0;

    // Find first valid book from recommendation rows
    for (let rowIdx = startIndex; rowIdx < recommendationRows.length; rowIdx++) {
      const row = recommendationRows[rowIdx];
      for (const book of row.items) {
        const fullItem = items.find((i) => i.id === book.id);
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

    // Fallback: Newest unfinished book by publication date
    const unfinishedItems = items.filter((item) => {
      const progress = item.userMediaProgress?.progress || 0;
      return !isFinished(item.id) && progress < 0.95;
    });

    // Sort by publication year (newest first), then by addedAt as tiebreaker
    const sortedByPublishDate = [...unfinishedItems].sort((a, b) => {
      const metaA = getBookMetadata(a);
      const metaB = getBookMetadata(b);

      // Parse publication year (can be string like "2023" or number)
      const yearA = metaA?.publishedYear ? parseInt(String(metaA.publishedYear), 10) : 0;
      const yearB = metaB?.publishedYear ? parseInt(String(metaB.publishedYear), 10) : 0;

      // Sort newest first
      if (yearB !== yearA) return yearB - yearA;

      // Tiebreaker: most recently added to library
      return (b.addedAt || 0) - (a.addedAt || 0);
    });

    if (sortedByPublishDate.length > 0) {
      return {
        item: sortedByPublishDate[0],
        source: 'library' as const,
      };
    }

    return null;
  }, [recommendationRows, items, isFinished, variant]);

  // Get book details
  const book = topPickData?.item;
  const bookId = book?.id || '';
  const metadata = book ? getBookMetadata(book) : null;
  const coverUrl = book ? apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 }) : null;

  // Report cover URL to parent for fixed blur background
  useEffect(() => {
    onCoverUrl?.(coverUrl);
  }, [coverUrl, onCoverUrl]);

  const _duration = book ? getBookDuration(book) : 0;
  const _progress = book?.userMediaProgress?.progress || 0;
  const _chapterCount = book ? getChapterCount(book) : 0;

  // Split title for display
  const title = metadata?.title || 'Unknown';
  const { line1, line2 } = splitTitle(title);
  const author = metadata?.authorName || 'Unknown Author';
  const narrator = metadata?.narratorName || '';
  const genres = metadata?.genres || [];
  const _publishedYear = metadata?.publishedYear || '';

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
  const _titleFontFamily = spineTypography.fontFamily || Platform.select({ ios: 'Georgia', android: 'serif' });
  const _titleFontWeight = spineTypography.titleWeight || spineTypography.fontWeight || '500';
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
    progress: _downloadProgress,
  } = useDownloadStatus(book?.id || '');

  // Library membership state
  const isInLibrary = useIsInLibrary(bookId);
  const addToLibrary = useProgressStore((s) => s.addToLibrary);
  const removeFromLibrary = useProgressStore((s) => s.removeFromLibrary);

  // Check if this book is currently loaded and playing
  const isCurrentBook = currentBook?.id === book?.id;
  const isCurrentlyPlaying = isCurrentBook && isPlaying;

  // Handle cover press
  const handleCoverPress = useCallback(() => {
    if (!book) return;
    haptics.selection();
    onBookPress?.(book.id);
  }, [book, onBookPress]);

  // Handle cover long press
  const handleCoverLongPress = useCallback(() => {
    if (!book) return;
    onBookLongPress?.(book.id);
  }, [book, onBookLongPress]);

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
  const _handleGenrePress = useCallback((genre: string) => {
    haptics.selection();
    navigation.navigate('GenreDetail', { genreName: genre });
  }, [navigation]);

  // Handle play button
  // FIX: Don't await play/pause for instant UI response
  const handlePlay = useCallback(async () => {
    if (!book) return;
    haptics.buttonPress();

    if (isCurrentlyPlaying) {
      pause(); // Fire and forget - instant response
      return;
    }

    if (isCurrentBook) {
      play(); // Fire and forget - instant response
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

  // Handle library toggle
  const handleLibraryToggle = useCallback(async () => {
    if (!book) return;
    haptics.buttonPress();
    if (isInLibrary) {
      await removeFromLibrary(book.id);
    } else {
      await addToLibrary(book.id);
    }
  }, [book, isInLibrary, addToLibrary, removeFromLibrary]);

  // Don't render if no book
  if (!book || !metadata) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Feathered bottom — fades blur into background, behind content */}
      <LinearGradient
        colors={['transparent', secretLibraryDarkColors.white]}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      {/* Hero Section - Centered like book detail */}
      <View style={[styles.hero, headerHeight ? { paddingTop: headerHeight + scale(20) } : undefined]}>
        {/* Centered Cover */}
        <TouchableOpacity style={styles.heroCover} onPress={handleCoverPress} onLongPress={handleCoverLongPress} activeOpacity={0.9}>
          <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
          <CoverStars bookId={bookId} starSize={scale(28)} />
        </TouchableOpacity>

        {/* Title + Author */}
        <View style={styles.titleSection}>
          <Text
            style={styles.titleText}
            numberOfLines={2}
          >
            {displayLine1}{displayLine2 ? ` ${displayLine2}` : ''}
          </Text>
          <Text style={styles.authorNarratorText} numberOfLines={1}>
            <Text style={styles.authorText} onPress={handleAuthorPress}>{author}</Text>
            {narrator ? (
              <>
                <Text style={styles.authorSeparator}>  •  </Text>
                <Text style={styles.narratorText} onPress={() => handleNarratorPress(narrator)}>{narrator}</Text>
              </>
            ) : null}
          </Text>
          {/* Series Link */}
          {seriesInfo && (
            <TouchableOpacity onPress={handleSeriesPress} activeOpacity={0.7}>
              <Text style={styles.seriesLink}>
                {seriesInfo.name}{seriesInfo.sequence ? ` · Book ${seriesInfo.sequence}` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons — clear hierarchy: Play primary, Download secondary, Library tertiary */}
        <View style={styles.actionButtons}>
          {/* Play Button — Primary (solid fill) */}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handlePlay}>
            {isCurrentlyPlaying ? (
              <PauseIcon color={secretLibraryColors.black} size={14} />
            ) : (
              <PlayIcon color={secretLibraryColors.black} size={14} />
            )}
            <Text style={styles.actionBtnPrimaryText}>
              {isCurrentlyPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          {/* Download Button — Secondary (outline) */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnSecondary,
              isDownloaded && styles.actionBtnPrimary,
            ]}
            onPress={handleDownload}
            disabled={isDownloaded}
          >
            {isDownloaded ? (
              <CheckIcon color={secretLibraryColors.black} size={14} />
            ) : (
              <DownloadIcon color={secretLibraryColors.white} size={14} />
            )}
            <Text style={[styles.actionBtnSecondaryText, isDownloaded && styles.actionBtnPrimaryText]}>
              {isDownloaded ? 'Saved' : 'Download'}
            </Text>
          </TouchableOpacity>

          {/* Library Button — Tertiary (text only) */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnTertiary]}
            onPress={handleLibraryToggle}
          >
            <Text style={[styles.actionBtnTertiaryText, isInLibrary && { color: secretLibraryColors.gold }]}>
              {isInLibrary ? 'In Library' : '+ Library'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    backgroundColor: 'transparent',
    paddingBottom: scale(8),
  },
  bottomFade: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: scale(12),
    marginBottom: scale(4),
    alignItems: 'center' as const,
  },
  sectionLabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(11),
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center' as const,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // Hero - Centered cover, left-aligned text
  hero: {
    alignItems: 'center',
    paddingTop: scale(8),
    paddingHorizontal: 16,
    paddingBottom: scale(20),
  },
  heroCover: {
    width: '85%',
    aspectRatio: 1,
    marginTop: scale(8),
    marginBottom: scale(24),
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },

  // Title section - centered
  titleSection: {
    alignItems: 'center',
    width: '80%',
  },
  titleText: {
    fontFamily: secretLibraryFonts.playfair.bold,
    fontSize: scale(22),
    fontWeight: '700',
    letterSpacing: 0.3,
    color: secretLibraryColors.white,
    lineHeight: scale(28),
    marginBottom: scale(6),
    textAlign: 'center',
  },
  authorNarratorText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: secretLibraryColors.gray,
    textAlign: 'center' as const,
    marginBottom: scale(4),
  },
  authorText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: secretLibraryColors.gray,
  },
  authorSeparator: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: secretLibraryColors.gray,
  },
  narratorText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: secretLibraryColors.gray,
  },
  seriesLink: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(13),
    fontStyle: 'italic',
    color: secretLibraryColors.gray,
    textDecorationLine: 'underline',
    marginTop: scale(4),
  },

  // Action buttons — hierarchy: primary (solid), secondary (outline), tertiary (text)
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    marginTop: scale(20),
    width: '100%',
    paddingHorizontal: scale(16),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(10),
    borderRadius: scale(6),
    gap: scale(6),
  },
  actionBtnPrimary: {
    flex: 1.2,
    backgroundColor: secretLibraryColors.white,
  },
  actionBtnPrimaryText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(12),
    color: secretLibraryColors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionBtnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  actionBtnSecondaryText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: secretLibraryColors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionBtnTertiary: {
    paddingHorizontal: scale(8),
  },
  actionBtnTertiaryText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(20),
    paddingTop: scale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  statLabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: secretLibraryColors.gray,
    marginBottom: scale(4),
  },
  statValue: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(16),
    fontWeight: '600',
    color: secretLibraryColors.white,
  },
  statDivider: {
    width: 1,
    height: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    marginHorizontal: 16,
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
