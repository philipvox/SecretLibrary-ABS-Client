/**
 * src/features/book-detail/components/ChaptersTab.tsx
 *
 * Redesigned chapters list with progress tracking and visual indicators.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Check, Volume2, Play, List } from 'lucide-react-native';
import { BookChapter, LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useColors, scale, spacing, radius } from '@/shared/theme';
import { useNormalizedChapters } from '@/shared/hooks';
import { logger } from '@/shared/utils/logger';

interface ChaptersTabProps {
  chapters: BookChapter[];
  currentPosition?: number;
  bookId?: string;
  book?: LibraryItem;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatShortDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function ChaptersTab({ chapters, currentPosition = 0, bookId, book }: ChaptersTabProps) {
  const { seekTo, currentBook, loadBook, play } = usePlayerStore();
  const colors = useColors();

  // Get normalized chapter names based on user settings
  const bookTitle = book?.media?.metadata?.title;
  const normalizedChapters = useNormalizedChapters(chapters, { bookTitle });

  // Calculate chapter states
  const chapterStates = useMemo(() => {
    return chapters.map((chapter, idx) => {
      const duration = chapter.end - chapter.start;
      const nextChapterStart = idx < chapters.length - 1 ? chapters[idx + 1].start : chapter.end;

      const isCompleted = currentPosition >= chapter.end;
      const isCurrent = currentPosition >= chapter.start && currentPosition < nextChapterStart;
      const isUpcoming = currentPosition < chapter.start;

      // Progress within current chapter (0-1)
      let chapterProgress = 0;
      if (isCompleted) {
        chapterProgress = 1;
      } else if (isCurrent) {
        chapterProgress = (currentPosition - chapter.start) / duration;
      }

      // Time remaining in chapter
      const timeRemaining = isCurrent ? chapter.end - currentPosition : duration;

      return {
        isCompleted,
        isCurrent,
        isUpcoming,
        chapterProgress,
        timeRemaining,
        duration,
      };
    });
  }, [chapters, currentPosition]);

  if (!chapters || chapters.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <List size={scale(40)} color={colors.text.tertiary} strokeWidth={1.5} />
        <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>No chapters available</Text>
      </View>
    );
  }

  const handleChapterPress = async (chapter: BookChapter) => {
    try {
      logger.debug('[ChaptersTab] Chapter press:', chapter.title, 'start:', chapter.start);
      if (currentBook?.id === bookId) {
        logger.debug('[ChaptersTab] Same book loaded, seeking to:', chapter.start);
        await seekTo(chapter.start);
        // Small delay to ensure seek completes before playing
        // This prevents race conditions where play() is called before audio is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        await play();
      } else if (book) {
        logger.debug('[ChaptersTab] Different/no book loaded, loading with startPosition:', chapter.start);
        await loadBook(book, {
          startPosition: chapter.start,
          autoPlay: true,
          showPlayer: false,
        });
      }
    } catch (error) {
      logger.error('[ChaptersTab] Failed to play chapter:', error);
    }
  };

  // Count completed chapters
  const completedCount = chapterStates.filter(s => s.isCompleted).length;
  const currentIndex = chapterStates.findIndex(s => s.isCurrent);

  return (
    <View style={styles.container}>
      {/* Progress summary */}
      <View style={[styles.summaryRow, { borderBottomColor: colors.border.default }]}>
        <Text style={[styles.summaryText, { color: colors.text.secondary }]}>
          {completedCount} of {chapters.length} completed
        </Text>
        {currentIndex >= 0 && (
          <Text style={[styles.currentText, { color: colors.text.primary }]}>
            Currently on Chapter {currentIndex + 1}
          </Text>
        )}
      </View>

      {/* Chapter list */}
      <View style={styles.chapterList}>
        {normalizedChapters.map((chapter, index) => {
          const state = chapterStates[index];

          // Use normalized display title from the hook
          const chapterTitle = chapter.displayTitle || `Chapter ${index + 1}`;
          const statusLabel = state.isCompleted ? 'completed' : state.isCurrent ? 'currently playing' : '';

          return (
            <TouchableOpacity
              key={chapter.id}
              style={[
                styles.chapterItem,
                state.isCurrent && { backgroundColor: colors.surface.default },
              ]}
              onPress={() => handleChapterPress(chapter)}
              activeOpacity={0.7}
              accessibilityLabel={`${chapterTitle}, ${formatShortDuration(state.duration)}${statusLabel ? `, ${statusLabel}` : ''}`}
              accessibilityRole="button"
              accessibilityHint="Double tap to play this chapter"
            >
              {/* Status indicator */}
              <View style={[
                styles.statusIndicator,
                { backgroundColor: colors.surface.default },
                state.isCompleted && { backgroundColor: colors.text.primary },
                state.isCurrent && { backgroundColor: colors.text.primary },
              ]}>
                {state.isCompleted ? (
                  <Check size={scale(12)} color={colors.background.primary} strokeWidth={3} />
                ) : state.isCurrent ? (
                  <Volume2 size={scale(10)} color={colors.background.primary} strokeWidth={2} />
                ) : (
                  <Text style={[styles.chapterNumber, { color: colors.text.tertiary }]}>{index + 1}</Text>
                )}
              </View>

              {/* Chapter info */}
              <View style={styles.chapterInfo}>
                <Text
                  style={[
                    styles.chapterTitle,
                    { color: colors.text.primary },
                    state.isCompleted && { color: colors.text.secondary },
                    state.isCurrent && { color: colors.text.primary, fontWeight: '600' },
                  ]}
                  numberOfLines={1}
                >
                  {chapterTitle}
                </Text>

                {/* Progress bar for current chapter */}
                {state.isCurrent && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressTrack, { backgroundColor: colors.border.default }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${state.chapterProgress * 100}%`, backgroundColor: colors.text.primary }
                        ]}
                      />
                    </View>
                    <Text style={[styles.timeRemaining, { color: colors.text.primary }]}>
                      {formatShortDuration(state.timeRemaining)} left
                    </Text>
                  </View>
                )}

                {/* Duration for non-current chapters */}
                {!state.isCurrent && (
                  <Text style={[
                    styles.chapterDuration,
                    { color: colors.text.tertiary },
                    state.isCompleted && { color: colors.text.tertiary },
                  ]}>
                    {formatDuration(state.duration)}
                  </Text>
                )}
              </View>

              {/* Play indicator */}
              <View style={styles.playIndicator}>
                {state.isCurrent ? (
                  <View style={[styles.nowPlayingDot, { backgroundColor: colors.text.primary }]} />
                ) : (
                  <Play
                    size={scale(14)}
                    color={state.isCompleted ? colors.text.tertiary : colors.text.secondary}
                    fill={state.isCompleted ? colors.text.tertiary : colors.text.secondary}
                    strokeWidth={0}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: scale(20),
  },
  emptyContainer: {
    padding: scale(40),
    alignItems: 'center',
    gap: scale(12),
  },
  emptyText: {
    fontSize: scale(14),
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
  },
  summaryText: {
    fontSize: scale(12),
  },
  currentText: {
    fontSize: scale(12),
    fontWeight: '600',
  },

  // Chapter list
  chapterList: {
    gap: scale(2),
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    marginHorizontal: scale(-12),
    borderRadius: scale(10),
  },
  chapterItemCurrent: {
    // Colors now applied inline
  },

  // Status indicator
  statusIndicator: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  statusCompleted: {
    // Colors now applied inline
  },
  statusCurrent: {
    // Colors now applied inline
  },
  chapterNumber: {
    fontSize: scale(10),
    fontWeight: '600',
  },

  // Chapter info
  chapterInfo: {
    flex: 1,
    marginRight: scale(12),
  },
  chapterTitle: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  chapterTitleCompleted: {
    // Colors now applied inline
  },
  chapterTitleCurrent: {
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: scale(11),
    marginTop: scale(4),
  },
  chapterDurationCompleted: {
    // Colors now applied inline
  },

  // Progress bar (current chapter)
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(6),
    gap: scale(8),
  },
  progressTrack: {
    flex: 1,
    height: scale(3),
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(2),
  },
  timeRemaining: {
    fontSize: scale(10),
    fontWeight: '500',
  },

  // Play indicator
  playIndicator: {
    width: scale(24),
    alignItems: 'center',
  },
  nowPlayingDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
});
