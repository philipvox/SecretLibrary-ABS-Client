/**
 * src/features/player/components/sheets/SettingsSheet.tsx
 *
 * Settings sheet for player options (progress mode, speed, sleep timer).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Keyboard } from 'react-native';
import { X, Moon, Gauge, Bookmark, Trash2 } from 'lucide-react-native';
import { scale, spacing, layout, useTheme } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { SPEED_QUICK_OPTIONS, SLEEP_QUICK_OPTIONS, SCREEN_WIDTH } from '../../constants/playerConstants';

type ProgressMode = 'chapter' | 'book';

export interface SettingsSheetProps {
  progressMode: ProgressMode;
  setProgressMode: (mode: ProgressMode) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  sleepTimer: number | null;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  bookmarksCount: number;
  queueCount: number;
  clearQueue: () => void;
  onOpenBookmarks: () => void;
  onClose: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  progressMode,
  setProgressMode,
  playbackRate,
  setPlaybackRate,
  sleepTimer,
  setSleepTimer,
  clearSleepTimer,
  bookmarksCount,
  queueCount,
  clearQueue,
  onOpenBookmarks,
  onClose,
}) => {
  const { colors } = useTheme();
  // Custom speed input state
  const isSpeedQuickOption = SPEED_QUICK_OPTIONS.includes(playbackRate);
  const [customSpeedInput, setCustomSpeedInput] = useState(
    isSpeedQuickOption ? '' : String(playbackRate)
  );

  // Custom sleep input state
  const currentSleepMinutes = sleepTimer ? Math.ceil(sleepTimer / 60) : 0;
  const isSleepQuickOption = SLEEP_QUICK_OPTIONS.includes(currentSleepMinutes);
  const [customSleepInput, setCustomSleepInput] = useState(
    sleepTimer && !isSleepQuickOption ? String(currentSleepMinutes) : ''
  );

  // Update custom inputs when values change externally
  useEffect(() => {
    if (!SPEED_QUICK_OPTIONS.includes(playbackRate)) {
      setCustomSpeedInput(String(playbackRate));
    } else {
      setCustomSpeedInput('');
    }
  }, [playbackRate]);

  useEffect(() => {
    const mins = sleepTimer ? Math.ceil(sleepTimer / 60) : 0;
    if (sleepTimer && !SLEEP_QUICK_OPTIONS.includes(mins)) {
      setCustomSleepInput(String(mins));
    } else {
      setCustomSleepInput('');
    }
  }, [sleepTimer]);

  const handleCustomSpeedSubmit = useCallback(() => {
    Keyboard.dismiss();
    const parsed = parseFloat(customSpeedInput);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 4) {
      setPlaybackRate(Math.round(parsed * 100) / 100);
      haptics.selection();
    }
  }, [customSpeedInput, setPlaybackRate]);

  const handleCustomSleepSubmit = useCallback(() => {
    Keyboard.dismiss();
    const parsed = parseInt(customSleepInput, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 720) {
      setSleepTimer(parsed);
      haptics.selection();
    }
  }, [customSleepInput, setSleepTimer]);

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background.elevated }]}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>Settings</Text>
        <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
          <X size={24} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Progress Bar: Book/Chapter Toggle */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: colors.text.tertiary }]}>Progress Bar</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: colors.background.secondary },
              progressMode === 'book' && { backgroundColor: colors.text.primary },
            ]}
            onPress={() => {
              setProgressMode('book');
              haptics.selection();
            }}
          >
            <Text style={[
              styles.toggleOptionText,
              { color: colors.text.secondary },
              progressMode === 'book' && { color: colors.background.primary, fontWeight: '600' },
            ]}>Book</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: colors.background.secondary },
              progressMode === 'chapter' && { backgroundColor: colors.text.primary },
            ]}
            onPress={() => {
              setProgressMode('chapter');
              haptics.selection();
            }}
          >
            <Text style={[
              styles.toggleOptionText,
              { color: colors.text.secondary },
              progressMode === 'chapter' && { color: colors.background.primary, fontWeight: '600' },
            ]}>Chapter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Speed */}
      <View style={styles.settingsSection}>
        <View style={styles.settingsTitleRow}>
          <Gauge size={16} color={colors.text.tertiary} strokeWidth={2} />
          <Text style={[styles.settingsSectionTitle, { marginBottom: 0, marginLeft: 6, color: colors.text.tertiary }]}>Speed</Text>
          <Text style={[styles.settingStatusText, { color: colors.text.primary }]}>{playbackRate}x</Text>
        </View>
        <View style={styles.optionsRow}>
          {SPEED_QUICK_OPTIONS.map((speed) => (
            <TouchableOpacity
              key={speed}
              style={[
                styles.quickOption,
                { backgroundColor: colors.background.secondary },
                playbackRate === speed && { backgroundColor: colors.text.primary },
              ]}
              onPress={() => {
                setPlaybackRate(speed);
                haptics.selection();
              }}
            >
              <Text style={[
                styles.quickOptionText,
                { color: colors.text.secondary },
                playbackRate === speed && { color: colors.background.primary, fontWeight: '600' },
              ]}>
                {speed}x
              </Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.customInputContainer, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}>
            <TextInput
              style={[styles.customInput, { color: colors.text.primary }]}
              value={customSpeedInput}
              onChangeText={setCustomSpeedInput}
              onSubmitEditing={handleCustomSpeedSubmit}
              onBlur={handleCustomSpeedSubmit}
              placeholder="0.1-4"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </View>
      </View>

      {/* Sleep Timer */}
      <View style={styles.settingsSection}>
        <View style={styles.settingsTitleRow}>
          <Moon size={16} color={colors.text.tertiary} strokeWidth={2} />
          <Text style={[styles.settingsSectionTitle, { marginBottom: 0, marginLeft: 6, color: colors.text.tertiary }]}>Sleep Timer</Text>
          <Text style={[styles.settingStatusText, { color: sleepTimer ? colors.accent.primary : colors.text.primary }]}>
            {sleepTimer ? `${Math.ceil(sleepTimer / 60)}m` : 'Off'}
          </Text>
          {sleepTimer && (
            <TouchableOpacity
              style={styles.offButtonSmall}
              onPress={() => {
                clearSleepTimer();
                haptics.selection();
              }}
            >
              <X size={14} color={colors.accent.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.optionsRow}>
          {SLEEP_QUICK_OPTIONS.map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[
                styles.quickOption,
                { backgroundColor: colors.background.secondary },
                sleepTimer !== null && Math.ceil(sleepTimer / 60) === mins ? { backgroundColor: colors.text.primary } : undefined,
              ]}
              onPress={() => {
                setSleepTimer(mins);
                haptics.selection();
              }}
            >
              <Text style={[
                styles.quickOptionText,
                { color: colors.text.secondary },
                sleepTimer !== null && Math.ceil(sleepTimer / 60) === mins ? { color: colors.background.primary, fontWeight: '600' as const } : undefined,
              ]}>
                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.customInputContainer, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}>
            <TextInput
              style={[styles.customInput, { color: colors.text.primary }]}
              value={customSleepInput}
              onChangeText={setCustomSleepInput}
              onSubmitEditing={handleCustomSleepSubmit}
              onBlur={handleCustomSleepSubmit}
              placeholder="min"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>
        </View>
      </View>

      {/* Action Buttons - Stacked */}
      <View style={styles.settingsActionsColumn}>
        <TouchableOpacity
          style={[styles.settingsActionButtonFull, { backgroundColor: colors.background.secondary }]}
          onPress={() => {
            haptics.selection();
            onOpenBookmarks();
          }}
        >
          <Bookmark size={18} color={colors.text.primary} strokeWidth={2} />
          <Text style={[styles.settingsActionText, { color: colors.text.primary }]}>Bookmarks</Text>
          {bookmarksCount > 0 && (
            <View style={[styles.settingsActionBadge, { backgroundColor: colors.text.primary }]}>
              <Text style={[styles.settingsActionBadgeText, { color: colors.background.primary }]}>{bookmarksCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingsActionButtonFull, { backgroundColor: colors.background.secondary }, queueCount === 0 && styles.settingsActionButtonDisabled]}
          onPress={() => {
            if (queueCount > 0) {
              haptics.impact('medium');
              clearQueue();
            }
          }}
        >
          <Trash2 size={18} color={queueCount > 0 ? colors.text.primary : colors.text.tertiary} strokeWidth={2} />
          <Text style={[styles.settingsActionText, { color: colors.text.primary }, queueCount === 0 && { color: colors.text.tertiary }]}>
            Clear Queue
          </Text>
          {queueCount > 0 && (
            <View style={[styles.settingsActionBadge, { backgroundColor: colors.text.primary }]}>
              <Text style={[styles.settingsActionBadgeText, { color: colors.background.primary }]}>{queueCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    padding: spacing.lg,
    paddingTop: scale(20),
    paddingBottom: scale(24),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(20),
  },
  sheetTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sheetClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsSection: {
    marginBottom: scale(20),
  },
  settingsSectionTitle: {
    fontSize: scale(12),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(10),
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(10),
  },
  settingStatusText: {
    marginLeft: 'auto',
    fontSize: scale(14),
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  toggleOption: {
    flex: 1,
    paddingVertical: scale(12),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  toggleOptionText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  quickOption: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(8),
    minWidth: scale(56),
    alignItems: 'center',
  },
  quickOptionText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  customInputContainer: {
    borderRadius: scale(8),
    borderWidth: 1,
    paddingHorizontal: scale(12),
    minWidth: scale(64),
    height: scale(38),
    justifyContent: 'center',
  },
  customInput: {
    fontSize: scale(14),
    fontWeight: '500',
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  offButtonSmall: {
    marginLeft: scale(8),
    padding: scale(4),
  },
  settingsActionsColumn: {
    gap: scale(8),
    marginTop: scale(4),
  },
  settingsActionButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(10),
    gap: scale(12),
  },
  settingsActionButtonDisabled: {
    opacity: 0.5,
  },
  settingsActionText: {
    fontSize: scale(15),
    fontWeight: '500',
    flex: 1,
  },
  settingsActionBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
    minWidth: scale(24),
    alignItems: 'center',
  },
  settingsActionBadgeText: {
    fontSize: scale(12),
    fontWeight: '600',
  },
});
