/**
 * src/shared/components/__tests__/Button.test.tsx
 *
 * Tests for Button component.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock the theme module
jest.mock('@/shared/theme', () => ({
  spacing: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    '3xl': 40,
  },
  radius: {
    button: 8,
  },
  typography: {
    labelMedium: { fontSize: 14 },
    labelLarge: { fontSize: 16 },
    bodyLarge: { fontSize: 18 },
  },
  elevation: {
    small: { shadowColor: '#000' },
    none: {},
  },
  scale: (val: number) => val,
  useTheme: () => ({
    colors: {
      accent: {
        primary: '#F3B60C',
        textOnAccent: '#000000',
      },
      background: {
        elevated: '#1a1a1a',
      },
      border: {
        default: '#333333',
      },
      text: {
        primary: '#ffffff',
        inverse: '#000000',
      },
      semantic: {
        error: '#ff4444',
      },
    },
  }),
}));

describe('Button', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with title', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Click Me" />
      );

      expect(getByText('Click Me')).toBeTruthy();
    });

    it('renders correctly', () => {
      const { toJSON } = render(
        <Button onPress={mockOnPress} title="Test Button" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('uses title as default accessibility label', () => {
      const { getByLabelText } = render(
        <Button onPress={mockOnPress} title="Submit" />
      );

      expect(getByLabelText('Submit')).toBeTruthy();
    });

    it('uses custom accessibility label when provided', () => {
      const { getByLabelText } = render(
        <Button
          onPress={mockOnPress}
          title="Submit"
          accessibilityLabel="Submit form"
        />
      );

      expect(getByLabelText('Submit form')).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('renders primary variant by default', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Primary" />
      );

      expect(getByText('Primary')).toBeTruthy();
    });

    it('renders secondary variant', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Secondary" variant="secondary" />
      );

      expect(getByText('Secondary')).toBeTruthy();
    });

    it('renders outline variant', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Outline" variant="outline" />
      );

      expect(getByText('Outline')).toBeTruthy();
    });

    it('renders ghost variant', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Ghost" variant="ghost" />
      );

      expect(getByText('Ghost')).toBeTruthy();
    });

    it('renders danger variant', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Danger" variant="danger" />
      );

      expect(getByText('Danger')).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Medium" />
      );

      expect(getByText('Medium')).toBeTruthy();
    });

    it('renders small size', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Small" size="small" />
      );

      expect(getByText('Small')).toBeTruthy();
    });

    it('renders large size', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Large" size="large" />
      );

      expect(getByText('Large')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onPress when pressed', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Press Me" />
      );

      fireEvent.press(getByText('Press Me'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('triggers haptic feedback on press', () => {
      const Haptics = require('expo-haptics');
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Haptic" />
      );

      fireEvent.press(getByText('Haptic'));
      expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('does not trigger haptic when noHaptics is true', () => {
      const Haptics = require('expo-haptics');
      const { getByText } = render(
        <Button onPress={mockOnPress} title="No Haptic" noHaptics />
      );

      fireEvent.press(getByText('No Haptic'));
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('renders disabled button with correct props', () => {
      const { getByLabelText } = render(
        <Button onPress={mockOnPress} title="Disabled" disabled />
      );

      const button = getByLabelText('Disabled');
      expect(button.props.disabled).toBe(true);
    });

    it('has disabled accessibility state', () => {
      const { getByLabelText } = render(
        <Button onPress={mockOnPress} title="Disabled" disabled />
      );

      const button = getByLabelText('Disabled');
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });
  });

  describe('loading state', () => {
    it('shows activity indicator when loading', () => {
      const { queryByText } = render(
        <Button onPress={mockOnPress} title="Loading" loading />
      );

      // Title should not be visible when loading
      expect(queryByText('Loading')).toBeNull();
    });

    it('sets disabled prop when loading', () => {
      const { getByLabelText } = render(
        <Button onPress={mockOnPress} title="Loading" loading />
      );

      const button = getByLabelText('Loading');
      expect(button.props.disabled).toBe(true);
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      const LeftIcon = () => <></>;
      const { getByText } = render(
        <Button
          onPress={mockOnPress}
          title="With Icon"
          leftIcon={<LeftIcon />}
        />
      );

      expect(getByText('With Icon')).toBeTruthy();
    });

    it('renders right icon', () => {
      const RightIcon = () => <></>;
      const { getByText } = render(
        <Button
          onPress={mockOnPress}
          title="With Icon"
          rightIcon={<RightIcon />}
        />
      );

      expect(getByText('With Icon')).toBeTruthy();
    });

    it('renders both icons', () => {
      const LeftIcon = () => <></>;
      const RightIcon = () => <></>;
      const { getByText } = render(
        <Button
          onPress={mockOnPress}
          title="Both Icons"
          leftIcon={<LeftIcon />}
          rightIcon={<RightIcon />}
        />
      );

      expect(getByText('Both Icons')).toBeTruthy();
    });
  });

  describe('fullWidth', () => {
    it('renders full width when prop is true', () => {
      const { getByText } = render(
        <Button onPress={mockOnPress} title="Full Width" fullWidth />
      );

      expect(getByText('Full Width')).toBeTruthy();
    });
  });
});
