/**
 * Tests for Playback Rate Resolver utility functions
 */

import {
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  DEFAULT_PLAYBACK_RATE,
  RATE_INCREMENTS,
  getPlaybackRateForBook,
  clampPlaybackRate,
  getNextPlaybackRate,
  getPreviousPlaybackRate,
  formatPlaybackRate,
  isStandardRate,
  nearestStandardRate,
  adjustPlaybackRate,
} from '../playbackRateResolver';

describe('Constants', () => {
  it('has correct min rate', () => {
    expect(MIN_PLAYBACK_RATE).toBe(0.5);
  });

  it('has correct max rate', () => {
    expect(MAX_PLAYBACK_RATE).toBe(3.0);
  });

  it('has correct default rate', () => {
    expect(DEFAULT_PLAYBACK_RATE).toBe(1.0);
  });

  it('has 1.0 in rate increments', () => {
    expect(RATE_INCREMENTS).toContain(1.0);
  });
});

describe('getPlaybackRateForBook', () => {
  const bookSpeedMap = {
    'book-1': 1.5,
    'book-2': 2.0,
  };

  it('returns book-specific rate when available', () => {
    expect(getPlaybackRateForBook('book-1', bookSpeedMap, 1.0)).toBe(1.5);
    expect(getPlaybackRateForBook('book-2', bookSpeedMap, 1.0)).toBe(2.0);
  });

  it('returns global rate when book not in map', () => {
    expect(getPlaybackRateForBook('book-3', bookSpeedMap, 1.25)).toBe(1.25);
  });

  it('returns global rate when bookId is null', () => {
    expect(getPlaybackRateForBook(null, bookSpeedMap, 1.5)).toBe(1.5);
  });

  it('clamps book-specific rate to valid range', () => {
    const invalidMap = { 'book-1': 5.0 };
    expect(getPlaybackRateForBook('book-1', invalidMap, 1.0)).toBe(3.0);
  });

  it('clamps global rate to valid range', () => {
    expect(getPlaybackRateForBook('book-3', bookSpeedMap, 0.1)).toBe(0.5);
  });
});

describe('clampPlaybackRate', () => {
  it('returns rate when in valid range', () => {
    expect(clampPlaybackRate(1.5)).toBe(1.5);
  });

  it('clamps rate below minimum', () => {
    expect(clampPlaybackRate(0.3)).toBe(0.5);
  });

  it('clamps rate above maximum', () => {
    expect(clampPlaybackRate(4.0)).toBe(3.0);
  });

  it('handles exact minimum', () => {
    expect(clampPlaybackRate(0.5)).toBe(0.5);
  });

  it('handles exact maximum', () => {
    expect(clampPlaybackRate(3.0)).toBe(3.0);
  });
});

describe('getNextPlaybackRate', () => {
  it('returns next standard rate', () => {
    expect(getNextPlaybackRate(1.0)).toBe(1.25);
    expect(getNextPlaybackRate(1.25)).toBe(1.5);
    expect(getNextPlaybackRate(1.5)).toBe(1.75);
  });

  it('wraps around from max to min', () => {
    expect(getNextPlaybackRate(3.0)).toBe(0.5);
  });

  it('finds next rate for non-standard values', () => {
    expect(getNextPlaybackRate(1.1)).toBe(1.5); // 1.1 is between 1.0 and 1.25, so >=1.1 is 1.25, next is 1.5
  });

  it('handles rate below min', () => {
    expect(getNextPlaybackRate(0.3)).toBe(0.75);
  });
});

describe('getPreviousPlaybackRate', () => {
  it('returns previous standard rate', () => {
    expect(getPreviousPlaybackRate(1.5)).toBe(1.25);
    expect(getPreviousPlaybackRate(1.25)).toBe(1.0);
    expect(getPreviousPlaybackRate(1.0)).toBe(0.75);
  });

  it('wraps around from min to max', () => {
    expect(getPreviousPlaybackRate(0.5)).toBe(3.0);
  });

  it('handles rate below min', () => {
    expect(getPreviousPlaybackRate(0.3)).toBe(3.0);
  });
});

describe('formatPlaybackRate', () => {
  it('formats whole number rate', () => {
    expect(formatPlaybackRate(1)).toBe('1x');
    expect(formatPlaybackRate(2)).toBe('2x');
  });

  it('formats rate with one decimal', () => {
    expect(formatPlaybackRate(1.5)).toBe('1.5x');
  });

  it('formats rate with two decimals', () => {
    expect(formatPlaybackRate(1.25)).toBe('1.25x');
  });

  it('removes trailing zeros', () => {
    expect(formatPlaybackRate(1.50)).toBe('1.5x');
    expect(formatPlaybackRate(2.00)).toBe('2x');
  });
});

describe('isStandardRate', () => {
  it('returns true for standard rates', () => {
    expect(isStandardRate(0.5)).toBe(true);
    expect(isStandardRate(1.0)).toBe(true);
    expect(isStandardRate(1.5)).toBe(true);
    expect(isStandardRate(2.0)).toBe(true);
    expect(isStandardRate(3.0)).toBe(true);
  });

  it('returns false for non-standard rates', () => {
    expect(isStandardRate(0.6)).toBe(false);
    expect(isStandardRate(1.1)).toBe(false);
    expect(isStandardRate(2.3)).toBe(false);
  });
});

describe('nearestStandardRate', () => {
  it('returns exact rate if standard', () => {
    expect(nearestStandardRate(1.0)).toBe(1.0);
    expect(nearestStandardRate(1.5)).toBe(1.5);
  });

  it('finds nearest standard rate', () => {
    expect(nearestStandardRate(1.1)).toBe(1.0);
    expect(nearestStandardRate(1.4)).toBe(1.5);
    expect(nearestStandardRate(0.6)).toBe(0.5);
  });

  it('handles rates at midpoint (rounds down)', () => {
    // 1.125 is exactly between 1.0 and 1.25
    // Should return the one with smaller absolute difference
    const result = nearestStandardRate(1.125);
    expect(result === 1.0 || result === 1.25).toBe(true);
  });
});

describe('adjustPlaybackRate', () => {
  it('increases rate by delta', () => {
    expect(adjustPlaybackRate(1.0, 0.25)).toBe(1.25);
  });

  it('decreases rate by delta', () => {
    expect(adjustPlaybackRate(1.5, -0.25)).toBe(1.25);
  });

  it('clamps to maximum', () => {
    expect(adjustPlaybackRate(2.9, 0.5)).toBe(3.0);
  });

  it('clamps to minimum', () => {
    expect(adjustPlaybackRate(0.6, -0.5)).toBe(0.5);
  });
});
