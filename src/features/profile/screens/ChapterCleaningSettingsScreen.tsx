/**
 * src/features/profile/screens/ChapterCleaningSettingsScreen.tsx
 *
 * Secret Library Chapter Cleaning Settings
 * Cleaning level selection with examples.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Code, Info, ArrowRight } from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import {
  useChapterCleaningStore,
  CLEANING_LEVEL_INFO,
  type ChapterCleaningLevel,
} from '../stores/chapterCleaningStore';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';

// =============================================================================
// CONSTANTS
// =============================================================================

const LEVEL_OPTIONS: ChapterCleaningLevel[] = ['off', 'light', 'standard', 'aggressive'];

// =============================================================================
// COMPONENTS
// =============================================================================

interface LevelOptionProps {
  level: ChapterCleaningLevel;
  isSelected: boolean;
  onSelect: (level: ChapterCleaningLevel) => void;
  isRecommended?: boolean;
}

function LevelOption({ level, isSelected, onSelect, isRecommended }: LevelOptionProps) {
  const colors = useSecretLibraryColors();
  const info = CLEANING_LEVEL_INFO[level];

  return (
    <TouchableOpacity
      style={[
        styles.levelOption,
        { borderBottomColor: colors.borderLight },
        isSelected && { backgroundColor: colors.grayLight },
      ]}
      onPress={() => onSelect(level)}
      activeOpacity={0.7}
    >
      <View style={styles.levelOptionLeft}>
        {/* Radio circle */}
        <View style={[styles.radioOuter, { borderColor: colors.gray }, isSelected && { borderColor: colors.black }]}>
          {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.black }]} />}
        </View>

        {/* Content */}
        <View style={styles.levelContent}>
          <View style={styles.labelRow}>
            <Text style={[styles.levelLabel, { color: colors.black }, isSelected && styles.levelLabelSelected]}>
              {info.label}
            </Text>
            {isRecommended && (
              <View style={[styles.recommendedBadge, { backgroundColor: colors.grayLight }]}>
                <Text style={[styles.recommendedText, { color: colors.gray }]}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={[styles.levelDescription, { color: colors.gray }]}>{info.description}</Text>
          <Text style={[styles.levelExample, { color: colors.gray }]}>{info.example}</Text>
        </View>
      </View>

      {/* Checkmark for selected */}
      {isSelected && <Check size={scale(20)} color={colors.black} strokeWidth={2} />}
    </TouchableOpacity>
  );
}

interface ExampleRowProps {
  before: string;
  after: string;
  note?: string;
}

function ExampleRow({ before, after, note }: ExampleRowProps) {
  const colors = useSecretLibraryColors();

  return (
    <View style={[styles.exampleRow, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.exampleBefore}>
        <Text style={[styles.exampleLabel, { color: colors.gray }]}>Before</Text>
        <Text style={[styles.exampleText, { color: colors.gray }]} numberOfLines={1}>
          {before}
        </Text>
      </View>
      <ArrowRight size={scale(14)} color={colors.gray} strokeWidth={1.5} style={styles.exampleArrow} />
      <View style={styles.exampleAfter}>
        <Text style={[styles.exampleLabel, { color: colors.gray }]}>After</Text>
        <Text style={[styles.exampleTextClean, { color: colors.black }]} numberOfLines={1}>
          {after}
        </Text>
        {note && <Text style={[styles.exampleNote, { color: colors.gray }]}>{note}</Text>}
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ChapterCleaningSettingsScreen() {
  const colors = useSecretLibraryColors();
  const insets = useSafeAreaInsets();

  // Settings from store
  const level = useChapterCleaningStore((s) => s.level);
  const showOriginalNames = useChapterCleaningStore((s) => s.showOriginalNames);
  const setLevel = useChapterCleaningStore((s) => s.setLevel);
  const setShowOriginalNames = useChapterCleaningStore((s) => s.setShowOriginalNames);

  const handleLevelSelect = useCallback(
    (newLevel: ChapterCleaningLevel) => {
      setLevel(newLevel);
    },
    [setLevel]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="Chapter Names" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={[styles.introText, { color: colors.black }]}>
            Clean up inconsistent chapter names for a more polished listening experience. Original
            metadata is always preserved.
          </Text>
        </View>

        {/* Cleaning Level Section */}
        <View style={styles.section}>
          <SectionHeader title="Cleaning Level" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            {LEVEL_OPTIONS.map((opt) => (
              <LevelOption
                key={opt}
                level={opt}
                isSelected={level === opt}
                onSelect={handleLevelSelect}
                isRecommended={opt === 'standard'}
              />
            ))}
          </View>
        </View>

        {/* Advanced Section */}
        <View style={styles.section}>
          <SectionHeader title="Advanced" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={Code}
              label="Show Original Names"
              description="Display original metadata for debugging"
              switchValue={showOriginalNames}
              onSwitchChange={setShowOriginalNames}
            />
          </View>
        </View>

        {/* Before/After Examples */}
        <View style={styles.section}>
          <SectionHeader title="Example Transformations" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <ExampleRow before="01 - The Great Gatsby: Chapter 1" after="Chapter 1" />
            <ExampleRow before="D01T05 - Interview With the Vampire" after="Chapter 5" />
            <ExampleRow
              before="Chapter Twenty-Three: The Discovery"
              after="Chapter 23: The Discovery"
            />
            <ExampleRow before="Prologue" after="Prologue" note="Front/back matter preserved" />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            Changes only affect how chapters are displayed. Your server data remains unchanged.
            Based on analysis of 68,000+ real audiobook chapters.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  introSection: {
    marginBottom: 28,
  },
  introText: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
    lineHeight: scale(22),
  },
  section: {
    marginBottom: 28,
  },
  sectionCard: {
  },
  // Level Option
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  levelOptionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  radioOuter: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(2),
  },
  radioInner: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
  },
  levelContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  levelLabelSelected: {
    fontFamily: fonts.playfair.bold,
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  levelExample: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Example Row
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  exampleBefore: {
    flex: 1,
  },
  exampleArrow: {
    marginHorizontal: 8,
    marginTop: 18,
  },
  exampleAfter: {
    flex: 1,
  },
  exampleLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  exampleTextClean: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  exampleNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  infoText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flex: 1,
    lineHeight: scale(16),
  },
});
