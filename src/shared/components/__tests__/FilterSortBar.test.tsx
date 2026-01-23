/**
 * src/shared/components/__tests__/FilterSortBar.test.tsx
 *
 * Tests for FilterSortBar component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FilterSortBar, SortOption } from '../FilterSortBar';

// Mock Icon component
jest.mock('../Icon', () => ({
  Icon: ({ name }: { name: string }) => null,
}));

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  scale: (val: number) => val,
  accentColors: {
    gold: '#F3B60C',
  },
  useTheme: () => ({
    colors: {
      text: {
        primary: '#ffffff',
        secondary: '#cccccc',
        tertiary: '#999999',
      },
      background: {
        primary: '#000000',
        secondary: '#1a1a1a',
        elevated: '#2a2a2a',
      },
      accent: {
        primary: '#F3B60C',
      },
      border: {
        default: '#333333',
      },
    },
  }),
}));

describe('FilterSortBar', () => {
  const mockOnSortChange = jest.fn();
  const mockOnGenreChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with sort button', () => {
      const { getAllByText } = render(
        <FilterSortBar sortBy="name-asc" onSortChange={mockOnSortChange} />
      );

      // At least one A → Z text should exist (the button)
      expect(getAllByText('A → Z').length).toBeGreaterThan(0);
    });

    it('displays current sort option label', () => {
      const { getAllByText } = render(
        <FilterSortBar sortBy="name-desc" onSortChange={mockOnSortChange} />
      );

      expect(getAllByText('Z → A').length).toBeGreaterThan(0);
    });

    it('displays book count sort option', () => {
      const { getAllByText } = render(
        <FilterSortBar sortBy="bookCount-desc" onSortChange={mockOnSortChange} />
      );

      expect(getAllByText('Most Books').length).toBeGreaterThan(0);
    });

    it('displays fewest books sort option', () => {
      const { getAllByText } = render(
        <FilterSortBar sortBy="bookCount-asc" onSortChange={mockOnSortChange} />
      );

      expect(getAllByText('Fewest Books').length).toBeGreaterThan(0);
    });
  });

  describe('sort modal', () => {
    it('opens sort modal when sort button is pressed', () => {
      const { getAllByText, getByText } = render(
        <FilterSortBar sortBy="name-asc" onSortChange={mockOnSortChange} />
      );

      // Press the first A → Z (the button)
      fireEvent.press(getAllByText('A → Z')[0]);

      // Modal should show "Sort By" title
      expect(getByText('Sort By')).toBeTruthy();
    });

    it('shows all sort options in modal', () => {
      const { getByText, getAllByText } = render(
        <FilterSortBar sortBy="name-asc" onSortChange={mockOnSortChange} />
      );

      fireEvent.press(getAllByText('A → Z')[0]);

      // Should have at least 2 A → Z (button + modal option)
      expect(getAllByText('A → Z').length).toBeGreaterThanOrEqual(2);
      expect(getByText('Z → A')).toBeTruthy();
      expect(getByText('Most Books')).toBeTruthy();
      expect(getByText('Fewest Books')).toBeTruthy();
    });

    it('calls onSortChange when option is selected', () => {
      const { getAllByText, getByText } = render(
        <FilterSortBar sortBy="name-asc" onSortChange={mockOnSortChange} />
      );

      // Open modal
      fireEvent.press(getAllByText('A → Z')[0]);
      // Select Z → A option
      fireEvent.press(getByText('Z → A'));

      expect(mockOnSortChange).toHaveBeenCalledWith('name-desc');
    });
  });

  describe('genre filter', () => {
    const genres = ['Fantasy', 'Mystery', 'Romance', 'Science Fiction'];

    it('does not show genre filter by default', () => {
      const { queryByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
        />
      );

      expect(queryByText('Genre')).toBeNull();
    });

    it('shows genre filter when showGenreFilter is true', () => {
      const { getByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      expect(getByText('Genre')).toBeTruthy();
    });

    it('does not show genre filter when genres array is empty', () => {
      const { queryByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={[]}
          showGenreFilter
        />
      );

      expect(queryByText('Genre')).toBeNull();
    });

    it('shows selected genre name when genre is selected', () => {
      const { getAllByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          selectedGenre="Fantasy"
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      // Fantasy appears in the button
      expect(getAllByText('Fantasy').length).toBeGreaterThan(0);
    });

    it('opens genre modal when genre button is pressed', () => {
      const { getByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      fireEvent.press(getByText('Genre'));

      expect(getByText('Filter by Genre')).toBeTruthy();
    });

    it('shows All Genres option in modal', () => {
      const { getByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      fireEvent.press(getByText('Genre'));

      expect(getByText('All Genres')).toBeTruthy();
    });

    it('shows all genres in modal', () => {
      const { getByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      fireEvent.press(getByText('Genre'));

      expect(getByText('Fantasy')).toBeTruthy();
      expect(getByText('Mystery')).toBeTruthy();
      expect(getByText('Romance')).toBeTruthy();
      expect(getByText('Science Fiction')).toBeTruthy();
    });

    it('calls onGenreChange when genre is selected', () => {
      const { getByText, getAllByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      fireEvent.press(getByText('Genre'));

      // Find Fantasy in the modal (might have multiple due to button showing selected)
      const fantasyButtons = getAllByText('Fantasy');
      fireEvent.press(fantasyButtons[fantasyButtons.length - 1]);

      expect(mockOnGenreChange).toHaveBeenCalledWith('Fantasy');
    });

    it('calls onGenreChange with null when All Genres is selected', () => {
      const { getAllByText, getByText } = render(
        <FilterSortBar
          sortBy="name-asc"
          onSortChange={mockOnSortChange}
          genres={genres}
          selectedGenre="Fantasy"
          showGenreFilter
          onGenreChange={mockOnGenreChange}
        />
      );

      // Press Fantasy button to open modal
      fireEvent.press(getAllByText('Fantasy')[0]);
      // Press All Genres option
      fireEvent.press(getByText('All Genres'));

      expect(mockOnGenreChange).toHaveBeenCalledWith(null);
    });
  });

  describe('all sort options', () => {
    const sortOptions: SortOption[] = ['name-asc', 'name-desc', 'bookCount-asc', 'bookCount-desc'];

    sortOptions.forEach((sortOption) => {
      it(`renders correctly with sortBy="${sortOption}"`, () => {
        const { toJSON } = render(
          <FilterSortBar sortBy={sortOption} onSortChange={mockOnSortChange} />
        );
        expect(toJSON()).toBeTruthy();
      });
    });
  });
});
