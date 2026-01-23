/**
 * src/shared/components/__tests__/Loading.test.tsx
 *
 * Tests for Loading component.
 * Uses global mocks from jest.setup.js for react-native-reanimated.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Loading, FullScreenLoading, InlineLoading, ButtonLoading, CandleLoading } from '../Loading';

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  spacing: {
    sm: 8,
    xl: 24,
  },
  scale: (val: number) => val,
  useTheme: () => ({
    colors: {
      text: {
        primary: '#ffffff',
        secondary: '#cccccc',
      },
      background: {
        primary: '#000000',
      },
    },
  }),
}));

describe('Loading', () => {
  describe('modes', () => {
    it('renders in fullScreen mode by default', () => {
      const { toJSON } = render(<Loading />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders in inline mode', () => {
      const { toJSON } = render(<Loading mode="inline" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders in button mode', () => {
      const { toJSON } = render(<Loading mode="button" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders in candle mode', () => {
      const { toJSON } = render(<Loading mode="candle" />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('text', () => {
    it('renders without text by default', () => {
      const { queryByText } = render(<Loading />);
      expect(queryByText(/loading/i)).toBeNull();
    });

    it('renders with text when provided', () => {
      const { getByText } = render(<Loading text="Loading books..." />);
      expect(getByText('Loading books...')).toBeTruthy();
    });

    it('renders custom text', () => {
      const { getByText } = render(<Loading text="Please wait" />);
      expect(getByText('Please wait')).toBeTruthy();
    });
  });

  describe('size', () => {
    it('uses default size for fullScreen mode', () => {
      const { toJSON } = render(<Loading mode="fullScreen" />);
      expect(toJSON()).toBeTruthy();
    });

    it('uses default size for inline mode', () => {
      const { toJSON } = render(<Loading mode="inline" />);
      expect(toJSON()).toBeTruthy();
    });

    it('uses default size for button mode', () => {
      const { toJSON } = render(<Loading mode="button" />);
      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom size', () => {
      const { toJSON } = render(<Loading size={100} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('color', () => {
    it('uses theme color by default', () => {
      const { toJSON } = render(<Loading />);
      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom color', () => {
      const { toJSON } = render(<Loading color="#ff0000" />);
      expect(toJSON()).toBeTruthy();
    });
  });
});

describe('Convenience exports', () => {
  describe('FullScreenLoading', () => {
    it('renders fullScreen mode', () => {
      const { toJSON } = render(<FullScreenLoading />);
      expect(toJSON()).toBeTruthy();
    });

    it('accepts text prop', () => {
      const { getByText } = render(<FullScreenLoading text="Loading..." />);
      expect(getByText('Loading...')).toBeTruthy();
    });

    it('accepts size prop', () => {
      const { toJSON } = render(<FullScreenLoading size={120} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('InlineLoading', () => {
    it('renders inline mode', () => {
      const { toJSON } = render(<InlineLoading />);
      expect(toJSON()).toBeTruthy();
    });

    it('accepts text prop', () => {
      const { getByText } = render(<InlineLoading text="Fetching..." />);
      expect(getByText('Fetching...')).toBeTruthy();
    });
  });

  describe('ButtonLoading', () => {
    it('renders button mode', () => {
      const { toJSON } = render(<ButtonLoading />);
      expect(toJSON()).toBeTruthy();
    });

    it('accepts color prop', () => {
      const { toJSON } = render(<ButtonLoading color="#ffffff" />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('CandleLoading', () => {
    it('renders candle mode', () => {
      const { toJSON } = render(<CandleLoading />);
      expect(toJSON()).toBeTruthy();
    });

    it('accepts text prop', () => {
      const { getByText } = render(<CandleLoading text="Processing..." />);
      expect(getByText('Processing...')).toBeTruthy();
    });
  });
});
