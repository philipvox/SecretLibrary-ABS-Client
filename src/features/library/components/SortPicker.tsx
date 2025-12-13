/**
 * src/features/library/components/SortPicker.tsx
 *
 * Sort picker/dropdown for My Library screen
 * Options: Recently Played, Recently Added, Title A-Z, etc.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

export type SortOption =
  | 'recently-played'
  | 'recently-added'
  | 'title-asc'
  | 'title-desc'
  | 'author-asc'
  | 'duration-asc'
  | 'duration-desc';

interface SortPickerProps {
  selected: SortOption;
  onSelect: (sort: SortOption) => void;
  bookCount: number;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recently-played', label: 'Recently Played' },
  { value: 'recently-added', label: 'Recently Added' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'author-asc', label: 'Author A-Z' },
  { value: 'duration-asc', label: 'Duration (Short to Long)' },
  { value: 'duration-desc', label: 'Duration (Long to Short)' },
];

export function SortPicker({ selected, onSelect, bookCount }: SortPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const selectedLabel = SORT_OPTIONS.find((o) => o.value === selected)?.label || 'Sort';

  const handleSelect = (value: SortOption) => {
    onSelect(value);
    setIsOpen(false);
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setIsOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.sortLabel}>Sort: </Text>
          <Text style={styles.sortValue}>{selectedLabel}</Text>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <Text style={styles.bookCount}>
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
        </Text>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Sort By</Text>

            {SORT_OPTIONS.map((option) => {
              const isSelected = selected === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => handleSelect(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={ACCENT} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortLabel: {
    fontSize: scale(13),
    color: colors.textTertiary,
  },
  sortValue: {
    fontSize: scale(13),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  bookCount: {
    fontSize: scale(13),
    color: colors.textTertiary,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
  },
  modalHandle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: colors.textMuted,
    borderRadius: radius.xs,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.xl,
  },
  optionRowSelected: {
    backgroundColor: colors.accentSubtle,
  },
  optionText: {
    fontSize: scale(15),
    color: colors.textSecondary,
  },
  optionTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
});
