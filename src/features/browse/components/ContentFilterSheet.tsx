/**
 * src/features/browse/components/ContentFilterSheet.tsx
 *
 * Filter popup for Kids mode settings.
 * Supports multi-select for age recommendations and ratings.
 * Matches SearchFilterSheet styling (centered popup, white/black only).
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { Icon } from '@/shared/components/Icon';
import { AgeRecommendation, AgeRating, useContentFilterStore } from '../stores/contentFilterStore';

// =============================================================================
// Types
// =============================================================================

interface ContentFilterSheetProps {
  visible: boolean;
  onClose: () => void;
}

// =============================================================================
// Age Options
// =============================================================================

const AGE_OPTIONS: { id: AgeRecommendation; label: string }[] = [
  { id: '4', label: '4 & under' },
  { id: '6', label: '6 & under' },
  { id: '8', label: '8 & under' },
  { id: '10', label: '10 & under' },
  { id: '12', label: '12 & under' },
  { id: '14', label: '14 & under' },
  { id: '16', label: '16 & under' },
];

const RATING_OPTIONS: { id: AgeRating; label: string }[] = [
  { id: 'childrens', label: "Children's" },
  { id: 'teens', label: 'Teens' },
  { id: 'young-adult', label: 'Young Adult' },
];

// =============================================================================
// Main Component
// =============================================================================

export function ContentFilterSheet({ visible, onClose }: ContentFilterSheetProps) {
  const colors = useSecretLibraryColors();

  // Store state
  const selectedAges = useContentFilterStore((s) => s.selectedAges);
  const selectedRatings = useContentFilterStore((s) => s.selectedRatings);
  const toggleAge = useContentFilterStore((s) => s.toggleAge);
  const toggleRating = useContentFilterStore((s) => s.toggleRating);
  const resetFilters = useContentFilterStore((s) => s.resetFilters);

  // Handlers
  const handleToggleAge = useCallback((age: AgeRecommendation) => {
    Haptics.selectionAsync();
    toggleAge(age);
  }, [toggleAge]);

  const handleToggleRating = useCallback((rating: AgeRating) => {
    Haptics.selectionAsync();
    toggleRating(rating);
  }, [toggleRating]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetFilters();
  }, [resetFilters]);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  }, [onClose]);

  // Count active filters
  const filterCount = selectedAges.length + selectedRatings.length;
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
            <Text style={[styles.headerTitle, { color: colors.black }]}>Kids Mode</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={20} color={colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Age Recommendations */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.gray }]}>AGE</Text>
              <Text style={[styles.sectionDescription, { color: colors.gray }]}>
                Select ages to show content for:
              </Text>
              <View style={styles.optionsGrid}>
                {AGE_OPTIONS.map((option) => {
                  const isSelected = selectedAges.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.option,
                        { borderColor: colors.grayLine },
                        isSelected && { backgroundColor: colors.black, borderColor: colors.black },
                      ]}
                      onPress={() => handleToggleAge(option.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: isSelected ? colors.white : colors.black },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Age Ratings */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.gray }]}>RATING</Text>
              <Text style={[styles.sectionDescription, { color: colors.gray }]}>
                Include content with these ratings:
              </Text>
              <View style={styles.optionsGrid}>
                {RATING_OPTIONS.map((option) => {
                  const isSelected = selectedRatings.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.option,
                        { borderColor: colors.grayLine },
                        isSelected && { backgroundColor: colors.black, borderColor: colors.black },
                      ]}
                      onPress={() => handleToggleRating(option.id)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: isSelected ? colors.white : colors.black },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.grayLine }]}>
            {hasActiveFilter && (
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={[styles.resetText, { color: colors.gray }]}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.black }]}
              onPress={handleDone}
            >
              <Text style={[styles.applyText, { color: colors.white }]}>
                Done{hasActiveFilter ? ` (${filterCount})` : ''}
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    marginBottom: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
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

export default ContentFilterSheet;
