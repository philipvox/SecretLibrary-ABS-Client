/**
 * src/shared/components/__tests__/ErrorView.test.tsx
 *
 * Tests for ErrorView component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorView } from '../ErrorView';

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  colors: {
    error: '#ff3b30',
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    backgroundTertiary: '#1a1a1a',
    backgroundPrimary: '#000000',
    accent: '#C1F40C',
    cardBackground: '#2a2a2a',
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
    labelMedium: { fontSize: 12 },
  },
  scale: (val: number) => val,
}));

// Mock netinfo
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

describe('ErrorView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default generic error', () => {
    const { getByText } = render(<ErrorView />);

    expect(getByText('Something Went Wrong')).toBeTruthy();
    expect(getByText('An unexpected error occurred. Please try again.')).toBeTruthy();
  });

  it('renders network error type', () => {
    const { getByText } = render(<ErrorView type="network" />);

    expect(getByText('No Internet Connection')).toBeTruthy();
    expect(getByText('Check your Wi-Fi or cellular connection and try again.')).toBeTruthy();
  });

  it('renders server error type', () => {
    const { getByText } = render(<ErrorView type="server" />);

    expect(getByText('Server Unavailable')).toBeTruthy();
    expect(getByText('The server is not responding. It may be down for maintenance.')).toBeTruthy();
  });

  it('renders auth error type', () => {
    const { getByText } = render(<ErrorView type="auth" />);

    expect(getByText('Session Expired')).toBeTruthy();
    expect(getByText('Please sign in again to continue.')).toBeTruthy();
  });

  it('renders notFound error type', () => {
    const { getByText } = render(<ErrorView type="notFound" />);

    expect(getByText('Content Not Found')).toBeTruthy();
    expect(getByText('This item may have been moved or deleted.')).toBeTruthy();
  });

  it('uses custom title when provided', () => {
    const { getByText } = render(
      <ErrorView title="Custom Error Title" />
    );

    expect(getByText('Custom Error Title')).toBeTruthy();
  });

  it('uses custom message when provided', () => {
    const { getByText } = render(
      <ErrorView message="This is a custom error message" />
    );

    expect(getByText('This is a custom error message')).toBeTruthy();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorView onRetry={onRetry} />
    );

    expect(getByText('Try Again')).toBeTruthy();
  });

  it('calls onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorView onRetry={onRetry} />
    );

    fireEvent.press(getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses custom retry label when provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorView onRetry={onRetry} retryLabel="Reload" />
    );

    expect(getByText('Reload')).toBeTruthy();
  });

  it('shows "Retrying..." when isRetrying is true', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorView onRetry={onRetry} isRetrying={true} />
    );

    expect(getByText('Retrying...')).toBeTruthy();
  });

  it('renders secondary action button when provided', () => {
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <ErrorView
        onSecondaryAction={onSecondaryAction}
        secondaryLabel="Go Home"
      />
    );

    expect(getByText('Go Home')).toBeTruthy();
  });

  it('calls onSecondaryAction when secondary button is pressed', () => {
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <ErrorView
        onSecondaryAction={onSecondaryAction}
        secondaryLabel="Go Home"
      />
    );

    fireEvent.press(getByText('Go Home'));
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it('uses default "Go Back" label for secondary action', () => {
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <ErrorView onSecondaryAction={onSecondaryAction} />
    );

    expect(getByText('Go Back')).toBeTruthy();
  });

  it('renders both action buttons when both are provided', () => {
    const onRetry = jest.fn();
    const onSecondaryAction = jest.fn();
    const { getByText } = render(
      <ErrorView
        onRetry={onRetry}
        onSecondaryAction={onSecondaryAction}
      />
    );

    expect(getByText('Try Again')).toBeTruthy();
    expect(getByText('Go Back')).toBeTruthy();
  });

  describe('offline detection', () => {
    it('shows network error when offline', () => {
      const { useNetInfo } = require('@react-native-community/netinfo');
      useNetInfo.mockReturnValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
      });

      const { getByText } = render(<ErrorView type="generic" />);

      // Should override to network error type
      expect(getByText('No Internet Connection')).toBeTruthy();
      expect(getByText('Offline')).toBeTruthy();
    });

    it('shows offline indicator when disconnected', () => {
      const { useNetInfo } = require('@react-native-community/netinfo');
      useNetInfo.mockReturnValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
      });

      const { getByText } = render(<ErrorView />);

      expect(getByText('Offline')).toBeTruthy();
    });
  });
});
