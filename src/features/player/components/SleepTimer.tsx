// File: src/features/player/components/SleepTimer.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { Icon } from '@/shared/components/Icon';
import { colors, spacing, radius, layout } from '@/shared/theme';

const SLEEP_OPTIONS = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

interface SleepTimerProps {
  visible: boolean;
  onClose: () => void;
}

export function SleepTimer({ visible, onClose }: SleepTimerProps) {
  const insets = useSafeAreaInsets();
  const { sleepTimer, setSleepTimer, clearSleepTimer } = usePlayerStore();

  const handleSelect = (minutes: number) => {
    setSleepTimer(minutes);
    onClose();
  };

  const handleEndOfChapter = () => {
    setSleepTimer(-1); // -1 = end of chapter
    onClose();
  };

  const handleClear = () => {
    clearSleepTimer();
    onClose();
  };

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} activeOpacity={1} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Sleep Timer</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={22} color={colors.textSecondary} set="ionicons" />
              </TouchableOpacity>
            </View>
          </View>

          {sleepTimer !== null && (
            <View style={styles.activeTimer}>
              <Icon name="moon" size={20} color={colors.accent} set="ionicons" />
              <Text style={styles.activeTimerText}>
                {sleepTimer === -1
                  ? 'End of chapter'
                  : `${formatTimeRemaining(sleepTimer)} remaining`
                }
              </Text>
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.optionsGrid}>
            {SLEEP_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.minutes}
                style={styles.optionButton}
                onPress={() => handleSelect(option.minutes)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.endOfChapterButton}
            onPress={handleEndOfChapter}
            activeOpacity={0.7}
          >
            <Icon name="bookmark-outline" size={18} color={colors.textPrimary} set="ionicons" />
            <Text style={styles.endOfChapterText}>End of chapter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.medium,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.backgroundTertiary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  activeTimerText: {
    fontSize: 14,
    color: colors.accent,
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.cardBackground,
    minWidth: 80,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  endOfChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardBackground,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  endOfChapterText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});