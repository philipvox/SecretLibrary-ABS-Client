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
import { theme } from '../../theme';

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
          color={theme.colors.text.tertiary}
          style={styles.searchIcon}
        />

        <RNTextInput
          ref={ref}
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.tertiary}
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
            <Feather name="x" size={18} color={theme.colors.text.tertiary} />
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
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    minHeight: 44,
    paddingHorizontal: theme.spacing[3],
  },
  containerFocused: {
    borderColor: theme.colors.primary[500],
  },
  searchIcon: {
    marginRight: theme.spacing[2],
  },
  input: {
    flex: 1,
    ...theme.textStyles.body,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing[2],
  },
  clearButton: {
    marginLeft: theme.spacing[2],
    padding: theme.spacing[1],
  },
});
