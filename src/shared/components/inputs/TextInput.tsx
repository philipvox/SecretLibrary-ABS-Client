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
import { theme } from '../../theme';

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
            placeholderTextColor={theme.colors.text.tertiary}
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
    marginBottom: theme.spacing[4],
  },
  label: {
    ...theme.textStyles.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1],
    fontWeight: '500',
  },
  labelError: {
    color: theme.colors.semantic.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    minHeight: 48,
  },
  inputContainerFocused: {
    borderColor: theme.colors.primary[500],
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: theme.colors.semantic.error,
  },
  inputContainerDisabled: {
    backgroundColor: theme.colors.neutral[50],
    opacity: 0.6,
  },
  input: {
    flex: 1,
    ...theme.textStyles.body,
    color: theme.colors.text.primary,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    minHeight: 46,
  },
  inputWithLeftIcon: {
    paddingLeft: theme.spacing[1],
  },
  inputWithRightIcon: {
    paddingRight: theme.spacing[1],
  },
  inputDisabled: {
    color: theme.colors.text.tertiary,
  },
  leftIcon: {
    paddingLeft: theme.spacing[3],
  },
  rightIcon: {
    paddingRight: theme.spacing[3],
  },
  hint: {
    ...theme.textStyles.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing[1],
  },
  hintError: {
    color: theme.colors.semantic.error,
  },
});
