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
import { Ionicons } from '@expo/vector-icons';
import { LibraryItem } from '@/core/types';
import { useCoverUrl } from '@/core/cache';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;
const ACCENT_DIM = 'rgba(243,182,12,0.5)';

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

// Progress dot component
function ProgressDot({
  status,
  size = 10,
}: {
  status: 'completed' | 'in_progress' | 'not_started';
  size?: number;
}) {
  const getColor = () => {
    switch (status) {
      case 'completed':
        return ACCENT;
      case 'in_progress':
        return ACCENT_DIM;
      default:
        return 'rgba(255,255,255,0.2)';
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

// Get sequence number for book - returns null if unknown
function getSequence(item: LibraryItem): number | null {
  const metadata = (item.media?.metadata as any) || {};

  // First check series array (preferred - has explicit sequence)
  if (metadata.series?.length > 0) {
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

// Get book progress
function getBookProgress(book: LibraryItem): number {
  return (book as any).userMediaProgress?.progress || 0;
}

// Get current chapter info
function getCurrentChapter(book: LibraryItem): { current: number; total: number } | null {
  const progress = (book as any).userMediaProgress;
  if (!progress) return null;

  const chapters = (book.media as any)?.chapters;
  if (!chapters || chapters.length === 0) return null;

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
  const totalBooks = books.length;
  const nextBookCoverUrl = useCoverUrl(nextBook?.id || '');
  const currentBookCoverUrl = useCoverUrl(currentBook?.id || '');

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
      const duration = (book.media as any)?.duration || 0;
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
    ? ((inProgressBook.media as any)?.duration || 0) * (1 - inProgressBookProgress)
    : 0;

  // STATE A: Not Started - don't show progress header, just the action buttons
  if (seriesState === 'not_started') {
    return null;
  }

  // STATE D: Series Completed
  if (seriesState === 'completed') {
    return (
      <View style={styles.container}>
        <View style={styles.completedState}>
          <View style={styles.trophyIcon}>
            <Ionicons name="trophy" size={scale(36)} color={ACCENT} />
          </View>
          <Text style={styles.completedTitle}>Series Complete!</Text>
          <Text style={styles.completedSubtext}>
            You finished {totalBooks} books · {formatDuration(totalDuration)} listened
          </Text>

          {/* All completed dots */}
          <View style={styles.dotsRowCompleted}>
            {books.map((book) => (
              <ProgressDot key={book.id} status="completed" size={scale(8)} />
            ))}
          </View>

          <View style={styles.completedActions}>
            <TouchableOpacity
              style={styles.listenAgainButton}
              onPress={() => nextBook && onPlayPress?.(books[0])}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={scale(14)} color={ACCENT} />
              <Text style={styles.listenAgainText}>Listen Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // STATE B & C: In Progress or Between Books
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Your Progress</Text>

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
          return <ProgressDot key={book.id} status={status} />;
        })}
      </View>

      {/* Progress Summary */}
      <Text style={styles.progressSummary}>
        {completedCount} of {totalBooks} books completed
      </Text>

      {/* Linear Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressPercent}>{progressPercent}%</Text>
      </View>

      {/* Time Remaining */}
      <Text style={styles.timeRemaining}>
        {formatTimeRemaining(remainingDuration)}
      </Text>

      {/* Dynamic Context Card */}
      {seriesState === 'mid_book' && inProgressBook ? (
        // STATE B: Mid-Book - Show current book with chapter progress
        <TouchableOpacity
          style={styles.contextCard}
          onPress={() => onNextBookPress(inProgressBook)}
          activeOpacity={0.7}
        >
          <Image
            source={currentBookCoverUrl || nextBookCoverUrl}
            style={styles.contextCover}
            contentFit="cover"
          />
          <View style={styles.contextInfo}>
            <Text style={styles.contextLabel}>{getSequence(inProgressBook) !== null ? `Continue Book ${getSequence(inProgressBook)}` : 'Continue'}</Text>
            <Text style={styles.contextTitle} numberOfLines={1}>
              {(inProgressBook.media?.metadata as any)?.title || 'Unknown'}
            </Text>
            {chapterInfo && (
              <Text style={styles.contextChapter}>
                Chapter {chapterInfo.current} of {chapterInfo.total}
              </Text>
            )}
            <View style={styles.contextProgressContainer}>
              <View style={styles.contextProgressTrack}>
                <View
                  style={[
                    styles.contextProgressFill,
                    { width: `${Math.round(inProgressBookProgress * 100)}%` }
                  ]}
                />
              </View>
              <Text style={styles.contextProgressText}>
                {Math.round(inProgressBookProgress * 100)}% · {formatDuration(inProgressBookRemaining)} left
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.contextPlayButton}
            onPress={() => onPlayPress?.(inProgressBook)}
            activeOpacity={0.7}
          >
            <Ionicons name="play" size={scale(20)} color="#000" />
          </TouchableOpacity>
        </TouchableOpacity>
      ) : nextBook ? (
        // STATE C: Between Books - Show up next
        <View style={styles.betweenBooksCard}>
          <View style={styles.congratsRow}>
            <Ionicons name="checkmark-circle" size={scale(18)} color={ACCENT} />
            <Text style={styles.congratsText}>
              Congrats on finishing Book {completedCount}!
            </Text>
          </View>
          <TouchableOpacity
            style={styles.contextCard}
            onPress={() => onNextBookPress(nextBook)}
            activeOpacity={0.7}
          >
            <Image
              source={nextBookCoverUrl}
              style={styles.contextCover}
              contentFit="cover"
            />
            <View style={styles.contextInfo}>
              <Text style={styles.contextLabelNext}>{getSequence(nextBook) !== null ? `Up Next: Book ${getSequence(nextBook)}` : 'Up Next'}</Text>
              <Text style={styles.contextTitle} numberOfLines={1}>
                {(nextBook.media?.metadata as any)?.title || 'Unknown'}
              </Text>
              <Text style={styles.contextDuration}>
                {formatDuration((nextBook.media as any)?.duration || 0)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.contextPlayButton}
              onPress={() => onPlayPress?.(nextBook)}
              activeOpacity={0.7}
            >
              <Ionicons name="play" size={scale(20)} color="#000" />
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
  },
  sectionLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
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
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(3),
  },
  progressPercent: {
    fontSize: scale(12),
    fontWeight: '600',
    color: ACCENT,
    width: scale(36),
    textAlign: 'right',
  },

  // Time Remaining
  timeRemaining: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(16),
  },

  // Context Card (Continue/Up Next)
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: scale(10),
    borderRadius: scale(10),
  },
  contextCover: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  contextInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  contextLabel: {
    fontSize: scale(10),
    fontWeight: '700',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(2),
  },
  contextLabelNext: {
    fontSize: scale(10),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(2),
  },
  contextTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(2),
  },
  contextChapter: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(6),
  },
  contextDuration: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  contextProgressContainer: {
    marginTop: scale(4),
  },
  contextProgressTrack: {
    height: scale(3),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(2),
    overflow: 'hidden',
    marginBottom: scale(4),
  },
  contextProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  contextProgressText: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
  },
  contextPlayButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: ACCENT,
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
    color: ACCENT,
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
    backgroundColor: 'rgba(244,182,12,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  completedTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(4),
  },
  completedSubtext: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.5)',
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
    borderColor: ACCENT,
  },
  listenAgainText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: ACCENT,
  },
});
