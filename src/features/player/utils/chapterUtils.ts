/**
 * src/features/player/utils/chapterUtils.ts
 *
 * Utility functions for chapter navigation and boundary detection.
 */

import { Chapter } from '../stores/playerStore';
import { ChapterCrossing, SeekDirection } from '../types/seek';

/**
 * Find the chapter index for a given position.
 * Returns the index of the chapter that contains the position.
 */
export function findChapterIndex(chapters: Chapter[], position: number): number {
  if (chapters.length === 0) return 0;

  // Clamp position to valid range
  const clampedPosition = Math.max(0, position);

  // Search from the end to find the chapter that starts at or before position
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (clampedPosition >= chapters[i].start) {
      return i;
    }
  }

  return 0;
}

/**
 * Detect if seeking from one position to another crosses a chapter boundary.
 * Returns null if no chapter crossing, or ChapterCrossing info if crossing occurs.
 */
export function detectChapterCrossing(
  chapters: Chapter[],
  fromPosition: number,
  toPosition: number
): ChapterCrossing | null {
  if (chapters.length === 0) return null;

  const fromChapterIndex = findChapterIndex(chapters, fromPosition);
  const toChapterIndex = findChapterIndex(chapters, toPosition);

  if (fromChapterIndex === toChapterIndex) {
    return null;
  }

  const fromChapter = chapters[fromChapterIndex];
  const toChapter = chapters[toChapterIndex];

  // Calculate position within the destination chapter
  const positionInChapter = toPosition - toChapter.start;

  return {
    fromChapter,
    fromChapterIndex,
    toChapter,
    toChapterIndex,
    fromPosition,
    targetPosition: toPosition,
    positionInChapter,
  };
}

/**
 * Detect all chapters that would be crossed when seeking.
 * Useful when seeking might skip multiple short chapters.
 */
export function detectAllChapterCrossings(
  chapters: Chapter[],
  fromPosition: number,
  toPosition: number
): ChapterCrossing[] {
  if (chapters.length === 0) return [];

  const crossings: ChapterCrossing[] = [];
  const direction = toPosition > fromPosition ? 1 : -1;

  const fromChapterIndex = findChapterIndex(chapters, fromPosition);
  const toChapterIndex = findChapterIndex(chapters, toPosition);

  if (fromChapterIndex === toChapterIndex) {
    return [];
  }

  // Iterate through all crossed chapters
  const start = Math.min(fromChapterIndex, toChapterIndex);
  const end = Math.max(fromChapterIndex, toChapterIndex);

  for (let i = start; i <= end; i++) {
    if (i !== fromChapterIndex) {
      const chapter = chapters[i];
      const prevChapter = i > 0 ? chapters[i - 1] : null;

      crossings.push({
        fromChapter: prevChapter || chapters[fromChapterIndex],
        fromChapterIndex: prevChapter ? i - 1 : fromChapterIndex,
        toChapter: chapter,
        toChapterIndex: i,
        fromPosition,
        targetPosition: i === toChapterIndex ? toPosition : chapter.start,
        positionInChapter: i === toChapterIndex ? toPosition - chapter.start : 0,
      });
    }
  }

  return crossings;
}

/**
 * Calculate the target position when going to the previous chapter.
 * Implements the "restart or go back" logic:
 * - If more than threshold seconds into chapter, go to start of current chapter
 * - Otherwise, go to start of previous chapter
 */
export function calculatePrevChapterPosition(
  chapters: Chapter[],
  currentPosition: number,
  restartThreshold: number = 3
): { position: number; chapterIndex: number } {
  if (chapters.length === 0) {
    return { position: 0, chapterIndex: 0 };
  }

  const currentChapterIndex = findChapterIndex(chapters, currentPosition);
  const currentChapter = chapters[currentChapterIndex];

  // How far into the current chapter are we?
  const positionInChapter = currentPosition - currentChapter.start;

  if (positionInChapter > restartThreshold) {
    // Go to start of current chapter (restart)
    return { position: currentChapter.start, chapterIndex: currentChapterIndex };
  } else if (currentChapterIndex > 0) {
    // Go to start of previous chapter
    const prevChapter = chapters[currentChapterIndex - 1];
    return { position: prevChapter.start, chapterIndex: currentChapterIndex - 1 };
  } else {
    // Already at first chapter, go to start
    return { position: 0, chapterIndex: 0 };
  }
}

/**
 * Calculate the target position when going to the next chapter.
 */
export function calculateNextChapterPosition(
  chapters: Chapter[],
  currentPosition: number
): { position: number; chapterIndex: number } | null {
  if (chapters.length === 0) {
    return null;
  }

  const currentChapterIndex = findChapterIndex(chapters, currentPosition);

  if (currentChapterIndex < chapters.length - 1) {
    const nextChapter = chapters[currentChapterIndex + 1];
    return { position: nextChapter.start, chapterIndex: currentChapterIndex + 1 };
  }

  // Already at last chapter
  return null;
}

/**
 * Clamp a position to valid bounds.
 */
export function clampPosition(position: number, duration: number): number {
  return Math.max(0, Math.min(duration, position));
}

/**
 * Check if a position is at or near the start of the book.
 */
export function isAtStart(position: number, tolerance: number = 0.5): boolean {
  return position <= tolerance;
}

/**
 * Check if a position is at or near the end of the book.
 */
export function isAtEnd(position: number, duration: number, tolerance: number = 0.5): boolean {
  return position >= duration - tolerance;
}

/**
 * Calculate the position after seeking by a relative amount,
 * potentially crossing chapter boundaries.
 */
export function calculateSeekPosition(
  chapters: Chapter[],
  currentPosition: number,
  seekAmount: number,
  duration: number
): {
  targetPosition: number;
  crossing: ChapterCrossing | null;
  boundaryHit: 'start' | 'end' | null;
} {
  const rawTarget = currentPosition + seekAmount;
  let targetPosition = clampPosition(rawTarget, duration);

  let boundaryHit: 'start' | 'end' | null = null;
  if (rawTarget < 0) {
    boundaryHit = 'start';
    targetPosition = 0;
  } else if (rawTarget > duration) {
    boundaryHit = 'end';
    targetPosition = duration;
  }

  const crossing = detectChapterCrossing(chapters, currentPosition, targetPosition);

  return {
    targetPosition,
    crossing,
    boundaryHit,
  };
}

/**
 * Get chapter progress (0-1) within the current chapter.
 */
export function getChapterProgress(
  chapters: Chapter[],
  position: number
): number {
  if (chapters.length === 0) return 0;

  const chapterIndex = findChapterIndex(chapters, position);
  const chapter = chapters[chapterIndex];

  if (!chapter) return 0;

  const chapterDuration = chapter.end - chapter.start;
  if (chapterDuration <= 0) return 0;

  const positionInChapter = position - chapter.start;
  return Math.max(0, Math.min(1, positionInChapter / chapterDuration));
}
