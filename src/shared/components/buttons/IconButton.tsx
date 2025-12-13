/**
 * Icon-only button component with various sizes and variants
 */

import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, radius, elevation } from '../../theme';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type IconButtonSize = 'small' | 'medium' | 'large';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  loading?: boolean;
  rounded?: boolean;
  style?: ViewStyle;
  accessibilityLabel: string;
}

const SIZE_MAP = {
  small: { button: 32, icon: 16 },
  medium: { button: 44, icon: 20 },
  large: { button: 56, icon: 24 },
};

/**
 * Icon-only button for toolbars, actions, etc.
 */
export function IconButton({
  icon,
  onPress,
  variant = 'ghost',
  size = 'medium',
  disabled = false,
  loading = false,
  rounded = true,
  style,
  accessibilityLabel,
}: IconButtonProps) {
  const isDisabled = disabled || loading;
  const dimensions = SIZE_MAP[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        {
          width: dimensions.button,
          height: dimensions.button,
          borderRadius: rounded ? dimensions.button / 2 : radius.md,
        },
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger'
            ? '#FFFFFF'
            : colors.accent}
          size={size === 'large' ? 'small' : 'small'}
        />
      ) : (
        icon
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Variants
  primary: {
    backgroundColor: colors.accent,
    ...elevation.small,
  },
  secondary: {
    backgroundColor: colors.progressTrack,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: '#EF4444',
    ...elevation.small,
  },

  // States
  disabled: {
    opacity: 0.5,
  },
});
