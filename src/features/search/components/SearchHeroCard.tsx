/**
 * src/features/search/components/SearchHeroCard.tsx
 *
 * Featured book hero card for the Search screen idle state.
 * Picks a random unstarted book, session-stable via useRef.
 * Blurred cover background, tag pill, metadata, and action buttons.
 */

import React, { useCallback, useMemo, useRef } from 'react';
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
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { apiClient } from '@/core/api';
import { haptics } from '@/core/native/haptics';
import { usePlayerStore } from '@/features/player';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { useProgressStore, useIsInLibrary } from '@/core/stores/progressStore';
import { LibraryItem, BookMetadata } from '@/core/types';
import { useKidModeStore } from '@/shared/stores/kidModeStore';

// Kids genre keywords — used to exclude children's books when kid mode is off
const KIDS_GENRES = ['children', "children's", 'childrens', 'kids', 'middle grade', 'picture books', 'juvenile', 'young readers'];

// Module-level counter: refreshes the pick every 3rd mount
let heroMountCount = 0;
const REFRESH_INTERVAL = 3;

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

interface ExtendedBookMetadata extends BookMetadata {
  narratorName?: string;
}

function getBookMetadata(item: LibraryItem): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

function getBookDuration(item: LibraryItem): number {
  return (item.media as any)?.duration || 0;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

// Vibe tags mapped to genres/tags keywords
const VIBE_POOLS: { tag: string; keywords: string[] }[] = [
  { tag: 'Cozy Listen', keywords: ['cozy', 'romance', 'feel-good', 'heartwarming', 'comfort'] },
  { tag: 'Edge of Your Seat', keywords: ['thriller', 'suspense', 'mystery', 'crime', 'detective'] },
  { tag: 'Epic Adventure', keywords: ['fantasy', 'adventure', 'epic', 'quest', 'sci-fi', 'science fiction'] },
  { tag: 'Mind Expanding', keywords: ['nonfiction', 'non-fiction', 'science', 'philosophy', 'psychology', 'history'] },
  { tag: 'Dark & Twisty', keywords: ['horror', 'gothic', 'dark', 'supernatural'] },
  { tag: 'Laugh Out Loud', keywords: ['humor', 'comedy', 'funny', 'humorous', 'satirical'] },
  { tag: 'For the Heart', keywords: ['memoir', 'biography', 'literary fiction', 'drama', 'family'] },
];

interface TaggedPool {
  tag: string;
  books: LibraryItem[];
}

function buildPools(items: LibraryItem[], kidModeEnabled: boolean): TaggedPool[] {
  const currentYear = new Date().getFullYear();
  const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;

  // Filter out kids books unless kid mode is on
  const filtered = kidModeEnabled ? items : items.filter((item) => {
    const meta = getBookMetadata(item);
    const genres = (meta?.genres || []).map((g) => g.toLowerCase());
    return !genres.some((g) => KIDS_GENRES.some((kg) => g.includes(kg)));
  });

  const unstarted = filtered.filter((item) => {
    const progress = item.userMediaProgress?.progress || 0;
    return progress === 0 && !item.userMediaProgress?.isFinished;
  });

  const pool = unstarted.length > 5 ? unstarted : filtered;
  const pools: TaggedPool[] = [];

  // New to Library
  const newToLibrary = pool.filter((item) => (item.addedAt || 0) > thirtyDaysAgo);
  if (newToLibrary.length > 0) pools.push({ tag: 'New to Library', books: newToLibrary });

  // New Releases
  const newReleases = pool.filter((item) => {
    const meta = getBookMetadata(item);
    const year = meta?.publishedYear ? parseInt(String(meta.publishedYear), 10) : 0;
    return year && currentYear - year <= 2;
  });
  if (newReleases.length > 0) pools.push({ tag: 'New Release', books: newReleases });

  // Vibe pools
  for (const vibe of VIBE_POOLS) {
    const matches = pool.filter((item) => {
      const meta = getBookMetadata(item);
      const genres = (meta?.genres || []).map((g) => g.toLowerCase());
      const tags = ((item.media as any)?.tags || []).map((t: string) => t.toLowerCase());
      const all = [...genres, ...tags];
      return vibe.keywords.some((kw) => all.some((g) => g.includes(kw)));
    });
    if (matches.length > 0) pools.push({ tag: vibe.tag, books: matches });
  }

  // Fallback — hidden gem from full pool
  if (pools.length === 0) {
    pools.push({ tag: 'Hidden Gem', books: pool.length > 0 ? pool : items });
  }

  return pools;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface SearchHeroCardProps {
  items: LibraryItem[];
  onBookPress?: (bookId: string) => void;
}

export const SearchHeroCard = React.memo(function SearchHeroCard({
  items,
  onBookPress,
}: SearchHeroCardProps) {
  const navigation = useNavigation<any>();
  const selectionRef = useRef<{ poolIdx: number; bookIdx: number } | null>(null);
  const kidModeEnabled = useKidModeStore((s) => s.enabled);

  // Refresh the pick every Nth mount
  const mountGenRef = useRef(heroMountCount);
  if (mountGenRef.current !== heroMountCount) {
    // New mount cycle — check if we should re-roll
    mountGenRef.current = heroMountCount;
  }
  // Increment on first render only
  const didIncrementRef = useRef(false);
  if (!didIncrementRef.current) {
    didIncrementRef.current = true;
    heroMountCount++;
    if (heroMountCount % REFRESH_INTERVAL === 0) {
      selectionRef.current = null; // Force re-roll
    }
  }

  // Player state
  const loadBook = usePlayerStore((s) => s.loadBook);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Build themed pools and pick one randomly, refreshes every 3rd mount
  const { book, tag } = useMemo(() => {
    if (!items.length) return { book: null, tag: '' };

    const pools = buildPools(items, kidModeEnabled);
    if (pools.length === 0) return { book: null, tag: '' };

    if (
      selectionRef.current === null ||
      selectionRef.current.poolIdx >= pools.length
    ) {
      const poolIdx = Math.floor(Math.random() * pools.length);
      const bookIdx = Math.floor(Math.random() * pools[poolIdx].books.length);
      selectionRef.current = { poolIdx, bookIdx };
    }

    const { poolIdx, bookIdx } = selectionRef.current;
    const selectedPool = pools[poolIdx % pools.length];
    const selectedBook = selectedPool.books[bookIdx % selectedPool.books.length];
    return { book: selectedBook, tag: selectedPool.tag };
  }, [items, kidModeEnabled]);

  const bookId = book?.id || '';
  const metadata = book ? getBookMetadata(book) : null;
  const coverUrl = book
    ? apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 })
    : null;
  const duration = book ? getBookDuration(book) : 0;
  const durationStr = formatDuration(duration);
  const title = metadata?.title || 'Unknown';
  const author = metadata?.authorName || 'Unknown Author';
  const narrator = metadata?.narratorName || '';

  // Download status
  const {
    isDownloaded,
    isDownloading,
    isPending,
    isPaused,
  } = useDownloadStatus(bookId);

  // Library membership
  const isInLibrary = useIsInLibrary(bookId);
  const addToLibrary = useProgressStore((s) => s.addToLibrary);
  const removeFromLibrary = useProgressStore((s) => s.removeFromLibrary);

  // Current book state
  const isCurrentBook = currentBook?.id === bookId;
  const isCurrentlyPlaying = isCurrentBook && isPlaying;

  // Handlers
  const handleCardPress = useCallback(() => {
    if (!book) return;
    haptics.selection();
    onBookPress?.(book.id);
  }, [book, onBookPress]);

  const handlePlay = useCallback(async () => {
    if (!book) return;
    haptics.buttonPress();

    if (isCurrentlyPlaying) {
      pause();
      return;
    }

    if (isCurrentBook) {
      play();
      return;
    }

    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      navigation.navigate('BookDetail', { id: book.id });
    }
  }, [book, loadBook, navigation, isCurrentlyPlaying, isCurrentBook, play, pause]);

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

  const handleLibraryToggle = useCallback(async () => {
    if (!book) return;
    haptics.buttonPress();
    if (isInLibrary) {
      await removeFromLibrary(book.id);
    } else {
      await addToLibrary(book.id);
    }
  }, [book, isInLibrary, addToLibrary, removeFromLibrary]);

  if (!book || !metadata || !coverUrl) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={handleCardPress}
    >
      {/* Blurred cover background */}
      <Image
        source={{ uri: coverUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={300}
        cachePolicy="memory-disk"
      />
      {/* Dark overlay gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.75)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: cover + metadata */}
        <View style={styles.topRow}>
          {/* Cover */}
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />

          {/* Metadata */}
          <View style={styles.meta}>
            {/* Tag pill */}
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>

            {/* Author · Narrator */}
            <Text style={styles.subtitle} numberOfLines={1}>
              {author}
              {narrator ? ` · ${narrator}` : ''}
            </Text>

            {/* Duration */}
            {durationStr ? (
              <Text style={styles.duration}>{durationStr}</Text>
            ) : null}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {/* Play — Primary */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={handlePlay}
          >
            {isCurrentlyPlaying ? (
              <PauseIcon color={secretLibraryColors.black} size={14} />
            ) : (
              <PlayIcon color={secretLibraryColors.black} size={14} />
            )}
            <Text style={styles.actionBtnPrimaryText}>
              {isCurrentlyPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          {/* Download — Secondary */}
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
            <Text
              style={[
                styles.actionBtnSecondaryText,
                isDownloaded && styles.actionBtnPrimaryText,
              ]}
            >
              {isDownloaded ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          {/* Library — Tertiary */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnTertiary]}
            onPress={handleLibraryToggle}
          >
            <Text
              style={[
                styles.actionBtnTertiaryText,
                isInLibrary && { color: secretLibraryColors.gold },
              ]}
            >
              {isInLibrary ? 'In Library' : '+ Library'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: scale(8),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  content: {
    padding: scale(16),
  },
  topRow: {
    flexDirection: 'row',
    gap: scale(14),
  },
  cover: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(6),
  },
  meta: {
    flex: 1,
    justifyContent: 'center',
    gap: scale(4),
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
    marginBottom: scale(2),
  },
  tagText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(9),
    color: secretLibraryColors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.bold,
    fontSize: scale(18),
    fontWeight: '700',
    color: secretLibraryColors.white,
    lineHeight: scale(22),
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.7)',
  },
  duration: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    marginTop: scale(14),
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
});
