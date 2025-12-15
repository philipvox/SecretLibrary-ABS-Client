/**
 * src/features/library/components/AppliedFilters.tsx
 *
 * Shows active filters as removable pills with result count.
 * UX Pattern: Visibility of System Status (NNGroup Heuristic #1)
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, scale, spacing, radius } from '@/shared/theme';

export interface AppliedFilter {
  key: string;
  label: string;
}

interface AppliedFiltersProps {
  /** List of active filters to display */
  filters: AppliedFilter[];
  /** Called when a filter pill's X is pressed */
  onRemove: (filterKey: string) => void;
  /** Number of results matching the filters */
  resultCount: number;
  /** Optional label for the count (default: "books") */
  resultLabel?: string;
}

export function AppliedFilters({
  filters,
  onRemove,
  resultCount,
  resultLabel = 'books',
}: AppliedFiltersProps) {
  // Don't render if no active filters
  if (filters.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Result count */}
      <Text style={styles.resultCount}>
        {resultCount} {resultCount === 1 ? resultLabel.replace(/s$/, '') : resultLabel}
      </Text>

      {/* Filter pills */}
      <View style={styles.pillsRow}>
        {filters.map((filter) => (
          <View key={filter.key} style={styles.pill}>
            <Text style={styles.pillText}>{filter.label}</Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(filter.key)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={scale(12)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Clear all button - only show if multiple filters */}
        {filters.length > 1 && (
          <TouchableOpacity
            style={styles.clearAll}
            onPress={() => filters.forEach(f => onRemove(f.key))}
          >
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  resultCount: {
    fontSize: scale(12),
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSubtle,
    paddingLeft: scale(10),
    paddingRight: scale(6),
    paddingVertical: scale(4),
    borderRadius: radius.full,
    gap: scale(4),
  },
  pillText: {
    fontSize: scale(11),
    fontWeight: '500',
    color: colors.accent,
  },
  removeButton: {
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAll: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },
  clearAllText: {
    fontSize: scale(11),
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },
});

export default AppliedFilters;
