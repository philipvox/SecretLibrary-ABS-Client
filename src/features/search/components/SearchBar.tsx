/**
 * src/features/search/components/SearchBar.tsx
 * 
 * Search input with dark theme support
 */

import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { useTheme } from '@/shared/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  dark?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search...',
  autoFocus = false,
  dark = true,
}: SearchBarProps) {
  const { colors } = useTheme();

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  const bgColor = dark ? colors.search.inputBackground : colors.background.secondary;
  const textColor = dark ? colors.text.primary : colors.text.inverse;
  const placeholderColor = dark ? colors.search.placeholder : colors.text.tertiary;
  const iconColor = dark ? colors.icon.tertiary : colors.icon.tertiary;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Icon
        name="Search"
        size={20}
        color={iconColor}
       
      />
      <TextInput
        style={[styles.input, { color: textColor }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon
            name="XCircle"
            size={20}
            color={iconColor}
           
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
    textAlignVertical: 'center', // Fix Android placeholder alignment
  },
  clearButton: {
    padding: 4,
  },
});