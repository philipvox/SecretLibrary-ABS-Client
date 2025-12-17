/**
 * src/shared/utils/__tests__/metadata.test.ts
 *
 * Tests for metadata extraction utility functions.
 */

import {
  getTitle,
  getAuthorName,
  getNarratorName,
  getNarratorNames,
  getDescription,
  getSeriesName,
  getSeriesWithSequence,
  getDuration,
  getFormattedDuration,
  formatDuration,
} from '../metadata';

// Helper to create mock LibraryItem (inline type to avoid importing types)
function createMockItem(metadata: Record<string, any>, duration?: number): any {
  return {
    id: 'test-id',
    ino: 'test-ino',
    libraryId: 'lib-1',
    folderId: 'folder-1',
    path: '/books/test',
    relPath: 'test',
    isFile: false,
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    birthtimeMs: Date.now(),
    addedAt: Date.now(),
    updatedAt: Date.now(),
    mediaType: 'book',
    media: {
      metadata,
      duration: duration || 0,
    },
  };
}

describe('getTitle', () => {
  it('returns title from metadata', () => {
    const item = createMockItem({ title: 'Test Book' });
    expect(getTitle(item)).toBe('Test Book');
  });

  it('returns "Unknown Title" when title is missing', () => {
    const item = createMockItem({});
    expect(getTitle(item)).toBe('Unknown Title');
  });

  it('handles null/undefined item', () => {
    expect(getTitle(null)).toBe('Unknown Title');
    expect(getTitle(undefined)).toBe('Unknown Title');
  });
});

describe('getAuthorName', () => {
  it('returns authorName when present', () => {
    const item = createMockItem({ authorName: 'John Doe' });
    expect(getAuthorName(item)).toBe('John Doe');
  });

  it('returns first author from authors array', () => {
    const item = createMockItem({
      authors: [{ name: 'Jane Smith' }, { name: 'Bob Jones' }],
    });
    expect(getAuthorName(item)).toBe('Jane Smith, Bob Jones');
  });

  it('prefers authorName over authors array', () => {
    const item = createMockItem({
      authorName: 'Preferred Author',
      authors: [{ name: 'Array Author' }],
    });
    expect(getAuthorName(item)).toBe('Preferred Author');
  });

  it('returns "Unknown Author" when no author data', () => {
    const item = createMockItem({});
    expect(getAuthorName(item)).toBe('Unknown Author');
  });

  it('handles null/undefined item', () => {
    expect(getAuthorName(null)).toBe('Unknown Author');
    expect(getAuthorName(undefined)).toBe('Unknown Author');
  });
});

describe('getNarratorName', () => {
  it('returns narratorName when present', () => {
    const item = createMockItem({ narratorName: 'Morgan Freeman' });
    expect(getNarratorName(item)).toBe('Morgan Freeman');
  });

  it('strips "Narrated by" prefix', () => {
    const item = createMockItem({ narratorName: 'Narrated by Morgan Freeman' });
    expect(getNarratorName(item)).toBe('Morgan Freeman');
  });

  it('handles case-insensitive "Narrated by" prefix', () => {
    const item = createMockItem({ narratorName: 'narrated by James Earl Jones' });
    expect(getNarratorName(item)).toBe('James Earl Jones');
  });

  it('returns narrators from array', () => {
    const item = createMockItem({
      narrators: ['Narrator One', 'Narrator Two'],
    });
    expect(getNarratorName(item)).toBe('Narrator One, Narrator Two');
  });

  it('handles narrator objects in array', () => {
    const item = createMockItem({
      narrators: [{ name: 'Object Narrator' }],
    });
    expect(getNarratorName(item)).toBe('Object Narrator');
  });

  it('returns "Unknown Narrator" when no narrator data', () => {
    const item = createMockItem({});
    expect(getNarratorName(item)).toBe('Unknown Narrator');
  });
});

describe('getNarratorNames', () => {
  it('returns array of narrator names from narrators array', () => {
    const item = createMockItem({
      narrators: ['Narrator A', 'Narrator B'],
    });
    expect(getNarratorNames(item)).toEqual(['Narrator A', 'Narrator B']);
  });

  it('parses comma-separated narratorName into array', () => {
    const item = createMockItem({
      narratorName: 'First Narrator, Second Narrator',
    });
    expect(getNarratorNames(item)).toEqual(['First Narrator', 'Second Narrator']);
  });

  it('returns empty array when no narrator data', () => {
    const item = createMockItem({});
    expect(getNarratorNames(item)).toEqual([]);
  });
});

describe('getDescription', () => {
  it('returns description when present', () => {
    const item = createMockItem({ description: 'A great book about testing.' });
    expect(getDescription(item)).toBe('A great book about testing.');
  });

  it('returns empty string when no description', () => {
    const item = createMockItem({});
    expect(getDescription(item)).toBe('');
  });

  it('handles null/undefined item', () => {
    expect(getDescription(null)).toBe('');
    expect(getDescription(undefined)).toBe('');
  });
});

describe('getSeriesName', () => {
  it('returns series name from seriesName string', () => {
    const item = createMockItem({ seriesName: 'Epic Series' });
    expect(getSeriesName(item)).toBe('Epic Series');
  });

  it('strips sequence number from seriesName', () => {
    const item = createMockItem({ seriesName: 'Epic Series #3' });
    expect(getSeriesName(item)).toBe('Epic Series');
  });

  it('handles decimal sequence numbers', () => {
    const item = createMockItem({ seriesName: 'Epic Series #3.5' });
    expect(getSeriesName(item)).toBe('Epic Series');
  });

  it('returns series name from series array', () => {
    const item = createMockItem({
      series: [{ name: 'Array Series', sequence: '1' }],
    });
    expect(getSeriesName(item)).toBe('Array Series');
  });

  it('returns null when no series data', () => {
    const item = createMockItem({});
    expect(getSeriesName(item)).toBeNull();
  });
});

describe('getSeriesWithSequence', () => {
  it('returns full seriesName with sequence', () => {
    const item = createMockItem({ seriesName: 'Epic Series #5' });
    expect(getSeriesWithSequence(item)).toBe('Epic Series #5');
  });

  it('constructs series with sequence from array', () => {
    const item = createMockItem({
      series: [{ name: 'Array Series', sequence: '3' }],
    });
    expect(getSeriesWithSequence(item)).toBe('Array Series #3');
  });

  it('returns just name when no sequence in array', () => {
    const item = createMockItem({
      series: [{ name: 'No Sequence Series' }],
    });
    expect(getSeriesWithSequence(item)).toBe('No Sequence Series');
  });

  it('returns null when no series data', () => {
    const item = createMockItem({});
    expect(getSeriesWithSequence(item)).toBeNull();
  });
});

describe('getDuration', () => {
  it('returns duration from item', () => {
    const item = createMockItem({}, 3600);
    expect(getDuration(item)).toBe(3600);
  });

  it('returns 0 when no duration', () => {
    const item = createMockItem({});
    expect(getDuration(item)).toBe(0);
  });

  it('handles null/undefined item', () => {
    expect(getDuration(null)).toBe(0);
    expect(getDuration(undefined)).toBe(0);
  });
});

describe('formatDuration (metadata version)', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7200)).toBe('2h 0m');
  });

  it('formats minutes only for < 1 hour', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(1800)).toBe('30m');
  });

  it('returns "Unknown" for invalid values', () => {
    expect(formatDuration(0)).toBe('Unknown');
    expect(formatDuration(-100)).toBe('Unknown');
    expect(formatDuration(null)).toBe('Unknown');
    expect(formatDuration(undefined)).toBe('Unknown');
    expect(formatDuration(NaN)).toBe('Unknown');
  });
});

describe('getFormattedDuration', () => {
  it('returns formatted duration', () => {
    const item = createMockItem({}, 7200);
    expect(getFormattedDuration(item)).toBe('2h 0m');
  });

  it('returns "Unknown" for items without duration', () => {
    const item = createMockItem({});
    expect(getFormattedDuration(item)).toBe('Unknown');
  });
});
