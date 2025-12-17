/**
 * src/shared/utils/__tests__/format.test.ts
 *
 * Tests for formatting utility functions.
 * These are pure functions with no external dependencies.
 */

// Import directly from the module (no expo dependencies)
import { formatBytes, formatFileSize, formatDuration } from '../format';

describe('formatBytes', () => {
  it('formats 0 bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500.00 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(2048)).toBe('2.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 500)).toBe('500.00 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.50 GB');
  });

  it('respects decimals parameter', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
    expect(formatBytes(1536, 3)).toBe('1.500 KB');
  });
});

describe('formatFileSize', () => {
  it('formats 0 bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 MB');
  });

  it('formats bytes with 1 decimal', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024 * 150)).toBe('150.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds correctly', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('handles negative seconds', () => {
    expect(formatDuration(-100)).toBe('0m');
  });

  it('formats minutes only', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(300)).toBe('5m');
    expect(formatDuration(1800)).toBe('30m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
    expect(formatDuration(7380)).toBe('2h 3m');
  });

  it('formats longer durations', () => {
    expect(formatDuration(37800)).toBe('10h 30m');
    expect(formatDuration(86400)).toBe('24h 0m');
  });

  it('rounds down partial minutes', () => {
    expect(formatDuration(90)).toBe('1m');
    expect(formatDuration(150)).toBe('2m');
  });
});
