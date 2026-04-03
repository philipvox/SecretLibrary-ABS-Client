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
import { useTranslation } from 'react-i18next';
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
  Monitor,
  Code,
  ArrowRight,
} from 'lucide-react-native';
import {
  usePlayerStore,
  usePlayerSettingsStore,
  useSpeedStore,
  useSleepTimerStore,
  useCompletionSheetStore,
} from '@/shared/stores/playerFacade';
import {
  useChapterCleaningStore,
  CLEANING_LEVEL_KEYS,
  type ChapterCleaningLevel,
} from '../stores/chapterCleaningStore';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { WebContentContainer } from '@/shared/components/WebContentContainer';
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
const CHAPTER_CLEANING_LEVELS: ChapterCleaningLevel[] = ['off', 'light', 'standard', 'aggressive'];

function formatSpeed(speed: number, t?: (key: string) => string): string {
  return speed === 1.0 ? (t ? t('settings.playback.defaultSpeed.normalSpeed') : '1.0× (Normal)') : `${speed}×`;
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
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close picker"
      >
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
                accessibilityRole="button"
                accessibilityLabel={`${formatOption(option)}${selectedValue === option ? ', currently selected' : ''}`}
                accessibilityState={{ selected: selectedValue === option }}
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
// CHAPTER CLEANING COMPONENTS
// =============================================================================

interface LevelOptionProps {
  level: ChapterCleaningLevel;
  isSelected: boolean;
  onSelect: (level: ChapterCleaningLevel) => void;
  isRecommended?: boolean;
}

function LevelOption({ level, isSelected, onSelect, isRecommended }: LevelOptionProps) {
  const colors = useSecretLibraryColors();
  const { t } = useTranslation();
  const keys = CLEANING_LEVEL_KEYS[level];
  const label = t(keys.labelKey);
  const description = t(keys.descriptionKey);
  const example = t(keys.exampleKey);

  return (
    <TouchableOpacity
      style={[
        styles.levelOption,
        { borderBottomColor: colors.borderLight },
        isSelected && { backgroundColor: colors.grayLight },
      ]}
      onPress={() => onSelect(level)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label} cleaning level${isRecommended ? ', recommended' : ''}${isSelected ? ', currently selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.levelOptionLeft}>
        <View style={[styles.radioOuter, { borderColor: colors.gray }, isSelected && { borderColor: colors.black }]}>
          {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.black }]} />}
        </View>
        <View style={styles.levelContent}>
          <View style={styles.labelRow}>
            <Text style={[styles.levelLabel, { color: colors.black }, isSelected && styles.levelLabelSelected]}>
              {label}
            </Text>
            {isRecommended && (
              <View style={[styles.recommendedBadge, { backgroundColor: colors.grayLight }]}>
                <Text style={[styles.recommendedText, { color: colors.gray }]}>{t('settings.playback.chapterCleaning.recommended')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.levelDescription, { color: colors.gray }]}>{description}</Text>
          <Text style={[styles.levelExample, { color: colors.gray }]}>{example}</Text>
        </View>
      </View>
      {isSelected && <Check size={scale(20)} color={colors.black} strokeWidth={2} />}
    </TouchableOpacity>
  );
}

interface ExampleRowProps {
  before: string;
  after: string;
  note?: string;
}

function ExampleRow({ before, after, note }: ExampleRowProps) {
  const colors = useSecretLibraryColors();
  const { t } = useTranslation();

  return (
    <View style={[styles.exampleRow, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.exampleBefore}>
        <Text style={[styles.exampleLabel, { color: colors.gray }]}>{t('settings.playback.chapterCleaning.before')}</Text>
        <Text style={[styles.exampleText, { color: colors.gray }]} numberOfLines={1}>{before}</Text>
      </View>
      <ArrowRight size={scale(14)} color={colors.gray} strokeWidth={1.5} style={styles.exampleArrow} />
      <View style={styles.exampleAfter}>
        <Text style={[styles.exampleLabel, { color: colors.gray }]}>{t('settings.playback.chapterCleaning.after')}</Text>
        <Text style={[styles.exampleTextClean, { color: colors.black }]} numberOfLines={1}>{after}</Text>
        {note && <Text style={[styles.exampleNote, { color: colors.gray }]}>{note}</Text>}
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PlaybackSettingsScreen() {
  const insets = useSafeAreaInsets();
  const _navigation = useNavigation();
  const colors = useSecretLibraryColors();
  const { t } = useTranslation();

  // Player settings from stores
  const globalDefaultRate = useSpeedStore((s) => s.globalDefaultRate);
  const setGlobalDefaultRate = useSpeedStore((s) => s.setGlobalDefaultRate);
  const skipForwardInterval = usePlayerSettingsStore((s) => s.skipForwardInterval ?? 30);
  const setSkipForwardInterval = usePlayerSettingsStore((s) => s.setSkipForwardInterval);
  const skipBackInterval = usePlayerSettingsStore((s) => s.skipBackInterval ?? 15);
  const setSkipBackInterval = usePlayerSettingsStore((s) => s.setSkipBackInterval);
  const shakeToExtendEnabled = useSleepTimerStore((s) => s.shakeToExtendEnabled);
  const setShakeToExtendEnabled = usePlayerStore((s) => s.setShakeToExtendEnabled);
  const smartRewindEnabled = usePlayerSettingsStore((s) => s.smartRewindEnabled);
  const setSmartRewindEnabled = usePlayerSettingsStore((s) => s.setSmartRewindEnabled);
  const smartRewindMaxSeconds = usePlayerSettingsStore((s) => s.smartRewindMaxSeconds);
  const setSmartRewindMaxSeconds = usePlayerSettingsStore((s) => s.setSmartRewindMaxSeconds);
  const bluetoothAutoResume = usePlayerSettingsStore((s) => s.bluetoothAutoResume);
  const setBluetoothAutoResume = usePlayerSettingsStore((s) => s.setBluetoothAutoResume);
  const showTimeRemaining = usePlayerSettingsStore((s) => s.showTimeRemaining);
  const setShowTimeRemaining = usePlayerSettingsStore((s) => s.setShowTimeRemaining);
  const keepScreenAwake = usePlayerSettingsStore((s) => s.keepScreenAwake);
  const setKeepScreenAwake = usePlayerSettingsStore((s) => s.setKeepScreenAwake);
  const showCompletionPrompt = useCompletionSheetStore((s) => s.showCompletionPrompt ?? true);
  const setShowCompletionPrompt = useCompletionSheetStore((s) => s.setShowCompletionPrompt);
  const autoMarkFinished = useCompletionSheetStore((s) => s.autoMarkFinished ?? false);
  const setAutoMarkFinished = useCompletionSheetStore((s) => s.setAutoMarkFinished);

  // Chapter cleaning settings
  const cleaningLevel = useChapterCleaningStore((s) => s.level);
  const showOriginalNames = useChapterCleaningStore((s) => s.showOriginalNames);
  const setCleaningLevel = useChapterCleaningStore((s) => s.setLevel);
  const setShowOriginalNames = useChapterCleaningStore((s) => s.setShowOriginalNames);

  // Modal states
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);

  const handleSpeedSelect = useCallback((speed: number) => {
    setGlobalDefaultRate(speed);
  }, [setGlobalDefaultRate]);

  const handleLevelSelect = useCallback(
    (newLevel: ChapterCleaningLevel) => {
      setCleaningLevel(newLevel);
    },
    [setCleaningLevel]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.grayLight} />
      <SettingsHeader title={t('settings.playback.title')} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <WebContentContainer variant="narrow">
        {/* Display & Speed */}
        <SectionHeader title={t('settings.playback.sections.displayAndSpeed')} />
        <SettingsRow
          Icon={Clock}
          label={t('settings.playback.timeDisplay.label')}
          value={showTimeRemaining ? t('settings.playback.timeDisplay.valueTimeLeft') : t('settings.playback.timeDisplay.valueTimePlayed')}
          onPress={() => setShowTimeRemaining(!showTimeRemaining)}
          description={showTimeRemaining ? t('settings.playback.timeDisplay.descriptionTimeLeft') : t('settings.playback.timeDisplay.descriptionTimePlayed')}
        />
        <SettingsRow
          Icon={Gauge}
          label={t('settings.playback.defaultSpeed.label')}
          value={formatSpeed(globalDefaultRate ?? 1, t)}
          onPress={() => setShowSpeedPicker(true)}
          description={t('settings.playback.defaultSpeed.description')}
        />

        {/* Skip Intervals */}
        <SectionHeader title={t('settings.playback.sections.skipIntervals')} />
        <View style={[styles.pillSelectorContainer, { borderTopColor: colors.borderLight }]}>
          <View style={styles.pillSelectorRow}>
            <SkipForward size={scale(16)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.pillSelectorLabel, { color: colors.gray }]}>{t('settings.playback.skipForward.label')}</Text>
          </View>
          <View style={styles.pillSelectorOptions}>
            {SKIP_FORWARD_OPTIONS.map((seconds) => (
              <TouchableOpacity
                key={seconds}
                style={[
                  styles.pillOption,
                  { backgroundColor: colors.grayLight },
                  skipForwardInterval === seconds && { backgroundColor: colors.black },
                ]}
                onPress={() => setSkipForwardInterval(seconds)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Skip forward ${seconds} seconds${skipForwardInterval === seconds ? ', currently selected' : ''}`}
                accessibilityState={{ selected: skipForwardInterval === seconds }}
              >
                <Text
                  style={[
                    styles.pillOptionText,
                    { color: colors.gray },
                    skipForwardInterval === seconds && { color: colors.white },
                  ]}
                >
                  {seconds}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={[styles.pillSelectorContainer, { borderTopColor: colors.borderLight }]}>
          <View style={styles.pillSelectorRow}>
            <SkipBack size={scale(16)} color={colors.gray} strokeWidth={1.5} />
            <Text style={[styles.pillSelectorLabel, { color: colors.gray }]}>{t('settings.playback.skipBack.label')}</Text>
          </View>
          <View style={styles.pillSelectorOptions}>
            {SKIP_BACK_OPTIONS.map((seconds) => (
              <TouchableOpacity
                key={seconds}
                style={[
                  styles.pillOption,
                  { backgroundColor: colors.grayLight },
                  skipBackInterval === seconds && { backgroundColor: colors.black },
                ]}
                onPress={() => setSkipBackInterval(seconds)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Skip back ${seconds} seconds${skipBackInterval === seconds ? ', currently selected' : ''}`}
                accessibilityState={{ selected: skipBackInterval === seconds }}
              >
                <Text
                  style={[
                    styles.pillOptionText,
                    { color: colors.gray },
                    skipBackInterval === seconds && { color: colors.white },
                  ]}
                >
                  {seconds}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sleep Timer */}
        <SectionHeader title={t('settings.playback.sections.sleepTimer')} />
        <SettingsRow
          Icon={Smartphone}
          label={t('settings.playback.shakeToExtend.label')}
          switchValue={shakeToExtendEnabled}
          onSwitchChange={setShakeToExtendEnabled}
          description={t('settings.playback.shakeToExtend.description')}
        />

        {/* Bluetooth */}
        <SectionHeader title={t('settings.playback.sections.bluetooth')} />
        <SettingsRow
          Icon={Bluetooth}
          label={t('settings.playback.bluetoothAutoResume.label')}
          switchValue={bluetoothAutoResume}
          onSwitchChange={setBluetoothAutoResume}
          description={t('settings.playback.bluetoothAutoResume.description')}
        />

        {/* Smart Rewind */}
        <SectionHeader title={t('settings.playback.sections.smartRewind')} />
        <SettingsRow
          Icon={RefreshCw}
          label={t('settings.playback.smartRewind.label')}
          switchValue={smartRewindEnabled}
          onSwitchChange={setSmartRewindEnabled}
          description={t('settings.playback.smartRewind.description')}
        />
        {smartRewindEnabled && (
          <View style={[styles.maxRewindContainer, { borderTopColor: colors.borderLight }]}>
            <Text style={[styles.maxRewindLabel, { color: colors.gray }]}>{t('settings.playback.smartRewind.maximumRewind')}</Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Maximum rewind ${seconds} seconds${smartRewindMaxSeconds === seconds ? ', currently selected' : ''}`}
                  accessibilityState={{ selected: smartRewindMaxSeconds === seconds }}
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
              {t('settings.playback.smartRewind.note')}
            </Text>
          </View>
        )}

        {/* Screen */}
        <SectionHeader title={t('settings.playback.sections.screen')} />
        <SettingsRow
          Icon={Monitor}
          label={t('settings.playback.keepScreenAwake.label')}
          switchValue={keepScreenAwake}
          onSwitchChange={setKeepScreenAwake}
          description={t('settings.playback.keepScreenAwake.description')}
        />

        {/* Book Completion */}
        <SectionHeader title={t('settings.playback.sections.bookCompletion')} />
        <SettingsRow
          Icon={CheckCircle}
          label={t('settings.playback.completionPrompt.label')}
          switchValue={showCompletionPrompt}
          onSwitchChange={setShowCompletionPrompt}
          description={t('settings.playback.completionPrompt.description')}
        />
        {!showCompletionPrompt && (
          <SettingsRow
            Icon={CheckSquare}
            label={t('settings.playback.autoMarkFinished.label')}
            switchValue={autoMarkFinished}
            onSwitchChange={setAutoMarkFinished}
            description={t('settings.playback.autoMarkFinished.description')}
          />
        )}

        {/* Chapter Names */}
        <SectionHeader title={t('settings.playback.sections.chapterNames')} />
        <View style={[styles.chapterIntro]}>
          <Text style={[styles.chapterIntroText, { color: colors.gray }]}>
            {t('settings.playback.chapterCleaning.intro')}
          </Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          {CHAPTER_CLEANING_LEVELS.map((opt) => (
            <LevelOption
              key={opt}
              level={opt}
              isSelected={cleaningLevel === opt}
              onSelect={handleLevelSelect}
              isRecommended={opt === 'standard'}
            />
          ))}
        </View>

        {/* Example Transformations */}
        <View style={styles.examplesSection}>
          <Text style={[styles.examplesSectionTitle, { color: colors.gray }]}>{t('settings.playback.chapterCleaning.examples')}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
            <ExampleRow before="01 - The Great Gatsby: Chapter 1" after="Chapter 1" />
            <ExampleRow before="D01T05 - Interview With the Vampire" after="Chapter 5" />
            <ExampleRow before="Chapter Twenty-Three: The Discovery" after="Chapter 23: The Discovery" />
            <ExampleRow before="Prologue" after="Prologue" note="Front/back matter preserved" />
          </View>
        </View>

        {/* Advanced Chapter Options */}
        <SettingsRow
          Icon={Code}
          label={t('settings.playback.showOriginalNames.label')}
          description={t('settings.playback.showOriginalNames.description')}
          switchValue={showOriginalNames}
          onSwitchChange={setShowOriginalNames}
        />

        {/* Info Note */}
        <View style={styles.infoSection}>
          <Info size={scale(16)} color={colors.gray} strokeWidth={1.5} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            {t('settings.playback.infoNote')}
          </Text>
        </View>
        </WebContentContainer>
      </ScrollView>

      {/* Speed Picker Modal */}
      <OptionPicker
        visible={showSpeedPicker}
        title={t('settings.playback.defaultSpeed.pickerTitle')}
        subtitle={t('settings.playback.defaultSpeed.pickerSubtitle')}
        options={SPEED_OPTIONS}
        selectedValue={globalDefaultRate ?? 1}
        formatOption={(s) => formatSpeed(s, t)}
        onSelect={handleSpeedSelect}
        onClose={() => setShowSpeedPicker(false)}
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
  // Pill selector (skip intervals)
  pillSelectorContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pillSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pillSelectorLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillSelectorOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  pillOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  pillOptionText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
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
  // Chapter cleaning
  sectionCard: {
  },
  chapterIntro: {
    marginBottom: 12,
  },
  chapterIntroText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    lineHeight: scale(16),
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  levelOptionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  radioOuter: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(2),
  },
  radioInner: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
  },
  levelContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  levelLabelSelected: {
    fontFamily: fonts.playfair.bold,
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  levelExample: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 4,
    fontStyle: 'italic',
  },
  examplesSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  examplesSectionTitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  exampleBefore: {
    flex: 1,
  },
  exampleArrow: {
    marginHorizontal: 8,
    marginTop: 18,
  },
  exampleAfter: {
    flex: 1,
  },
  exampleLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  exampleTextClean: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  exampleNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    marginTop: 2,
    fontStyle: 'italic',
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
