/**
 * src/features/player/sheets/SleepTimerSheet.tsx
 *
 * Sleep Timer panel - Editorial design with quick set, special options, and custom time.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { usePlayerStore, useCurrentChapterIndex, useSleepTimer } from '../stores';
import { useSleepTimerStore } from '../stores/sleepTimerStore';
import { haptics } from '@/core/native/haptics';
import { scale } from '@/shared/theme';
import {
  secretLibraryColors as colors,
} from '@/shared/theme/secretLibrary';

// =============================================================================
// CONSTANTS
// =============================================================================

const QUICK_OPTIONS = [
  { value: 5, label: '5', unit: 'min' },
  { value: 10, label: '10', unit: 'min' },
  { value: 15, label: '15', unit: 'min' },
  { value: 20, label: '20', unit: 'min' },
  { value: 30, label: '30', unit: 'min' },
  { value: 45, label: '45', unit: 'min' },
  { value: 60, label: '1', unit: 'hr' },
  { value: 90, label: '1.5', unit: 'hr' },
];

// =============================================================================
// ICONS
// =============================================================================

const BookIcon = ({ color = colors.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Svg>
);

const BooksIcon = ({ color = colors.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </Svg>
);

const CloseIcon = ({ color = colors.white, size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface SleepTimerSheetProps {
  onClose: () => void;
}

type TimerMode = 'minutes' | 'end-of-chapter' | 'end-of-book' | 'custom' | null;

// =============================================================================
// COMPONENT
// =============================================================================

export function SleepTimerSheet({ onClose }: SleepTimerSheetProps) {
  const { t } = useTranslation();

  // Sleep timer state - read directly from sleepTimerStore for real-time countdown
  const sleepTimer = useSleepTimer();

  // Player store state
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const chapters = usePlayerStore((s) => s.chapters);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepTimer = usePlayerStore((s) => s.clearSleepTimer);
  const chapterIndex = useCurrentChapterIndex();

  // Timer memory
  const lastTimerMinutes = useSleepTimerStore((s) => s.lastTimerMinutes);
  const lastTimerType = useSleepTimerStore((s) => s.lastTimerType);
  const setLastTimer = useSleepTimerStore((s) => s.setLastTimer);

  // Local state - initialize from memory if no timer is active
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(
    !sleepTimer && lastTimerType === 'minutes' ? lastTimerMinutes : null
  );
  const [timerMode, setTimerMode] = useState<TimerMode>(null);
  const [customHours, setCustomHours] = useState('0');
  const [customMins, setCustomMins] = useState('0');

  // Animation for pulsing dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when timer is active
  useEffect(() => {
    if (sleepTimer && sleepTimer > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [sleepTimer, pulseAnim]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const getChapterRemainingMins = (): number => {
    if (chapters.length === 0) return 0;
    const currentChapter = chapters[chapterIndex];
    if (!currentChapter) return 0;
    const remaining = Math.max(0, currentChapter.end - position);
    return Math.round(remaining / 60);
  };

  const getBookRemainingTime = (): { hours: number; mins: number } => {
    const remaining = Math.max(0, duration - position);
    const totalMins = Math.round(remaining / 60);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return { hours, mins };
  };

  const formatTimeDisplay = (seconds: number): string => {
    if (seconds <= 0) return t('sleepTimer.statusOff');
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleQuickSelect = useCallback((minutes: number) => {
    haptics.selection();
    setSelectedMinutes(minutes);
    setTimerMode('minutes');
    setSleepTimer(minutes);
    setLastTimer(minutes, 'minutes');
  }, [setSleepTimer, setLastTimer]);

  const handleEndOfChapter = useCallback(() => {
    haptics.selection();
    const chapterRemaining = getChapterRemainingMins();
    setTimerMode('end-of-chapter');
    setSelectedMinutes(null);
    if (chapterRemaining > 0) {
      setSleepTimer(chapterRemaining);
      setLastTimer(chapterRemaining, 'end-of-chapter');
    }
  }, [setSleepTimer, setLastTimer, chapters, chapterIndex, position]);

  const handleEndOfBook = useCallback(() => {
    haptics.selection();
    const { hours, mins } = getBookRemainingTime();
    const totalMins = hours * 60 + mins;
    setTimerMode('end-of-book');
    setSelectedMinutes(null);
    if (totalMins > 0) {
      setSleepTimer(totalMins);
      setLastTimer(totalMins, 'end-of-book');
    }
  }, [setSleepTimer, setLastTimer, duration, position]);

  const handleCustomSet = useCallback(() => {
    const hours = parseInt(customHours) || 0;
    const mins = parseInt(customMins) || 0;
    if (hours === 0 && mins === 0) return;

    haptics.selection();
    const totalMins = hours * 60 + mins;
    setTimerMode('custom');
    setSelectedMinutes(null);
    setSleepTimer(totalMins);
    setLastTimer(totalMins, 'custom');
  }, [customHours, customMins, setSleepTimer, setLastTimer]);

  const handleCancelTimer = useCallback(() => {
    haptics.impact('light');
    clearSleepTimer();
    setSelectedMinutes(null);
    setTimerMode(null);
  }, [clearSleepTimer]);

  // ==========================================================================
  // COMPUTED
  // ==========================================================================

  const isTimerActive = sleepTimer !== null && sleepTimer > 0;
  const chapterRemaining = getChapterRemainingMins();
  const bookRemaining = getBookRemainingTime();
  const displayValue = isTimerActive ? formatTimeDisplay(sleepTimer) : t('sleepTimer.statusOff');

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View style={styles.container}>
      {/* Handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('sleepTimer.title')}</Text>
        <View style={[styles.status, isTimerActive && styles.statusActive]}>
          {isTimerActive && (
            <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
          )}
          <Text style={[styles.statusText, isTimerActive && styles.statusTextActive]}>
            {isTimerActive ? t('sleepTimer.statusActive') : t('sleepTimer.statusOff')}
          </Text>
        </View>
      </View>

      {/* Timer Display */}
      <View style={styles.timerDisplay}>
        <Text style={styles.timerDisplayLabel}>{t('sleepTimer.timeRemaining')}</Text>
        <Text style={[styles.timerDisplayValue, !isTimerActive && styles.timerDisplayValueOff]}>
          {displayValue}
        </Text>
      </View>

      {/* Quick Set Options */}
      <Text style={styles.sectionLabel}>
        {t('sleepTimer.quickSet')}
        {!isTimerActive && lastTimerType === 'minutes' && lastTimerMinutes && (
          <Text style={styles.lastUsedHint}> · {t('sleepTimer.lastUsedHint', { minutes: lastTimerMinutes })}</Text>
        )}
      </Text>
      <View style={styles.optionsGrid}>
        {QUICK_OPTIONS.map((option) => {
          const isSelected = timerMode === 'minutes' && selectedMinutes === option.value;
          const isLastUsed = !isTimerActive && !timerMode && lastTimerType === 'minutes' && lastTimerMinutes === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                isSelected && styles.optionButtonSelected,
                isLastUsed && styles.optionButtonLastUsed,
              ]}
              onPress={() => handleQuickSelect(option.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} ${option.unit === 'hr' ? (option.label === '1' ? 'hour' : 'hours') : 'minutes'}${isLastUsed ? ', last used' : ''}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option.label}
              </Text>
              <Text style={[styles.optionUnit, isSelected && styles.optionUnitSelected]}>
                {option.unit === 'hr' ? t('sleepTimer.unitHr') : t('sleepTimer.unitMin')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Special Options */}
      <View style={styles.specialOptions}>
        <TouchableOpacity
          style={[
            styles.specialOption,
            timerMode === 'end-of-chapter' && styles.specialOptionSelected,
          ]}
          onPress={handleEndOfChapter}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`End of chapter, approximately ${chapterRemaining} minutes remaining`}
          accessibilityState={{ selected: timerMode === 'end-of-chapter' }}
        >
          <BookIcon
            color={timerMode === 'end-of-chapter' ? colors.black : colors.white}
            size={18}
          />
          <View style={styles.specialOptionText}>
            <Text style={[
              styles.specialOptionTitle,
              timerMode === 'end-of-chapter' && styles.specialOptionTitleSelected,
            ]}>
              {t('sleepTimer.endOfChapter')}
            </Text>
            <Text style={[
              styles.specialOptionSubtitle,
              timerMode === 'end-of-chapter' && styles.specialOptionSubtitleSelected,
            ]}>
              {t('sleepTimer.chapterMinRemaining', { minutes: chapterRemaining })}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.specialOption,
            timerMode === 'end-of-book' && styles.specialOptionSelected,
          ]}
          onPress={handleEndOfBook}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`End of book, ${bookRemaining.hours} hours ${bookRemaining.mins} minutes remaining`}
          accessibilityState={{ selected: timerMode === 'end-of-book' }}
        >
          <BooksIcon
            color={timerMode === 'end-of-book' ? colors.black : colors.white}
            size={18}
          />
          <View style={styles.specialOptionText}>
            <Text style={[
              styles.specialOptionTitle,
              timerMode === 'end-of-book' && styles.specialOptionTitleSelected,
            ]}>
              {t('sleepTimer.endOfBook')}
            </Text>
            <Text style={[
              styles.specialOptionSubtitle,
              timerMode === 'end-of-book' && styles.specialOptionSubtitleSelected,
            ]}>
              {t('sleepTimer.bookTimeRemaining', { hours: bookRemaining.hours, minutes: bookRemaining.mins })}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Custom Time */}
      <View style={styles.customTime}>
        <Text style={styles.customTimeLabel}>{t('sleepTimer.custom')}</Text>
        <View style={styles.customTimeInputs}>
          <TextInput
            style={styles.customTimeInput}
            value={customHours}
            onChangeText={setCustomHours}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            accessibilityLabel="Custom timer hours"
          />
          <Text style={styles.customTimeUnit}>h</Text>
          <Text style={styles.customTimeSeparator}>:</Text>
          <TextInput
            style={styles.customTimeInput}
            value={customMins}
            onChangeText={setCustomMins}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            accessibilityLabel="Custom timer minutes"
          />
          <Text style={styles.customTimeUnit}>m</Text>
        </View>
        <TouchableOpacity style={styles.customTimeSet} onPress={handleCustomSet} accessibilityRole="button" accessibilityLabel="Set custom timer">
          <Text style={styles.customTimeSetText}>{t('sleepTimer.set')}</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {isTimerActive ? (
          <>
            <TouchableOpacity
              style={styles.actionButtonCancel}
              onPress={handleCancelTimer}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel timer"
            >
              <CloseIcon color={colors.orange} size={14} />
              <Text style={styles.actionButtonCancelText}>{t('sleepTimer.cancelTimer')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButtonPrimary}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.actionButtonPrimaryText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.actionButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

// Dark mode colors
const darkBg = '#1a1a1a';
const darkCard = '#2a2a2a';
const darkBorder = '#3a3a3a';

const styles = StyleSheet.create({
  container: {
    backgroundColor: darkBg,
    paddingHorizontal: scale(28),
    paddingBottom: scale(40),
  },
  handle: {
    width: scale(36),
    height: scale(4),
    backgroundColor: darkBorder,
    borderRadius: scale(2),
    alignSelf: 'center',
    marginTop: scale(12),
    marginBottom: scale(12),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: darkBorder,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(28),
    fontWeight: '400',
    color: colors.white,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  statusActive: {},
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: colors.orange,
  },
  statusText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(12),
    color: colors.gray,
  },
  statusTextActive: {
    color: colors.orange,
  },

  // Timer Display
  timerDisplay: {
    alignItems: 'center',
    marginBottom: scale(20),
    paddingVertical: scale(16),
    backgroundColor: darkCard,
  },
  timerDisplayLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.gray,
    marginBottom: scale(8),
  },
  timerDisplayValue: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(44),
    fontStyle: 'italic',
    color: colors.white,
    lineHeight: scale(44),
  },
  timerDisplayValueOff: {
    fontSize: scale(28),
    fontStyle: 'normal',
    color: colors.gray,
  },

  // Quick Options Grid
  sectionLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.gray,
    marginBottom: scale(12),
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(16),
  },
  optionButton: {
    width: '23.5%',
    height: scale(48),
    borderWidth: 1,
    borderColor: darkBorder,
    backgroundColor: darkCard,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  optionButtonLastUsed: {
    borderColor: colors.orange,
  },
  lastUsedHint: {
    fontSize: scale(9),
    color: colors.orange,
    textTransform: 'none',
    letterSpacing: 0,
  },
  optionText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(13),
    color: colors.white,
  },
  optionTextSelected: {
    color: colors.black,
  },
  optionUnit: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(9),
    color: colors.gray,
    marginLeft: scale(2),
  },
  optionUnitSelected: {
    color: 'rgba(0,0,0,0.6)',
  },

  // Special Options
  specialOptions: {
    gap: scale(8),
    marginBottom: scale(16),
  },
  specialOption: {
    height: scale(52),
    borderWidth: 1,
    borderColor: darkBorder,
    backgroundColor: darkCard,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    gap: scale(12),
  },
  specialOptionSelected: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  specialOptionText: {
    flex: 1,
  },
  specialOptionTitle: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(14),
    color: colors.white,
  },
  specialOptionTitleSelected: {
    color: colors.black,
  },
  specialOptionSubtitle: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: colors.gray,
  },
  specialOptionSubtitleSelected: {
    color: 'rgba(0,0,0,0.6)',
  },

  // Custom Time
  customTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginBottom: scale(16),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: darkBorder,
  },
  customTimeLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: colors.gray,
  },
  customTimeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    flex: 1,
  },
  customTimeInput: {
    width: scale(48),
    height: scale(40),
    borderWidth: 1,
    borderColor: darkBorder,
    backgroundColor: darkCard,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(16),
    color: colors.white,
  },
  customTimeSeparator: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(16),
    color: colors.gray,
  },
  customTimeUnit: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(9),
    color: colors.gray,
    marginLeft: scale(-4),
  },
  customTimeSet: {
    height: scale(40),
    paddingHorizontal: scale(16),
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customTimeSetText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.black,
  },

  // Action Buttons
  actions: {
    flexDirection: 'row',
    gap: scale(8),
  },
  actionButton: {
    flex: 1,
    height: scale(48),
    borderWidth: 1,
    borderColor: darkBorder,
    backgroundColor: darkCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    fontWeight: '500',
    color: colors.white,
  },
  actionButtonCancel: {
    flex: 1,
    height: scale(48),
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: darkCard,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
  },
  actionButtonCancelText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    fontWeight: '500',
    color: colors.orange,
  },
  actionButtonPrimary: {
    flex: 1,
    height: scale(48),
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonPrimaryText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    fontWeight: '500',
    color: colors.black,
  },
});

export default SleepTimerSheet;
