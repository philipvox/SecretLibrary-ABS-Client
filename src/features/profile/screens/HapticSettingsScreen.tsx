/**
 * src/features/profile/screens/HapticSettingsScreen.tsx
 *
 * Secret Library Haptic Feedback Settings
 * Enable/disable haptics globally and per category.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { haptics } from '@/core/native/haptics';
import { useHapticSettingsStore } from '../stores/hapticSettingsStore';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HapticSettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();

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

  const handleMasterToggle = useCallback(
    (value: boolean) => {
      if (value) {
        haptics.success();
      }
      setEnabled(value);
    },
    [setEnabled]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="Haptic Feedback" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Toggle Section */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={Circle}
              label="Haptic Feedback"
              description="Provides vibration feedback for actions"
              switchValue={enabled}
              onSwitchChange={handleMasterToggle}
            />
          </View>
        </View>

        {/* Category Toggles - Only visible when master is enabled */}
        {enabled && (
          <>
            {/* Playback Section */}
            <View style={styles.section}>
              <SectionHeader title="Playback" />
              <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
                <SettingsRow
                  Icon={PlayCircle}
                  label="Playback Controls"
                  description="Play, pause, skip forward/back"
                  switchValue={playbackControls}
                  onSwitchChange={setPlaybackControls}
                />
                <SettingsRow
                  Icon={GitCommitHorizontal}
                  label="Timeline Scrubbing"
                  description="Scrubbing feedback, chapter markers"
                  switchValue={scrubberFeedback}
                  onSwitchChange={setScrubberFeedback}
                />
                <SettingsRow
                  Icon={Gauge}
                  label="Speed Control"
                  description="Speed selection changes"
                  switchValue={speedControl}
                  onSwitchChange={setSpeedControl}
                />
                <SettingsRow
                  Icon={Moon}
                  label="Sleep Timer"
                  description="Timer set, warning, expiration"
                  switchValue={sleepTimer}
                  onSwitchChange={setSleepTimer}
                />
              </View>
            </View>

            {/* Library Section */}
            <View style={styles.section}>
              <SectionHeader title="Library" />
              <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
                <SettingsRow
                  Icon={Download}
                  label="Downloads"
                  description="Download start and completion"
                  switchValue={downloads}
                  onSwitchChange={setDownloads}
                />
                <SettingsRow
                  Icon={Bookmark}
                  label="Bookmarks"
                  description="Create, delete, jump to bookmark"
                  switchValue={bookmarks}
                  onSwitchChange={setBookmarks}
                />
                <SettingsRow
                  Icon={Trophy}
                  label="Completions"
                  description="Book and series celebrations"
                  switchValue={completions}
                  onSwitchChange={setCompletions}
                />
              </View>
            </View>

            {/* UI Section */}
            <View style={styles.section}>
              <SectionHeader title="Interface" />
              <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
                <SettingsRow
                  Icon={Hand}
                  label="UI Interactions"
                  description="Buttons, toggles, long press"
                  switchValue={uiInteractions}
                  onSwitchChange={setUiInteractions}
                />
              </View>
            </View>
          </>
        )}

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            Haptic patterns use the system Taptic Engine. Some older devices may not support all feedback types.
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
  section: {
    marginBottom: 28,
  },
  sectionCard: {
  },
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
