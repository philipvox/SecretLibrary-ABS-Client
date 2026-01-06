/**
 * src/features/profile/screens/HapticSettingsScreen.tsx
 *
 * Settings screen for haptic feedback preferences.
 * Allows users to enable/disable haptics globally and per category.
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
import {
  ChevronLeft,
  Circle,
  PlayCircle,
  GitCommitHorizontal,
  Gauge,
  Moon,
  Download,
  Bookmark,
  Trophy,
  Hand,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { accentColors, scale, typography, fontWeight, spacing } from '@/shared/theme';
import { useThemeColors, ThemeColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { useHapticSettingsStore } from '../stores/hapticSettingsStore';

const ACCENT = accentColors.gold;

// Helper to create theme-aware colors
function createColors(themeColors: ThemeColors) {
  return {
    accent: ACCENT,
    background: themeColors.backgroundSecondary,
    text: themeColors.text,
    textSecondary: themeColors.textSecondary,
    textTertiary: themeColors.textTertiary,
    card: themeColors.border,
    border: themeColors.border,
    iconBg: themeColors.border,
  };
}

// Settings Row Component
interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  note?: string;
  switchValue: boolean;
  onSwitchChange: (value: boolean) => void;
  disabled?: boolean;
  colors: ReturnType<typeof createColors>;
}

function SettingsRow({ Icon, label, note, switchValue, onSwitchChange, disabled, colors }: SettingsRowProps) {
  const handleChange = useCallback((value: boolean) => {
    // Play haptic feedback when enabling
    if (value) {
      haptics.selection();
    }
    onSwitchChange(value);
  }, [onSwitchChange]);

  return (
    <View style={[styles.settingsRow, { borderBottomColor: colors.border }, disabled && styles.settingsRowDisabled]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }, disabled && { opacity: 0.5 }]}>
          <Icon
            size={scale(18)}
            color={disabled ? colors.textTertiary : colors.textSecondary}
            strokeWidth={2}
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.text }, disabled && { color: colors.textTertiary }]}>{label}</Text>
          {note ? <Text style={[styles.rowNote, { color: colors.textTertiary }, disabled && { opacity: 0.6 }]}>{note}</Text> : null}
        </View>
      </View>
      <Switch
        value={switchValue}
        onValueChange={handleChange}
        trackColor={{ false: colors.border, true: ACCENT }}
        thumbColor="#fff"
        disabled={disabled}
      />
    </View>
  );
}

// Section Header Component
function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof createColors> }) {
  return <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>{title}</Text>;
}

export function HapticSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const colors = createColors(themeColors);

  // Haptic settings from store
  const enabled = useHapticSettingsStore((s) => s.enabled);
  const playbackControls = useHapticSettingsStore((s) => s.playbackControls);
  const scrubberFeedback = useHapticSettingsStore((s) => s.scrubberFeedback);
  const speedControl = useHapticSettingsStore((s) => s.speedControl);
  const sleepTimer = useHapticSettingsStore((s) => s.sleepTimer);
  const downloads = useHapticSettingsStore((s) => s.downloads);
  const bookmarks = useHapticSettingsStore((s) => s.bookmarks);
  const completions = useHapticSettingsStore((s) => s.completions);
  const uiInteractions = useHapticSettingsStore((s) => s.uiInteractions);

  // Actions
  const setEnabled = useHapticSettingsStore((s) => s.setEnabled);
  const setPlaybackControls = useHapticSettingsStore((s) => s.setPlaybackControls);
  const setScrubberFeedback = useHapticSettingsStore((s) => s.setScrubberFeedback);
  const setSpeedControl = useHapticSettingsStore((s) => s.setSpeedControl);
  const setSleepTimer = useHapticSettingsStore((s) => s.setSleepTimer);
  const setDownloads = useHapticSettingsStore((s) => s.setDownloads);
  const setBookmarks = useHapticSettingsStore((s) => s.setBookmarks);
  const setCompletions = useHapticSettingsStore((s) => s.setCompletions);
  const setUiInteractions = useHapticSettingsStore((s) => s.setUiInteractions);

  const handleMasterToggle = useCallback((value: boolean) => {
    if (value) {
      // Play success haptic when enabling
      haptics.success();
    }
    setEnabled(value);
  }, [setEnabled]);

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Haptic Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Toggle Section */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={Circle}
              label="Haptic Feedback"
              note="Enable tactile feedback throughout the app"
              switchValue={enabled}
              onSwitchChange={handleMasterToggle}
              colors={colors}
            />
          </View>
        </View>

        {/* Category Toggles - Only visible when master is enabled */}
        {enabled && (
          <>
            {/* Playback Section */}
            <View style={styles.section}>
              <SectionHeader title="Playback" colors={colors} />
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                <SettingsRow
                  Icon={PlayCircle}
                  label="Playback Controls"
                  note="Play, pause, skip forward/back"
                  switchValue={playbackControls}
                  onSwitchChange={setPlaybackControls}
                  colors={colors}
                />
                <SettingsRow
                  Icon={GitCommitHorizontal}
                  label="Timeline Scrubbing"
                  note="Scrubbing feedback, chapter markers"
                  switchValue={scrubberFeedback}
                  onSwitchChange={setScrubberFeedback}
                  colors={colors}
                />
                <SettingsRow
                  Icon={Gauge}
                  label="Speed Control"
                  note="Speed selection changes"
                  switchValue={speedControl}
                  onSwitchChange={setSpeedControl}
                  colors={colors}
                />
                <SettingsRow
                  Icon={Moon}
                  label="Sleep Timer"
                  note="Timer set, warning, expiration"
                  switchValue={sleepTimer}
                  onSwitchChange={setSleepTimer}
                  colors={colors}
                />
              </View>
            </View>

            {/* Library Section */}
            <View style={styles.section}>
              <SectionHeader title="Library" colors={colors} />
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                <SettingsRow
                  Icon={Download}
                  label="Downloads"
                  note="Download start and completion"
                  switchValue={downloads}
                  onSwitchChange={setDownloads}
                  colors={colors}
                />
                <SettingsRow
                  Icon={Bookmark}
                  label="Bookmarks"
                  note="Create, delete, jump to bookmark"
                  switchValue={bookmarks}
                  onSwitchChange={setBookmarks}
                  colors={colors}
                />
                <SettingsRow
                  Icon={Trophy}
                  label="Completions"
                  note="Book and series celebrations"
                  switchValue={completions}
                  onSwitchChange={setCompletions}
                  colors={colors}
                />
              </View>
            </View>

            {/* UI Section */}
            <View style={styles.section}>
              <SectionHeader title="Interface" colors={colors} />
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                <SettingsRow
                  Icon={Hand}
                  label="UI Interactions"
                  note="Buttons, toggles, long press"
                  switchValue={uiInteractions}
                  onSwitchChange={setUiInteractions}
                  colors={colors}
                />
              </View>
            </View>
          </>
        )}

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            Haptic feedback provides tactile confirmation for actions without requiring you to look at the screen.
            Disable individual categories to customize your experience.
          </Text>
        </View>
      </ScrollView>
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border in JSX
  },
  settingsRowDisabled: {
    opacity: 0.5,
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
