/**
 * src/features/library/components/FilterChips.tsx
 *
 * Filter chips for My Library screen
 * Options: All, In Progress, Not Started, Completed
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

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
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(filter.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
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
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: colors.accentSubtle,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
});
