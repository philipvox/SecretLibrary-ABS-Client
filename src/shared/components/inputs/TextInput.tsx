/**
 * Styled text input component with label and error states
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps as RNTextInputProps,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

/**
 * Text input with label, icons, and error states
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      inputStyle,
      editable = true,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasError = !!error;
    const isDisabled = !editable;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text
            style={[styles.label, hasError && styles.labelError]}
          >
            {label}
          </Text>
        )}

        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
            hasError && styles.inputContainerError,
            isDisabled && styles.inputContainerDisabled,
          ]}
        >
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

          <RNTextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              rightIcon && styles.inputWithRightIcon,
              isDisabled && styles.inputDisabled,
              inputStyle,
            ]}
            placeholderTextColor={colors.textTertiary}
            editable={editable}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightIcon && (
            <TouchableOpacity
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              style={styles.rightIcon}
            >
              {rightIcon}
            </TouchableOpacity>
          )}
        </View>

        {(error || hint) && (
          <Text style={[styles.hint, hasError && styles.hintError]}>
            {error || hint}
          </Text>
        )}
      </View>
    );
  }
);

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  labelError: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.progressTrack,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 48,
  },
  inputContainerFocused: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  inputContainerDisabled: {
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 46,
  },
  inputWithLeftIcon: {
    paddingLeft: 4,
  },
  inputWithRightIcon: {
    paddingRight: 4,
  },
  inputDisabled: {
    color: colors.textTertiary,
  },
  leftIcon: {
    paddingLeft: spacing.sm,
  },
  rightIcon: {
    paddingRight: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  hintError: {
    color: '#EF4444',
  },
});
