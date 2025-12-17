/**
 * Tests for Smart Rewind functionality
 */

import { calculateSmartRewindSeconds } from '../../utils/smartRewindCalculator';

describe('calculateSmartRewindSeconds', () => {
  // Test cases based on the spec's anchor points
  const MAX_REWIND = 30; // Default max

  describe('No rewind for very brief pauses', () => {
    it('returns 0 for pause < 3 seconds', () => {
      expect(calculateSmartRewindSeconds(0, MAX_REWIND)).toBe(0);
      expect(calculateSmartRewindSeconds(1000, MAX_REWIND)).toBe(0);
      expect(calculateSmartRewindSeconds(2000, MAX_REWIND)).toBe(0);
      expect(calculateSmartRewindSeconds(2999, MAX_REWIND)).toBe(0);
    });
  });

  describe('Short pauses (3-10 seconds)', () => {
    it('returns ~3s for 3 second pause', () => {
      const result = calculateSmartRewindSeconds(3000, MAX_REWIND);
      expect(result).toBe(3);
    });

    it('returns ~5s for 10 second pause', () => {
      const result = calculateSmartRewindSeconds(10000, MAX_REWIND);
      expect(result).toBe(5);
    });
  });

  describe('Medium pauses (10-30 seconds)', () => {
    it('returns ~10s for 30 second pause', () => {
      const result = calculateSmartRewindSeconds(30000, MAX_REWIND);
      expect(result).toBe(10);
    });
  });

  describe('Longer pauses (30s - 2min)', () => {
    it('returns ~15s for 2 minute pause', () => {
      const result = calculateSmartRewindSeconds(120000, MAX_REWIND);
      expect(result).toBe(15);
    });
  });

  describe('Extended pauses (2-5 minutes)', () => {
    it('returns ~20s for 5 minute pause', () => {
      const result = calculateSmartRewindSeconds(300000, MAX_REWIND);
      expect(result).toBe(20);
    });
  });

  describe('Long pauses (5-15 minutes)', () => {
    it('returns ~25s for 15 minute pause', () => {
      const result = calculateSmartRewindSeconds(900000, MAX_REWIND);
      expect(result).toBe(25);
    });
  });

  describe('Very long pauses (15min - 1hr)', () => {
    it('returns ~30s for 1 hour pause', () => {
      const result = calculateSmartRewindSeconds(3600000, MAX_REWIND);
      expect(result).toBe(30);
    });
  });

  describe('Extended pauses (1hr - 24hr)', () => {
    it('returns up to max for 24 hour pause', () => {
      const result = calculateSmartRewindSeconds(86400000, MAX_REWIND);
      expect(result).toBeLessThanOrEqual(MAX_REWIND);
    });
  });

  describe('Max rewind capping', () => {
    it('respects max rewind setting of 15s', () => {
      const result = calculateSmartRewindSeconds(3600000, 15);
      expect(result).toBe(15);
    });

    it('respects max rewind setting of 60s', () => {
      const result = calculateSmartRewindSeconds(86400000, 60);
      expect(result).toBe(60); // 24hr+ pauses use max rewind setting
    });

    it('respects max rewind setting of 90s', () => {
      const result = calculateSmartRewindSeconds(86400000 * 2, 90);
      expect(result).toBe(90); // Should be max for > 24hr
    });
  });

  describe('Logarithmic curve behavior', () => {
    it('rewind increases logarithmically, not linearly', () => {
      // Get rewind values at different pause durations
      const at10s = calculateSmartRewindSeconds(10000, MAX_REWIND);
      const at20s = calculateSmartRewindSeconds(20000, MAX_REWIND);
      const at30s = calculateSmartRewindSeconds(30000, MAX_REWIND);
      const at60s = calculateSmartRewindSeconds(60000, MAX_REWIND);
      const at120s = calculateSmartRewindSeconds(120000, MAX_REWIND);
      const at300s = calculateSmartRewindSeconds(300000, MAX_REWIND);

      // Verify increasing trend
      expect(at20s).toBeGreaterThan(at10s);
      expect(at30s).toBeGreaterThan(at20s);
      expect(at60s).toBeGreaterThan(at30s);
      expect(at120s).toBeGreaterThan(at60s);
      expect(at300s).toBeGreaterThan(at120s);

      // Verify diminishing returns (logarithmic, not linear)
      // The difference between later intervals should be smaller
      const diff10to30 = at30s - at10s;
      const diff30to120 = at120s - at30s;

      // 120s pause is 4x longer than 30s, but rewind increase should be less than 4x
      expect(diff30to120).toBeLessThan(diff10to30 * 4);
    });
  });

  describe('Edge cases', () => {
    it('handles exactly 3 second pause (boundary)', () => {
      const result = calculateSmartRewindSeconds(3000, MAX_REWIND);
      expect(result).toBeGreaterThan(0);
    });

    it('handles very long pauses (1 week)', () => {
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      const result = calculateSmartRewindSeconds(oneWeek, 90);
      expect(result).toBe(90);
    });

    it('returns integer values', () => {
      // Check various durations return integers
      const testDurations = [5000, 15000, 45000, 90000, 180000, 600000];
      testDurations.forEach((duration) => {
        const result = calculateSmartRewindSeconds(duration, MAX_REWIND);
        expect(Number.isInteger(result)).toBe(true);
      });
    });
  });
});
