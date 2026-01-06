/**
 * src/features/profile/screens/ChapterCleaningSettingsScreen.tsx
 *
 * Settings screen for chapter name cleaning preferences.
 * Allows users to select cleaning level and see examples.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, Code, Info, ArrowRight, type LucideIcon } from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { accentColors, scale, typography, fontWeight, spacing } from '@/shared/theme';
import { useColors, ThemeColors } from '@/shared/theme';
import {
  useChapterCleaningStore,
  CLEANING_LEVEL_INFO,
  type ChapterCleaningLevel,
} from '../stores/chapterCleaningStore';

const ACCENT = accentColors.gold;

// Helper to create theme-aware colors from nested ThemeColors
function createColors(c: ThemeColors) {
  return {
    accent: ACCENT,
    background: c.background.secondary,
    text: c.text.primary,
    textSecondary: c.text.secondary,
    textTertiary: c.text.tertiary,
    card: c.border.default,
    border: c.border.default,
    iconBg: c.border.default,
  };
}

// Level option data
const LEVEL_OPTIONS: ChapterCleaningLevel[] = ['off', 'light', 'standard', 'aggressive'];

// Radio Button Option Component
interface LevelOptionProps {
  level: ChapterCleaningLevel;
  isSelected: boolean;
  onSelect: (level: ChapterCleaningLevel) => void;
  isRecommended?: boolean;
  colors: ReturnType<typeof createColors>;
}

function LevelOption({ level, isSelected, onSelect, isRecommended, colors }: LevelOptionProps) {
  const info = CLEANING_LEVEL_INFO[level];

  return (
    <TouchableOpacity
      style={[styles.levelOption, { borderBottomColor: colors.border }, isSelected && { backgroundColor: 'rgba(243, 182, 12, 0.08)' }]}
      onPress={() => onSelect(level)}
      activeOpacity={0.7}
    >
      <View style={styles.levelOptionLeft}>
        {/* Radio circle */}
        <View style={[styles.radioOuter, { borderColor: colors.textTertiary }, isSelected && { borderColor: colors.accent }]}>
          {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
        </View>

        {/* Content */}
        <View style={styles.levelContent}>
          <View style={styles.labelRow}>
            <Text style={[styles.levelLabel, { color: colors.text }, isSelected && { color: colors.accent }]}>
              {info.label}
            </Text>
            {isRecommended && (
              <View style={styles.recommendedBadge}>
                <Text style={[styles.recommendedText, { color: colors.accent }]}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={[styles.levelDescription, { color: colors.textTertiary }]}>{info.description}</Text>
          <Text style={[styles.levelExample, { color: colors.textTertiary }]}>{info.example}</Text>
        </View>
      </View>

      {/* Checkmark for selected */}
      {isSelected && (
        <Check size={scale(20)} color={colors.accent} strokeWidth={2.5} />
      )}
    </TouchableOpacity>
  );
}

// Settings Row Component (for toggle)
interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  note?: string;
  switchValue: boolean;
  onSwitchChange: (value: boolean) => void;
  colors: ReturnType<typeof createColors>;
}

function SettingsRow({ Icon, label, note, switchValue, onSwitchChange, colors }: SettingsRowProps) {
  return (
    <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
          <Icon
            size={scale(18)}
            color={colors.textSecondary}
            strokeWidth={2}
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
          {note ? <Text style={[styles.rowNote, { color: colors.textTertiary }]}>{note}</Text> : null}
        </View>
      </View>
      <Switch
        value={switchValue}
        onValueChange={onSwitchChange}
        trackColor={{ false: colors.border, true: ACCENT }}
        thumbColor="#fff"
      />
    </View>
  );
}

// Section Header Component
function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof createColors> }) {
  return <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>{title}</Text>;
}

export function ChapterCleaningSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const themeColors = useColors();
  const colors = createColors(themeColors);

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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={scale(24)} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chapter Names</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Clean up inconsistent chapter names for a more polished listening experience.
            Original metadata is always preserved.
          </Text>
        </View>

        {/* Cleaning Level Section */}
        <View style={styles.section}>
          <SectionHeader title="CLEANING LEVEL" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            {LEVEL_OPTIONS.map((opt) => (
              <LevelOption
                key={opt}
                level={opt}
                isSelected={level === opt}
                onSelect={handleLevelSelect}
                isRecommended={opt === 'standard'}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Advanced Section */}
        <View style={styles.section}>
          <SectionHeader title="ADVANCED" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={Code}
              label="Show Original Names"
              note="Display original metadata for debugging"
              switchValue={showOriginalNames}
              onSwitchChange={setShowOriginalNames}
              colors={colors}
            />
          </View>
        </View>

        {/* Before/After Examples */}
        <View style={styles.section}>
          <SectionHeader title="EXAMPLE TRANSFORMATIONS" colors={colors} />
          <View style={[styles.examplesCard, { backgroundColor: colors.card }]}>
            <ExampleRow
              before="01 - The Great Gatsby: Chapter 1"
              after="Chapter 1"
              colors={colors}
            />
            <ExampleRow
              before="D01T05 - Interview With the Vampire"
              after="Chapter 5"
              colors={colors}
            />
            <ExampleRow
              before="Chapter Twenty-Three: The Discovery"
              after="Chapter 23: The Discovery"
              colors={colors}
            />
            <ExampleRow
              before="Prologue"
              after="Prologue"
              note="Front/back matter preserved"
              colors={colors}
            />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info
            size={scale(16)}
            color={colors.textTertiary}
            strokeWidth={2}
          />
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            Changes only affect how chapters are displayed. Your server data remains unchanged.
            Based on analysis of 68,000+ real audiobook chapters.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Example Row Component
function ExampleRow({
  before,
  after,
  note,
  colors,
}: {
  before: string;
  after: string;
  note?: string;
  colors: ReturnType<typeof createColors>;
}) {
  return (
    <View style={[styles.exampleRow, { borderBottomColor: colors.border }]}>
      <View style={styles.exampleBefore}>
        <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>Before</Text>
        <Text style={[styles.exampleText, { color: colors.textTertiary }]} numberOfLines={1}>
          {before}
        </Text>
      </View>
      <ArrowRight
        size={scale(14)}
        color={colors.textTertiary}
        strokeWidth={2}
        style={styles.exampleArrow}
      />
      <View style={styles.exampleAfter}>
        <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>After</Text>
        <Text style={[styles.exampleTextClean, { color: colors.accent }]} numberOfLines={1}>
          {after}
        </Text>
        {note && <Text style={[styles.exampleNote, { color: colors.textTertiary }]}>{note}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via colors.background in JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontWeight: fontWeight.semibold,
    // color set via colors.text in JSX
  },
  headerSpacer: {
    width: scale(40),
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },
  introSection: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  introText: {
    ...typography.bodyLarge,
    // color set via colors.textSecondary in JSX
    lineHeight: scale(20),
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
    // color set via colors.textTertiary in JSX
    letterSpacing: 0.5,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    // backgroundColor set via colors.card in JSX
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border in JSX
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
    // borderColor set in JSX
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(2),
  },
  radioInner: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    // backgroundColor set in JSX
  },
  levelContent: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: scale(12),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.medium,
    // color set in JSX
  },
  recommendedBadge: {
    backgroundColor: 'rgba(243, 182, 12, 0.15)', // Intentional: accent highlight
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  recommendedText: {
    ...typography.labelSmall,
    fontWeight: fontWeight.semibold,
    // color set in JSX
  },
  levelDescription: {
    ...typography.bodySmall,
    // color set in JSX
    marginTop: scale(2),
  },
  levelExample: {
    ...typography.labelMedium,
    // color set in JSX
    marginTop: scale(4),
    fontFamily: 'monospace',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border in JSX
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    // backgroundColor set via colors.iconBg in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: scale(12),
  },
  rowLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.medium,
    // color set via colors.text in JSX
  },
  rowNote: {
    ...typography.bodySmall,
    // color set via colors.textTertiary in JSX
    marginTop: scale(2),
  },
  examplesCard: {
    marginHorizontal: spacing.lg,
    // backgroundColor set via colors.card in JSX
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border in JSX
  },
  exampleBefore: {
    flex: 1,
  },
  exampleArrow: {
    marginHorizontal: scale(8),
    marginTop: scale(14),
  },
  exampleAfter: {
    flex: 1,
  },
  exampleLabel: {
    ...typography.labelSmall,
    fontWeight: fontWeight.semibold,
    // color set in JSX
    marginBottom: scale(4),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    ...typography.bodySmall,
    // color set in JSX
    fontFamily: 'monospace',
  },
  exampleTextClean: {
    ...typography.bodySmall,
    // color set via colors.accent in JSX
    fontFamily: 'monospace',
  },
  exampleNote: {
    ...typography.labelSmall,
    // color set in JSX
    marginTop: scale(2),
    fontStyle: 'italic',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  infoText: {
    flex: 1,
    ...typography.bodySmall,
    // color set via colors.textTertiary in JSX
    lineHeight: scale(18),
  },
});
