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
import { Ionicons } from '@expo/vector-icons';
import { BookChapter, LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

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
        <Ionicons name="list-outline" size={scale(40)} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyText}>No chapters available</Text>
      </View>
    );
  }

  const handleChapterPress = async (chapter: BookChapter) => {
    try {
      console.log('[ChaptersTab] Chapter press:', chapter.title, 'start:', chapter.start);
      if (currentBook?.id === bookId) {
        console.log('[ChaptersTab] Same book loaded, seeking to:', chapter.start);
        await seekTo(chapter.start);
        await play();
      } else if (book) {
        console.log('[ChaptersTab] Different/no book loaded, loading with startPosition:', chapter.start);
        await loadBook(book, {
          startPosition: chapter.start,
          autoPlay: true,
          showPlayer: false,
        });
      }
    } catch (error) {
      console.error('[ChaptersTab] Failed to play chapter:', error);
    }
  };

  // Count completed chapters
  const completedCount = chapterStates.filter(s => s.isCompleted).length;
  const currentIndex = chapterStates.findIndex(s => s.isCurrent);

  return (
    <View style={styles.container}>
      {/* Progress summary */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {completedCount} of {chapters.length} completed
        </Text>
        {currentIndex >= 0 && (
          <Text style={styles.currentText}>
            Currently on Chapter {currentIndex + 1}
          </Text>
        )}
      </View>

      {/* Chapter list */}
      <View style={styles.chapterList}>
        {chapters.map((chapter, index) => {
          const state = chapterStates[index];

          const chapterTitle = chapter.title || `Chapter ${index + 1}`;
          const statusLabel = state.isCompleted ? 'completed' : state.isCurrent ? 'currently playing' : '';

          return (
            <TouchableOpacity
              key={chapter.id}
              style={[
                styles.chapterItem,
                state.isCurrent && styles.chapterItemCurrent,
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
                state.isCompleted && styles.statusCompleted,
                state.isCurrent && styles.statusCurrent,
              ]}>
                {state.isCompleted ? (
                  <Ionicons name="checkmark" size={scale(12)} color="#000" />
                ) : state.isCurrent ? (
                  <Ionicons name="volume-high" size={scale(10)} color="#000" />
                ) : (
                  <Text style={styles.chapterNumber}>{index + 1}</Text>
                )}
              </View>

              {/* Chapter info */}
              <View style={styles.chapterInfo}>
                <Text
                  style={[
                    styles.chapterTitle,
                    state.isCompleted && styles.chapterTitleCompleted,
                    state.isCurrent && styles.chapterTitleCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {chapterTitle}
                </Text>

                {/* Progress bar for current chapter */}
                {state.isCurrent && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${state.chapterProgress * 100}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.timeRemaining}>
                      {formatShortDuration(state.timeRemaining)} left
                    </Text>
                  </View>
                )}

                {/* Duration for non-current chapters */}
                {!state.isCurrent && (
                  <Text style={[
                    styles.chapterDuration,
                    state.isCompleted && styles.chapterDurationCompleted,
                  ]}>
                    {formatDuration(state.duration)}
                  </Text>
                )}
              </View>

              {/* Play indicator */}
              <View style={styles.playIndicator}>
                {state.isCurrent ? (
                  <View style={styles.nowPlayingDot} />
                ) : (
                  <Ionicons
                    name="play"
                    size={scale(14)}
                    color={state.isCompleted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)'}
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
    color: 'rgba(255,255,255,0.4)',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  summaryText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  currentText: {
    fontSize: scale(12),
    color: ACCENT,
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
    backgroundColor: 'rgba(193,244,12,0.08)',
  },

  // Status indicator
  statusIndicator: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  statusCompleted: {
    backgroundColor: ACCENT,
  },
  statusCurrent: {
    backgroundColor: '#fff',
  },
  chapterNumber: {
    fontSize: scale(10),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },

  // Chapter info
  chapterInfo: {
    flex: 1,
    marginRight: scale(12),
  },
  chapterTitle: {
    fontSize: scale(14),
    color: '#fff',
    fontWeight: '500',
  },
  chapterTitleCompleted: {
    color: 'rgba(255,255,255,0.5)',
  },
  chapterTitleCurrent: {
    color: '#fff',
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
    marginTop: scale(4),
  },
  chapterDurationCompleted: {
    color: 'rgba(255,255,255,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
  timeRemaining: {
    fontSize: scale(10),
    color: ACCENT,
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
    backgroundColor: ACCENT,
  },
});
