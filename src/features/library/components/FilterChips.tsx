/**
 * src/features/library/components/FilterChips.tsx
 *
 * Filter chips for My Library screen
 * Options: All, In Progress, Not Started, Completed
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { scale, spacing, radius } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';

export type FilterOption = 'all' | 'in-progress' | 'not-started' | 'completed';

interface FilterChipsProps {
  selected: FilterOption;
  onSelect: (filter: FilterOption) => void;
  counts?: {
    all: number;
    inProgress: number;
    notStarted: number;
    completed: number;
  };
}

const FILTERS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'completed', label: 'Completed' },
];

export function FilterChips({ selected, onSelect, counts }: FilterChipsProps) {
  const colors = useColors();

  const getCount = (filter: FilterOption): number | undefined => {
    if (!counts) return undefined;
    switch (filter) {
      case 'all': return counts.all;
      case 'in-progress': return counts.inProgress;
      case 'not-started': return counts.notStarted;
      case 'completed': return counts.completed;
      default: return undefined;
    }
  };

  const handleSelect = useCallback((filter: FilterOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(filter);
  }, [onSelect]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((filter) => {
        const isSelected = selected === filter.value;
        const count = getCount(filter.value);

        return (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.chip,
              { backgroundColor: colors.background.tertiary },
              isSelected && {
                backgroundColor: colors.button.disabled,
                borderColor: colors.text.accent,
              }
            ]}
            onPress={() => handleSelect(filter.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Filter by ${filter.label}${count !== undefined ? `, ${count} items` : ''}`}
          >
            <Text style={[
              styles.chipText,
              { color: colors.text.secondary },
              isSelected && { color: colors.text.accent, fontWeight: '600' }
            ]}>
              {filter.label}
              {count !== undefined && count > 0 && ` (${count})`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: scale(14),
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: scale(13),
    fontWeight: '500',
  },
});
