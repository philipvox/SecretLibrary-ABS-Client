/**
 * src/features/library/components/__tests__/HorizontalBookItem.test.tsx
 *
 * Tests for HorizontalBookItem component.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { HorizontalBookItem } from '../HorizontalBookItem';
import { LibraryItem } from '@/core/types';

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    progressTrack: '#333333',
  },
  spacing: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  radius: {
    md: 8,
  },
  elevation: {
    small: {},
  },
}));

// Mock the API client
const mockGetItem = jest.fn();
const mockGetItemCoverUrl = jest.fn();
jest.mock('@/core/api', () => ({
  apiClient: {
    getItem: (...args: any[]) => mockGetItem(...args),
    getItemCoverUrl: (...args: any[]) => mockGetItemCoverUrl(...args),
  },
}));

// Mock the player store
const mockLoadBook = jest.fn();
jest.mock('@/features/player', () => ({
  usePlayerStore: () => ({
    loadBook: mockLoadBook,
  }),
}));

// Mock metadata utilities
jest.mock('@/shared/utils/metadata', () => ({
  getTitle: jest.fn((book) => book.media?.metadata?.title || 'Unknown Title'),
  getAuthorName: jest.fn((book) => book.media?.metadata?.authorName || 'Unknown Author'),
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

describe('HorizontalBookItem', () => {
  const mockBook: LibraryItem = {
    id: 'book-123',
    ino: 'ino-123',
    libraryId: 'lib-1',
    folderId: 'folder-1',
    path: '/path/to/book',
    relPath: 'book',
    isFile: false,
    mtimeMs: 1234567890,
    ctimeMs: 1234567890,
    birthtimeMs: 1234567890,
    addedAt: 1234567890,
    updatedAt: 1234567890,
    lastScan: 1234567890,
    scanVersion: '1.0.0',
    isMissing: false,
    isInvalid: false,
    mediaType: 'book',
    media: {
      id: 'media-123',
      metadata: {
        title: 'Test Book Title',
        authorName: 'Test Author',
        description: 'This is a test description for the book that should be truncated if it exceeds 100 characters in length.',
      } as any,
      audioFiles: [],
      chapters: [],
      duration: 3600,
      size: 100000000,
      tags: [],
    },
    libraryFiles: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemCoverUrl.mockReturnValue('https://example.com/cover.jpg');
    mockGetItem.mockResolvedValue(mockBook);
    mockLoadBook.mockResolvedValue(undefined);
  });

  it('renders book title correctly', () => {
    const { getByText } = render(<HorizontalBookItem book={mockBook} />);
    expect(getByText('Test Book Title')).toBeTruthy();
  });

  it('renders author name correctly', () => {
    const { getByText } = render(<HorizontalBookItem book={mockBook} />);
    expect(getByText('Test Author')).toBeTruthy();
  });

  it('renders truncated description', () => {
    const { getByText } = render(<HorizontalBookItem book={mockBook} />);
    // Description should be truncated and end with ...
    expect(getByText(/This is a test description.*\.\.\./)).toBeTruthy();
  });

  it('has correct accessibility label', () => {
    const { getByLabelText } = render(<HorizontalBookItem book={mockBook} />);
    expect(getByLabelText('Test Book Title by Test Author')).toBeTruthy();
  });

  it('calls API to get full book details on press', async () => {
    const { getByText } = render(<HorizontalBookItem book={mockBook} />);

    fireEvent.press(getByText('Test Book Title'));

    await waitFor(() => {
      expect(mockGetItem).toHaveBeenCalledWith('book-123');
    });
  });

  it('loads book after fetching full details', async () => {
    const fullBook = { ...mockBook, additionalData: 'full' };
    mockGetItem.mockResolvedValue(fullBook);

    const { getByText } = render(<HorizontalBookItem book={mockBook} />);

    fireEvent.press(getByText('Test Book Title'));

    await waitFor(() => {
      expect(mockLoadBook).toHaveBeenCalledWith(fullBook, { autoPlay: false });
    });
  });

  it('falls back to original book data if API call fails', async () => {
    mockGetItem.mockRejectedValue(new Error('API Error'));

    const { getByText } = render(<HorizontalBookItem book={mockBook} />);

    fireEvent.press(getByText('Test Book Title'));

    await waitFor(() => {
      expect(mockLoadBook).toHaveBeenCalledWith(mockBook, { autoPlay: false });
    });
  });

  it('renders without description when not available', () => {
    const bookWithoutDescription: LibraryItem = {
      ...mockBook,
      media: {
        ...mockBook.media,
        metadata: {
          title: 'No Description Book',
          authorName: 'Author',
        } as any,
      },
    };

    const { queryByText, getByText } = render(<HorizontalBookItem book={bookWithoutDescription} />);

    // Should render title
    expect(getByText('No Description Book')).toBeTruthy();
    // Should not render description text from original book
    expect(queryByText(/This is a test/)).toBeNull();
  });

  it('renders placeholder when no cover URL', () => {
    mockGetItemCoverUrl.mockReturnValue(null);

    const { getByText } = render(<HorizontalBookItem book={mockBook} />);

    // Should show placeholder emoji
    expect(getByText('📖')).toBeTruthy();
  });

  it('renders different books correctly', () => {
    const anotherBook: LibraryItem = {
      ...mockBook,
      id: 'another-book',
      media: {
        ...mockBook.media,
        metadata: {
          title: 'Another Book',
          authorName: 'Different Author',
          description: 'Short desc',
        } as any,
      },
    };

    const { getByText } = render(<HorizontalBookItem book={anotherBook} />);

    expect(getByText('Another Book')).toBeTruthy();
    expect(getByText('Different Author')).toBeTruthy();
  });
});
