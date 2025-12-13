/**
 * Standard button component with variants and states
 *
 * Variants: primary, secondary, ghost, danger
 * Sizes: small, medium, large
 * States: loading, disabled
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  colors,
  spacing,
  radius,
  typography,
  elevation,
} from '@/shared/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

/**
 * Button component with consistent styling
 */
export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`${size}Size`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.backgroundPrimary : colors.accent}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text`],
            styles[`${size}Text`],
            isDisabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Base styles
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 0,
  },

  // Variants
  primary: {
    backgroundColor: colors.accent,
    ...elevation.small,
  },
  secondary: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
    ...elevation.small,
  },

  // Sizes
  smallSize: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  mediumSize: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  largeSize: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    minHeight: 52,
  },

  // Text base
  text: {
    textAlign: 'center',
  },

  // Text variants
  primaryText: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.backgroundPrimary,
  },
  secondaryText: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ghostText: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.accent,
  },
  dangerText: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Text sizes
  smallText: {
    ...typography.labelMedium,
  },
  mediumText: {
    ...typography.labelLarge,
  },
  largeText: {
    ...typography.bodyLarge,
    fontWeight: '600',
  },

  // States
  disabled: {
    opacity: 0.5,
    ...elevation.none,
  },
  disabledText: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});
