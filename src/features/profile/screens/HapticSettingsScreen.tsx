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
import { Ionicons } from '@expo/vector-icons';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { useHapticSettingsStore } from '../stores/hapticSettingsStore';

const ACCENT = colors.accent;

// Settings Row Component
interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  note?: string;
  switchValue: boolean;
  onSwitchChange: (value: boolean) => void;
  disabled?: boolean;
}

function SettingsRow({ icon, label, note, switchValue, onSwitchChange, disabled }: SettingsRowProps) {
  const handleChange = useCallback((value: boolean) => {
    // Play haptic feedback when enabling
    if (value) {
      haptics.selection();
    }
    onSwitchChange(value);
  }, [onSwitchChange]);

  return (
    <View style={[styles.settingsRow, disabled && styles.settingsRowDisabled]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, disabled && styles.iconContainerDisabled]}>
          <Ionicons
            name={icon}
            size={scale(18)}
            color={disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)'}
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>{label}</Text>
          {note ? <Text style={[styles.rowNote, disabled && styles.rowNoteDisabled]}>{note}</Text> : null}
        </View>
      </View>
      <Switch
        value={switchValue}
        onValueChange={handleChange}
        trackColor={{ false: 'rgba(255,255,255,0.2)', true: ACCENT }}
        thumbColor="#fff"
        disabled={disabled}
      />
    </View>
  );
}

// Section Header Component
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function HapticSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Haptic Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Toggle Section */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="radio-button-on-outline"
              label="Haptic Feedback"
              note="Enable tactile feedback throughout the app"
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
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="play-circle-outline"
                  label="Playback Controls"
                  note="Play, pause, skip forward/back"
                  switchValue={playbackControls}
                  onSwitchChange={setPlaybackControls}
                />
                <SettingsRow
                  icon="git-commit-outline"
                  label="Timeline Scrubbing"
                  note="Scrubbing feedback, chapter markers"
                  switchValue={scrubberFeedback}
                  onSwitchChange={setScrubberFeedback}
                />
                <SettingsRow
                  icon="speedometer-outline"
                  label="Speed Control"
                  note="Speed selection changes"
                  switchValue={speedControl}
                  onSwitchChange={setSpeedControl}
                />
                <SettingsRow
                  icon="moon-outline"
                  label="Sleep Timer"
                  note="Timer set, warning, expiration"
                  switchValue={sleepTimer}
                  onSwitchChange={setSleepTimer}
                />
              </View>
            </View>

            {/* Library Section */}
            <View style={styles.section}>
              <SectionHeader title="Library" />
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="download-outline"
                  label="Downloads"
                  note="Download start and completion"
                  switchValue={downloads}
                  onSwitchChange={setDownloads}
                />
                <SettingsRow
                  icon="bookmark-outline"
                  label="Bookmarks"
                  note="Create, delete, jump to bookmark"
                  switchValue={bookmarks}
                  onSwitchChange={setBookmarks}
                />
                <SettingsRow
                  icon="trophy-outline"
                  label="Completions"
                  note="Book and series celebrations"
                  switchValue={completions}
                  onSwitchChange={setCompletions}
                />
              </View>
            </View>

            {/* UI Section */}
            <View style={styles.section}>
              <SectionHeader title="Interface" />
              <View style={styles.sectionCard}>
                <SettingsRow
                  icon="hand-left-outline"
                  label="UI Interactions"
                  note="Buttons, toggles, long press"
                  switchValue={uiInteractions}
                  onSwitchChange={setUiInteractions}
                />
              </View>
            </View>
          </>
        )}

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={scale(16)} color="rgba(255,255,255,0.4)" />
          <Text style={styles.infoText}>
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
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
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
    marginBottom: scale(24),
  },
  sectionHeader: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginHorizontal: scale(20),
    marginBottom: scale(8),
  },
  sectionCard: {
    marginHorizontal: scale(16),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowContent: {
    flex: 1,
    marginLeft: scale(12),
    marginRight: scale(12),
  },
  rowLabel: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#fff',
  },
  rowLabelDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  rowNote: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },
  rowNoteDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    marginHorizontal: scale(20),
    marginTop: scale(8),
  },
  infoText: {
    flex: 1,
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.4)',
    lineHeight: scale(18),
  },
});
