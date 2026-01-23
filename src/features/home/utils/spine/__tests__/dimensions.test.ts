/**
 * src/features/home/utils/spine/__tests__/dimensions.test.ts
 *
 * Comprehensive tests for dimension calculations.
 */

import {
  calculateWidth,
  calculateHeight,
  calculateTouchPadding,
  scaleDimensions,
  isThinSpine,
  isThickSpine,
  widthToDuration,
} from '../core/dimensions';

describe('Spine Dimensions', () => {
  describe('calculateWidth', () => {
    it('returns minimum width for very short audiobooks', () => {
      expect(calculateWidth(1800)).toBe(44);  // 30 minutes - MIN width
      expect(calculateWidth(3000)).toBe(44);  // 50 minutes - MIN width
    });

    it('returns maximum width for very long audiobooks', () => {
      expect(calculateWidth(180000)).toBe(280);  // 50 hours
      expect(calculateWidth(200000)).toBe(280);  // 55+ hours
    });

    it('scales with ease-out curve between min and max', () => {
      const w5hr = calculateWidth(18000);   // 5 hours
      const w10hr = calculateWidth(36000);  // 10 hours
      const w25hr = calculateWidth(90000);  // 25 hours

      // Should be increasing
      expect(w10hr).toBeGreaterThan(w5hr);
      expect(w25hr).toBeGreaterThan(w10hr);

      // With ease-out curve, early growth is faster than late growth
      // So diff5to10 should be greater than the proportional diff10to25/3
      const diff10to25 = w25hr - w10hr;
      const diff5to10 = w10hr - w5hr;
      expect(diff5to10).toBeGreaterThan(diff10to25 / 3);
    });

    it('returns median for undefined duration', () => {
      expect(calculateWidth(undefined)).toBe(44);  // MEDIAN = 44
    });

    it('returns median for null duration', () => {
      expect(calculateWidth(null as any)).toBe(44);  // MEDIAN = 44
    });

    it('returns median for zero duration', () => {
      expect(calculateWidth(0)).toBe(44);  // MEDIAN = 44
    });

    it('produces realistic widths for common audiobook lengths', () => {
      expect(calculateWidth(3600)).toBeGreaterThanOrEqual(44);    // 1hr - MIN
      expect(calculateWidth(18000)).toBeGreaterThanOrEqual(80);   // 5hr
      expect(calculateWidth(36000)).toBeGreaterThanOrEqual(120);  // 10hr
      expect(calculateWidth(90000)).toBeGreaterThanOrEqual(200);  // 25hr
    });
  });

  describe('calculateHeight', () => {
    it('returns consistent height for same book ID', () => {
      const h1 = calculateHeight('fantasy', 'book-123');
      const h2 = calculateHeight('fantasy', 'book-123');
      expect(h1).toBe(h2);
    });

    it('returns different heights for different book IDs', () => {
      const h1 = calculateHeight('fantasy', 'book-123');
      const h2 = calculateHeight('fantasy', 'book-456');
      // Should be different (very unlikely to be same with variation)
      expect(h1).not.toBe(h2);
    });

    it('uses genre-specific base heights', () => {
      const fantasy = calculateHeight('fantasy', 'test-1');
      const poetry = calculateHeight('poetry', 'test-1');
      const children = calculateHeight('children-0-2', 'test-1');

      // Fantasy should be taller than poetry
      expect(fantasy).toBeGreaterThan(poetry);
      // Poetry should be taller than toddler books
      expect(poetry).toBeGreaterThan(children);
    });

    it('clamps to min/max bounds', () => {
      // Test many random books
      for (let i = 0; i < 100; i++) {
        const height = calculateHeight('fantasy', `book-${i}`);
        expect(height).toBeGreaterThanOrEqual(290);  // MIN_HEIGHT
        expect(height).toBeLessThanOrEqual(450);     // MAX_HEIGHT
      }
    });

    it('uses default height for unknown genre', () => {
      const height = calculateHeight(undefined, 'book-123');
      expect(height).toBeGreaterThanOrEqual(290);
      expect(height).toBeLessThanOrEqual(450);
    });
  });

  describe('calculateTouchPadding', () => {
    it('returns 0 for widths >= 44px', () => {
      expect(calculateTouchPadding(44)).toBe(0);
      expect(calculateTouchPadding(50)).toBe(0);
      expect(calculateTouchPadding(100)).toBe(0);
    });

    it('returns padding for widths < 44px', () => {
      expect(calculateTouchPadding(20)).toBe(12);  // (44-20)/2 = 12
      expect(calculateTouchPadding(30)).toBe(7);   // (44-30)/2 = 7
      expect(calculateTouchPadding(40)).toBe(2);   // (44-40)/2 = 2
    });

    it('ensures total width meets 44px minimum', () => {
      const spineWidth = 30;
      const padding = calculateTouchPadding(spineWidth);
      const totalWidth = spineWidth + (padding * 2);
      expect(totalWidth).toBeGreaterThanOrEqual(44);
    });
  });

  describe('scaleDimensions', () => {
    it('scales dimensions correctly for shelf context', () => {
      const result = scaleDimensions(
        { width: 100, height: 400 },
        'shelf'
      );

      expect(result.width).toBe(100);   // 100 * 1.0 (shelf scale = 1)
      expect(result.height).toBe(400);  // 400 * 1.0 (shelf scale = 1)
      expect(result.scaleFactor).toBe(1);
      expect(result.context).toBe('shelf');
    });

    it('scales dimensions correctly for card context', () => {
      const result = scaleDimensions(
        { width: 100, height: 400 },
        'card'
      );

      expect(result.width).toBe(35);   // 100 * 0.35
      expect(result.height).toBe(140); // 400 * 0.35
      expect(result.scaleFactor).toBe(0.35);
    });

    it('calculates touch padding for scaled width', () => {
      const result = scaleDimensions(
        { width: 40, height: 400 },
        'card'  // 40 * 0.35 = 14px (way below 44px)
      );

      expect(result.touchPadding).toBeGreaterThan(0);
    });
  });

  describe('utility functions', () => {
    describe('isThinSpine', () => {
      it('identifies thin spines correctly', () => {
        expect(isThinSpine(20)).toBe(true);
        expect(isThinSpine(30)).toBe(true);
        expect(isThinSpine(40)).toBe(false);
        expect(isThinSpine(100)).toBe(false);
      });
    });

    describe('isThickSpine', () => {
      it('identifies thick spines correctly', () => {
        expect(isThickSpine(100)).toBe(false);
        expect(isThickSpine(150)).toBe(false);
        expect(isThickSpine(151)).toBe(true);
        expect(isThickSpine(200)).toBe(true);
      });
    });

    describe('widthToDuration', () => {
      it('returns correct duration descriptions', () => {
        expect(widthToDuration(25)).toBe('Under 3 hours');
        expect(widthToDuration(50)).toBe('3-10 hours');
        expect(widthToDuration(80)).toBe('10-20 hours');
        expect(widthToDuration(120)).toBe('20-35 hours');
        expect(widthToDuration(200)).toBe('Over 35 hours');
      });
    });
  });
});
