/**
 * src/features/profile/screens/PlaybackSettingsScreen.tsx
 *
 * Secret Library Playback Settings
 * Speed, skip intervals, sleep timer, smart rewind, completion settings.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Gauge,
  SkipForward,
  SkipBack,
  Smartphone,
  RefreshCw,
  CheckCircle,
  CheckSquare,
  Info,
  Check,
  Bluetooth,
  Clock,
} from 'lucide-react-native';
import { usePlayerStore } from '@/features/player/stores';
import { usePlayerSettingsStore } from '@/features/player/stores/playerSettingsStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsRow } from '../components/SettingsRow';
import { SectionHeader } from '../components/SectionHeader';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const SKIP_FORWARD_OPTIONS = [10, 15, 30, 45, 60];
const SKIP_BACK_OPTIONS = [5, 10, 15, 30, 45];
const SMART_REWIND_MAX_OPTIONS = [15, 30, 45, 60, 90];

function formatSpeed(speed: number): string {
  return speed === 1.0 ? '1.0× (Normal)' : `${speed}×`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface OptionPickerProps<T> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: T[];
  selectedValue: T;
  formatOption: (option: T) => string;
  onSelect: (option: T) => void;
  onClose: () => void;
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
}: OptionPickerProps<T>) {
  const colors = useSecretLibraryColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.pickerContainer, { backgroundColor: colors.white }]}>
          <Text style={[styles.pickerTitle, { color: colors.black }]}>{title}</Text>
          {subtitle && <Text style={[styles.pickerSubtitle, { color: colors.gray }]}>{subtitle}</Text>}
          <View style={styles.pickerOptions}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.pickerOption,
                  { borderBottomColor: colors.borderLight },
                  selectedValue === option && { backgroundColor: colors.grayLight },
                ]}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    { color: colors.black },
                    selectedValue === option && styles.pickerOptionTextSelected,
                  ]}
                >
                  {formatOption(option)}
                </Text>
                {selectedValue === option && (
                  <Check size={scale(18)} color={colors.black} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PlaybackSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useSecretLibraryColors();

  // Player settings from store
  const globalDefaultRate = usePlayerStore((s) => s.globalDefaultRate);
  const setGlobalDefaultRate = usePlayerStore((s) => s.setGlobalDefaultRate);
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);
  const setSkipForwardInterval = usePlayerStore((s) => s.setSkipForwardInterval);
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);
  const setSkipBackInterval = usePlayerStore((s) => s.setSkipBackInterval);
  const shakeToExtendEnabled = usePlayerStore((s) => s.shakeToExtendEnabled);
  const setShakeToExtendEnabled = usePlayerStore((s) => s.setShakeToExtendEnabled);
  const smartRewindEnabled = usePlayerSettingsStore((s) => s.smartRewindEnabled);
  const setSmartRewindEnabled = usePlayerSettingsStore((s) => s.setSmartRewindEnabled);
  const smartRewindMaxSeconds = usePlayerSettingsStore((s) => s.smartRewindMaxSeconds);
  const setSmartRewindMaxSeconds = usePlayerSettingsStore((s) => s.setSmartRewindMaxSeconds);
  const bluetoothAutoResume = usePlayerSettingsStore((s) => s.bluetoothAutoResume);
  const setBluetoothAutoResume = usePlayerSettingsStore((s) => s.setBluetoothAutoResume);
  const showTimeRemaining = usePlayerSettingsStore((s) => s.showTimeRemaining);
  const setShowTimeRemaining = usePlayerSettingsStore((s) => s.setShowTimeRemaining);
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
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title="Playback Settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Display & Speed Section */}
        <View style={styles.section}>
          <SectionHeader title="Display & Speed" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={Clock}
              label="Time Display"
              value={showTimeRemaining ? 'Remaining' : 'Elapsed'}
              onPress={() => setShowTimeRemaining(!showTimeRemaining)}
            />
            <SettingsRow
              Icon={Gauge}
              label="Default Speed"
              value={formatSpeed(globalDefaultRate)}
              onPress={() => setShowSpeedPicker(true)}
              description="Applied to books without a saved speed"
            />
          </View>
        </View>

        {/* Skip Intervals Section */}
        <View style={styles.section}>
          <SectionHeader title="Skip Intervals" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={SkipForward}
              label="Skip Forward"
              value={`${skipForwardInterval}s`}
              onPress={() => setShowForwardPicker(true)}
            />
            <SettingsRow
              Icon={SkipBack}
              label="Skip Back"
              value={`${skipBackInterval}s`}
              onPress={() => setShowBackPicker(true)}
            />
          </View>
        </View>

        {/* Sleep Timer Section */}
        <View style={styles.section}>
          <SectionHeader title="Sleep Timer" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={Smartphone}
              label="Shake to Extend"
              switchValue={shakeToExtendEnabled}
              onSwitchChange={setShakeToExtendEnabled}
              description="Adds 15 minutes when you shake near expiry"
            />
          </View>
        </View>

        {/* Bluetooth Section */}
        <View style={styles.section}>
          <SectionHeader title="Bluetooth" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={Bluetooth}
              label="Auto-Resume on Connect"
              switchValue={bluetoothAutoResume}
              onSwitchChange={setBluetoothAutoResume}
              description="Resumes playback when Bluetooth connects"
            />
          </View>
        </View>

        {/* Smart Rewind Section */}
        <View style={styles.section}>
          <SectionHeader title="Smart Rewind" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={RefreshCw}
              label="Smart Rewind"
              switchValue={smartRewindEnabled}
              onSwitchChange={setSmartRewindEnabled}
              description="Rewinds a few seconds after a pause"
            />
            {smartRewindEnabled && (
              <View style={[styles.maxRewindContainer, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.maxRewindLabel, { color: colors.gray }]}>Maximum Rewind</Text>
                <View style={styles.maxRewindOptions}>
                  {SMART_REWIND_MAX_OPTIONS.map((seconds) => (
                    <TouchableOpacity
                      key={seconds}
                      style={[
                        styles.maxRewindOption,
                        { backgroundColor: colors.grayLight },
                        smartRewindMaxSeconds === seconds && { backgroundColor: colors.black },
                      ]}
                      onPress={() => setSmartRewindMaxSeconds(seconds)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.maxRewindOptionText,
                          { color: colors.gray },
                          smartRewindMaxSeconds === seconds && { color: colors.white },
                        ]}
                      >
                        {seconds}s
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.maxRewindNote, { color: colors.gray }]}>
                  Rewind amount increases with pause duration
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Completion Section */}
        <View style={styles.section}>
          <SectionHeader title="Book Completion" />
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <SettingsRow
              Icon={CheckCircle}
              label="Completion Prompt"
              switchValue={showCompletionPrompt}
              onSwitchChange={setShowCompletionPrompt}
              description="Shows options when a book finishes"
            />
            {!showCompletionPrompt && (
              <SettingsRow
                Icon={CheckSquare}
                label="Auto-Mark Finished"
                switchValue={autoMarkFinished}
                onSwitchChange={setAutoMarkFinished}
                description="Marks books as finished automatically"
              />
            )}
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
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
      />
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
  // Smart Rewind max selector
  maxRewindContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  maxRewindLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  maxRewindOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  maxRewindOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  maxRewindOptionText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  maxRewindNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 12,
  },
  // Info section
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerContainer: {
    borderRadius: 0,
    width: '100%',
    maxWidth: 340,
    padding: 24,
  },
  pickerTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(20),
    marginBottom: 4,
  },
  pickerSubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    marginBottom: 16,
  },
  pickerOptions: {
    marginTop: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  pickerOptionText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(12),
  },
  pickerOptionTextSelected: {
    fontFamily: fonts.jetbrainsMono.bold,
  },
});
