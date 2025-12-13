/**
 * src/features/library/components/AddToLibraryButton.tsx
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { colors, spacing, radius } from '@/shared/theme';

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
          name={inLibrary ? "heart" : "heart-outline"}
          size={iconSize}
          color={inLibrary ? "#EF4444" : colors.textSecondary}
          set="ionicons"
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        inLibrary && styles.buttonActive,
        size === 'small' && styles.buttonSmall,
        size === 'large' && styles.buttonLarge,
      ]} 
      onPress={handlePress}
    >
      <Icon
        name={inLibrary ? "heart" : "heart-outline"}
        size={size === 'small' ? 16 : 20}
        color={inLibrary ? '#FFFFFF' : colors.textPrimary}
        set="ionicons"
      />
      <Text style={[
        styles.buttonText,
        inLibrary && styles.buttonTextActive,
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
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  buttonActive: {
    backgroundColor: '#EF4444',
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
    color: colors.textPrimary,
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  buttonTextSmall: {
    fontSize: 12,
  },
});