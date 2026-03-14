/**
 * src/features/profile/components/SectionHeader.tsx
 *
 * Unified section header for settings screens.
 * Supports title with optional description text.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';

export interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  const colors = useSecretLibraryColors();

  if (description) {
    return (
      <View style={styles.container}>
        <Text style={[styles.titleRich, { color: colors.black }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.gray }]}>{description}</Text>
      </View>
    );
  }

  return (
    <Text style={[styles.titleSimple, { color: colors.gray }]}>{title}</Text>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  titleRich: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
    marginBottom: 4,
  },
  description: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    lineHeight: scale(16),
  },
  titleSimple: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
});
