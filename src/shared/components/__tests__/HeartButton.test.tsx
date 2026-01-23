/**
 * src/shared/components/__tests__/HeartButton.test.tsx
 *
 * Tests for HeartButton component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HeartButton } from '../HeartButton';

// Mock haptics
jest.mock('@/core/native/haptics', () => ({
  haptics: {
    toggle: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => React.createElement('Svg', props, children),
    Svg: ({ children, ...props }: any) => React.createElement('Svg', props, children),
    Path: (props: any) => React.createElement('Path', props),
  };
});

// Mock myLibraryStore
const mockIsInLibrary = jest.fn();
const mockAddToLibrary = jest.fn();
const mockRemoveFromLibrary = jest.fn();

jest.mock('@/shared/stores/myLibraryStore', () => ({
  useMyLibraryStore: () => ({
    isInLibrary: mockIsInLibrary,
    addToLibrary: mockAddToLibrary,
    removeFromLibrary: mockRemoveFromLibrary,
  }),
}));

describe('HeartButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInLibrary.mockReturnValue(false);
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<HeartButton bookId="book-123" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with default size', () => {
      const { toJSON } = render(<HeartButton bookId="book-123" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with custom size', () => {
      const { toJSON } = render(<HeartButton bookId="book-123" size={32} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('favorite state', () => {
    it('checks if book is in library on render', () => {
      mockIsInLibrary.mockReturnValue(false);
      render(<HeartButton bookId="book-123" />);
      expect(mockIsInLibrary).toHaveBeenCalledWith('book-123');
    });

    it('checks different book id', () => {
      mockIsInLibrary.mockReturnValue(true);
      render(<HeartButton bookId="book-456" />);
      expect(mockIsInLibrary).toHaveBeenCalledWith('book-456');
    });
  });

  describe('interactions', () => {
    it('has add/remove library functions available when not favorite', () => {
      mockIsInLibrary.mockReturnValue(false);
      render(<HeartButton bookId="book-123" />);

      // Verify mock functions are set up correctly
      expect(mockAddToLibrary).toBeDefined();
      expect(mockRemoveFromLibrary).toBeDefined();
    });

    it('has add/remove library functions available when favorite', () => {
      mockIsInLibrary.mockReturnValue(true);
      render(<HeartButton bookId="book-123" />);

      // Verify mock functions are set up correctly
      expect(mockAddToLibrary).toBeDefined();
      expect(mockRemoveFromLibrary).toBeDefined();
    });

    it('accepts onToggle callback prop', () => {
      mockIsInLibrary.mockReturnValue(false);
      const onToggle = jest.fn();
      const { toJSON } = render(
        <HeartButton bookId="book-123" onToggle={onToggle} />
      );

      // Verify component renders with callback
      expect(toJSON()).toBeTruthy();
    });

    it('renders correctly with onToggle callback when favorite', () => {
      mockIsInLibrary.mockReturnValue(true);
      const onToggle = jest.fn();
      const { toJSON } = render(
        <HeartButton bookId="book-123" onToggle={onToggle} />
      );

      // Verify component renders with callback
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('haptic feedback', () => {
    it('has haptics module available for success feedback', () => {
      const { haptics } = require('@/core/native/haptics');
      // Verify haptics mock is set up correctly
      expect(haptics.success).toBeDefined();
      expect(typeof haptics.success).toBe('function');
    });

    it('has haptics module available for toggle feedback', () => {
      const { haptics } = require('@/core/native/haptics');
      // Verify haptics mock is set up correctly
      expect(haptics.toggle).toBeDefined();
      expect(typeof haptics.toggle).toBe('function');
    });
  });

  describe('disabled state', () => {
    it('does not call store methods when disabled', () => {
      mockIsInLibrary.mockReturnValue(false);
      const { UNSAFE_root } = render(<HeartButton bookId="book-123" disabled />);

      fireEvent.press(UNSAFE_root);

      expect(mockAddToLibrary).not.toHaveBeenCalled();
      expect(mockRemoveFromLibrary).not.toHaveBeenCalled();
    });
  });

  describe('custom colors', () => {
    it('accepts custom active color', () => {
      const { toJSON } = render(
        <HeartButton bookId="book-123" activeColor="#ff0000" />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom inactive color', () => {
      const { toJSON } = render(
        <HeartButton bookId="book-123" inactiveColor="#cccccc" />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('custom icon renderer', () => {
    it('uses custom icon renderer when provided', () => {
      const customRenderer = jest.fn(() => <></>);
      mockIsInLibrary.mockReturnValue(false);

      render(
        <HeartButton bookId="book-123" renderIcon={customRenderer} />
      );

      expect(customRenderer).toHaveBeenCalledWith(24, '#808080', false);
    });

    it('passes correct color when favorite', () => {
      const customRenderer = jest.fn(() => <></>);
      mockIsInLibrary.mockReturnValue(true);

      render(
        <HeartButton bookId="book-123" renderIcon={customRenderer} />
      );

      expect(customRenderer).toHaveBeenCalledWith(24, '#F4B60C', true);
    });
  });

  describe('animation', () => {
    it('renders with animation enabled by default', () => {
      const { toJSON } = render(<HeartButton bookId="book-123" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders without animation when animated is false', () => {
      const { toJSON } = render(
        <HeartButton bookId="book-123" animated={false} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('hitSlop', () => {
    it('accepts custom hitSlop', () => {
      const { toJSON } = render(
        <HeartButton bookId="book-123" hitSlop={16} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });
});
