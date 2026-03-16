/**
 * src/features/player/sheets/ChaptersSheet.tsx
 *
 * Chapters panel - Editorial design with book info, progress bar, chapter list, and fuzzy search.
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Animated,
  TextInput,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { haptics } from '@/core/native/haptics';
import { scale } from '@/shared/theme';
import { useCoverUrl } from '@/core/cache';
import { usePlayerStore } from '../stores';
import {
  secretLibraryColors as colors,
} from '@/shared/theme/secretLibrary';

// =============================================================================
// ICONS
// =============================================================================

const CheckIcon = ({ color = colors.gray, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

const SearchIcon = ({ color = colors.black, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Circle cx={11} cy={11} r={8} />
    <Path d="M21 21l-4.35-4.35" />
  </Svg>
);

const PlayIcon = ({ color = colors.white, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M5 3l14 9-14 9V3z" />
  </Svg>
);

const CloseIcon = ({ color = colors.black, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

// =============================================================================
// TYPES
// =============================================================================

export interface ChapterData {
  id?: number;
  title: string;
  start: number;
  end: number;
  displayTitle?: string;
}

interface ChaptersSheetProps {
  chapters: ChapterData[];
  currentChapterIndex: number;
  onChapterSelect: (start: number) => void;
  onClose: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

function getBookInitials(title: string): string {
  return title
    .split(' ')
    .slice(0, 3)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Simple fuzzy search - checks if all characters in query appear in text in order.
 * Returns a score (higher is better match), or -1 if no match.
 */
function fuzzyMatch(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase().trim();

  if (!queryLower) return 1; // Empty query matches everything

  // Check for exact substring match first (highest score)
  if (textLower.includes(queryLower)) {
    return 100 + (100 - textLower.indexOf(queryLower)); // Earlier match = higher score
  }

  // Fuzzy match: all query chars must appear in order
  let textIndex = 0;
  let queryIndex = 0;
  let score = 0;
  let consecutiveBonus = 0;

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      score += 1 + consecutiveBonus;
      consecutiveBonus += 0.5; // Bonus for consecutive matches
      queryIndex++;
    } else {
      consecutiveBonus = 0;
    }
    textIndex++;
  }

  // All query characters must be found
  if (queryIndex < queryLower.length) {
    return -1; // No match
  }

  return score;
}

// =============================================================================
// COMPONENTS
// =============================================================================

// Playing indicator animation
function PlayingIndicator() {
  const bar1 = useRef(new Animated.Value(0.6)).current;
  const bar2 = useRef(new Animated.Value(1)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.5,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(bar1, 0);
    animate(bar2, 200);
    animate(bar3, 400);
  }, [bar1, bar2, bar3]);

  return (
    <View style={styles.playingIndicator}>
      <Animated.View style={[styles.playingBar, { transform: [{ scaleY: bar1 }] }]} />
      <Animated.View style={[styles.playingBar, { transform: [{ scaleY: bar2 }] }]} />
      <Animated.View style={[styles.playingBar, { transform: [{ scaleY: bar3 }] }]} />
    </View>
  );
}

// Chapter item component
function ChapterItem({
  chapter,
  index,
  isComplete,
  isCurrent,
  chapterProgress,
  onSelect,
  _highlightText,
}: {
  chapter: ChapterData;
  index: number;
  isComplete: boolean;
  isCurrent: boolean;
  chapterProgress?: number;
  onSelect: () => void;
  highlightText?: string;
}) {
  const chapterDuration = chapter.end - chapter.start;
  const chapterNumber = String(index + 1).padStart(2, '0');
  const displayTitle = chapter.displayTitle || chapter.title || `Chapter ${index + 1}`;

  return (
    <TouchableOpacity
      style={[
        styles.chapterItem,
        isCurrent && styles.chapterItemCurrent,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.chapterNumber,
        isComplete && !isCurrent && styles.chapterNumberComplete,
        isCurrent && styles.chapterNumberCurrent,
      ]}>
        {chapterNumber}
      </Text>
      <View style={styles.chapterInfo}>
        <Text
          style={[
            styles.chapterTitle,
            isComplete && !isCurrent && styles.chapterTitleComplete,
            isCurrent && styles.chapterTitleCurrent,
          ]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
        {isCurrent && chapterProgress !== undefined && (
          <Text style={styles.chapterSubtitle}>
            {Math.round(chapterProgress * 100)}% · {formatDuration(chapterDuration * (1 - chapterProgress))} remaining
          </Text>
        )}
      </View>
      <Text style={[
        styles.chapterDuration,
        isCurrent && styles.chapterDurationCurrent,
      ]}>
        {formatDuration(chapterDuration)}
      </Text>
      <View style={styles.chapterStatus}>
        {isComplete && !isCurrent && (
          <CheckIcon color={colors.grayLine} size={16} />
        )}
        {isCurrent && <PlayingIndicator />}
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ChaptersSheet({
  chapters,
  currentChapterIndex,
  onChapterSelect,
  onClose,
}: ChaptersSheetProps) {
  const currentBook = usePlayerStore((s) => s.currentBook);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const coverUrl = useCoverUrl(currentBook?.id || '');

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const bookTitle = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';

  // Calculate progress
  const bookProgress = duration > 0 ? position / duration : 0;
  const timeRemaining = duration - position;
  const completedChapters = currentChapterIndex;
  const totalChapters = chapters.length;

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return chapters.reduce((acc, ch) => acc + (ch.end - ch.start), 0);
  }, [chapters]);

  // Current chapter progress
  const currentChapter = chapters[currentChapterIndex];
  const chapterProgress = currentChapter
    ? (position - currentChapter.start) / (currentChapter.end - currentChapter.start)
    : 0;

  // Calculate time listened
  const timeListened = position;

  // Filter chapters based on search query (fuzzy search)
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) {
      return chapters.map((ch, idx) => ({ chapter: ch, originalIndex: idx }));
    }

    return chapters
      .map((chapter, originalIndex) => {
        const title = chapter.displayTitle || chapter.title || `Chapter ${originalIndex + 1}`;
        const score = fuzzyMatch(title, searchQuery);
        return { chapter, originalIndex, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ chapter, originalIndex }) => ({ chapter, originalIndex }));
  }, [chapters, searchQuery]);

  const handleChapterSelect = useCallback((start: number) => {
    haptics.selection();
    onChapterSelect(start);
    onClose();
  }, [onChapterSelect, onClose]);

  const handleResume = useCallback(() => {
    haptics.selection();
    onClose();
  }, [onClose]);

  const handleSearchToggle = useCallback(() => {
    haptics.selection();
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
    } else {
      setIsSearching(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearching]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Chapters</Text>
        <Text style={styles.subtitle}>
          {totalChapters} chapters · {formatTotalDuration(totalDuration)}
        </Text>
      </View>

      {/* Search Bar (when active) */}
      {isSearching ? (
        <View style={styles.searchBar}>
          <View style={styles.searchInputContainer}>
            <SearchIcon color={colors.gray} size={14} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search chapters..."
              placeholderTextColor={colors.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <CloseIcon color={colors.gray} size={12} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchCancelBtn} onPress={handleSearchToggle}>
            <Text style={styles.searchCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Book Info */}
          <View style={styles.bookInfo}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.bookCover} contentFit="cover" />
            ) : (
              <View style={[styles.bookCover, styles.bookCoverFallback]}>
                <Text style={styles.bookCoverInitials}>{getBookInitials(bookTitle)}</Text>
              </View>
            )}
            <View style={styles.bookText}>
              <Text style={styles.bookTitle} numberOfLines={1}>{bookTitle}</Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>{author}</Text>
            </View>
            <View style={styles.bookProgress}>
              <Text style={styles.bookPercent}>{Math.round(bookProgress * 100)}%</Text>
              <Text style={styles.bookTime}>{formatTotalDuration(timeRemaining)} left</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${bookProgress * 100}%` }]} />
            </View>
            <View style={styles.progressLabel}>
              <Text style={styles.progressText}>
                {completedChapters} of {totalChapters} complete
              </Text>
              <Text style={styles.progressText}>
                {formatTotalDuration(timeListened)} listened
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Chapter List */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredChapters.length === 0 ? (
          <View style={styles.emptySearch}>
            <Text style={styles.emptySearchText}>No chapters found</Text>
            <Text style={styles.emptySearchSubtext}>Try a different search term</Text>
          </View>
        ) : (
          filteredChapters.map(({ chapter, originalIndex }) => (
            <ChapterItem
              key={chapter.id || originalIndex}
              chapter={chapter}
              index={originalIndex}
              isComplete={originalIndex < currentChapterIndex}
              isCurrent={originalIndex === currentChapterIndex}
              chapterProgress={originalIndex === currentChapterIndex ? chapterProgress : undefined}
              onSelect={() => handleChapterSelect(chapter.start)}
              highlightText={searchQuery}
            />
          ))
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.actionButton, isSearching && styles.actionButtonActive]}
          onPress={handleSearchToggle}
          activeOpacity={0.7}
        >
          <SearchIcon color={isSearching ? colors.white : colors.black} size={14} />
          <Text style={[styles.actionButtonText, isSearching && styles.actionButtonTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleResume}
          activeOpacity={0.7}
        >
          <PlayIcon color={colors.white} size={14} />
          <Text style={styles.actionButtonTextPrimary}>Resume</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.creamGray,
    paddingBottom: scale(40),
  },
  handle: {
    width: scale(36),
    height: scale(4),
    backgroundColor: colors.grayLine,
    borderRadius: scale(2),
    alignSelf: 'center',
    marginTop: scale(12),
    marginBottom: scale(16),
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: scale(28),
    marginBottom: scale(16),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(28),
    fontWeight: '400',
    color: colors.black,
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: colors.gray,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginHorizontal: scale(28),
    marginBottom: scale(16),
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    height: scale(44),
    paddingHorizontal: scale(14),
    backgroundColor: colors.grayLight,
    borderWidth: 1,
    borderColor: colors.grayLine,
  },
  searchInput: {
    flex: 1,
    fontSize: scale(14),
    color: colors.black,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  searchCancelBtn: {
    paddingVertical: scale(8),
  },
  searchCancelText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.black,
  },

  // Empty Search
  emptySearch: {
    alignItems: 'center',
    paddingVertical: scale(48),
  },
  emptySearchText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.black,
    marginBottom: scale(4),
  },
  emptySearchSubtext: {
    fontSize: scale(13),
    color: colors.gray,
  },

  // Book Info
  bookInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    marginHorizontal: scale(28),
    marginBottom: scale(16),
    padding: scale(14),
    backgroundColor: colors.grayLight,
  },
  bookCover: {
    width: scale(48),
    height: scale(48),
  },
  bookCoverFallback: {
    backgroundColor: colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCoverInitials: {
    fontSize: scale(14),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.3)',
  },
  bookText: {
    flex: 1,
    minWidth: 0,
  },
  bookTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(14),
    color: colors.black,
    marginBottom: scale(2),
  },
  bookAuthor: {
    fontSize: scale(11),
    color: colors.gray,
  },
  bookProgress: {
    alignItems: 'flex-end',
  },
  bookPercent: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(20),
    fontStyle: 'italic',
    color: colors.black,
  },
  bookTime: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(9),
    color: colors.gray,
  },

  // Progress Bar
  progressSection: {
    marginHorizontal: scale(28),
    marginBottom: scale(16),
  },
  progressBar: {
    height: scale(3),
    backgroundColor: colors.grayLine,
    marginBottom: scale(8),
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.black,
  },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(9),
    color: colors.gray,
  },

  // Chapter List
  scrollContent: {
    maxHeight: scale(300),
    paddingHorizontal: scale(28),
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLine,
  },
  chapterItemCurrent: {
    backgroundColor: colors.black,
    marginHorizontal: scale(-28),
    paddingHorizontal: scale(28),
    borderBottomColor: colors.black,
  },
  chapterNumber: {
    width: scale(28),
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(16),
    fontStyle: 'italic',
    color: colors.gray,
  },
  chapterNumberComplete: {
    color: colors.grayLine,
  },
  chapterNumberCurrent: {
    color: colors.white,
  },
  chapterInfo: {
    flex: 1,
    minWidth: 0,
  },
  chapterTitle: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.black,
  },
  chapterTitleComplete: {
    color: colors.gray,
  },
  chapterTitleCurrent: {
    color: colors.white,
  },
  chapterSubtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.6)',
    marginTop: scale(2),
  },
  chapterDuration: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: colors.gray,
  },
  chapterDurationCurrent: {
    color: 'rgba(255,255,255,0.6)',
  },
  chapterStatus: {
    width: scale(20),
    alignItems: 'center',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: scale(2),
    height: scale(14),
  },
  playingBar: {
    width: scale(3),
    height: scale(14),
    backgroundColor: colors.white,
    borderRadius: scale(1),
  },

  // Bottom Actions
  bottomActions: {
    paddingHorizontal: scale(28),
    paddingTop: scale(16),
    borderTopWidth: 1,
    borderTopColor: colors.grayLine,
    flexDirection: 'row',
    gap: scale(8),
  },
  actionButton: {
    flex: 1,
    height: scale(44),
    borderWidth: 1,
    borderColor: colors.grayLine,
    backgroundColor: colors.grayLight,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
  },
  actionButtonActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  actionButtonPrimary: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  actionButtonText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.black,
  },
  actionButtonTextActive: {
    color: colors.white,
  },
  actionButtonTextPrimary: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.white,
  },
});

export default ChaptersSheet;
