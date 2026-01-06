/**
 * src/features/profile/screens/PlaybackSettingsScreen.tsx
 *
 * Dedicated screen for playback settings: speed, skip intervals, sleep timer.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  SkipForward,
  SkipBack,
  Smartphone,
  RefreshCw,
  CheckCircle,
  CheckSquare,
  Info,
  Check,
  type LucideIcon,
} from 'lucide-react-native';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { accentColors, scale, typography, fontWeight, spacing } from '@/shared/theme';
import { useColors, ThemeColors } from '@/shared/theme';

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

// Playback speed options
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

// Skip interval options (in seconds)
const SKIP_FORWARD_OPTIONS = [10, 15, 30, 45, 60];
const SKIP_BACK_OPTIONS = [5, 10, 15, 30, 45];
const SMART_REWIND_MAX_OPTIONS = [15, 30, 45, 60, 90];

function formatSpeed(speed: number): string {
  return speed === 1.0 ? '1.0× (Normal)' : `${speed}×`;
}

// Settings Row Component
interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  note?: string;
  disabled?: boolean;
  disabledReason?: string;
  colors: ReturnType<typeof createColors>;
}

function SettingsRow({ Icon, label, value, onPress, switchValue, onSwitchChange, note, disabled, disabledReason, colors }: SettingsRowProps) {
  // Show disabled reason instead of note when disabled
  const displayNote = disabled && disabledReason ? disabledReason : note;

  const content = (
    <View style={[styles.settingsRow, { borderBottomColor: colors.border }, disabled && styles.settingsRowDisabled]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
          <Icon size={scale(18)} color={disabled ? colors.textTertiary : colors.textSecondary} strokeWidth={2} />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: colors.text }, disabled && { color: colors.textTertiary }]}>{label}</Text>
          {displayNote ? <Text style={[styles.rowNote, { color: colors.textTertiary }, disabled && styles.rowNoteDisabled]}>{displayNote}</Text> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: colors.accent }, disabled && { color: colors.textTertiary }]}>{value}</Text> : null}
        {onSwitchChange !== undefined ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: colors.border, true: ACCENT }}
            thumbColor="#fff"
            disabled={disabled}
          />
        ) : null}
        {onPress ? (
          <ChevronRight size={scale(18)} color={disabled ? colors.textTertiary : colors.textSecondary} strokeWidth={2} />
        ) : null}
      </View>
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Section Header Component
function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof createColors> }) {
  return <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>{title}</Text>;
}

// Option Picker Modal
interface OptionPickerProps<T> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: T[];
  selectedValue: T;
  formatOption: (option: T) => string;
  onSelect: (option: T) => void;
  onClose: () => void;
  colors: ReturnType<typeof createColors>;
}

function OptionPicker<T>({
  visible,
  title,
  subtitle,
  options,
  selectedValue,
  formatOption,
  onSelect,
  onClose,
  colors,
}: OptionPickerProps<T>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.pickerTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.pickerSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
          <View style={styles.pickerOptions}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.pickerOption,
                  selectedValue === option && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    { color: colors.text },
                    selectedValue === option && { color: colors.accent, fontWeight: '600' },
                  ]}
                >
                  {formatOption(option)}
                </Text>
                {selectedValue === option ? (
                  <Check size={scale(18)} color={colors.accent} strokeWidth={2.5} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function PlaybackSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const themeColors = useColors();
  const colors = createColors(themeColors);

  // Player settings from store
  const globalDefaultRate = usePlayerStore((s) => s.globalDefaultRate);
  const setGlobalDefaultRate = usePlayerStore((s) => s.setGlobalDefaultRate);
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);
  const setSkipForwardInterval = usePlayerStore((s) => s.setSkipForwardInterval);
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);
  const setSkipBackInterval = usePlayerStore((s) => s.setSkipBackInterval);
  const shakeToExtendEnabled = usePlayerStore((s) => s.shakeToExtendEnabled);
  const setShakeToExtendEnabled = usePlayerStore((s) => s.setShakeToExtendEnabled);
  const smartRewindEnabled = usePlayerStore((s) => s.smartRewindEnabled ?? true);
  const setSmartRewindEnabled = usePlayerStore((s) => s.setSmartRewindEnabled);
  const smartRewindMaxSeconds = usePlayerStore((s) => s.smartRewindMaxSeconds ?? 30);
  const setSmartRewindMaxSeconds = usePlayerStore((s) => s.setSmartRewindMaxSeconds);
  const showCompletionPrompt = usePlayerStore((s) => s.showCompletionPrompt ?? true);
  const setShowCompletionPrompt = usePlayerStore((s) => s.setShowCompletionPrompt);
  const autoMarkFinished = usePlayerStore((s) => s.autoMarkFinished ?? false);
  const setAutoMarkFinished = usePlayerStore((s) => s.setAutoMarkFinished);

  // Modal states
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [showBackPicker, setShowBackPicker] = useState(false);

  const handleSpeedSelect = useCallback((speed: number) => {
    setGlobalDefaultRate(speed);
  }, [setGlobalDefaultRate]);

  const handleForwardSelect = useCallback((interval: number) => {
    setSkipForwardInterval?.(interval);
  }, [setSkipForwardInterval]);

  const handleBackSelect = useCallback((interval: number) => {
    setSkipBackInterval?.(interval);
  }, [setSkipBackInterval]);

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Playback</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Speed Section */}
        <View style={styles.section}>
          <SectionHeader title="Speed" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={Gauge}
              label="Default Speed"
              value={formatSpeed(globalDefaultRate)}
              onPress={() => setShowSpeedPicker(true)}
              note="Used for books without a saved preference"
              colors={colors}
            />
          </View>
        </View>

        {/* Skip Intervals Section */}
        <View style={styles.section}>
          <SectionHeader title="Skip Intervals" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={SkipForward}
              label="Skip Forward"
              value={`${skipForwardInterval}s`}
              onPress={() => setShowForwardPicker(true)}
              colors={colors}
            />
            <SettingsRow
              Icon={SkipBack}
              label="Skip Back"
              value={`${skipBackInterval}s`}
              onPress={() => setShowBackPicker(true)}
              colors={colors}
            />
          </View>
        </View>

        {/* Sleep Timer Section */}
        <View style={styles.section}>
          <SectionHeader title="Sleep Timer" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={Smartphone}
              label="Shake to Extend"
              switchValue={shakeToExtendEnabled}
              onSwitchChange={setShakeToExtendEnabled}
              note="Shake to add 15 minutes when timer is low"
              colors={colors}
            />
          </View>
        </View>

        {/* Smart Rewind Section */}
        <View style={styles.section}>
          <SectionHeader title="Smart Rewind" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={RefreshCw}
              label="Smart Rewind"
              switchValue={smartRewindEnabled}
              onSwitchChange={setSmartRewindEnabled}
              note="Automatically rewind after pausing"
              colors={colors}
            />
            {smartRewindEnabled && (
              <View style={[styles.maxRewindContainer, { borderTopColor: colors.border }]}>
                <Text style={[styles.maxRewindLabel, { color: colors.textSecondary }]}>Maximum Rewind</Text>
                <View style={styles.maxRewindOptions}>
                  {SMART_REWIND_MAX_OPTIONS.map((seconds) => (
                    <TouchableOpacity
                      key={seconds}
                      style={[
                        styles.maxRewindOption,
                        { backgroundColor: colors.iconBg },
                        smartRewindMaxSeconds === seconds && styles.maxRewindOptionSelected,
                      ]}
                      onPress={() => setSmartRewindMaxSeconds(seconds)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.maxRewindOptionText,
                          { color: colors.textSecondary },
                          smartRewindMaxSeconds === seconds && styles.maxRewindOptionTextSelected,
                        ]}
                      >
                        {seconds}s
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.maxRewindNote, { color: colors.textTertiary }]}>
                  Rewind amount increases with pause duration
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Completion Section */}
        <View style={styles.section}>
          <SectionHeader title="Book Completion" colors={colors} />
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <SettingsRow
              Icon={CheckCircle}
              label="Completion Prompt"
              switchValue={showCompletionPrompt}
              onSwitchChange={setShowCompletionPrompt}
              note="Ask what to do when a book ends"
              colors={colors}
            />
            {!showCompletionPrompt && (
              <SettingsRow
                Icon={CheckSquare}
                label="Auto-Mark Finished"
                switchValue={autoMarkFinished}
                onSwitchChange={setAutoMarkFinished}
                note="Automatically mark books as finished"
                colors={colors}
              />
            )}
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            Playback speed is remembered per book. The default speed is only used when playing a book for the first time.
          </Text>
        </View>
      </ScrollView>

      {/* Speed Picker Modal */}
      <OptionPicker
        visible={showSpeedPicker}
        title="Default Playback Speed"
        subtitle="Used for new books"
        options={SPEED_OPTIONS}
        selectedValue={globalDefaultRate}
        formatOption={formatSpeed}
        onSelect={handleSpeedSelect}
        onClose={() => setShowSpeedPicker(false)}
        colors={colors}
      />

      {/* Skip Forward Picker Modal */}
      <OptionPicker
        visible={showForwardPicker}
        title="Skip Forward Interval"
        options={SKIP_FORWARD_OPTIONS}
        selectedValue={skipForwardInterval}
        formatOption={(s) => `${s} seconds`}
        onSelect={handleForwardSelect}
        onClose={() => setShowForwardPicker(false)}
        colors={colors}
      />

      {/* Skip Back Picker Modal */}
      <OptionPicker
        visible={showBackPicker}
        title="Skip Back Interval"
        options={SKIP_BACK_OPTIONS}
        selectedValue={skipBackInterval}
        formatOption={(s) => `${s} seconds`}
        onSelect={handleBackSelect}
        onClose={() => setShowBackPicker(false)}
        colors={colors}
      />
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  rowValue: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    // color set via colors.accent in JSX
  },
  // Disabled states
  settingsRowDisabled: {
    opacity: 0.5,
  },
  rowNoteDisabled: {
    fontStyle: 'italic',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    flex: 1,
    // color set via colors.textTertiary in JSX
    lineHeight: scale(18),
  },
  // Smart Rewind max selector styles
  maxRewindContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: scale(8),
    paddingBottom: scale(16),
    borderTopWidth: 1,
    // borderTopColor set via colors.border in JSX
  },
  maxRewindLabel: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.medium,
    // color set via colors.textSecondary in JSX
    marginBottom: scale(12),
  },
  maxRewindOptions: {
    flexDirection: 'row',
    gap: scale(8),
  },
  maxRewindOption: {
    flex: 1,
    paddingVertical: scale(10),
    paddingHorizontal: scale(8),
    // backgroundColor set via colors.iconBg in JSX
    borderRadius: scale(8),
    alignItems: 'center',
  },
  maxRewindOptionSelected: {
    backgroundColor: ACCENT,
  },
  maxRewindOptionText: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.semibold,
    // color set via colors.textSecondary in JSX
  },
  maxRewindOptionTextSelected: {
    color: '#000', // Black on gold accent - intentional
  },
  maxRewindNote: {
    ...typography.labelMedium,
    // color set via colors.textTertiary in JSX
    marginTop: scale(12),
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dark overlay - intentional
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    // backgroundColor set via colors.card in JSX
    borderRadius: scale(16),
    padding: scale(20),
    width: '80%',
    maxWidth: 320,
  },
  pickerTitle: {
    ...typography.headlineLarge,
    fontWeight: fontWeight.semibold,
    // color set via colors.text in JSX
    marginBottom: scale(4),
    textAlign: 'center',
  },
  pickerSubtitle: {
    ...typography.bodyMedium,
    // color set via colors.textTertiary in JSX
    marginBottom: scale(16),
    textAlign: 'center',
  },
  pickerOptions: {
    gap: scale(4),
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(193,244,12,0.15)',
  },
  pickerOptionText: {
    ...typography.headlineMedium,
    // color set via colors.text in JSX
  },
  pickerOptionTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },
});
