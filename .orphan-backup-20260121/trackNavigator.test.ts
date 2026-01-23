/**
 * Tests for Track Navigator utility functions
 */

import {
  findTrackForPosition,
  calculateGlobalPosition,
  isNearTrackEnd,
  getNextTrackIndex,
  getPreviousTrackIndex,
  calculateTotalDuration,
  getTrackAtIndex,
} from '../trackNavigator';
import { AudioTrackInfo } from '../types';

// Mock tracks representing a 3-track audiobook
const mockTracks: AudioTrackInfo[] = [
  { url: 'track1.mp3', title: 'Track 1', startOffset: 0, duration: 1800 }, // 30 min
  { url: 'track2.mp3', title: 'Track 2', startOffset: 1800, duration: 1800 }, // 30 min
  { url: 'track3.mp3', title: 'Track 3', startOffset: 3600, duration: 1800 }, // 30 min
];

describe('findTrackForPosition', () => {
  it('returns null for empty tracks', () => {
    expect(findTrackForPosition([], 100)).toBeNull();
  });

  it('finds track at start of book', () => {
    const result = findTrackForPosition(mockTracks, 0);
    expect(result).toEqual({ trackIndex: 0, positionInTrack: 0 });
  });

  it('finds track in middle of first track', () => {
    const result = findTrackForPosition(mockTracks, 900); // 15 minutes
    expect(result).toEqual({ trackIndex: 0, positionInTrack: 900 });
  });

  it('finds track at boundary (start of second track)', () => {
    const result = findTrackForPosition(mockTracks, 1800); // 30 minutes
    expect(result).toEqual({ trackIndex: 1, positionInTrack: 0 });
  });

  it('finds track in middle of second track', () => {
    const result = findTrackForPosition(mockTracks, 2700); // 45 minutes
    expect(result).toEqual({ trackIndex: 1, positionInTrack: 900 });
  });

  it('finds track in third track', () => {
    const result = findTrackForPosition(mockTracks, 4500); // 75 minutes
    expect(result).toEqual({ trackIndex: 2, positionInTrack: 900 });
  });

  it('handles position beyond all tracks', () => {
    const result = findTrackForPosition(mockTracks, 10000);
    expect(result?.trackIndex).toBe(2);
    expect(result?.positionInTrack).toBe(1800); // At end of last track
  });

  it('handles negative position', () => {
    const result = findTrackForPosition(mockTracks, -100);
    expect(result).toEqual({ trackIndex: 0, positionInTrack: 0 });
  });
});

describe('calculateGlobalPosition', () => {
  it('calculates position in first track', () => {
    expect(calculateGlobalPosition(mockTracks, 0, 500)).toBe(500);
  });

  it('calculates position in second track', () => {
    expect(calculateGlobalPosition(mockTracks, 1, 500)).toBe(2300);
  });

  it('calculates position in third track', () => {
    expect(calculateGlobalPosition(mockTracks, 2, 500)).toBe(4100);
  });

  it('handles invalid negative track index', () => {
    expect(calculateGlobalPosition(mockTracks, -1, 500)).toBe(0);
  });

  it('handles invalid high track index', () => {
    expect(calculateGlobalPosition(mockTracks, 99, 500)).toBe(0);
  });

  it('handles empty tracks array', () => {
    expect(calculateGlobalPosition([], 0, 500)).toBe(0);
  });
});

describe('isNearTrackEnd', () => {
  it('returns false when not near end', () => {
    expect(isNearTrackEnd(mockTracks, 0, 1000)).toBe(false);
  });

  it('returns true when within default threshold', () => {
    expect(isNearTrackEnd(mockTracks, 0, 1799.6)).toBe(true);
  });

  it('returns false when just outside default threshold', () => {
    expect(isNearTrackEnd(mockTracks, 0, 1799.4)).toBe(false);
  });

  it('uses custom threshold correctly', () => {
    expect(isNearTrackEnd(mockTracks, 0, 1795, 10)).toBe(true);
    expect(isNearTrackEnd(mockTracks, 0, 1785, 10)).toBe(false);
  });

  it('handles invalid track index', () => {
    expect(isNearTrackEnd(mockTracks, -1, 100)).toBe(false);
    expect(isNearTrackEnd(mockTracks, 99, 100)).toBe(false);
  });

  it('returns true at exactly track end', () => {
    expect(isNearTrackEnd(mockTracks, 0, 1800)).toBe(true);
  });
});

describe('getNextTrackIndex', () => {
  it('returns next index for first track', () => {
    expect(getNextTrackIndex(mockTracks, 0)).toBe(1);
  });

  it('returns next index for second track', () => {
    expect(getNextTrackIndex(mockTracks, 1)).toBe(2);
  });

  it('returns null for last track', () => {
    expect(getNextTrackIndex(mockTracks, 2)).toBeNull();
  });

  it('returns null for invalid high index', () => {
    expect(getNextTrackIndex(mockTracks, 99)).toBeNull();
  });
});

describe('getPreviousTrackIndex', () => {
  it('returns null for first track', () => {
    expect(getPreviousTrackIndex(0)).toBeNull();
  });

  it('returns previous index for second track', () => {
    expect(getPreviousTrackIndex(1)).toBe(0);
  });

  it('returns previous index for third track', () => {
    expect(getPreviousTrackIndex(2)).toBe(1);
  });

  it('returns null for negative index', () => {
    expect(getPreviousTrackIndex(-1)).toBeNull();
  });
});

describe('calculateTotalDuration', () => {
  it('calculates total duration correctly', () => {
    expect(calculateTotalDuration(mockTracks)).toBe(5400); // 90 minutes
  });

  it('returns 0 for empty tracks', () => {
    expect(calculateTotalDuration([])).toBe(0);
  });

  it('handles single track', () => {
    const singleTrack = [mockTracks[0]];
    expect(calculateTotalDuration(singleTrack)).toBe(1800);
  });
});

describe('getTrackAtIndex', () => {
  it('returns track at valid index', () => {
    expect(getTrackAtIndex(mockTracks, 0)).toEqual(mockTracks[0]);
    expect(getTrackAtIndex(mockTracks, 1)).toEqual(mockTracks[1]);
    expect(getTrackAtIndex(mockTracks, 2)).toEqual(mockTracks[2]);
  });

  it('returns null for invalid index', () => {
    expect(getTrackAtIndex(mockTracks, -1)).toBeNull();
    expect(getTrackAtIndex(mockTracks, 99)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getTrackAtIndex([], 0)).toBeNull();
  });
});
