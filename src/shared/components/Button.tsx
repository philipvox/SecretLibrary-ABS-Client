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
  TextStyle,
} from 'react-native';
import { theme } from '../theme';

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
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : theme.colors.primary[500]}
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
    borderRadius: theme.radius.large,
    borderWidth: 0,
  },

  // Variants
  primary: {
    backgroundColor: theme.colors.primary[500],
    ...theme.elevation.small,
  },
  secondary: {
    backgroundColor: theme.colors.neutral[100],
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: theme.colors.semantic.error,
    ...theme.elevation.small,
  },

  // Sizes
  smallSize: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    minHeight: 36,
  },
  mediumSize: {
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    minHeight: 44,
  },
  largeSize: {
    paddingHorizontal: theme.spacing[8],
    paddingVertical: theme.spacing[4],
    minHeight: 52,
  },

  // Text base
  text: {
    textAlign: 'center',
  },

  // Text variants
  primaryText: {
    ...theme.textStyles.button,
    color: theme.colors.text.inverse,
  },
  secondaryText: {
    ...theme.textStyles.button,
    color: theme.colors.text.primary,
  },
  ghostText: {
    ...theme.textStyles.button,
    color: theme.colors.primary[500],
  },
  dangerText: {
    ...theme.textStyles.button,
    color: theme.colors.text.inverse,
  },

  // Text sizes
  smallText: {
    fontSize: theme.fontSize.sm,
  },
  mediumText: {
    fontSize: theme.fontSize.base,
  },
  largeText: {
    fontSize: theme.fontSize.lg,
  },

  // States
  disabled: {
    opacity: 0.5,
    ...theme.elevation.none,
  },
  disabledText: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});