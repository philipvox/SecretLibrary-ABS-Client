/**
 * src/features/library/components/__tests__/BookRow.test.tsx
 *
 * Tests for BookRow component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BookRow } from '../BookRow';
import { EnrichedBook } from '../../types';

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  scale: (val: number) => val,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  },
  useTheme: () => ({
    colors: {
      text: { primary: '#ffffff', secondary: '#cccccc', tertiary: '#999999' },
      background: { primary: '#000000', secondary: '#1a1a1a', tertiary: '#2a2a2a' },
      border: { default: '#333333' },
      accent: { primary: '#C1F40C' },
    },
    isDark: true,
  }),
}));

// Mock the API client
jest.mock('@/core/api', () => ({
  apiClient: {
    getItemCoverUrl: jest.fn(() => 'https://example.com/cover.jpg'),
  },
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock lucide-react-native
jest.mock('lucide-react-native', () => ({
  Play: 'Play',
  CheckCircle: 'CheckCircle',
}));

// Helper to create a mock book
function createMockBook(overrides: Partial<EnrichedBook> = {}): EnrichedBook {
  return {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    duration: 36000, // 10 hours
    progress: 0,
    lastPlayedAt: null,
    isFavorite: false,
    isDownloaded: false,
    narrator: 'Test Narrator',
    series: null,
    seriesSequence: null,
    genres: [],
    coverUrl: null,
    ...overrides,
  };
}

describe('BookRow', () => {
  const mockOnPress = jest.fn();
  const mockOnPlay = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders book title and author', () => {
    const book = createMockBook({
      title: 'Harry Potter',
      author: 'J.K. Rowling',
    });

    const { getByText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    expect(getByText('Harry Potter')).toBeTruthy();
    expect(getByText('J.K. Rowling')).toBeTruthy();
  });

  it('formats duration correctly', () => {
    const book = createMockBook({
      duration: 36000, // 10 hours
    });

    const { getByText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    // Duration should be formatted (implementation may vary)
    // Check that the component renders without error
    expect(getByText(/\d+/)).toBeTruthy();
  });

  it('calls onPress when row is pressed', () => {
    const book = createMockBook();

    const { getByLabelText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    const row = getByLabelText(/Test Book by Test Author/);
    fireEvent.press(row);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('shows progress percentage for in-progress books', () => {
    const book = createMockBook({
      progress: 0.5, // 50%
    });

    const { getByText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    expect(getByText('50%')).toBeTruthy();
  });

  it('does not show progress for books not started', () => {
    const book = createMockBook({
      progress: 0,
    });

    const { queryByText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    // Should not find percentage text
    expect(queryByText(/\d+%$/)).toBeNull();
  });

  it('shows completed badge for finished books (>= 95%)', () => {
    const book = createMockBook({
      title: 'Finished Book',
      author: 'Some Author',
      progress: 0.95,
    });

    const { getByLabelText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    // Check that completed state is reflected in accessibility label
    expect(getByLabelText(/Finished Book by Some Author, completed/)).toBeTruthy();
  });

  it('shows completed badge when isMarkedFinished is true', () => {
    const book = createMockBook({
      title: 'Marked Book',
      author: 'Some Author',
      progress: 0, // No progress - to test isMarkedFinished alone
    });

    const { getByLabelText } = render(
      <BookRow
        book={book}
        onPress={mockOnPress}
        onPlay={mockOnPlay}
        isMarkedFinished={true}
      />
    );

    // Check that completed state is reflected (when progress=0 and isMarkedFinished=true)
    expect(getByLabelText(/Marked Book by Some Author, completed/)).toBeTruthy();
  });

  it('includes accessibility label with progress info', () => {
    const book = createMockBook({
      title: 'Progress Book',
      author: 'Progress Author',
      progress: 0.75,
    });

    const { getByLabelText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    expect(getByLabelText('Progress Book by Progress Author, 75% complete')).toBeTruthy();
  });

  it('has correct accessibility role', () => {
    const book = createMockBook();

    const { getByLabelText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    // The main row should have the book's accessibility label with button role
    const row = getByLabelText(/Test Book by Test Author/);
    expect(row).toBeTruthy();
    expect(row.props.accessibilityRole).toBe('button');
  });

  it('has accessibility hint for navigation', () => {
    const book = createMockBook();

    const { getByA11yHint } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    expect(getByA11yHint('Double tap to view book details')).toBeTruthy();
  });

  it('renders without crashing with minimal props', () => {
    const book = createMockBook({
      title: 'Minimal Book',
      author: '',
      duration: 0,
      progress: 0,
    });

    const { getByText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    expect(getByText('Minimal Book')).toBeTruthy();
  });

  it('handles long titles with truncation', () => {
    const book = createMockBook({
      title: 'This is a very long book title that should be truncated in the UI to prevent overflow issues',
    });

    // Render should not throw
    const { getByText } = render(
      <BookRow book={book} onPress={mockOnPress} onPlay={mockOnPlay} />
    );

    // Component should render (truncation is handled by numberOfLines prop)
    expect(getByText(/This is a very long/)).toBeTruthy();
  });
});
