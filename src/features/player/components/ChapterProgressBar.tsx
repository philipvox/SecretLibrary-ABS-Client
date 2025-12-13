/**
 * src/features/player/components/ChapterProgressBar.tsx
 *
 * Visual chapter progress bar showing all chapters as segments.
 * - Width proportional to chapter duration
 * - Filled portion shows progress
 * - Current chapter highlighted
 * - Tap to seek to chapter start
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { haptics } from '@/core/native/haptics';
import { Chapter } from '../stores/playerStore';
import { colors, wp, spacing } from '@/shared/theme';

const BAR_WIDTH = wp(100) - 48; // 24px padding on each side
const SEGMENT_GAP = 2;
const BAR_HEIGHT = 6;

interface ChapterProgressBarProps {
  chapters: Chapter[];
  position: number;
  duration: number;
  onChapterPress: (chapterStart: number) => void;
}

// Use theme colors
const UNFILLED_COLOR = colors.progressTrack;
const FILLED_COLOR = colors.progressFill;
const CURRENT_CHAPTER_BG = colors.accentSubtle;

/**
 * Calculate the fill percentage for a chapter based on current position.
 */
function getChapterFillPercent(chapter: Chapter, position: number): number {
  if (position >= chapter.end) {
    return 100; // Past this chapter - fully filled
  }
  if (position < chapter.start) {
    return 0; // Before this chapter - empty
  }
  // Within this chapter - proportional fill
  const chapterDuration = chapter.end - chapter.start;
  if (chapterDuration <= 0) return 0;
  const progressInChapter = position - chapter.start;
  return Math.min(100, Math.max(0, (progressInChapter / chapterDuration) * 100));
}

/**
 * Find the index of the chapter containing the given position.
 */
function findCurrentChapterIndex(chapters: Chapter[], position: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (position >= chapters[i].start) {
      return i;
    }
  }
  return 0;
}

/**
 * Animated chapter segment with fill progress.
 */
function ChapterSegment({
  chapter,
  index,
  widthPercent,
  fillPercent,
  isCurrent,
  onPress,
}: {
  chapter: Chapter;
  index: number;
  widthPercent: number;
  fillPercent: number;
  isCurrent: boolean;
  onPress: () => void;
}) {
  const animatedFillStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${fillPercent}%`, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      }),
    };
  }, [fillPercent]);

  const segmentWidth = (widthPercent / 100) * BAR_WIDTH - SEGMENT_GAP;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.segment,
        {
          width: segmentWidth,
          backgroundColor: isCurrent ? CURRENT_CHAPTER_BG : UNFILLED_COLOR,
        },
        isCurrent && styles.currentSegment,
      ]}
    >
      <Animated.View
        style={[
          styles.segmentFill,
          animatedFillStyle,
          fillPercent >= 100 && styles.segmentFillComplete,
        ]}
      />
    </TouchableOpacity>
  );
}

export function ChapterProgressBar({
  chapters,
  position,
  duration,
  onChapterPress,
}: ChapterProgressBarProps) {
  // Calculate segment widths based on chapter durations
  const segmentData = useMemo(() => {
    if (!chapters.length || duration <= 0) return [];

    return chapters.map((chapter, index) => {
      const chapterDuration = chapter.end - chapter.start;
      const widthPercent = (chapterDuration / duration) * 100;
      return {
        chapter,
        index,
        widthPercent,
      };
    });
  }, [chapters, duration]);

  // Find current chapter
  const currentChapterIndex = useMemo(() => {
    return findCurrentChapterIndex(chapters, position);
  }, [chapters, position]);

  // Current chapter for label
  const currentChapter = chapters[currentChapterIndex];

  const handleChapterPress = useCallback((chapterStart: number) => {
    haptics.selection();
    onChapterPress(chapterStart);
  }, [onChapterPress]);

  if (!chapters.length || duration <= 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Chapter segments */}
      <View style={styles.segmentsContainer}>
        {segmentData.map(({ chapter, index, widthPercent }) => (
          <ChapterSegment
            key={index}
            chapter={chapter}
            index={index}
            widthPercent={widthPercent}
            fillPercent={getChapterFillPercent(chapter, position)}
            isCurrent={index === currentChapterIndex}
            onPress={() => handleChapterPress(chapter.start)}
          />
        ))}
      </View>

      {/* Chapter label */}
      {currentChapter && (
        <View style={styles.labelContainer}>
          <Text style={styles.chapterLabel} numberOfLines={1}>
            Chapter {currentChapterIndex + 1} of {chapters.length}
            {currentChapter.title && currentChapter.title !== `Chapter ${currentChapterIndex + 1}` && (
              <Text style={styles.chapterTitle}> · {currentChapter.title}</Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  segmentsContainer: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    gap: SEGMENT_GAP,
  },
  segment: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    minWidth: 4, // Ensure very short chapters are still visible
  },
  currentSegment: {
    // Slightly taller for emphasis
  },
  segmentFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: FILLED_COLOR,
    borderRadius: BAR_HEIGHT / 2,
  },
  segmentFillComplete: {
    // Completed chapters have slightly different style
    opacity: 0.8,
  },
  labelContainer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  chapterLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chapterTitle: {
    color: colors.textTertiary,
  },
});

export default ChapterProgressBar;
