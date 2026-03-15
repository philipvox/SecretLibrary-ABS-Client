/**
 * src/features/browse/components/BrowseFooter.tsx
 *
 * Footer section for the Browse screen with library stats.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { useLibraryStats, formatLibraryStats } from '../hooks/useLibraryStats';
import { scale, useSecretLibraryColors } from '@/shared/theme';

export function BrowseFooter() {
  // Theme-aware colors
  const colors = useSecretLibraryColors();

  const stats = useLibraryStats();
  const { titlesDisplay, hoursDisplay } = formatLibraryStats(stats);

  return (
    <View style={styles.container}>
      <View style={[styles.separator, { backgroundColor: colors.grayLine }]} />
      <Text style={[styles.text, { color: colors.gray }]}>
        {titlesDisplay} titles · {hoursDisplay} hours
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  separator: {
    width: 40,
    height: 1,
    marginBottom: 16,
    opacity: 0.4,
  },
  text: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1.35,
    color: staticColors.gray,
  },
});
