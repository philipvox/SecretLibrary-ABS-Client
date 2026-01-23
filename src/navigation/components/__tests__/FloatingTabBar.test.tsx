/**
 * src/navigation/components/__tests__/FloatingTabBar.test.tsx
 *
 * Tests for FloatingTabBar component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FloatingTabBar } from '../FloatingTabBar';
import { Platform } from 'react-native';

// Mock Platform to return ios for consistent testing
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((config: any) => config.ios),
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Svg: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Path: (props: any) => <View testID="svg-path" {...props} />,
    Rect: (props: any) => <View testID="svg-rect" {...props} />,
  };
});

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

// Mock navigation functions
const mockNavigate = jest.fn();
const mockUnsubscribe = jest.fn();
const mockAddListener = jest.fn((event: string, callback: () => void) => {
  // Call callback immediately to set up state
  setTimeout(() => callback(), 0);
  return mockUnsubscribe;
});
const mockGetState = jest.fn(() => ({
  routes: [{ name: 'HomeTab' }],
  index: 0,
}));

// Mock useNavigationWithLoading which provides navigation
jest.mock('@/shared/hooks', () => ({
  useNavigationWithLoading: () => ({
    navigateWithLoading: jest.fn(),
    navigation: {
      navigate: mockNavigate,
      addListener: mockAddListener,
      getState: mockGetState,
    },
  }),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
    getState: mockGetState,
  }),
}));

// Mock player store - return isPlayerVisible: false so tab bar shows
jest.mock('@/features/player', () => ({
  usePlayerStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      const state = {
        isPlayerVisible: false,
        closePlayer: jest.fn(),
      };
      return selector(state);
    }
    return { isPlayerVisible: false, closePlayer: jest.fn() };
  }),
}));

// Mock theme
jest.mock('@/shared/theme', () => ({
  spacing: { sm: 8, md: 12, lg: 16 },
  useTheme: () => ({
    colors: {
      nav: {
        background: '#FFFFFF',
        active: '#000000',
        inactive: '#666666',
      },
    },
    isDark: false,
  }),
}));

// Mock theme colors
jest.mock('@/shared/theme/colors', () => ({
  darkColors: {
    nav: {
      background: '#FFFFFF',
      active: '#000000',
      inactive: '#666666',
    },
  },
}));

// Mock zustand useShallow - just pass through
jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

describe('FloatingTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset navigation state to HomeTab
    mockGetState.mockReturnValue({
      routes: [{ name: 'HomeTab' }],
      index: 0,
    });
  });

  it('renders all five tabs', async () => {
    const { findByText } = render(<FloatingTabBar />);

    // Use findBy for async rendering
    expect(await findByText('Home')).toBeTruthy();
    expect(await findByText('Library')).toBeTruthy();
    expect(await findByText('Browse')).toBeTruthy();
    expect(await findByText('Search')).toBeTruthy();
    expect(await findByText('Profile')).toBeTruthy();
  });

  it('renders tab icons', async () => {
    const { findAllByTestId } = render(<FloatingTabBar />);

    // Each icon is rendered with SVG paths
    const paths = await findAllByTestId('svg-path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('calls navigate when Library tab is pressed', async () => {
    const { findByText } = render(<FloatingTabBar />);

    const libraryTab = await findByText('Library');
    fireEvent.press(libraryTab);

    expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'LibraryTab' });
  });

  it('calls navigate for Search tab', async () => {
    const { findByText } = render(<FloatingTabBar />);

    const searchTab = await findByText('Search');
    fireEvent.press(searchTab);

    expect(mockNavigate).toHaveBeenCalledWith('Search');
  });

  it('calls navigate for Profile tab', async () => {
    const { findByText } = render(<FloatingTabBar />);

    const profileTab = await findByText('Profile');
    fireEvent.press(profileTab);

    expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'ProfileTab' });
  });

  it('renders with proper structure', async () => {
    const { findByText, toJSON } = render(<FloatingTabBar />);

    // Wait for component to render
    await findByText('Home');

    const tree = toJSON();
    // Component should render (not null when visible)
    expect(tree).toBeTruthy();
  });
});
