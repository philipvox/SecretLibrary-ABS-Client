/**
 * src/features/reading-history-wizard/components/FilterSheet.tsx
 *
 * Bottom sheet for filtering reading history.
 * Supports filtering by: Sync Status, Genre, Author, Series, Duration
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FilterState, DurationFilter, SyncStatusFilter } from '../stores/galleryStore';
import { wp, hp, moderateScale, useTheme, colors } from '@/shared/theme';

// =============================================================================
// TYPES
// =============================================================================

interface AvailableFilters {
  genres: { id: string; name: string; count: number }[];
  authors: { id: string; name: string; count: number }[];
  series: { id: string; name: string; count: number }[];
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  availableFilters: AvailableFilters;
  resultCount: number;
}

// =============================================================================
// DURATION OPTIONS
// =============================================================================

const DURATION_OPTIONS: { id: DurationFilter; label: string }[] = [
  { id: 'under_5h', label: 'Under 5h' },
  { id: '5_10h', label: '5-10h' },
  { id: '10_20h', label: '10-20h' },
  { id: 'over_20h', label: 'Over 20h' },
];

// =============================================================================
// FILTER CHIP COMPONENT
// =============================================================================

interface FilterChipProps {
  label: string;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
  themeColors: ReturnType<typeof useTheme>['colors'];
}

function FilterChip({ label, count, isSelected, onPress, themeColors }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: themeColors.surface.card, borderColor: themeColors.border.default },
        isSelected && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.chipText,
        { color: themeColors.text.secondary },
        isSelected && { color: themeColors.text.inverse, fontWeight: '600' },
      ]}>
        {label}
        {count !== undefined && ` (${count})`}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// SECTION COMPONENT
// =============================================================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
  showSeeAll?: boolean;
  themeColors: ReturnType<typeof useTheme>['colors'];
}

function Section({ title, children, onSeeAll, showSeeAll, themeColors }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>{title}</Text>
        {showSeeAll && onSeeAll && (
          <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAll}>
            <Text style={[styles.seeAllText, { color: colors.accent.primary }]}>See All</Text>
            <ChevronRight size={wp(4)} color={colors.accent.primary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.chipContainer}>{children}</View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  availableFilters,
  resultCount,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // Local state for editing filters
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  // Reset local state when sheet opens
  React.useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  // Toggle helpers
  const toggleSyncStatus = useCallback((status: SyncStatusFilter) => {
    setLocalFilters((prev) => {
      const current = prev.syncStatus;
      if (current.includes(status)) {
        return { ...prev, syncStatus: current.filter((s) => s !== status) };
      }
      return { ...prev, syncStatus: [...current, status] };
    });
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    setLocalFilters((prev) => {
      const current = prev.genres;
      if (current.includes(genre)) {
        return { ...prev, genres: current.filter((g) => g !== genre) };
      }
      return { ...prev, genres: [...current, genre] };
    });
  }, []);

  const toggleAuthor = useCallback((author: string) => {
    setLocalFilters((prev) => {
      const current = prev.authors;
      if (current.includes(author)) {
        return { ...prev, authors: current.filter((a) => a !== author) };
      }
      return { ...prev, authors: [...current, author] };
    });
  }, []);

  const toggleSeries = useCallback((series: string) => {
    setLocalFilters((prev) => {
      const current = prev.series;
      if (current.includes(series)) {
        return { ...prev, series: current.filter((s) => s !== series) };
      }
      return { ...prev, series: [...current, series] };
    });
  }, []);

  const toggleDuration = useCallback((duration: DurationFilter) => {
    setLocalFilters((prev) => ({
      ...prev,
      duration: prev.duration === duration ? null : duration,
    }));
  }, []);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFilters({
      genres: [],
      authors: [],
      series: [],
      syncStatus: [],
      duration: null,
    });
  }, []);

  const handleApply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(localFilters);
    onClose();
  }, [localFilters, onApply, onClose]);

  // Check if any filters are active
  const hasFilters = useMemo(() => {
    return (
      localFilters.genres.length > 0 ||
      localFilters.authors.length > 0 ||
      localFilters.series.length > 0 ||
      localFilters.syncStatus.length > 0 ||
      localFilters.duration !== null
    );
  }, [localFilters]);

  // Limit displayed authors/series (show first 6)
  const displayedAuthors = availableFilters.authors.slice(0, 6);
  const displayedSeries = availableFilters.series.slice(0, 6);
  const showSeeAllAuthors = availableFilters.authors.length > 6;
  const showSeeAllSeries = availableFilters.series.length > 6;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[styles.overlay, { backgroundColor: themeColors.overlay.medium }]}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: themeColors.background.primary,
              paddingBottom: insets.bottom + hp(2),
            },
          ]}
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: themeColors.text.tertiary }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border.default }]}>
            <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Filters</Text>
            {hasFilters && (
              <TouchableOpacity onPress={handleReset}>
                <Text style={[styles.resetText, { color: colors.accent.primary }]}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Sync Status */}
            <Section title="Sync Status" themeColors={themeColors}>
              <FilterChip
                label="Synced"
                isSelected={localFilters.syncStatus.includes('synced')}
                onPress={() => toggleSyncStatus('synced')}
                themeColors={themeColors}
              />
              <FilterChip
                label="Not Synced"
                isSelected={localFilters.syncStatus.includes('not_synced')}
                onPress={() => toggleSyncStatus('not_synced')}
                themeColors={themeColors}
              />
            </Section>

            {/* Genres */}
            {availableFilters.genres.length > 0 && (
              <Section title="Genre" themeColors={themeColors}>
                {availableFilters.genres.map((genre) => (
                  <FilterChip
                    key={genre.id}
                    label={genre.name}
                    count={genre.count}
                    isSelected={localFilters.genres.includes(genre.id)}
                    onPress={() => toggleGenre(genre.id)}
                    themeColors={themeColors}
                  />
                ))}
              </Section>
            )}

            {/* Authors */}
            {availableFilters.authors.length > 0 && (
              <Section title="Author" showSeeAll={showSeeAllAuthors} themeColors={themeColors}>
                {displayedAuthors.map((author) => (
                  <FilterChip
                    key={author.id}
                    label={author.name}
                    count={author.count}
                    isSelected={localFilters.authors.includes(author.id)}
                    onPress={() => toggleAuthor(author.id)}
                    themeColors={themeColors}
                  />
                ))}
              </Section>
            )}

            {/* Series */}
            {availableFilters.series.length > 0 && (
              <Section title="Series" showSeeAll={showSeeAllSeries} themeColors={themeColors}>
                {displayedSeries.map((series) => (
                  <FilterChip
                    key={series.id}
                    label={series.name}
                    count={series.count}
                    isSelected={localFilters.series.includes(series.id)}
                    onPress={() => toggleSeries(series.id)}
                    themeColors={themeColors}
                  />
                ))}
              </Section>
            )}

            {/* Duration */}
            <Section title="Duration" themeColors={themeColors}>
              {DURATION_OPTIONS.map((option) => (
                <FilterChip
                  key={option.id || 'none'}
                  label={option.label}
                  isSelected={localFilters.duration === option.id}
                  onPress={() => toggleDuration(option.id)}
                  themeColors={themeColors}
                />
              ))}
            </Section>
          </ScrollView>

          {/* Apply Button */}
          <View style={[styles.footer, { borderTopColor: themeColors.border.default }]}>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.accent.primary }]}
              onPress={handleApply}
            >
              <Text style={[styles.applyButtonText, { color: themeColors.text.inverse }]}>
                Show {resultCount} Result{resultCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    // backgroundColor set via theme in JSX
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    // backgroundColor set via theme in JSX
    borderTopLeftRadius: wp(5),
    borderTopRightRadius: wp(5),
    maxHeight: hp(80),
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: hp(1.5),
  },
  handle: {
    width: wp(9),
    height: hp(0.5),
    // backgroundColor set via theme in JSX
    borderRadius: hp(0.25),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5.5),
    paddingBottom: hp(2),
    borderBottomWidth: 1,
    // borderBottomColor set via theme in JSX
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    // color set via theme in JSX
  },
  resetText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    // color set via theme in JSX
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: wp(5.5),
    paddingTop: hp(2),
    paddingBottom: hp(2),
  },
  section: {
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  sectionTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    // color set via theme in JSX
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    // color set via theme in JSX
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  chip: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    // backgroundColor set via theme in JSX
    borderRadius: hp(2),
    borderWidth: 1,
    // borderColor set via theme in JSX
  },
  chipText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    // color set via theme in JSX
  },
  footer: {
    paddingHorizontal: wp(5.5),
    paddingTop: hp(2),
    borderTopWidth: 1,
    // borderTopColor set via theme in JSX
  },
  applyButton: {
    // backgroundColor set via theme in JSX
    paddingVertical: hp(1.8),
    borderRadius: wp(2),
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    // color set via theme in JSX
  },
});

export default FilterSheet;
