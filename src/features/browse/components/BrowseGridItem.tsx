/**
 * src/features/browse/components/BrowseGridItem.tsx
 *
 * Individual item in the browse category grid.
 * Matches the search page's browse recovery card style.
 */

import React, { memo } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { Icon } from '@/shared/components/Icon';
import { scale, useSecretLibraryColors } from '@/shared/theme';

export type BrowseItemType = 'genres' | 'narrators' | 'series' | 'duration';

interface BrowseGridItemProps {
  type: BrowseItemType;
  title: string;
  count: string;
  iconName: string;
  onPress?: () => void;
}

function BrowseGridItemComponent({
  title,
  iconName,
  onPress,
}: BrowseGridItemProps) {
  // Theme-aware colors
  const colors = useSecretLibraryColors();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : colors.cream },
        { borderColor: colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      <Icon name={iconName} size={24} color={colors.text} strokeWidth={1.5} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

export const BrowseGridItem = memo(BrowseGridItemComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  title: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: staticColors.black,
  },
});
