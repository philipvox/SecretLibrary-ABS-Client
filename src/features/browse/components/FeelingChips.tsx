/**
 * src/features/browse/components/FeelingChips.tsx
 *
 * 2×4 grid of feeling chips for the Discover tab.
 * One active at a time (tap again to deselect).
 * Inactive: border + gray text. Active: gold fill + dark text.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { secretLibraryColors as colors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { FeelingChip, useFeelingChipStore } from '../stores/feelingChipStore';

const CHIPS: { key: FeelingChip; label: string }[] = [
  { key: 'thrilling', label: 'Thrilling' },
  { key: 'funny', label: 'Funny' },
  { key: 'dark', label: 'Dark' },
  { key: 'heartwarming', label: 'Heartwarming' },
  { key: 'escapist', label: 'Escapist' },
  { key: 'thought-provoking', label: 'Thought-Provoking' },
  { key: 'cozy', label: 'Cozy' },
  { key: 'intense', label: 'Intense' },
];

export function FeelingChips() {
  const activeChip = useFeelingChipStore((s) => s.activeChip);
  const toggleChip = useFeelingChipStore((s) => s.toggleChip);

  const handlePress = useCallback((chip: FeelingChip) => {
    Haptics.selectionAsync();
    toggleChip(chip);
  }, [toggleChip]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>I'm in the mood for...</Text>
      </View>
      <View style={styles.grid}>
        {CHIPS.map(({ key, label }) => {
          const isActive = activeChip === key;
          return (
            <Pressable
              key={key}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => handlePress(key)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    paddingBottom: scale(16),
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: scale(24),
    marginBottom: scale(12),
  },
  sectionLabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(11),
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: scale(8),
  },
  chip: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipTextActive: {
    color: colors.black,
    fontWeight: '600',
  },
});
