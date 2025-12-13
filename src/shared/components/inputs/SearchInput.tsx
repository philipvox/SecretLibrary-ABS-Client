/**
 * Search input with icon and clear button
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme';

interface SearchInputProps extends Omit<RNTextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  onSubmit?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

/**
 * Search input with search icon and clear button
 */
export const SearchInput = forwardRef<RNTextInput, SearchInputProps>(
  (
    {
      value,
      onChangeText,
      onClear,
      onSubmit,
      placeholder = 'Search...',
      containerStyle,
      inputStyle,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleClear = () => {
      onChangeText('');
      onClear?.();
    };

    return (
      <View
        style={[
          styles.container,
          isFocused && styles.containerFocused,
          containerStyle,
        ]}
      >
        <Feather
          name="search"
          size={20}
          color={colors.textTertiary}
          style={styles.searchIcon}
        />

        <RNTextInput
          ref={ref}
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          autoCorrect={false}
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

        {value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.progressTrack,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  containerFocused: {
    borderColor: colors.accent,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    marginLeft: spacing.xs,
    padding: 4,
  },
});
