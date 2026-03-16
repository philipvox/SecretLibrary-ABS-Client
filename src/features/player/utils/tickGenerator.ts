/**
 * src/features/player/utils/tickGenerator.ts
 *
 * Pre-generates timeline ticks for audiobooks.
 * Ticks are cached to avoid expensive computation during playback.
 *
 * IMPORTANT: tick.time stores position in SECONDS (time-based), not pixels.
 * This allows cached ticks to work across different screen sizes.
 * Convert to pixels at render time using: tick.time * PIXELS_PER_SECOND
 */

import { scale } from '@/shared/theme';

// Tick types - time is stored in seconds for device-independent caching
export interface TimelineTick {
  time: number;  // Position in seconds (NOT pixels!)
  tier: 'chapter' | 'tenMin' | 'oneMin' | 'fifteenSec';
  label?: string;
}

export interface ChapterInput {
  start: number;
  end: number;
  displayTitle?: string;
}

// Constants for tick generation logic
// Note: These are for spacing calculations only, not for stored positions
const _MINUTES_PER_SCREEN = 5;
const PIXELS_PER_SECOND_REF = 1; // Reference for spacing (300px / 300sec)
const MIN_LABEL_SPACING_SECONDS = scale(55) / PIXELS_PER_SECOND_REF; // ~55 seconds
const MIN_CHAPTER_DURATION = 60;

/**
 * Generate all ticks for a book's timeline.
 * This is expensive but only needs to run once per book.
 */
export function generateTicksForBook(
  duration: number,
  chapters: ChapterInput[]
): TimelineTick[] {
  const tickArray: TimelineTick[] = [];

  const minTime = 0;
  const maxTime = duration;

  // Tier 1: Chapter ticks with labels
  let lastLabelTime = -Infinity;

  chapters.forEach((chapter, index) => {
    if (chapter.start >= minTime && chapter.start <= maxTime) {
      // Calculate chapter duration
      const nextChapter = chapters[index + 1];
      const chapterEnd = nextChapter ? nextChapter.start : duration;
      const chapterDuration = chapterEnd - chapter.start;

      // Only show label if chapter is long enough and there's space
      const isLongEnough = chapterDuration >= MIN_CHAPTER_DURATION;
      const hasSpace = (chapter.start - lastLabelTime) >= MIN_LABEL_SPACING_SECONDS;
      const showLabel = isLongEnough && hasSpace;

      tickArray.push({
        time: chapter.start,  // Store time in seconds
        tier: 'chapter',
        label: showLabel ? (chapter.displayTitle || `CH ${index + 1}`) : undefined
      });

      if (showLabel) {
        lastLabelTime = chapter.start;
      }
    }
  });

  // Tier 2: 10-minute ticks
  const tenMinInterval = 10 * 60;
  const startTenMin = Math.floor(minTime / tenMinInterval) * tenMinInterval;
  for (let t = startTenMin; t <= maxTime; t += tenMinInterval) {
    if (t < minTime) continue;
    const isNearChapter = chapters.some(ch => Math.abs(ch.start - t) < 30);
    if (!isNearChapter) {
      let chapterStart = 0;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (t >= chapters[i].start) {
          chapterStart = chapters[i].start;
          break;
        }
      }
      const secondsIntoChapter = t - chapterStart;
      const chapterMinute = secondsIntoChapter > 0 ? Math.floor(secondsIntoChapter / 60) + 1 : 0;

      tickArray.push({
        time: t,  // Store time in seconds
        tier: 'tenMin',
        label: chapterMinute > 0 ? `${chapterMinute}` : undefined
      });
    }
  }

  // Tier 3: 1-minute ticks
  const oneMinInterval = 60;
  const startOneMin = Math.floor(minTime / oneMinInterval) * oneMinInterval;
  for (let t = startOneMin; t <= maxTime; t += oneMinInterval) {
    if (t < minTime) continue;
    const isNearChapter = chapters.some(ch => Math.abs(ch.start - t) < 10);
    const isNear10Min = (t % tenMinInterval) < 10 || (tenMinInterval - (t % tenMinInterval)) < 10;
    if (!isNearChapter && !isNear10Min) {
      let chapterStart = 0;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (t >= chapters[i].start) {
          chapterStart = chapters[i].start;
          break;
        }
      }
      const secondsIntoChapter = t - chapterStart;
      const chapterMinute = secondsIntoChapter > 0 ? Math.floor(secondsIntoChapter / 60) + 1 : 0;

      tickArray.push({
        time: t,  // Store time in seconds
        tier: 'oneMin',
        label: chapterMinute > 0 ? `${chapterMinute}` : undefined
      });
    }
  }

  // Tier 4: 15-second ticks
  const fifteenSecInterval = 15;
  const startFifteenSec = Math.floor(minTime / fifteenSecInterval) * fifteenSecInterval;
  for (let t = startFifteenSec; t <= maxTime; t += fifteenSecInterval) {
    if (t < minTime) continue;
    const isNearChapter = chapters.some(ch => Math.abs(ch.start - t) < 5);
    const isNear10Min = (t % tenMinInterval) < 5 || (tenMinInterval - (t % tenMinInterval)) < 5;
    const isNear1Min = (t % oneMinInterval) < 5 || (oneMinInterval - (t % oneMinInterval)) < 5;
    if (!isNearChapter && !isNear10Min && !isNear1Min) {
      tickArray.push({
        time: t,  // Store time in seconds
        tier: 'fifteenSec'
      });
    }
  }

  return tickArray;
}

/**
 * Get ticks for a visible window (for rendering).
 * Used when displaying from cached full tick array.
 * Filters by time (seconds), not pixels - positions are device-independent.
 */
export function getVisibleTicks(
  allTicks: TimelineTick[],
  centerPosition: number,
  windowSeconds: number = 60 * 60 // 60 min default
): TimelineTick[] {
  const minTime = Math.max(0, centerPosition - windowSeconds);
  const maxTime = centerPosition + windowSeconds;

  return allTicks.filter(tick => tick.time >= minTime && tick.time <= maxTime);
}
