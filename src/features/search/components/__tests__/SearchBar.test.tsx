/**
 * src/features/search/components/__tests__/SearchBar.test.tsx
 *
 * Tests for SearchBar component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

// Mock the Icon component
jest.mock('@/shared/components/Icon', () => ({
  Icon: ({ name, testID, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || `icon-${name}`} {...props} />;
  },
}));

// Mock the theme
jest.mock('@/shared/theme', () => ({
  useTheme: () => ({
    colors: {
      search: {
        inputBackground: '#2A2A2A',
        placeholder: '#888888',
      },
      background: {
        secondary: '#F0F0F0',
      },
      text: {
        primary: '#FFFFFF',
        inverse: '#000000',
        tertiary: '#999999',
      },
      icon: {
        tertiary: '#888888',
      },
    },
    isDark: true,
  }),
}));

describe('SearchBar', () => {
  const mockOnChangeText = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Search audiobooks..."
      />
    );

    expect(getByPlaceholderText('Search audiobooks...')).toBeTruthy();
  });

  it('renders with default placeholder when not provided', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={mockOnChangeText} />
    );

    expect(getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('displays the current value', () => {
    const { getByDisplayValue } = render(
      <SearchBar value="Harry Potter" onChangeText={mockOnChangeText} />
    );

    expect(getByDisplayValue('Harry Potter')).toBeTruthy();
  });

  it('calls onChangeText when text is entered', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Search...');
    fireEvent.changeText(input, 'Lord of the Rings');

    expect(mockOnChangeText).toHaveBeenCalledWith('Lord of the Rings');
  });

  it('shows clear button when value is not empty', () => {
    const { getByTestId } = render(
      <SearchBar value="Test Query" onChangeText={mockOnChangeText} />
    );

    // Clear button icon should be visible
    expect(getByTestId('icon-XCircle')).toBeTruthy();
  });

  it('hides clear button when value is empty', () => {
    const { queryByTestId } = render(
      <SearchBar value="" onChangeText={mockOnChangeText} />
    );

    // Clear button icon should not be visible
    expect(queryByTestId('icon-XCircle')).toBeNull();
  });

  it('calls onChangeText with empty string and onClear when clear button is pressed', () => {
    const { getByTestId } = render(
      <SearchBar
        value="Test Query"
        onChangeText={mockOnChangeText}
        onClear={mockOnClear}
      />
    );

    const clearButton = getByTestId('icon-XCircle').parent;
    fireEvent.press(clearButton!);

    expect(mockOnChangeText).toHaveBeenCalledWith('');
    expect(mockOnClear).toHaveBeenCalled();
  });

  it('clears text without onClear callback', () => {
    const { getByTestId } = render(
      <SearchBar value="Test Query" onChangeText={mockOnChangeText} />
    );

    const clearButton = getByTestId('icon-XCircle').parent;
    fireEvent.press(clearButton!);

    expect(mockOnChangeText).toHaveBeenCalledWith('');
  });

  it('renders search icon', () => {
    const { getByTestId } = render(
      <SearchBar value="" onChangeText={mockOnChangeText} />
    );

    expect(getByTestId('icon-Search')).toBeTruthy();
  });

  it('applies autoFocus when specified', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        value=""
        onChangeText={mockOnChangeText}
        autoFocus={true}
      />
    );

    const input = getByPlaceholderText('Search...');
    expect(input.props.autoFocus).toBe(true);
  });

  it('has correct input configuration', () => {
    const { getByPlaceholderText } = render(
      <SearchBar value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Search...');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.returnKeyType).toBe('search');
  });
});
