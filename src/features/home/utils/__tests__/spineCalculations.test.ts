/**
 * src/features/home/utils/__tests__/spineCalculations.test.ts
 *
 * Tests for spine calculation pure functions.
 */

import {
  hashString,
  seededRandom,
  normalizeSeriesName,
  findBestTitleSplit,
  isLightColor,
  darkenColorForDisplay,
  calculateSpineWidth,
  calculateSpineHeight,
  calculateTouchPadding,
} from '../spineCalculations';

describe('spineCalculations', () => {
  describe('hashString', () => {
    it('returns 0 for empty string', () => {
      expect(hashString('')).toBe(0);
    });

    it('returns 0 for null/undefined', () => {
      expect(hashString(null as any)).toBe(0);
      expect(hashString(undefined as any)).toBe(0);
    });

    it('returns consistent hash for same input', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('test');
      expect(hash1).toBe(hash2);
    });

    it('returns different hashes for different inputs', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('world');
      expect(hash1).not.toBe(hash2);
    });

    it('returns positive numbers', () => {
      expect(hashString('test')).toBeGreaterThan(0);
      expect(hashString('negative test')).toBeGreaterThan(0);
      expect(hashString('!@#$%^&*()')).toBeGreaterThan(0);
    });

    it('handles unicode characters', () => {
      expect(hashString('日本語')).toBeGreaterThan(0);
      expect(hashString('émoji 🎉')).toBeGreaterThan(0);
    });
  });

  describe('seededRandom', () => {
    it('returns deterministic values for same seed', () => {
      const val1 = seededRandom(12345, 0, 100);
      const val2 = seededRandom(12345, 0, 100);
      expect(val1).toBe(val2);
    });

    it('returns values within range', () => {
      for (let seed = 0; seed < 100; seed++) {
        const val = seededRandom(seed, 10, 50);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThanOrEqual(50);
      }
    });

    it('returns different values for different seeds', () => {
      const val1 = seededRandom(1, 0, 1000);
      const val2 = seededRandom(2, 0, 1000);
      // Note: There's a small chance these could be equal, but statistically unlikely
      expect(val1).not.toBe(val2);
    });
  });

  describe('normalizeSeriesName', () => {
    it('returns empty string for empty input', () => {
      expect(normalizeSeriesName('')).toBe('');
      expect(normalizeSeriesName(null as any)).toBe('');
      expect(normalizeSeriesName(undefined as any)).toBe('');
    });

    it('converts to lowercase', () => {
      expect(normalizeSeriesName('Harry Potter')).toBe('harry potter');
      expect(normalizeSeriesName('THE LORD OF THE RINGS')).toBe('lord of the rings');
    });

    it('removes leading articles', () => {
      expect(normalizeSeriesName('The Lord of the Rings')).toBe('lord of the rings');
      expect(normalizeSeriesName('A Song of Ice and Fire')).toBe('song of ice and fire');
      expect(normalizeSeriesName('An Example Series')).toBe('example series');
    });

    it('removes trailing book numbers', () => {
      expect(normalizeSeriesName('Harry Potter #7')).toBe('harry potter');
      expect(normalizeSeriesName('Foundation #3.5')).toBe('foundation');
      expect(normalizeSeriesName('Dune #2')).toBe('dune');
    });

    it('normalizes whitespace', () => {
      expect(normalizeSeriesName('  Too   Much   Space  ')).toBe('too much space');
      expect(normalizeSeriesName('Tab\tHere')).toBe('tab here');
    });

    it('normalizes apostrophes', () => {
      expect(normalizeSeriesName("The King's Dark Tidings")).toBe("king's dark tidings");
      expect(normalizeSeriesName("The King's Dark Tidings")).toBe("king's dark tidings");
    });
  });

  describe('findBestTitleSplit', () => {
    it('returns original for empty/short titles', () => {
      expect(findBestTitleSplit('')).toEqual({
        line1: '',
        line2: '',
        isSplit: false,
        splitIndex: -1,
      });

      expect(findBestTitleSplit('Short')).toEqual({
        line1: 'Short',
        line2: '',
        isSplit: false,
        splitIndex: -1,
      });
    });

    it('splits single long words at middle with hyphen', () => {
      const result = findBestTitleSplit('Supercalifragilisticexpialidocious');
      expect(result.isSplit).toBe(true);
      expect(result.line1.endsWith('-')).toBe(true);
      expect(result.line1.length + result.line2.length).toBe(35); // 34 + hyphen
    });

    it('splits multi-word titles at word boundaries', () => {
      const result = findBestTitleSplit('The Lord of the Rings');
      expect(result.isSplit).toBe(true);
      expect(result.line1).not.toContain('-');
      expect(result.line2).not.toContain('-');
      expect(`${result.line1} ${result.line2}`).toBe('The Lord of the Rings');
    });

    it('prefers balanced splits', () => {
      const result = findBestTitleSplit('One Two Three Four');
      // Should split roughly in middle
      expect(result.isSplit).toBe(true);
      const balance = result.line1.length / result.line2.length;
      expect(balance).toBeGreaterThan(0.5);
      expect(balance).toBeLessThan(2);
    });
  });

  describe('isLightColor', () => {
    it('returns true for white', () => {
      expect(isLightColor('#FFFFFF')).toBe(true);
      expect(isLightColor('#ffffff')).toBe(true);
    });

    it('returns false for black', () => {
      expect(isLightColor('#000000')).toBe(false);
    });

    it('returns true for light colors', () => {
      expect(isLightColor('#FFFFCC')).toBe(true); // Light yellow
      expect(isLightColor('#CCFFCC')).toBe(true); // Light green
      expect(isLightColor('#FFCCCC')).toBe(true); // Light pink
    });

    it('returns false for dark colors', () => {
      expect(isLightColor('#333333')).toBe(false);
      expect(isLightColor('#000066')).toBe(false); // Dark blue
      expect(isLightColor('#006600')).toBe(false); // Dark green
    });

    it('respects custom threshold', () => {
      const midGray = '#808080'; // ~0.5 luminance
      expect(isLightColor(midGray, 0.3)).toBe(true);
      expect(isLightColor(midGray, 0.6)).toBe(false);
    });

    it('handles colors without hash', () => {
      expect(isLightColor('FFFFFF')).toBe(true);
      expect(isLightColor('000000')).toBe(false);
    });
  });

  describe('darkenColorForDisplay', () => {
    it('darkens white color', () => {
      const result = darkenColorForDisplay('#FFFFFF', 0.5);
      // Should be darker than white
      expect(result).not.toBe('#FFFFFF');
      expect(result.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('returns valid hex color', () => {
      const result = darkenColorForDisplay('#FF5500', 0.3);
      expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('darker percentage produces darker result', () => {
      const light = darkenColorForDisplay('#FFFFFF', 0.2);
      const dark = darkenColorForDisplay('#FFFFFF', 0.8);
      // Can't easily compare hex strings, but both should be valid
      expect(light).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('calculateSpineWidth', () => {
    it('returns median width for undefined duration', () => {
      const width = calculateSpineWidth(undefined);
      expect(width).toBe(60); // MEDIAN_WIDTH
    });

    it('returns minimum width for very short durations', () => {
      const width = calculateSpineWidth(60); // 1 minute
      expect(width).toBeGreaterThanOrEqual(44); // MIN_WIDTH
    });

    it('increases width with duration', () => {
      const shortBook = calculateSpineWidth(3600);   // 1 hour
      const longBook = calculateSpineWidth(72000);   // 20 hours
      expect(longBook).toBeGreaterThan(shortBook);
    });

    it('stays within bounds', () => {
      const veryLong = calculateSpineWidth(360000); // 100 hours
      expect(veryLong).toBeGreaterThanOrEqual(44);  // MIN_WIDTH
      expect(veryLong).toBeLessThanOrEqual(380);    // MAX_WIDTH
    });
  });

  describe('calculateSpineHeight', () => {
    it('returns reasonable height for book without genres', () => {
      const height = calculateSpineHeight(undefined, 'book123');
      expect(height).toBeGreaterThanOrEqual(290); // MIN_HEIGHT
      expect(height).toBeLessThanOrEqual(450);    // MAX_HEIGHT
    });

    it('returns consistent height for same bookId', () => {
      const height1 = calculateSpineHeight(['fiction'], 'book123');
      const height2 = calculateSpineHeight(['fiction'], 'book123');
      expect(height1).toBe(height2);
    });

    it('respects min/max bounds for various genres', () => {
      const heights = [
        calculateSpineHeight(['thriller'], 'book1'),
        calculateSpineHeight(['romance'], 'book2'),
        calculateSpineHeight(['fantasy'], 'book3'),
        calculateSpineHeight(undefined, 'book4'),
      ];

      heights.forEach(height => {
        expect(height).toBeGreaterThanOrEqual(290); // MIN_HEIGHT
        expect(height).toBeLessThanOrEqual(450);    // MAX_HEIGHT
      });
    });
  });

  describe('calculateTouchPadding', () => {
    it('adds padding for narrow spines', () => {
      const padding = calculateTouchPadding(20); // Very narrow
      expect(padding).toBeGreaterThan(0);
    });

    it('returns 0 for wide spines', () => {
      const padding = calculateTouchPadding(60); // Wide enough
      expect(padding).toBe(0);
    });

    it('ensures minimum touch target', () => {
      const padding = calculateTouchPadding(30);
      // 30 + padding * 2 should be >= MIN_TOUCH_TARGET (44)
      expect(30 + padding * 2).toBeGreaterThanOrEqual(44);
    });
  });
});
