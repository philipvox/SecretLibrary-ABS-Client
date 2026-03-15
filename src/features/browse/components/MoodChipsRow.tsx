/**
 * src/features/browse/components/MoodChipsRow.tsx
 *
 * Horizontal scroll mood chips for DISCOVER tab.
 * Same chip styling as LibraryMoodChips but single-row horizontal scroll.
 * Tapping navigates to filtered browse results.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { LibraryItem } from '@/core/types';
import { useLibraryMoods } from '../hooks/useLibraryMoods';
import { SectionHeader } from './SectionHeader';
import type { FeelingChip } from '../stores/feelingChipStore';

interface MoodChipsRowProps {
  items: LibraryItem[];
  onMoodPress: (moodKey: FeelingChip) => void;
}

export const MoodChipsRow = React.memo(function MoodChipsRow({ items, onMoodPress }: MoodChipsRowProps) {
  const colors = useSecretLibraryColors();
  const { moods } = useLibraryMoods(items);

  const handlePress = useCallback((key: FeelingChip) => {
    Haptics.selectionAsync();
    onMoodPress(key);
  }, [onMoodPress]);

  if (moods.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader label="Browse by Mood" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {moods.map(({ key, label, count }) => (
          <Pressable
            key={key}
            style={[styles.chip, { borderColor: colors.gray + '40' }]}
            onPress={() => handlePress(key)}
          >
            <Text style={[styles.chipText, { color: colors.gray }]}>{label}</Text>
            <Text style={[styles.chipCount, { color: colors.black }]}>{count}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: scale(16),
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: scale(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(18),
    borderWidth: 1,
    gap: scale(6),
  },
  chipText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
  },
});
