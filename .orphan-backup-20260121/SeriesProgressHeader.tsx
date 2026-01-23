/**
 * src/features/series/components/SeriesProgressHeader.tsx
 *
 * Enhanced series progress header based on UX research.
 * Features:
 * - Progress dots (●●●○) with visual states
 * - Linear progress bar with percentage
 * - Time remaining estimate
 * - Dynamic context card with 4 states
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Trophy, RefreshCw, Play, CheckCircle } from 'lucide-react-native';
import { LibraryItem, BookMedia, BookMetadata, BookChapter } from '@/core/types';
import { useCoverUrl } from '@/core/cache';
import { scale, spacing, radius, useTheme } from '@/shared/theme';

// Type guard for FULL book media with audioFiles (needed for chapters)
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'audioFiles' in media && Array.isArray(media.audioFiles);
}

// Helper to get book metadata safely
// Note: Does NOT require audioFiles - works with cache items that only have metadata
function getBookMetadata(item: LibraryItem | null | undefined): BookMetadata | null {
  if (!item?.media?.metadata) return null;
  // This app only handles books, so metadata is always BookMetadata
  if (item.mediaType !== 'book') return null;
  return item.media.metadata as BookMetadata;
}

// Helper to get book duration safely
// Note: Does NOT require audioFiles - works with cache items that only have duration
function getBookDuration(item: LibraryItem | null | undefined): number {
  return item?.media?.duration || 0;
}

// Helper to get book chapters
// Note: Chapters require full book data (not available in cache items)
function getBookChapters(item: LibraryItem | null | undefined): BookChapter[] {
  if (!item?.media || !isBookMedia(item.media)) return [];
  return item.media.chapters || [];
}

interface SeriesProgressHeaderProps {
  books: LibraryItem[];
  completedCount: number;
  inProgressCount: number;
  nextBook: LibraryItem | null;
  currentBook?: LibraryItem | null;
  onNextBookPress: (book: LibraryItem) => void;
  onPlayPress?: (book: LibraryItem) => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimeRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `~${hours}h ${minutes}m remaining`;
  }
  return `~${minutes}m remaining`;
}

// Progress dot component - uses theme colors passed as props
interface ProgressDotProps {
  status: 'completed' | 'in_progress' | 'not_started';
  size?: number;
  accentColor: string;
  accentSubtle: string;
  inactiveColor: string;
}

function ProgressDot({
  status,
  size = 10,
  accentColor,
  accentSubtle,
  inactiveColor,
}: ProgressDotProps) {
  const getColor = () => {
    switch (status) {
      case 'completed':
        return accentColor;
      case 'in_progress':
        return accentSubtle;
      default:
        return inactiveColor;
    }
  };

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getColor(),
        },
      ]}
    />
  );
}

// Get raw sequence number for book - returns null if unknown
function getRawSequence(item: LibraryItem): number | null {
  const metadata = getBookMetadata(item);
  if (!metadata) return null;

  // First check series array (preferred - has explicit sequence)
  if (metadata.series && metadata.series.length > 0) {
    const primarySeries = metadata.series[0];
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  // Fallback: check seriesName for #N pattern
  const seriesName = metadata.seriesName || '';
  const match = seriesName.match(/#([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

// Check if a series has meaningful sequence numbers
function hasRealSequences(books: LibraryItem[]): boolean {
  if (books.length <= 1) return true;
  const sequences = books.map(getRawSequence).filter(s => s !== null);
  if (sequences.length === 0) return false;
  const uniqueSequences = new Set(sequences);
  return uniqueSequences.size > 1;
}

// Get sequence for display - returns null if this book shouldn't show a sequence
function getSequenceForDisplay(item: LibraryItem, allBooks: LibraryItem[]): number | null {
  if (!hasRealSequences(allBooks)) return null;
  return getRawSequence(item);
}

// Get book progress
function getBookProgress(book: LibraryItem): number {
  return book.userMediaProgress?.progress || 0;
}

// Get current chapter info
function getCurrentChapter(book: LibraryItem): { current: number; total: number } | null {
  const progress = book.userMediaProgress;
  if (!progress) return null;

  const chapters = getBookChapters(book);
  if (chapters.length === 0) return null;

  const currentTime = progress.currentTime || 0;
  let currentChapter = 1;

  for (let i = 0; i < chapters.length; i++) {
    if (currentTime >= chapters[i].start) {
      currentChapter = i + 1;
    }
  }

  return { current: currentChapter, total: chapters.length };
}

// Calculate series state
type SeriesState = 'not_started' | 'mid_book' | 'between_books' | 'completed';

function getSeriesState(
  books: LibraryItem[],
  completedCount: number,
  inProgressCount: number
): SeriesState {
  if (completedCount === books.length) {
    return 'completed';
  }
  if (inProgressCount > 0) {
    return 'mid_book';
  }
  if (completedCount > 0 && inProgressCount === 0) {
    return 'between_books';
  }
  return 'not_started';
}

export function SeriesProgressHeader({
  books,
  completedCount,
  inProgressCount,
  nextBook,
  currentBook,
  onNextBookPress,
  onPlayPress,
}: SeriesProgressHeaderProps) {
  const { colors } = useTheme();
  const totalBooks = books.length;
  const nextBookCoverUrl = useCoverUrl(nextBook?.id || '');
  const currentBookCoverUrl = useCoverUrl(currentBook?.id || '');

  // Theme-aware accent colors
  const accentColor = colors.accent.primary;
  const accentSubtle = colors.accent.primarySubtle;
  const inactiveColor = colors.progress.track;

  // Determine series state
  const seriesState = useMemo(() =>
    getSeriesState(books, completedCount, inProgressCount),
    [books, completedCount, inProgressCount]
  );

  // Calculate total and remaining duration
  const { totalDuration, remainingDuration, progressPercent } = useMemo(() => {
    let total = 0;
    let listened = 0;

    books.forEach(book => {
      const duration = getBookDuration(book);
      const progress = getBookProgress(book);
      total += duration;
      listened += duration * progress;
    });

    return {
      totalDuration: total,
      remainingDuration: total - listened,
      progressPercent: total > 0 ? Math.round((listened / total) * 100) : 0,
    };
  }, [books]);

  // Find the book currently in progress
  const inProgressBook = useMemo(() => {
    return books.find(book => {
      const progress = getBookProgress(book);
      return progress > 0 && progress < 0.95;
    }) || null;
  }, [books]);

  // Get chapter info for in-progress book
  const chapterInfo = inProgressBook ? getCurrentChapter(inProgressBook) : null;

  // Book progress for in-progress book
  const inProgressBookProgress = inProgressBook ? getBookProgress(inProgressBook) : 0;
  const inProgressBookRemaining = inProgressBook
    ? getBookDuration(inProgressBook) * (1 - inProgressBookProgress)
    : 0;

  // STATE A: Not Started - don't show progress header, just the action buttons
  if (seriesState === 'not_started') {
    return null;
  }

  // STATE D: Series Completed
  if (seriesState === 'completed') {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface.card }]}>
        <View style={styles.completedState}>
          <View style={[styles.trophyIcon, { backgroundColor: colors.accent.primarySubtle }]}>
            <Trophy size={scale(36)} color={accentColor} strokeWidth={2} />
          </View>
          <Text style={[styles.completedTitle, { color: colors.text.primary }]}>Series Complete!</Text>
          <Text style={[styles.completedSubtext, { color: colors.text.tertiary }]}>
            You finished {totalBooks} books · {formatDuration(totalDuration)} listened
          </Text>

          {/* All completed dots */}
          <View style={styles.dotsRowCompleted}>
            {books.map((book) => (
              <ProgressDot key={book.id} status="completed" size={scale(8)} accentColor={accentColor} accentSubtle={accentSubtle} inactiveColor={inactiveColor} />
            ))}
          </View>

          <View style={styles.completedActions}>
            <TouchableOpacity
              style={[styles.listenAgainButton, { borderColor: accentColor }]}
              onPress={() => nextBook && onPlayPress?.(books[0])}
              activeOpacity={0.7}
            >
              <RefreshCw size={scale(14)} color={accentColor} strokeWidth={2} />
              <Text style={[styles.listenAgainText, { color: accentColor }]}>Listen Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // STATE B & C: In Progress or Between Books
  return (
    <View style={[styles.container, { backgroundColor: colors.surface.card }]}>
      <Text style={[styles.sectionLabel, { color: colors.text.tertiary }]}>Your Progress</Text>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {books.map((book) => {
          const progress = getBookProgress(book);
          let status: 'completed' | 'in_progress' | 'not_started';
          if (progress >= 0.95) {
            status = 'completed';
          } else if (progress > 0) {
            status = 'in_progress';
          } else {
            status = 'not_started';
          }
          return <ProgressDot key={book.id} status={status} accentColor={accentColor} accentSubtle={accentSubtle} inactiveColor={inactiveColor} />;
        })}
      </View>

      {/* Progress Summary */}
      <Text style={[styles.progressSummary, { color: colors.text.primary }]}>
        {completedCount} of {totalBooks} books completed
      </Text>

      {/* Linear Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarTrack, { backgroundColor: colors.progress.track }]}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: accentColor }]} />
        </View>
        <Text style={[styles.progressPercent, { color: accentColor }]}>{progressPercent}%</Text>
      </View>

      {/* Time Remaining */}
      <Text style={[styles.timeRemaining, { color: colors.text.tertiary }]}>
        {formatTimeRemaining(remainingDuration)}
      </Text>

      {/* Dynamic Context Card */}
      {seriesState === 'mid_book' && inProgressBook ? (
        // STATE B: Mid-Book - Show current book with chapter progress
        <TouchableOpacity
          style={[styles.contextCard, { backgroundColor: colors.background.tertiary }]}
          onPress={() => onNextBookPress(inProgressBook)}
          activeOpacity={0.7}
        >
          <Image
            source={currentBookCoverUrl || nextBookCoverUrl}
            style={[styles.contextCover, { backgroundColor: colors.surface.card }]}
            contentFit="cover"
          />
          <View style={styles.contextInfo}>
            <Text style={[styles.contextLabel, { color: accentColor }]}>{getSequenceForDisplay(inProgressBook, books) !== null ? `Continue Book ${getSequenceForDisplay(inProgressBook, books)}` : 'Continue'}</Text>
            <Text style={[styles.contextTitle, { color: colors.text.primary }]} numberOfLines={1}>
              {getBookMetadata(inProgressBook)?.title || 'Unknown'}
            </Text>
            {chapterInfo && (
              <Text style={[styles.contextChapter, { color: colors.text.tertiary }]}>
                Chapter {chapterInfo.current} of {chapterInfo.total}
              </Text>
            )}
            <View style={styles.contextProgressContainer}>
              <View style={[styles.contextProgressTrack, { backgroundColor: colors.progress.track }]}>
                <View
                  style={[
                    styles.contextProgressFill,
                    { width: `${Math.round(inProgressBookProgress * 100)}%`, backgroundColor: accentColor }
                  ]}
                />
              </View>
              <Text style={[styles.contextProgressText, { color: colors.text.tertiary }]}>
                {Math.round(inProgressBookProgress * 100)}% · {formatDuration(inProgressBookRemaining)} left
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.contextPlayButton, { backgroundColor: accentColor }]}
            onPress={() => onPlayPress?.(inProgressBook)}
            activeOpacity={0.7}
          >
            <Play size={scale(20)} color={colors.text.inverse} fill={colors.text.inverse} strokeWidth={0} />
          </TouchableOpacity>
        </TouchableOpacity>
      ) : nextBook ? (
        // STATE C: Between Books - Show up next
        <View style={styles.betweenBooksCard}>
          <View style={styles.congratsRow}>
            <CheckCircle size={scale(18)} color={accentColor} strokeWidth={2} />
            <Text style={[styles.congratsText, { color: accentColor }]}>
              Congrats on finishing Book {completedCount}!
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.contextCard, { backgroundColor: colors.background.tertiary }]}
            onPress={() => onNextBookPress(nextBook)}
            activeOpacity={0.7}
          >
            <Image
              source={nextBookCoverUrl}
              style={[styles.contextCover, { backgroundColor: colors.surface.card }]}
              contentFit="cover"
            />
            <View style={styles.contextInfo}>
              <Text style={[styles.contextLabelNext, { color: colors.text.secondary }]}>{getSequenceForDisplay(nextBook, books) !== null ? `Up Next: Book ${getSequenceForDisplay(nextBook, books)}` : 'Up Next'}</Text>
              <Text style={[styles.contextTitle, { color: colors.text.primary }]} numberOfLines={1}>
                {getBookMetadata(nextBook)?.title || 'Unknown'}
              </Text>
              <Text style={[styles.contextDuration, { color: colors.text.tertiary }]}>
                {formatDuration(getBookDuration(nextBook))}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.contextPlayButton, { backgroundColor: accentColor }]}
              onPress={() => onPlayPress?.(nextBook)}
              activeOpacity={0.7}
            >
              <Play size={scale(20)} color={colors.text.inverse} fill={colors.text.inverse} strokeWidth={0} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: scale(16),
    marginBottom: scale(16),
    padding: scale(16),
    // backgroundColor set dynamically via colors.surface.card
    borderRadius: scale(12),
  },
  sectionLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    // color set dynamically via colors.text.tertiary
    letterSpacing: 0.5,
    marginBottom: scale(12),
  },

  // Progress Dots
  dotsRow: {
    flexDirection: 'row',
    gap: scale(6),
    marginBottom: scale(8),
    flexWrap: 'wrap',
  },
  dotsRowCompleted: {
    flexDirection: 'row',
    gap: scale(6),
    marginTop: scale(12),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dot: {
    // Styles set dynamically
  },

  // Progress Summary
  progressSummary: {
    fontSize: scale(14),
    fontWeight: '600',
    // color set dynamically via colors.text.primary
    marginBottom: scale(10),
  },

  // Progress Bar
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginBottom: scale(6),
  },
  progressBarTrack: {
    flex: 1,
    height: scale(6),
    // backgroundColor set dynamically via colors.progress.track
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    // backgroundColor set dynamically via accentColor
    borderRadius: scale(3),
  },
  progressPercent: {
    fontSize: scale(12),
    fontWeight: '600',
    // color set dynamically via accentColor
    width: scale(36),
    textAlign: 'right',
  },

  // Time Remaining
  timeRemaining: {
    fontSize: scale(12),
    // color set dynamically via colors.text.tertiary
    marginBottom: scale(16),
  },

  // Context Card (Continue/Up Next)
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set dynamically via colors.background.tertiary
    padding: scale(10),
    borderRadius: scale(10),
  },
  contextCover: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(6),
    // backgroundColor set dynamically via colors.surface.card
  },
  contextInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  contextLabel: {
    fontSize: scale(10),
    fontWeight: '700',
    // color set dynamically via accentColor
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(2),
  },
  contextLabelNext: {
    fontSize: scale(10),
    fontWeight: '700',
    // color set dynamically via colors.text.secondary
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(2),
  },
  contextTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    // color set dynamically via colors.text.primary
    marginBottom: scale(2),
  },
  contextChapter: {
    fontSize: scale(11),
    // color set dynamically via colors.text.tertiary
    marginBottom: scale(6),
  },
  contextDuration: {
    fontSize: scale(12),
    // color set dynamically via colors.text.tertiary
  },
  contextProgressContainer: {
    marginTop: scale(4),
  },
  contextProgressTrack: {
    height: scale(3),
    // backgroundColor set dynamically via colors.progress.track
    borderRadius: scale(2),
    overflow: 'hidden',
    marginBottom: scale(4),
  },
  contextProgressFill: {
    height: '100%',
    // backgroundColor set dynamically via accentColor
  },
  contextProgressText: {
    fontSize: scale(10),
    // color set dynamically via colors.text.tertiary
  },
  contextPlayButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    // backgroundColor set dynamically via accentColor
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(8),
  },

  // Between Books Card
  betweenBooksCard: {
    gap: scale(10),
  },
  congratsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(4),
  },
  congratsText: {
    fontSize: scale(13),
    // color set dynamically via accentColor
    fontWeight: '500',
  },

  // Completed State
  completedState: {
    alignItems: 'center',
    paddingVertical: scale(12),
  },
  trophyIcon: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    // backgroundColor set dynamically via colors.accent.primarySubtle
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  completedTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    // color set dynamically via colors.text.primary
    marginBottom: scale(4),
  },
  completedSubtext: {
    fontSize: scale(13),
    // color set dynamically via colors.text.tertiary
  },
  completedActions: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: scale(16),
  },
  listenAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(8),
    borderWidth: 1,
    // borderColor set dynamically via accentColor
  },
  listenAgainText: {
    fontSize: scale(13),
    fontWeight: '600',
    // color set dynamically via accentColor
  },
});
