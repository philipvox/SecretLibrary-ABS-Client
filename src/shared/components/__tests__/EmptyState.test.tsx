/**
 * src/shared/components/__tests__/EmptyState.test.tsx
 *
 * Tests for EmptyState component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  colors: {
    textMuted: '#888888',
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    backgroundTertiary: '#1a1a1a',
    backgroundPrimary: '#000000',
    accent: '#C1F40C',
  },
  spacing: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    '3xl': 40,
    xs: 4,
  },
  radius: {
    card: 12,
  },
  layout: {
    minTouchTarget: 44,
  },
  typography: {
    displaySmall: { fontSize: 20 },
    bodyMedium: { fontSize: 14 },
    labelLarge: { fontSize: 16 },
  },
  scale: (val: number) => val,
}));

describe('EmptyState', () => {
  it('renders title correctly', () => {
    const { getByText } = render(
      <EmptyState title="No items found" />
    );

    expect(getByText('No items found')).toBeTruthy();
  });

  it('renders description when provided', () => {
    const { getByText } = render(
      <EmptyState
        title="No items"
        description="Try adding some items to see them here"
      />
    );

    expect(getByText('Try adding some items to see them here')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    const { queryByText } = render(
      <EmptyState title="No items" />
    );

    // The description text should not exist
    expect(queryByText('Try adding some items to see them here')).toBeNull();
  });

  it('renders action button when actionTitle and onAction provided', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No items"
        actionTitle="Add Item"
        onAction={onAction}
      />
    );

    expect(getByText('Add Item')).toBeTruthy();
  });

  it('calls onAction when action button is pressed', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No items"
        actionTitle="Add Item"
        onAction={onAction}
      />
    );

    fireEvent.press(getByText('Add Item'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when only actionTitle provided (no onAction)', () => {
    const { queryByText } = render(
      <EmptyState
        title="No items"
        actionTitle="Add Item"
      />
    );

    expect(queryByText('Add Item')).toBeNull();
  });

  it('renders secondary action when provided', () => {
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No items"
        secondaryActionTitle="Learn More"
        onSecondaryAction={onSecondaryAction}
      />
    );

    expect(getByText('Learn More')).toBeTruthy();
  });

  it('calls onSecondaryAction when secondary button is pressed', () => {
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No items"
        secondaryActionTitle="Learn More"
        onSecondaryAction={onSecondaryAction}
      />
    );

    fireEvent.press(getByText('Learn More'));
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it('renders both action buttons when both are provided', () => {
    const onAction = jest.fn();
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No items"
        actionTitle="Add Item"
        onAction={onAction}
        secondaryActionTitle="Learn More"
        onSecondaryAction={onSecondaryAction}
      />
    );

    expect(getByText('Add Item')).toBeTruthy();
    expect(getByText('Learn More')).toBeTruthy();
  });

  it('accepts different icon types', () => {
    // Test with string icon
    const { rerender } = render(
      <EmptyState title="Search" icon="search" />
    );

    // Test with another icon
    rerender(<EmptyState title="Downloads" icon="download" />);

    // Test with heart icon
    rerender(<EmptyState title="Favorites" icon="heart" />);

    // Test with list icon
    rerender(<EmptyState title="Items" icon="list" />);

    // All should render without errors
    expect(true).toBe(true);
  });

  it('accepts custom React element as icon', () => {
    const CustomIcon = () => <></>;

    const { getByText } = render(
      <EmptyState
        title="Custom Icon Test"
        icon={<CustomIcon />}
      />
    );

    expect(getByText('Custom Icon Test')).toBeTruthy();
  });
});
