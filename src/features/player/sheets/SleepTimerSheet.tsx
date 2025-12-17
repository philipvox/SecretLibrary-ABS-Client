/**
 * src/features/player/sheets/SleepTimerSheet.tsx
 *
 * Unified Sleep Timer panel component (inline overlay style).
 * Use this component from any screen to control sleep timer.
 * All state is managed via playerStore.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore, useCurrentChapterIndex } from '../stores/playerStore';
import { haptics } from '@/core/native/haptics';
import { colors, spacing, radius, scale, layout } from '@/shared/theme';

// =============================================================================
// CONSTANTS
// =============================================================================

const SLEEP_PRESETS = [15, 30, 45, 60, 90];

// =============================================================================
// TYPES
// =============================================================================

interface SleepTimerSheetProps {
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SleepTimerSheet({ onClose }: SleepTimerSheetProps) {
  // Player store state
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const position = usePlayerStore((s) => s.position);
  const chapters = usePlayerStore((s) => s.chapters);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepTimer = usePlayerStore((s) => s.clearSleepTimer);
  const chapterIndex = useCurrentChapterIndex();

  // Local state for UI
  const [sliderValue, setSliderValue] = useState(15);
  const [endOfChapter, setEndOfChapter] = useState(false);

  // Sync local state when sheet mounts
  useEffect(() => {
    if (sleepTimer && sleepTimer > 0) {
      const mins = Math.ceil(sleepTimer / 60);
      setSliderValue(mins);
      setEndOfChapter(false);
    } else {
      setSliderValue(15);
      setEndOfChapter(false);
    }
  }, []);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const formatSleepTime = (mins: number): string => {
    if (mins === 0) return 'Off';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    if (remaining === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${remaining}m`;
  };

  const getChapterRemainingMins = (): number => {
    if (chapters.length === 0) return 0;
    const currentChapter = chapters[chapterIndex];
    if (!currentChapter) return 0;
    const remaining = Math.max(0, currentChapter.end - position);
    return Math.ceil(remaining / 60);
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleApply = useCallback(() => {
    haptics.selection();
    if (endOfChapter) {
      // Set timer to end of current chapter
      const chapterRemaining = getChapterRemainingMins();
      if (chapterRemaining > 0) {
        setSleepTimer(chapterRemaining);
      }
    } else if (sliderValue > 0) {
      setSleepTimer(sliderValue);
    } else {
      clearSleepTimer();
    }
    onClose();
  }, [endOfChapter, sliderValue, setSleepTimer, clearSleepTimer, onClose, chapters, chapterIndex, position]);

  const handleClear = useCallback(() => {
    haptics.selection();
    clearSleepTimer();
    onClose();
  }, [clearSleepTimer, onClose]);

  const handlePresetPress = useCallback((preset: number) => {
    haptics.selection();
    setSliderValue(preset);
    setEndOfChapter(false);
  }, []);

  const handleEndOfChapterPress = useCallback(() => {
    haptics.selection();
    setEndOfChapter(!endOfChapter);
    if (!endOfChapter) {
      setSliderValue(0);
    }
  }, [endOfChapter]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const displayValue = endOfChapter ? 'End of Chapter' : formatSleepTime(sliderValue);
  const chapterRemaining = getChapterRemainingMins();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sleep Timer</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Value Display */}
      <Text style={styles.valueText}>{displayValue}</Text>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={120}
          step={5}
          value={sliderValue}
          onValueChange={(value) => {
            setSliderValue(value);
            setEndOfChapter(false);
          }}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.progressTrack}
          thumbTintColor={colors.accent}
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>Off</Text>
          <Text style={styles.sliderLabel}>30m</Text>
          <Text style={styles.sliderLabel}>1h</Text>
          <Text style={styles.sliderLabel}>1.5h</Text>
          <Text style={styles.sliderLabel}>2h</Text>
        </View>
      </View>

      {/* Preset Buttons */}
      <View style={styles.presetRow}>
        {SLEEP_PRESETS.map((preset) => {
          const isActive = sliderValue === preset && !endOfChapter;
          return (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetButton,
                isActive && styles.presetButtonActive,
              ]}
              onPress={() => handlePresetPress(preset)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.presetText,
                isActive && styles.presetTextActive,
              ]}>
                {preset < 60 ? `${preset}m` : `${preset / 60}h`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* End of Chapter Button */}
      <TouchableOpacity
        style={[
          styles.endOfChapterButton,
          endOfChapter && styles.endOfChapterButtonActive,
        ]}
        onPress={handleEndOfChapterPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="bookmark-outline"
          size={20}
          color={endOfChapter ? '#000' : '#FFF'}
        />
        <Text style={[
          styles.endOfChapterText,
          endOfChapter && styles.endOfChapterTextActive,
        ]}>
          End of Chapter
        </Text>
        {chapterRemaining > 0 && (
          <Text style={[
            styles.endOfChapterEstimate,
            endOfChapter && styles.endOfChapterEstimateActive,
          ]}>
            (~{chapterRemaining}m)
          </Text>
        )}
      </TouchableOpacity>

      {/* Action Row: Cancel or Start */}
      <View style={styles.actionRow}>
        {sleepTimer !== null && sleepTimer > 0 ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel Timer</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[
            styles.applyButton,
            sleepTimer !== null && sleepTimer > 0 && styles.applyButtonSmall,
          ]}
          onPress={sliderValue > 0 || endOfChapter ? handleApply : handleClear}
          activeOpacity={0.7}
        >
          <Text style={styles.applyButtonText}>
            {sliderValue > 0 || endOfChapter ? 'Start Timer' : 'Turn Off'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    fontSize: scale(42),
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sliderContainer: {
    marginBottom: spacing.lg,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: -4,
  },
  sliderLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  presetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: colors.accent,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  presetTextActive: {
    color: colors.backgroundPrimary,
  },
  endOfChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.cardBackground,
    marginBottom: spacing.md,
  },
  endOfChapterButtonActive: {
    backgroundColor: colors.accent,
  },
  endOfChapterText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  endOfChapterTextActive: {
    color: colors.backgroundPrimary,
  },
  endOfChapterEstimate: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  endOfChapterEstimateActive: {
    color: 'rgba(0,0,0,0.5)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,80,80,0.15)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  applyButtonSmall: {
    flex: 1,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.backgroundPrimary,
  },
});

export default SleepTimerSheet;
