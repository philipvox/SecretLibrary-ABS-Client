/**
 * src/features/library/components/AddToLibraryButton.tsx
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { spacing, radius } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';

interface AddToLibraryButtonProps {
  bookId: string;
  variant?: 'icon' | 'button';
  size?: 'small' | 'medium' | 'large';
}

export function AddToLibraryButton({
  bookId,
  variant = 'button',
  size = 'medium',
}: AddToLibraryButtonProps) {
  const colors = useColors();
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();
  const inLibrary = isInLibrary(bookId);

  const handlePress = () => {
    if (inLibrary) {
      removeFromLibrary(bookId);
    } else {
      addToLibrary(bookId);
    }
  };

  if (variant === 'icon') {
    const iconSize = size === 'small' ? 20 : size === 'large' ? 28 : 24;

    return (
      <TouchableOpacity
        onPress={handlePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon
          name="Heart"
          size={iconSize}
          color={inLibrary ? colors.feature.heartFill : colors.text.secondary}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.background.secondary },
        inLibrary && { backgroundColor: colors.semantic.error },
        size === 'small' && styles.buttonSmall,
        size === 'large' && styles.buttonLarge,
      ]}
      onPress={handlePress}
    >
      <Icon
        name="Heart"
        size={size === 'small' ? 16 : 20}
        color={inLibrary ? colors.text.inverse : colors.text.primary}
      />
      <Text style={[
        styles.buttonText,
        { color: colors.text.primary },
        inLibrary && { color: colors.text.inverse },
        size === 'small' && styles.buttonTextSmall,
      ]}>
        {inLibrary ? 'In Library' : 'Add to Library'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  buttonSmall: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  buttonLarge: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextSmall: {
    fontSize: 12,
  },
});