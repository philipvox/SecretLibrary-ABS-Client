/**
 * src/features/browse/components/LibraryMoodChips.tsx
 *
 * Horizontal scroll mood chips — controls mood filter for the entire Browse page.
 * Only moods with 10+ matching books appear.
 * Active chip: white border + white text (no gold).
 *
 * NOTE: items passed here should be UNFILTERED by mood (the base filteredItems),
 * since we need accurate counts. The actual mood filtering happens in BrowseContent.
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { LibraryItem } from '@/core/types';
import { filterByFeeling } from '@/shared/utils/bookDNA';
import { useFeelingChipStore, FeelingChip } from '../stores/feelingChipStore';
import { useLibraryMoods } from '../hooks/useLibraryMoods';
import { SectionHeader } from './SectionHeader';

interface LibraryMoodChipsProps {
  items: LibraryItem[];
  onBookPress: (bookId: string) => void;
}

export const LibraryMoodChips = React.memo(function LibraryMoodChips({ items, onBookPress }: LibraryMoodChipsProps) {
  const colors = useSecretLibraryColors();
  const { moods } = useLibraryMoods(items);
  const activeChip = useFeelingChipStore((s) => s.activeChip);
  const toggleChip = useFeelingChipStore((s) => s.toggleChip);

  const handlePress = useCallback((key: FeelingChip) => {
    Haptics.selectionAsync();
    toggleChip(key);
  }, [toggleChip]);

  // Count for the active chip summary line
  const activeCount = useMemo(() => {
    if (!activeChip) return 0;
    return filterByFeeling(items, activeChip).length;
  }, [items, activeChip]);

  const activeLabel = moods.find((m) => m.key === activeChip)?.label || '';

  if (moods.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader label="What are you in the mood for" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {moods.map(({ key, label, count }) => {
          const isActive = activeChip === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.chip,
                { borderColor: isActive ? colors.black : colors.gray + '40' },
              ]}
              onPress={() => handlePress(key)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? colors.black : colors.gray },
                ]}
              >
                {label}
              </Text>
              <Text style={[styles.chipCount, { color: isActive ? colors.black : colors.gray }]}>
                {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Active chip result summary */}
      {activeChip && activeCount > 0 && (
        <View style={styles.resultSummary}>
          <Text style={[styles.resultText, { color: colors.black }]}>
            SHOWING {activeLabel} TITLES FROM YOUR LIBRARY · {activeCount} BOOKS MATCH
          </Text>
        </View>
      )}
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
    opacity: 0.6,
  },
  resultSummary: {
    paddingHorizontal: 24,
    paddingTop: scale(12),
  },
  resultText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
