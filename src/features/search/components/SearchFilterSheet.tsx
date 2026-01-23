/**
 * src/features/search/components/SearchFilterSheet.tsx
 *
 * Simple filter popup for search results.
 * Filters: Genre, Duration, Age Range
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { Icon } from '@/shared/components/Icon';
import { DURATION_RANGES, type DurationRangeId } from '@/features/browse/hooks/useBrowseCounts';

// =============================================================================
// TYPES
// =============================================================================

export type AgeRange = 'all' | 'kids' | 'ya' | 'adult';

export interface SearchFilterState {
  genres: string[];
  authors: string[];
  narrators: string[];
  series: string[];
  duration: DurationRangeId | null;
  ageRange: AgeRange;
  sortBy: 'title' | 'author' | 'dateAdded' | 'duration';
  sortOrder: 'asc' | 'desc';
}

export interface AvailableFilters {
  genres: { id: string; name: string; count: number }[];
  authors: { id: string; name: string; count: number }[];
  narrators: { id: string; name: string; count: number }[];
  series: { id: string; name: string; count: number }[];
}

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilterState;
  onApply: (filters: SearchFilterState) => void;
  availableFilters: AvailableFilters;
  resultCount: number;
}

// =============================================================================
// AGE RANGE OPTIONS
// =============================================================================

const AGE_RANGES: { id: AgeRange; label: string }[] = [
  { id: 'all', label: 'All Ages' },
  { id: 'kids', label: 'Kids' },
  { id: 'ya', label: 'Young Adult' },
  { id: 'adult', label: 'Adult' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  availableFilters,
  resultCount,
}: SearchFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();

  // Local state for editing filters
  const [selectedGenre, setSelectedGenre] = useState<string | null>(filters.genres[0] || null);
  const [selectedDuration, setSelectedDuration] = useState<DurationRangeId | null>(filters.duration);
  const [selectedAgeRange, setSelectedAgeRange] = useState<AgeRange>(filters.ageRange || 'all');

  // Reset local state when sheet opens
  useEffect(() => {
    if (visible) {
      setSelectedGenre(filters.genres[0] || null);
      setSelectedDuration(filters.duration);
      setSelectedAgeRange(filters.ageRange || 'all');
    }
  }, [visible, filters]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenre(null);
    setSelectedDuration(null);
    setSelectedAgeRange('all');
  }, []);

  const handleApply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply({
      ...filters,
      genres: selectedGenre ? [selectedGenre] : [],
      duration: selectedDuration,
      ageRange: selectedAgeRange,
    });
    onClose();
  }, [filters, selectedGenre, selectedDuration, selectedAgeRange, onApply, onClose]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGenre) count++;
    if (selectedDuration) count++;
    if (selectedAgeRange !== 'all') count++;
    return count;
  }, [selectedGenre, selectedDuration, selectedAgeRange]);

  // Top 8 genres for display
  const displayedGenres = availableFilters.genres.slice(0, 8);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={styles.overlay}
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={[styles.popup, { backgroundColor: colors.white }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.grayLine }]}>
            <Text style={[styles.headerTitle, { color: colors.black }]}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={20} color={colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Genre */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.gray }]}>GENRE</Text>
              <View style={styles.optionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    { borderColor: colors.grayLine },
                    !selectedGenre && { backgroundColor: colors.black, borderColor: colors.black },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedGenre(null);
                  }}
                >
                  <Text style={[styles.optionText, { color: !selectedGenre ? colors.white : colors.black }]}>
                    All
                  </Text>
                </TouchableOpacity>
                {displayedGenres.map((genre) => (
                  <TouchableOpacity
                    key={genre.id}
                    style={[
                      styles.option,
                      { borderColor: colors.grayLine },
                      selectedGenre === genre.id && { backgroundColor: colors.black, borderColor: colors.black },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedGenre(selectedGenre === genre.id ? null : genre.id);
                    }}
                  >
                    <Text
                      style={[styles.optionText, { color: selectedGenre === genre.id ? colors.white : colors.black }]}
                      numberOfLines={1}
                    >
                      {genre.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.gray }]}>DURATION</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    { borderColor: colors.grayLine },
                    !selectedDuration && { backgroundColor: colors.black, borderColor: colors.black },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDuration(null);
                  }}
                >
                  <Text style={[styles.optionText, { color: !selectedDuration ? colors.white : colors.black }]}>
                    Any
                  </Text>
                </TouchableOpacity>
                {DURATION_RANGES.map((range) => (
                  <TouchableOpacity
                    key={range.id}
                    style={[
                      styles.option,
                      { borderColor: colors.grayLine },
                      selectedDuration === range.id && { backgroundColor: colors.black, borderColor: colors.black },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDuration(selectedDuration === range.id ? null : range.id);
                    }}
                  >
                    <Text
                      style={[styles.optionText, { color: selectedDuration === range.id ? colors.white : colors.black }]}
                    >
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Age Range */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.gray }]}>AGE RANGE</Text>
              <View style={styles.optionsRow}>
                {AGE_RANGES.map((range) => (
                  <TouchableOpacity
                    key={range.id}
                    style={[
                      styles.option,
                      { borderColor: colors.grayLine },
                      selectedAgeRange === range.id && { backgroundColor: colors.black, borderColor: colors.black },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedAgeRange(range.id);
                    }}
                  >
                    <Text
                      style={[styles.optionText, { color: selectedAgeRange === range.id ? colors.white : colors.black }]}
                    >
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.grayLine }]}>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={[styles.resetText, { color: colors.gray }]}>Clear all</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.black }]}
              onPress={handleApply}
            >
              <Text style={[styles.applyText, { color: colors.white }]}>
                Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  popup: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(20),
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 1,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  resetText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  applyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default SearchFilterSheet;
