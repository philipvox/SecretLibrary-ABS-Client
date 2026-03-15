/**
 * src/features/browse/components/TagFilterSheet.tsx
 *
 * Filter sheet with collapsible Genres and Tags sections.
 * NN/g principles: compact by default, accordion expand, batch apply via DONE,
 * counts to prevent zero-result dead ends, alphabetical genres / frequency tags.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronUp, Timer } from 'lucide-react-native';
import { secretLibraryFonts, secretLibraryColors } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { Icon } from '@/shared/components/Icon';
import { LengthRange, AudienceFilter, useContentFilterStore } from '../stores/contentFilterStore';
import { useDynamicFilters, FilterOption } from '../hooks/useDynamicFilters';

// How many items to show before "SHOW ALL"
const PREVIEW_COUNT = 8;

// =============================================================================
// Types
// =============================================================================

interface TagFilterSheetProps {
  visible: boolean;
  onClose: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTagLabel(tag: string): string {
  return tag
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .toUpperCase();
}

// =============================================================================
// Length Range Section
// =============================================================================

const LENGTH_MIN = 0;
const LENGTH_MAX = 30;

interface LengthRangeSectionProps {
  lengthRange: LengthRange | null;
  onLengthChange: (range: LengthRange | null) => void;
}

function LengthRangeSection({ lengthRange, onLengthChange }: LengthRangeSectionProps) {
  const colors = useSecretLibraryColors();
  const [expanded, setExpanded] = useState(false);

  const minValue = lengthRange?.min ?? LENGTH_MIN;
  const maxValue = lengthRange?.max ?? LENGTH_MAX;
  const isActive = lengthRange !== null;

  const handleToggleExpand = useCallback(() => {
    Haptics.selectionAsync();
    setExpanded((prev) => !prev);
  }, []);

  const handleMinChange = useCallback((value: number) => {
    const newMin = Math.round(value);
    const newMax = Math.max(newMin + 1, maxValue);
    onLengthChange({ min: newMin, max: newMax });
  }, [maxValue, onLengthChange]);

  const handleMaxChange = useCallback((value: number) => {
    const newMax = Math.round(value);
    const newMin = Math.min(minValue, newMax - 1);
    onLengthChange({ min: newMin, max: newMax });
  }, [minValue, onLengthChange]);

  const handleClear = useCallback(() => {
    Haptics.selectionAsync();
    onLengthChange(null);
  }, [onLengthChange]);

  const formatHours = (hours: number) => {
    if (hours >= LENGTH_MAX) return '30+';
    return `${hours}`;
  };

  return (
    <View style={[styles.lengthContainer, { borderBottomColor: colors.grayLine }]}>
      <TouchableOpacity style={styles.lengthHeader} onPress={handleToggleExpand}>
        <View style={styles.lengthTitleRow}>
          <Timer size={14} color={colors.gray} />
          <Text style={[styles.lengthTitle, { color: colors.black }]}>LENGTH</Text>
          {isActive && (
            <View style={[styles.lengthBadge, { backgroundColor: colors.black }]}>
              <Text style={[styles.lengthBadgeText, { color: colors.white }]}>
                {formatHours(minValue)}-{formatHours(maxValue)}H
              </Text>
            </View>
          )}
        </View>
        {expanded ? (
          <ChevronUp size={16} color={colors.gray} />
        ) : (
          <ChevronDown size={16} color={colors.gray} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.lengthSection}>
          <View style={styles.lengthRangeDisplay}>
            <Text style={[styles.lengthRangeText, { color: colors.black }]}>
              {formatHours(minValue)} - {formatHours(maxValue)} HOURS
            </Text>
            {isActive && (
              <TouchableOpacity onPress={handleClear}>
                <Text style={[styles.clearText, { color: colors.gray }]}>CLEAR</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.gray }]}>MIN</Text>
            <Slider
              style={styles.slider}
              minimumValue={LENGTH_MIN}
              maximumValue={LENGTH_MAX - 1}
              value={minValue}
              onValueChange={handleMinChange}
              minimumTrackTintColor={colors.black}
              maximumTrackTintColor={colors.grayLine}
              thumbTintColor={colors.black}
              step={1}
            />
            <Text style={[styles.sliderValue, { color: colors.black }]}>{formatHours(minValue)}H</Text>
          </View>
          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.gray }]}>MAX</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={LENGTH_MAX}
              value={maxValue}
              onValueChange={handleMaxChange}
              minimumTrackTintColor={colors.black}
              maximumTrackTintColor={colors.grayLine}
              thumbTintColor={colors.black}
              step={1}
            />
            <Text style={[styles.sliderValue, { color: colors.black }]}>{formatHours(maxValue)}H</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Collapsible Filter Section
// =============================================================================

interface FilterSectionProps {
  title: string;
  items: FilterOption[];
  selectedKeys: string[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggle: (key: string) => void;
  formatLabel?: (name: string) => string;
}

function FilterSection({ title, items, selectedKeys, collapsed, onToggleCollapsed, expanded, onToggleExpanded, onToggle, formatLabel }: FilterSectionProps) {
  const colors = useSecretLibraryColors();
  const selectedCount = useMemo(
    () => items.filter((i) => selectedKeys.includes(i.key)).length,
    [items, selectedKeys]
  );

  const needsExpand = items.length > PREVIEW_COUNT;
  const visibleItems = expanded || !needsExpand ? items : items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - PREVIEW_COUNT;

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Section header — tappable to collapse/expand entire section */}
      <Pressable
        style={styles.sectionHeaderRow}
        onPress={onToggleCollapsed}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={[styles.sectionHeader, { color: colors.gray }]}>{title}</Text>
          {selectedCount > 0 && (
            <View style={[styles.sectionBadge, { backgroundColor: colors.black }]}>
              <Text style={[styles.sectionBadgeText, { color: colors.white }]}>{selectedCount}</Text>
            </View>
          )}
        </View>
        {collapsed ? (
          <ChevronDown size={14} color={colors.gray} />
        ) : (
          <ChevronUp size={14} color={colors.gray} />
        )}
      </Pressable>

      {/* List rows — only shown when section is expanded */}
      {!collapsed && (
        <>
          {visibleItems.map((item, index) => {
            const isSelected = selectedKeys.includes(item.key);
            const isLast = index === visibleItems.length - 1 && (expanded || !needsExpand);
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.listRow,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.grayLine },
                  isSelected && { backgroundColor: 'rgba(0, 0, 0, 0.06)' },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onToggle(item.key);
                }}
              >
                <View style={styles.listRowLeft}>
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: colors.black }]}>
                      <Icon name="Check" size={10} color={colors.white} />
                    </View>
                  )}
                  <Text style={[styles.listRowLabel, { color: colors.black }]}>
                    {formatLabel ? formatLabel(item.name) : item.name.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.listRowCount, { color: colors.black }]}>
                  {item.count}
                </Text>
              </Pressable>
            );
          })}

          {/* Show All / Show Less toggle */}
          {needsExpand && (
            <Pressable style={styles.expandButton} onPress={onToggleExpanded}>
              <Text style={[styles.expandText, { color: colors.gray }]}>
                {expanded ? 'SHOW LESS' : `SHOW ALL (${hiddenCount} MORE)`}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TagFilterSheet({ visible, onClose }: TagFilterSheetProps) {
  const colors = useSecretLibraryColors();
  const { genres, tags } = useDynamicFilters();

  // Accordion state — collapsed controls section visibility, expanded controls show all
  const [genresCollapsed, setGenresCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(true);
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const handleToggleGenresCollapsed = useCallback(() => {
    Haptics.selectionAsync();
    setGenresCollapsed((prev) => !prev);
  }, []);

  const handleToggleTagsCollapsed = useCallback(() => {
    Haptics.selectionAsync();
    setTagsCollapsed((prev) => !prev);
  }, []);

  const handleToggleGenresExpanded = useCallback(() => {
    Haptics.selectionAsync();
    setGenresExpanded((prev) => !prev);
  }, []);

  const handleToggleTagsExpanded = useCallback(() => {
    Haptics.selectionAsync();
    setTagsExpanded((prev) => !prev);
  }, []);

  // Store state
  const audience = useContentFilterStore((s) => s.audience);
  const setAudience = useContentFilterStore((s) => s.setAudience);
  const selectedTags = useContentFilterStore((s) => s.selectedTags);
  const selectedGenres = useContentFilterStore((s) => s.selectedGenres);
  const lengthRange = useContentFilterStore((s) => s.lengthRange);
  const toggleTag = useContentFilterStore((s) => s.toggleTag);
  const toggleGenre = useContentFilterStore((s) => s.toggleGenre);
  const setLengthRange = useContentFilterStore((s) => s.setLengthRange);
  const clearTags = useContentFilterStore((s) => s.clearTags);

  const handleAudienceChange = useCallback((value: AudienceFilter) => {
    Haptics.selectionAsync();
    setAudience(value);
  }, [setAudience]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTags();
  }, [clearTags]);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  }, [onClose]);

  const filterCount = selectedTags.length + selectedGenres.length + (lengthRange ? 1 : 0) + (audience !== 'all' ? 1 : 0);
  const hasActiveFilter = filterCount > 0;

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
            <Text style={[styles.headerTitle, { color: colors.black }]}>FILTERS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          {/* Selected Summary — horizontal scroll of active pills */}
          {hasActiveFilter && (
            <View style={styles.selectedSummary}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.selectedTagsRow}>
                  {lengthRange && (
                    <View style={[styles.selectedTag, { backgroundColor: colors.black }]}>
                      <Timer size={12} color={colors.white} />
                      <Text style={[styles.selectedTagText, { color: colors.white }]}>
                        {lengthRange.min}-{lengthRange.max >= 30 ? '30+' : lengthRange.max}H
                      </Text>
                    </View>
                  )}
                  {selectedGenres.map((genre) => (
                    <TouchableOpacity
                      key={`g-${genre}`}
                      style={[styles.selectedTag, { backgroundColor: colors.black }]}
                      onPress={() => { Haptics.selectionAsync(); toggleGenre(genre); }}
                    >
                      <Text style={[styles.selectedTagText, { color: colors.white }]}>
                        {genre.toUpperCase()}
                      </Text>
                      <Icon name="X" size={12} color={colors.white} />
                    </TouchableOpacity>
                  ))}
                  {selectedTags.map((tag) => (
                    <TouchableOpacity
                      key={`t-${tag}`}
                      style={[styles.selectedTag, { backgroundColor: colors.black }]}
                      onPress={() => { Haptics.selectionAsync(); toggleTag(tag); }}
                    >
                      <Text style={[styles.selectedTagText, { color: colors.white }]}>
                        {formatTagLabel(tag)}
                      </Text>
                      <Icon name="X" size={12} color={colors.white} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Audience Toggle */}
          <View style={styles.audienceContainer}>
            <View style={styles.audiencePillTrack}>
              {(['all', 'kids', 'adults'] as AudienceFilter[]).map((value) => {
                const isActive = audience === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.audiencePill, isActive && styles.audiencePillActive]}
                    onPress={() => handleAudienceChange(value)}
                  >
                    <Text style={[styles.audiencePillText, isActive && styles.audiencePillTextActive]}>
                      {value.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Length */}
          <LengthRangeSection lengthRange={lengthRange} onLengthChange={setLengthRange} />

          {/* Scrollable accordion sections */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <FilterSection
              title="GENRES"
              items={genres}
              selectedKeys={selectedGenres}
              collapsed={genresCollapsed}
              onToggleCollapsed={handleToggleGenresCollapsed}
              expanded={genresExpanded}
              onToggleExpanded={handleToggleGenresExpanded}
              onToggle={toggleGenre}
            />
            <FilterSection
              title="TAGS"
              items={tags}
              selectedKeys={selectedTags}
              collapsed={tagsCollapsed}
              onToggleCollapsed={handleToggleTagsCollapsed}
              expanded={tagsExpanded}
              onToggleExpanded={handleToggleTagsExpanded}
              onToggle={toggleTag}
              formatLabel={formatTagLabel}
            />
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.grayLine }]}>
            {hasActiveFilter && (
              <TouchableOpacity style={styles.resetButton} onPress={handleClear}>
                <Text style={[styles.resetText, { color: colors.gray }]}>CLEAR ALL</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.black }]}
              onPress={handleDone}
              activeOpacity={0.8}
            >
              <Text style={[styles.doneText, { color: colors.white }]}>
                DONE{hasActiveFilter ? ` (${filterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// =============================================================================
// Styles
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
    maxHeight: '85%',
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
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(13),
    letterSpacing: 1.5,
  },
  closeButton: {
    padding: 4,
  },
  selectedSummary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  selectedTagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  selectedTagText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    letterSpacing: 0.5,
  },
  // Audience pills
  audienceContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  audiencePillTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: scale(20),
    padding: 3,
  },
  audiencePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: scale(8),
    borderRadius: scale(17),
  },
  audiencePillActive: {
    backgroundColor: secretLibraryColors.black,
  },
  audiencePillText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: secretLibraryColors.gray,
    letterSpacing: 0.5,
  },
  audiencePillTextActive: {
    color: secretLibraryColors.white,
    fontWeight: '600',
  },
  // Length
  lengthContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  lengthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lengthTitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    fontWeight: '500',
    letterSpacing: 1,
  },
  lengthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  lengthBadgeText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  lengthSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  lengthRangeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lengthRangeText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  clearText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 0.5,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    width: 32,
    letterSpacing: 0.5,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    width: 36,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  // Scrollable content
  content: {
    maxHeight: 340,
  },
  // Accordion section
  section: {
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeader: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(9),
    letterSpacing: 1.5,
  },
  sectionBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  sectionBadgeText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    fontWeight: '700',
  },
  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: scale(44),
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowLabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    letterSpacing: 0.5,
    flex: 1,
  },
  listRowCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(11),
    letterSpacing: 0.5,
    marginLeft: 12,
  },
  // Expand/collapse toggle
  expandButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  expandText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    letterSpacing: 1,
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resetText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 0.5,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(13),
    letterSpacing: 1.5,
  },
});

export default TagFilterSheet;
