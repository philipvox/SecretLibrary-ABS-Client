/**
 * src/features/player/utils/__tests__/chapterUtils.test.ts
 *
 * Tests for chapter navigation and boundary detection utilities.
 */

import {
  findChapterIndex,
  detectChapterCrossing,
  detectAllChapterCrossings,
  calculatePrevChapterPosition,
  calculateNextChapterPosition,
  clampPosition,
  isAtStart,
  isAtEnd,
  calculateSeekPosition,
  getChapterProgress,
} from '../chapterUtils';
import { Chapter } from '../../stores/playerStore';

// Mock chapters for testing
const mockChapters: Chapter[] = [
  { title: 'Chapter 1', start: 0, end: 300 },
  { title: 'Chapter 2', start: 300, end: 600 },
  { title: 'Chapter 3', start: 600, end: 900 },
  { title: 'Chapter 4', start: 900, end: 1200 },
];

const emptyChapters: Chapter[] = [];

describe('chapterUtils', () => {
  describe('findChapterIndex', () => {
    it('returns 0 for empty chapters array', () => {
      expect(findChapterIndex(emptyChapters, 100)).toBe(0);
    });

    it('returns 0 for position at the start', () => {
      expect(findChapterIndex(mockChapters, 0)).toBe(0);
    });

    it('returns correct chapter index for position in middle of chapter', () => {
      expect(findChapterIndex(mockChapters, 150)).toBe(0);
      expect(findChapterIndex(mockChapters, 450)).toBe(1);
      expect(findChapterIndex(mockChapters, 750)).toBe(2);
      expect(findChapterIndex(mockChapters, 1050)).toBe(3);
    });

    it('returns correct chapter index for position at chapter boundary', () => {
      expect(findChapterIndex(mockChapters, 300)).toBe(1);
      expect(findChapterIndex(mockChapters, 600)).toBe(2);
      expect(findChapterIndex(mockChapters, 900)).toBe(3);
    });

    it('clamps negative positions to chapter 0', () => {
      expect(findChapterIndex(mockChapters, -100)).toBe(0);
    });

    it('returns last chapter for position beyond end', () => {
      expect(findChapterIndex(mockChapters, 1500)).toBe(3);
    });
  });

  describe('detectChapterCrossing', () => {
    it('returns null for empty chapters array', () => {
      expect(detectChapterCrossing(emptyChapters, 100, 200)).toBeNull();
    });

    it('returns null when staying in same chapter', () => {
      expect(detectChapterCrossing(mockChapters, 100, 200)).toBeNull();
      expect(detectChapterCrossing(mockChapters, 350, 450)).toBeNull();
    });

    it('detects forward chapter crossing', () => {
      const crossing = detectChapterCrossing(mockChapters, 250, 350);
      expect(crossing).not.toBeNull();
      expect(crossing!.fromChapterIndex).toBe(0);
      expect(crossing!.toChapterIndex).toBe(1);
      expect(crossing!.fromChapter.title).toBe('Chapter 1');
      expect(crossing!.toChapter.title).toBe('Chapter 2');
    });

    it('detects backward chapter crossing', () => {
      const crossing = detectChapterCrossing(mockChapters, 350, 250);
      expect(crossing).not.toBeNull();
      expect(crossing!.fromChapterIndex).toBe(1);
      expect(crossing!.toChapterIndex).toBe(0);
    });

    it('calculates positionInChapter correctly', () => {
      const crossing = detectChapterCrossing(mockChapters, 250, 400);
      expect(crossing).not.toBeNull();
      expect(crossing!.positionInChapter).toBe(100); // 400 - 300 = 100
    });
  });

  describe('detectAllChapterCrossings', () => {
    it('returns empty array for empty chapters', () => {
      expect(detectAllChapterCrossings(emptyChapters, 100, 200)).toEqual([]);
    });

    it('returns empty array when staying in same chapter', () => {
      expect(detectAllChapterCrossings(mockChapters, 100, 200)).toEqual([]);
    });

    it('returns single crossing for adjacent chapters', () => {
      const crossings = detectAllChapterCrossings(mockChapters, 250, 350);
      expect(crossings.length).toBe(1);
    });

    it('returns multiple crossings when skipping chapters forward', () => {
      const crossings = detectAllChapterCrossings(mockChapters, 100, 950);
      expect(crossings.length).toBeGreaterThan(1);
    });

    it('returns multiple crossings when skipping chapters backward', () => {
      const crossings = detectAllChapterCrossings(mockChapters, 950, 100);
      expect(crossings.length).toBeGreaterThan(1);
    });
  });

  describe('calculatePrevChapterPosition', () => {
    it('returns 0 for empty chapters', () => {
      const result = calculatePrevChapterPosition(emptyChapters, 100);
      expect(result.position).toBe(0);
      expect(result.chapterIndex).toBe(0);
    });

    it('restarts current chapter when more than threshold seconds in', () => {
      const result = calculatePrevChapterPosition(mockChapters, 310, 3);
      expect(result.position).toBe(300); // Start of chapter 2
      expect(result.chapterIndex).toBe(1);
    });

    it('goes to previous chapter when less than threshold seconds in', () => {
      const result = calculatePrevChapterPosition(mockChapters, 302, 3);
      expect(result.position).toBe(0); // Start of chapter 1
      expect(result.chapterIndex).toBe(0);
    });

    it('goes to start when already at first chapter', () => {
      const result = calculatePrevChapterPosition(mockChapters, 2, 3);
      expect(result.position).toBe(0);
      expect(result.chapterIndex).toBe(0);
    });

    it('uses custom threshold', () => {
      const result = calculatePrevChapterPosition(mockChapters, 308, 10);
      expect(result.position).toBe(0); // Goes back since 8 < 10 threshold
      expect(result.chapterIndex).toBe(0);
    });
  });

  describe('calculateNextChapterPosition', () => {
    it('returns null for empty chapters', () => {
      expect(calculateNextChapterPosition(emptyChapters, 100)).toBeNull();
    });

    it('returns next chapter start position', () => {
      const result = calculateNextChapterPosition(mockChapters, 150);
      expect(result).not.toBeNull();
      expect(result!.position).toBe(300);
      expect(result!.chapterIndex).toBe(1);
    });

    it('returns null when already at last chapter', () => {
      const result = calculateNextChapterPosition(mockChapters, 950);
      expect(result).toBeNull();
    });
  });

  describe('clampPosition', () => {
    it('clamps negative values to 0', () => {
      expect(clampPosition(-100, 1000)).toBe(0);
    });

    it('clamps values above duration to duration', () => {
      expect(clampPosition(1500, 1000)).toBe(1000);
    });

    it('returns value unchanged when within bounds', () => {
      expect(clampPosition(500, 1000)).toBe(500);
    });

    it('handles zero duration', () => {
      expect(clampPosition(100, 0)).toBe(0);
    });
  });

  describe('isAtStart', () => {
    it('returns true when position is 0', () => {
      expect(isAtStart(0)).toBe(true);
    });

    it('returns true when position is within tolerance', () => {
      expect(isAtStart(0.3, 0.5)).toBe(true);
    });

    it('returns false when position is beyond tolerance', () => {
      expect(isAtStart(1, 0.5)).toBe(false);
    });

    it('uses default tolerance of 0.5', () => {
      expect(isAtStart(0.4)).toBe(true);
      expect(isAtStart(0.6)).toBe(false);
    });
  });

  describe('isAtEnd', () => {
    it('returns true when position equals duration', () => {
      expect(isAtEnd(1000, 1000)).toBe(true);
    });

    it('returns true when position is within tolerance of end', () => {
      expect(isAtEnd(999.7, 1000, 0.5)).toBe(true);
    });

    it('returns false when position is beyond tolerance from end', () => {
      expect(isAtEnd(999, 1000, 0.5)).toBe(false);
    });

    it('uses default tolerance of 0.5', () => {
      expect(isAtEnd(999.6, 1000)).toBe(true);
      expect(isAtEnd(999.4, 1000)).toBe(false);
    });
  });

  describe('calculateSeekPosition', () => {
    const duration = 1200;

    it('calculates forward seek correctly', () => {
      const result = calculateSeekPosition(mockChapters, 100, 50, duration);
      expect(result.targetPosition).toBe(150);
      expect(result.boundaryHit).toBeNull();
    });

    it('calculates backward seek correctly', () => {
      const result = calculateSeekPosition(mockChapters, 100, -50, duration);
      expect(result.targetPosition).toBe(50);
      expect(result.boundaryHit).toBeNull();
    });

    it('clamps to start and reports boundary hit', () => {
      const result = calculateSeekPosition(mockChapters, 50, -100, duration);
      expect(result.targetPosition).toBe(0);
      expect(result.boundaryHit).toBe('start');
    });

    it('clamps to end and reports boundary hit', () => {
      const result = calculateSeekPosition(mockChapters, 1150, 100, duration);
      expect(result.targetPosition).toBe(1200);
      expect(result.boundaryHit).toBe('end');
    });

    it('detects chapter crossing during seek', () => {
      const result = calculateSeekPosition(mockChapters, 250, 100, duration);
      expect(result.crossing).not.toBeNull();
      expect(result.crossing!.fromChapterIndex).toBe(0);
      expect(result.crossing!.toChapterIndex).toBe(1);
    });

    it('returns null crossing when staying in chapter', () => {
      const result = calculateSeekPosition(mockChapters, 100, 50, duration);
      expect(result.crossing).toBeNull();
    });
  });

  describe('getChapterProgress', () => {
    it('returns 0 for empty chapters', () => {
      expect(getChapterProgress(emptyChapters, 100)).toBe(0);
    });

    it('returns 0 at chapter start', () => {
      expect(getChapterProgress(mockChapters, 300)).toBe(0);
    });

    it('returns 0.5 at chapter midpoint', () => {
      expect(getChapterProgress(mockChapters, 450)).toBeCloseTo(0.5, 2);
    });

    it('returns close to 1 near chapter end', () => {
      expect(getChapterProgress(mockChapters, 299)).toBeCloseTo(0.997, 2);
    });

    it('clamps to valid range', () => {
      expect(getChapterProgress(mockChapters, 0)).toBeGreaterThanOrEqual(0);
      expect(getChapterProgress(mockChapters, 1200)).toBeLessThanOrEqual(1);
    });
  });
});
