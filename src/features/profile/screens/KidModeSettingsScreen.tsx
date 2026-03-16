/**
 * src/features/profile/screens/KidModeSettingsScreen.tsx
 *
 * Secret Library Kid Mode Settings
 * Content filtering with PIN protection, age categories, and genre/tag filters.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Plus,
  X,
  RotateCcw,
  Baby,
  Check,
  Ban,
  Info,
  Users,
  Star,
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { haptics } from '@/core/native/haptics';
import { PinInput } from '@/shared/components/PinInput';
import {
  useKidModeStore,
  AGE_CATEGORY_ORDER,
  AGE_CATEGORY_LABELS,
  RATING_ORDER,
  RATING_LABELS,
  MAX_PIN_ATTEMPTS,
} from '@/shared/stores/kidModeStore';
import { SettingsHeader } from '../components/SettingsHeader';

const DANGER = '#ff4b4b';
const SUCCESS = '#34C759';

// =============================================================================
// COMPONENTS
// =============================================================================

interface ChipProps {
  label: string;
  onRemove: () => void;
  variant?: 'allowed' | 'blocked';
}

function Chip({ label, onRemove, variant = 'allowed' }: ChipProps) {
  const colors = useSecretLibraryColors();
  const bgColor = variant === 'blocked' ? 'rgba(255,75,75,0.1)' : 'rgba(52,199,89,0.1)';
  const borderColor = variant === 'blocked' ? DANGER : SUCCESS;

  return (
    <View style={[styles.chip, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.chipText, { color: colors.black }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => {
          haptics.selection();
          onRemove();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={14} color={colors.gray} />
      </TouchableOpacity>
    </View>
  );
}

interface AddItemInputProps {
  placeholder: string;
  onAdd: (value: string) => void;
}

function AddItemInput({ placeholder, onAdd }: AddItemInputProps) {
  const colors = useSecretLibraryColors();
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (value.trim()) {
      haptics.selection();
      onAdd(value.trim());
      setValue('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <TouchableOpacity
        style={[styles.addButton, { borderColor: colors.gray }]}
        onPress={() => setIsAdding(true)}
      >
        <Plus size={16} color={colors.black} />
        <Text style={[styles.addButtonText, { color: colors.black }]}>Add</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.addInputContainer, { borderColor: colors.black }]}>
      <TextInput
        style={[styles.addInput, { color: colors.black }]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={handleAdd}
        autoFocus
        autoCapitalize="none"
        returnKeyType="done"
      />
      <TouchableOpacity onPress={handleAdd} style={styles.addInputButton}>
        <Check size={18} color={SUCCESS} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setValue('');
          setIsAdding(false);
        }}
        style={styles.addInputButton}
      >
        <X size={18} color={DANGER} />
      </TouchableOpacity>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  Icon?: React.ComponentType<any>;
}

function SectionHeader({ title, subtitle, Icon }: SectionHeaderProps) {
  const colors = useSecretLibraryColors();
  return (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderRow}>
        {Icon && <Icon size={14} color={colors.black} style={{ marginRight: 6 }} />}
        <Text style={[styles.sectionHeader, { color: colors.gray }]}>{title}</Text>
      </View>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: colors.gray }]}>{subtitle}</Text>}
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KidModeSettingsScreen() {
  const colors = useSecretLibraryColors();
  const insets = useSafeAreaInsets();
  const _navigation = useNavigation();

  // Kid Mode settings from store
  const enabled = useKidModeStore((s) => s.enabled);
  const useAgeFiltering = useKidModeStore((s) => s.useAgeFiltering);
  const maxAgeCategory = useKidModeStore((s) => s.maxAgeCategory);
  const useRatingFiltering = useKidModeStore((s) => s.useRatingFiltering);
  const maxRating = useKidModeStore((s) => s.maxRating);
  const useAllowedGenresTags = useKidModeStore((s) => s.useAllowedGenresTags);
  const allowedGenres = useKidModeStore((s) => s.allowedGenres);
  const allowedTags = useKidModeStore((s) => s.allowedTags);
  const blockedGenres = useKidModeStore((s) => s.blockedGenres);
  const blockedTags = useKidModeStore((s) => s.blockedTags);

  // Actions
  const setEnabled = useKidModeStore((s) => s.setEnabled);
  const setUseAgeFiltering = useKidModeStore((s) => s.setUseAgeFiltering);
  const setMaxAgeCategory = useKidModeStore((s) => s.setMaxAgeCategory);
  const setUseRatingFiltering = useKidModeStore((s) => s.setUseRatingFiltering);
  const setMaxRating = useKidModeStore((s) => s.setMaxRating);
  const setUseAllowedGenresTags = useKidModeStore((s) => s.setUseAllowedGenresTags);
  const addAllowedGenre = useKidModeStore((s) => s.addAllowedGenre);
  const removeAllowedGenre = useKidModeStore((s) => s.removeAllowedGenre);
  const addAllowedTag = useKidModeStore((s) => s.addAllowedTag);
  const removeAllowedTag = useKidModeStore((s) => s.removeAllowedTag);
  const addBlockedGenre = useKidModeStore((s) => s.addBlockedGenre);
  const removeBlockedGenre = useKidModeStore((s) => s.removeBlockedGenre);
  const addBlockedTag = useKidModeStore((s) => s.addBlockedTag);
  const removeBlockedTag = useKidModeStore((s) => s.removeBlockedTag);
  const resetToDefaults = useKidModeStore((s) => s.resetToDefaults);

  // PIN-related state from store
  const pin = useKidModeStore((s) => s.pin);
  const pinFailedAttempts = useKidModeStore((s) => s.pinFailedAttempts);
  const setPin = useKidModeStore((s) => s.setPin);
  const removePin = useKidModeStore((s) => s.removePin);
  const verifyPin = useKidModeStore((s) => s.verifyPin);
  const _disableKidMode = useKidModeStore((s) => s.disableKidMode);
  const isLockedOut = useKidModeStore((s) => s.isLockedOut);
  const getLockoutRemaining = useKidModeStore((s) => s.getLockoutRemaining);

  // PIN modal state
  type PinMode = 'verify' | 'set' | 'change' | 'remove' | null;
  const [pinModalMode, setPinModalMode] = useState<PinMode>(null);
  const [pinValue, setPinValue] = useState('');
  const [confirmPinValue, setConfirmPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Update lockout countdown
  useEffect(() => {
    if (!isLockedOut()) {
      setLockoutSeconds(0);
      return;
    }

    const updateLockout = () => {
      const remaining = getLockoutRemaining();
      setLockoutSeconds(remaining);
      if (remaining <= 0) {
        setPinError(null);
      }
    };

    updateLockout();
    const interval = setInterval(updateLockout, 1000);
    return () => clearInterval(interval);
  }, [pinFailedAttempts, isLockedOut, getLockoutRemaining]);

  // Handle PIN modal close
  const closePinModal = useCallback(() => {
    setPinModalMode(null);
    setPinValue('');
    setConfirmPinValue('');
    setPinError(null);
    setIsConfirmStep(false);
  }, []);

  // Handle PIN submission
  const handlePinSubmit = useCallback(() => {
    if (isLockedOut()) {
      haptics.error();
      setPinError(`Too many attempts. Try again in ${getLockoutRemaining()} seconds.`);
      return;
    }

    switch (pinModalMode) {
      case 'verify':
        if (verifyPin(pinValue)) {
          haptics.success();
          setEnabled(false);
          closePinModal();
        } else {
          haptics.error();
          const remaining = MAX_PIN_ATTEMPTS - pinFailedAttempts - 1;
          if (isLockedOut()) {
            setPinError(`Too many attempts. Try again in ${getLockoutRemaining()} seconds.`);
          } else if (remaining > 0) {
            setPinError(
              `Wrong PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
            );
          } else {
            setPinError('Wrong PIN.');
          }
          setPinValue('');
        }
        break;

      case 'set':
        if (!isConfirmStep) {
          if (pinValue.length !== 4) {
            haptics.warning();
            setPinError('PIN must be 4 digits');
            return;
          }
          setIsConfirmStep(true);
          setConfirmPinValue('');
          setPinError(null);
        } else {
          if (pinValue !== confirmPinValue) {
            haptics.error();
            setPinError('PINs do not match. Try again.');
            setConfirmPinValue('');
            return;
          }
          if (setPin(pinValue)) {
            haptics.success();
            closePinModal();
          } else {
            haptics.error();
            setPinError('Invalid PIN format');
          }
        }
        break;

      case 'change':
        if (!isConfirmStep) {
          if (verifyPin(pinValue)) {
            setIsConfirmStep(true);
            setPinValue('');
            setConfirmPinValue('');
            setPinError(null);
          } else {
            haptics.error();
            const remaining = MAX_PIN_ATTEMPTS - pinFailedAttempts - 1;
            if (isLockedOut()) {
              setPinError(`Too many attempts. Try again in ${getLockoutRemaining()} seconds.`);
            } else if (remaining > 0) {
              setPinError(
                `Wrong PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
              );
            } else {
              setPinError('Wrong PIN.');
            }
            setPinValue('');
          }
        } else {
          if (pinValue.length !== 4) {
            haptics.warning();
            setPinError('PIN must be 4 digits');
            return;
          }
          if (pinValue !== confirmPinValue) {
            haptics.error();
            setPinError('PINs do not match');
            return;
          }
          if (setPin(pinValue)) {
            haptics.success();
            closePinModal();
          } else {
            haptics.error();
            setPinError('Invalid PIN format');
          }
        }
        break;

      case 'remove':
        if (verifyPin(pinValue)) {
          haptics.success();
          removePin();
          closePinModal();
        } else {
          haptics.error();
          const remaining = MAX_PIN_ATTEMPTS - pinFailedAttempts - 1;
          if (isLockedOut()) {
            setPinError(`Too many attempts. Try again in ${getLockoutRemaining()} seconds.`);
          } else if (remaining > 0) {
            setPinError(
              `Wrong PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
            );
          } else {
            setPinError('Wrong PIN.');
          }
          setPinValue('');
        }
        break;
    }
  }, [
    pinModalMode,
    pinValue,
    confirmPinValue,
    isConfirmStep,
    pinFailedAttempts,
    verifyPin,
    setPin,
    removePin,
    setEnabled,
    isLockedOut,
    getLockoutRemaining,
    closePinModal,
  ]);

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pinModalMode === 'verify' || pinModalMode === 'remove') {
      if (pinValue.length === 4) {
        handlePinSubmit();
      }
    } else if (pinModalMode === 'set' || pinModalMode === 'change') {
      if (isConfirmStep && confirmPinValue.length === 4) {
        handlePinSubmit();
      }
    }
  }, [pinValue, confirmPinValue, pinModalMode, isConfirmStep, handlePinSubmit]);

  // Handle Kid Mode toggle
  const handleToggle = useCallback(
    (newValue: boolean) => {
      if (newValue) {
        haptics.selection();
        setEnabled(true);
      } else {
        if (pin) {
          setPinModalMode('verify');
          setPinValue('');
          setPinError(null);
        } else {
          haptics.selection();
          setEnabled(false);
        }
      }
    },
    [pin, setEnabled]
  );

  // Get PIN modal title and subtitle
  const getPinModalTitle = () => {
    switch (pinModalMode) {
      case 'verify':
        return 'Enter PIN';
      case 'set':
        return isConfirmStep ? 'Confirm PIN' : 'Set PIN';
      case 'change':
        return isConfirmStep ? 'Enter New PIN' : 'Enter Current PIN';
      case 'remove':
        return 'Enter PIN to Remove';
      default:
        return '';
    }
  };

  const getPinModalSubtitle = () => {
    if (lockoutSeconds > 0) {
      return `Locked out for ${lockoutSeconds} seconds`;
    }
    switch (pinModalMode) {
      case 'verify':
        return 'Enter your PIN to disable Kid Mode';
      case 'set':
        return isConfirmStep ? 'Enter the same PIN again to confirm' : 'Create a 4-digit PIN';
      case 'change':
        return isConfirmStep ? 'Create your new 4-digit PIN' : 'Verify your current PIN first';
      case 'remove':
        return 'Enter your PIN to remove PIN protection';
      default:
        return '';
    }
  };

  const handleResetToDefaults = useCallback(() => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all allowed and blocked genres/tags to their default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            haptics.warning();
            resetToDefaults();
          },
        },
      ]
    );
  }, [resetToDefaults]);

  return (
    <View style={[styles.container, { backgroundColor: colors.grayLight }]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.grayLight}
      />
      <SettingsHeader title="Kid Mode" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Toggle */}
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          <View style={styles.masterToggleRow}>
            <View style={[styles.masterIconContainer, { backgroundColor: colors.black }]}>
              <Baby size={scale(20)} color={colors.white} strokeWidth={2} />
            </View>
            <View style={styles.masterToggleContent}>
              <Text style={[styles.masterToggleLabel, { color: colors.black }]}>Kid Mode</Text>
              <Text style={[styles.masterToggleNote, { color: colors.gray }]}>
                {enabled ? 'Active - filtering content' : 'Off - showing all content'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: colors.borderLight, true: colors.black }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.borderLight}
            />
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleResetToDefaults}>
          <RotateCcw size={16} color={colors.gray} />
          <Text style={[styles.resetButtonText, { color: colors.gray }]}>Reset to Defaults</Text>
        </TouchableOpacity>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.white }]}>
          <Info size={16} color={colors.gray} />
          <Text style={[styles.infoText, { color: colors.gray }]}>
            Books with category tags pass if they match your max category. Books without category
            tags must have an allowed genre/tag and no blocked items.
          </Text>
        </View>

        {/* PIN Protection Section - only show when Kid Mode is enabled */}
        {enabled && (
          <>
            <SectionHeader
              title="PIN Protection"
              subtitle="Prevent children from disabling Kid Mode"
              Icon={Lock}
            />
            <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
              {!pin ? (
                <TouchableOpacity
                  style={styles.pinRow}
                  onPress={() => {
                    haptics.selection();
                    setPinModalMode('set');
                    setPinValue('');
                    setConfirmPinValue('');
                    setPinError(null);
                    setIsConfirmStep(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pinIconContainer, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
                    <KeyRound size={scale(18)} color={SUCCESS} strokeWidth={2} />
                  </View>
                  <View style={styles.pinRowContent}>
                    <Text style={[styles.pinRowLabel, { color: colors.black }]}>Set PIN</Text>
                    <Text style={[styles.pinRowNote, { color: colors.gray }]}>
                      Require a 4-digit PIN to disable Kid Mode
                    </Text>
                  </View>
                  <ChevronLeft
                    size={20}
                    color={colors.gray}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.pinStatusRow}>
                    <View style={[styles.pinIconContainer, { backgroundColor: colors.grayLight }]}>
                      <Lock size={scale(18)} color={colors.black} strokeWidth={2} />
                    </View>
                    <View style={styles.pinRowContent}>
                      <Text style={[styles.pinRowLabel, { color: colors.black }]}>PIN Protected</Text>
                      <Text style={[styles.pinRowNote, { color: colors.gray }]}>
                        A PIN is required to disable Kid Mode
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.pinButtonsRow, { borderTopColor: colors.borderLight }]}>
                    <TouchableOpacity
                      style={[styles.pinActionButton, { backgroundColor: colors.grayLight }]}
                      onPress={() => {
                        haptics.selection();
                        setPinModalMode('change');
                        setPinValue('');
                        setConfirmPinValue('');
                        setPinError(null);
                        setIsConfirmStep(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <KeyRound size={16} color={colors.black} />
                      <Text style={[styles.pinActionButtonText, { color: colors.black }]}>Change PIN</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.pinActionButton, styles.pinActionButtonDanger]}
                      onPress={() => {
                        haptics.selection();
                        setPinModalMode('remove');
                        setPinValue('');
                        setPinError(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Unlock size={16} color={DANGER} />
                      <Text style={[styles.pinActionButtonText, { color: DANGER }]}>
                        Remove PIN
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* Age Category Filtering */}
        <SectionHeader
          title="Age Category Filtering"
          subtitle="Filter by category tags (Children's, Teens, etc.)"
          Icon={Users}
        />
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.black }]}>Use Category Filtering</Text>
              <Text style={[styles.toggleNote, { color: colors.gray }]}>Filter books by age category tags if present</Text>
            </View>
            <Switch
              value={useAgeFiltering}
              onValueChange={(value) => {
                haptics.selection();
                setUseAgeFiltering(value);
              }}
              trackColor={{ false: colors.borderLight, true: colors.black }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.borderLight}
            />
          </View>

          {useAgeFiltering && (
            <View style={[styles.pickerContainer, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.pickerLabel, { color: colors.black }]}>Maximum Age Category</Text>
              <Text style={[styles.pickerHint, { color: colors.gray }]}>Books in higher categories will be hidden</Text>
              <View style={styles.categoryOptions}>
                {AGE_CATEGORY_ORDER.map((category, index) => {
                  const isSelected = maxAgeCategory === category;
                  const maxIndex = AGE_CATEGORY_ORDER.indexOf(maxAgeCategory);
                  const isPastMax = index > maxIndex;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryOption,
                        { backgroundColor: colors.grayLight },
                        isSelected && { backgroundColor: colors.black },
                        isPastMax && { opacity: 0.4 },
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setMaxAgeCategory(category);
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryOptionLabel,
                          { color: colors.black },
                          isSelected && { color: colors.white, fontFamily: fonts.jetbrainsMono.bold },
                        ]}
                      >
                        {AGE_CATEGORY_LABELS[category]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Content Rating Filtering */}
        <SectionHeader
          title="Content Rating Filtering"
          subtitle="Filter by content ratings (G, PG, PG-13, R)"
          Icon={Star}
        />
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.black }]}>Use Rating Filtering</Text>
              <Text style={[styles.toggleNote, { color: colors.gray }]}>Filter books by content rating tags if present</Text>
            </View>
            <Switch
              value={useRatingFiltering}
              onValueChange={(value) => {
                haptics.selection();
                setUseRatingFiltering(value);
              }}
              trackColor={{ false: colors.borderLight, true: colors.black }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.borderLight}
            />
          </View>

          {useRatingFiltering && (
            <View style={[styles.pickerContainer, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.pickerLabel, { color: colors.black }]}>Maximum Content Rating</Text>
              <Text style={[styles.pickerHint, { color: colors.gray }]}>Books rated higher will be hidden</Text>
              <View style={styles.ratingOptions}>
                {RATING_ORDER.map((rating, index) => {
                  const isSelected = maxRating === rating;
                  const maxIndex = RATING_ORDER.indexOf(maxRating);
                  const isPastMax = index > maxIndex;
                  return (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.ratingOption,
                        { backgroundColor: colors.grayLight },
                        isSelected && { backgroundColor: colors.black },
                        isPastMax && { opacity: 0.4 },
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setMaxRating(rating);
                      }}
                    >
                      <Text
                        style={[
                          styles.ratingOptionLabel,
                          { color: colors.black },
                          isSelected && { color: colors.white, fontFamily: fonts.jetbrainsMono.bold },
                        ]}
                      >
                        {RATING_LABELS[rating]}
                      </Text>
                      <Text
                        style={[
                          styles.ratingOptionAge,
                          { color: colors.gray },
                          isSelected && { color: 'rgba(255,255,255,0.7)' },
                        ]}
                      >
                        {rating === 'g'
                          ? 'All Ages'
                          : rating === 'pg'
                            ? '8+'
                            : rating === 'pg-13'
                              ? '13+'
                              : '17+'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Allowed Genres/Tags Section */}
        <SectionHeader
          title="Allowed Genres & Tags"
          subtitle="Require books to have specific genres or tags"
          Icon={Check}
        />
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.black }]}>Require Allowed Genres/Tags</Text>
              <Text style={[styles.toggleNote, { color: colors.gray }]}>
                {useAllowedGenresTags
                  ? 'Books must have an allowed genre or tag'
                  : 'Off - only blocked items are checked'}
              </Text>
            </View>
            <Switch
              value={useAllowedGenresTags}
              onValueChange={(value) => {
                haptics.selection();
                setUseAllowedGenresTags(value);
              }}
              trackColor={{ false: colors.borderLight, true: colors.black }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.borderLight}
            />
          </View>
        </View>

        {/* Allowed Genres - only show if toggle is on */}
        {useAllowedGenresTags && (
          <>
            <Text style={[styles.subSectionLabel, { color: colors.gray }]}>Allowed Genres</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
              <View style={styles.chipGrid}>
                {allowedGenres.map((genre) => (
                  <Chip
                    key={genre}
                    label={genre}
                    onRemove={() => removeAllowedGenre(genre)}
                    variant="allowed"
                  />
                ))}
                <AddItemInput placeholder="Add genre..." onAdd={addAllowedGenre} />
              </View>
            </View>

            <Text style={[styles.subSectionLabel, { color: colors.gray }]}>Allowed Tags</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
              <View style={styles.chipGrid}>
                {allowedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onRemove={() => removeAllowedTag(tag)}
                    variant="allowed"
                  />
                ))}
                <AddItemInput placeholder="Add tag..." onAdd={addAllowedTag} />
              </View>
            </View>
          </>
        )}

        {/* Blocked Genres */}
        <SectionHeader
          title="Blocked Genres"
          subtitle="Books with these genres will be hidden"
          Icon={Ban}
        />
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          <View style={styles.chipGrid}>
            {blockedGenres.map((genre) => (
              <Chip
                key={genre}
                label={genre}
                onRemove={() => removeBlockedGenre(genre)}
                variant="blocked"
              />
            ))}
            <AddItemInput placeholder="Add blocked genre..." onAdd={addBlockedGenre} />
          </View>
        </View>

        {/* Blocked Tags */}
        <SectionHeader
          title="Blocked Tags"
          subtitle="Books with these tags will be hidden"
          Icon={Ban}
        />
        <View style={[styles.sectionCard, { backgroundColor: colors.white }]}>
          <View style={styles.chipGrid}>
            {blockedTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onRemove={() => removeBlockedTag(tag)}
                variant="blocked"
              />
            ))}
            <AddItemInput placeholder="Add blocked tag..." onAdd={addBlockedTag} />
          </View>
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.white }]}>
          <Text style={[styles.tipsTitle, { color: colors.black }]}>Tips</Text>
          <Text style={[styles.tipText, { color: colors.gray }]}>
            • Age categories: Children's → Teens → Young Adult → Adult
          </Text>
          <Text style={[styles.tipText, { color: colors.gray }]}>• Content ratings: G → PG → PG-13 → R</Text>
          <Text style={[styles.tipText, { color: colors.gray }]}>
            • Both filters apply independently - book must pass both if enabled
          </Text>
          <Text style={[styles.tipText, { color: colors.gray }]}>
            • Books without category/rating tags fall back to genre/tag filtering
          </Text>
        </View>
      </ScrollView>

      {/* PIN Modal */}
      <Modal
        visible={pinModalMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closePinModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.white }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: colors.grayLight }]}>
                <Lock size={scale(32)} color={colors.black} strokeWidth={1.5} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.black }]}>{getPinModalTitle()}</Text>
              <Text style={[styles.modalSubtitle, { color: colors.gray }]}>{getPinModalSubtitle()}</Text>
            </View>

            {/* PIN Input */}
            <PinInput
              value={
                pinModalMode === 'set' && isConfirmStep
                  ? confirmPinValue
                  : pinModalMode === 'change' && isConfirmStep
                    ? pinValue.length === 4
                      ? confirmPinValue
                      : pinValue
                    : pinValue
              }
              onChange={(value) => {
                if (pinModalMode === 'set' && isConfirmStep) {
                  setConfirmPinValue(value);
                } else if (pinModalMode === 'change' && isConfirmStep) {
                  if (pinValue.length < 4) {
                    setPinValue(value);
                  } else {
                    setConfirmPinValue(value);
                  }
                } else {
                  setPinValue(value);
                }
                if (pinError) setPinError(null);
              }}
              length={4}
              secure
              autoFocus
              disabled={lockoutSeconds > 0}
              error={!!pinError}
            />

            {/* Error Message */}
            {pinError && <Text style={styles.pinErrorText}>{pinError}</Text>}

            {/* Confirm step indicator for set/change */}
            {(pinModalMode === 'set' || pinModalMode === 'change') &&
              isConfirmStep &&
              pinModalMode === 'change' &&
              pinValue.length === 4 && (
                <Text style={[styles.confirmHint, { color: colors.gray }]}>Confirm your new PIN</Text>
              )}

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.grayLight }]}
                onPress={closePinModal}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelButtonText, { color: colors.gray }]}>Cancel</Text>
              </TouchableOpacity>

              {(pinModalMode === 'set' || (pinModalMode === 'change' && isConfirmStep)) && (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.black },
                    pinModalMode === 'set' &&
                      !isConfirmStep &&
                      pinValue.length !== 4 &&
                      styles.modalButtonDisabled,
                  ]}
                  onPress={handlePinSubmit}
                  activeOpacity={0.7}
                  disabled={pinModalMode === 'set' && !isConfirmStep && pinValue.length !== 4}
                >
                  <Text style={[styles.modalConfirmButtonText, { color: colors.white }]}>
                    {isConfirmStep ? 'Confirm' : 'Next'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  sectionCard: {
    marginBottom: 16,
    padding: 16,
  },
  // Master Toggle
  masterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterIconContainer: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  masterToggleContent: {
    flex: 1,
  },
  masterToggleLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
  },
  masterToggleNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  // Reset Button
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  resetButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  infoText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    flex: 1,
    lineHeight: scale(16),
  },
  // Section Header
  sectionHeaderContainer: {
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeader: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  toggleNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  // Picker Container
  pickerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  pickerLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
    marginBottom: 4,
  },
  pickerHint: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginBottom: 12,
  },
  // Category Options
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  categoryOptionLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  // Rating Options
  ratingOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  ratingOptionLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  ratingOptionAge: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(8),
    marginTop: 2,
  },
  // Chip Grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
  },
  addButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  addInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingLeft: 10,
    minWidth: scale(150),
  },
  addInput: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    flex: 1,
    paddingVertical: 6,
  },
  addInputButton: {
    padding: 6,
  },
  // Sub-section Label
  subSectionLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  // PIN Rows
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pinIconContainer: {
    width: scale(36),
    height: scale(36),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pinRowContent: {
    flex: 1,
  },
  pinRowLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  pinRowNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  pinStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 12,
  },
  pinButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pinActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  pinActionButtonDanger: {
    backgroundColor: 'rgba(255,75,75,0.1)',
  },
  pinActionButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  // Tips Card
  tipsCard: {
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  tipsTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(14),
    marginBottom: 10,
  },
  tipText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    lineHeight: scale(16),
    marginBottom: 4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: scale(340),
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: scale(72),
    height: scale(72),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(24),
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textAlign: 'center',
  },
  pinErrorText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: DANGER,
    textAlign: 'center',
    marginTop: 10,
  },
  confirmHint: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textAlign: 'center',
    marginTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  modalCancelButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalConfirmButtonText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
});
