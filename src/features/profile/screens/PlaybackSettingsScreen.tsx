/**
 * src/features/profile/screens/PlaybackSettingsScreen.tsx
 *
 * Dedicated screen for playback settings: speed, skip intervals, sleep timer.
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
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale } from '@/shared/theme';

const ACCENT = colors.accent;

// Playback speed options
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

// Skip interval options (in seconds)
const SKIP_FORWARD_OPTIONS = [10, 15, 30, 45, 60];
const SKIP_BACK_OPTIONS = [5, 10, 15, 30, 45];

function formatSpeed(speed: number): string {
  return speed === 1.0 ? '1.0× (Normal)' : `${speed}×`;
}

// Settings Row Component
interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  note?: string;
}

function SettingsRow({ icon, label, value, onPress, switchValue, onSwitchChange, note }: SettingsRowProps) {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.rowLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={scale(18)} color="rgba(255,255,255,0.8)" />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {note ? <Text style={styles.rowNote}>{note}</Text> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onSwitchChange !== undefined ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: ACCENT }}
            thumbColor="#fff"
          />
        ) : null}
        {onPress ? (
          <Ionicons name="chevron-forward" size={scale(18)} color="rgba(255,255,255,0.3)" />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Section Header Component
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
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
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.pickerSubtitle}>{subtitle}</Text> : null}
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
                    selectedValue === option && styles.pickerOptionTextSelected,
                  ]}
                >
                  {formatOption(option)}
                </Text>
                {selectedValue === option ? (
                  <Ionicons name="checkmark" size={scale(18)} color={ACCENT} />
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

  // Player settings from store
  const globalDefaultRate = usePlayerStore((s) => s.globalDefaultRate);
  const setGlobalDefaultRate = usePlayerStore((s) => s.setGlobalDefaultRate);
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);
  const setSkipForwardInterval = usePlayerStore((s) => s.setSkipForwardInterval);
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);
  const setSkipBackInterval = usePlayerStore((s) => s.setSkipBackInterval);
  const shakeToExtendEnabled = usePlayerStore((s) => s.shakeToExtendEnabled);
  const setShakeToExtendEnabled = usePlayerStore((s) => s.setShakeToExtendEnabled);

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
        <Text style={styles.headerTitle}>Playback</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Speed Section */}
        <View style={styles.section}>
          <SectionHeader title="Speed" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="speedometer-outline"
              label="Default Speed"
              value={formatSpeed(globalDefaultRate)}
              onPress={() => setShowSpeedPicker(true)}
              note="Used for books without a saved preference"
            />
          </View>
        </View>

        {/* Skip Intervals Section */}
        <View style={styles.section}>
          <SectionHeader title="Skip Intervals" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="play-forward-outline"
              label="Skip Forward"
              value={`${skipForwardInterval}s`}
              onPress={() => setShowForwardPicker(true)}
            />
            <SettingsRow
              icon="play-back-outline"
              label="Skip Back"
              value={`${skipBackInterval}s`}
              onPress={() => setShowBackPicker(true)}
            />
          </View>
        </View>

        {/* Sleep Timer Section */}
        <View style={styles.section}>
          <SectionHeader title="Sleep Timer" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="phone-portrait-outline"
              label="Shake to Extend"
              switchValue={shakeToExtendEnabled}
              onSwitchChange={setShakeToExtendEnabled}
              note="Shake to add 15 minutes when timer is low"
            />
          </View>
        </View>

        {/* Joystick Seek Section */}
        <View style={styles.section}>
          <SectionHeader title="Seeking" />
          <View style={styles.sectionCard}>
            <SettingsRow
              icon="game-controller-outline"
              label="Joystick Seek"
              onPress={() => (navigation as any).navigate('JoystickSeekSettings')}
              note="Customize drag-to-seek speed and curve"
            />
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={scale(16)} color="rgba(255,255,255,0.4)" />
          <Text style={styles.infoText}>
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
  rowContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  rowLabel: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#fff',
  },
  rowNote: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  rowValue: {
    fontSize: scale(14),
    color: ACCENT,
    fontWeight: '500',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: scale(16),
    padding: scale(20),
    width: '80%',
    maxWidth: 320,
  },
  pickerTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(4),
    textAlign: 'center',
  },
  pickerSubtitle: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.5)',
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
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(193,244,12,0.15)',
  },
  pickerOptionText: {
    fontSize: scale(15),
    color: '#fff',
  },
  pickerOptionTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },
});
