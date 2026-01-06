/**
 * src/features/profile/screens/KidModeSettingsScreen.tsx
 *
 * Settings screen for Kid Mode content filtering.
 * Allows users to customize allowed and blocked genres/tags.
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
import { accentColors, scale, spacing, typography, fontWeight } from '@/shared/theme';
import { useColors, ThemeColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { PinInput } from '@/shared/components/PinInput';
import {
  useKidModeStore,
  DEFAULT_ALLOWED_GENRES,
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_BLOCKED_GENRES,
  DEFAULT_BLOCKED_TAGS,
  AgeCategory,
  AGE_CATEGORY_ORDER,
  AGE_CATEGORY_LABELS,
  ContentRating,
  RATING_ORDER,
  RATING_LABELS,
  MAX_PIN_ATTEMPTS,
} from '@/shared/stores/kidModeStore';

const ACCENT = accentColors.gold;
const DANGER = '#FF3B30';
const SUCCESS = '#34C759';

// Helper to create theme-aware colors
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

// Chip component for displaying a removable item
interface ChipProps {
  label: string;
  onRemove: () => void;
  colors: ReturnType<typeof createColors>;
  variant?: 'allowed' | 'blocked';
}

function Chip({ label, onRemove, colors, variant = 'allowed' }: ChipProps) {
  const bgColor = variant === 'blocked' ? 'rgba(255,59,48,0.15)' : 'rgba(52,199,89,0.15)';
  const borderColor = variant === 'blocked' ? DANGER : SUCCESS;

  return (
    <View style={[styles.chip, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => {
          haptics.selection();
          onRemove();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

// Add item input component
interface AddItemInputProps {
  placeholder: string;
  onAdd: (value: string) => void;
  colors: ReturnType<typeof createColors>;
}

function AddItemInput({ placeholder, onAdd, colors }: AddItemInputProps) {
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
        style={[styles.addButton, { borderColor: colors.border }]}
        onPress={() => setIsAdding(true)}
      >
        <Plus size={16} color={ACCENT} />
        <Text style={[styles.addButtonText, { color: ACCENT }]}>Add</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.addInputContainer, { borderColor: ACCENT }]}>
      <TextInput
        style={[styles.addInput, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
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

// Section Header Component
function SectionHeader({
  title,
  subtitle,
  colors,
  Icon,
}: {
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof createColors>;
  Icon?: React.ComponentType<any>;
}) {
  return (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderRow}>
        {Icon && <Icon size={16} color={ACCENT} style={{ marginRight: 6 }} />}
        <Text style={[styles.sectionHeader, { color: colors.text }]}>{title}</Text>
      </View>
      {subtitle && (
        <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

export function KidModeSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const themeColors = useColors();
  const colors = createColors(themeColors);

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
  const disableKidMode = useKidModeStore((s) => s.disableKidMode);
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
        // Verifying to disable Kid Mode
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
            setPinError(`Wrong PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
          } else {
            setPinError('Wrong PIN.');
          }
          setPinValue('');
        }
        break;

      case 'set':
        if (!isConfirmStep) {
          // First step: enter new PIN
          if (pinValue.length !== 4) {
            haptics.warning();
            setPinError('PIN must be 4 digits');
            return;
          }
          setIsConfirmStep(true);
          setConfirmPinValue('');
          setPinError(null);
        } else {
          // Second step: confirm new PIN
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
          // First step: verify current PIN
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
              setPinError(`Wrong PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
            } else {
              setPinError('Wrong PIN.');
            }
            setPinValue('');
          }
        } else {
          // Second step: set new PIN (using confirmPinValue for the new PIN confirmation)
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
        // Verify current PIN to remove it
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
            setPinError(`Wrong PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
          } else {
            setPinError('Wrong PIN.');
          }
          setPinValue('');
        }
        break;
    }
  }, [
    pinModalMode, pinValue, confirmPinValue, isConfirmStep, pinFailedAttempts,
    verifyPin, setPin, removePin, setEnabled, isLockedOut, getLockoutRemaining, closePinModal,
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
  const handleToggle = useCallback((newValue: boolean) => {
    if (newValue) {
      // Enabling Kid Mode - no PIN required
      haptics.selection();
      setEnabled(true);
    } else {
      // Disabling Kid Mode - check if PIN is required
      if (pin) {
        setPinModalMode('verify');
        setPinValue('');
        setPinError(null);
      } else {
        haptics.selection();
        setEnabled(false);
      }
    }
  }, [pin, setEnabled]);

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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kid Mode Settings</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetToDefaults}
          accessibilityLabel="Reset to defaults"
          accessibilityRole="button"
        >
          <RotateCcw size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Toggle */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.masterToggleRow}>
            <View style={[styles.iconContainer, { backgroundColor: ACCENT }]}>
              <Baby size={scale(20)} color="#000" strokeWidth={2} />
            </View>
            <View style={styles.masterToggleContent}>
              <Text style={[styles.masterToggleLabel, { color: colors.text }]}>Kid Mode</Text>
              <Text style={[styles.masterToggleNote, { color: colors.textTertiary }]}>
                {enabled ? 'Active - filtering content' : 'Off - showing all content'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: colors.border, true: ACCENT }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { borderColor: colors.border }]}>
          <Info size={16} color={colors.textTertiary} />
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            Books with category tags pass if they match your max category. Books without category tags must have an allowed genre/tag and no blocked items.
          </Text>
        </View>

        {/* PIN Protection Section - only show when Kid Mode is enabled */}
        {enabled && (
          <>
            <SectionHeader
              title="PIN Protection"
              subtitle="Prevent children from disabling Kid Mode"
              colors={colors}
              Icon={Lock}
            />
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {!pin ? (
                // No PIN set - show Set PIN option
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
                  <View style={[styles.pinIconContainer, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                    <KeyRound size={scale(18)} color={SUCCESS} strokeWidth={2} />
                  </View>
                  <View style={styles.pinRowContent}>
                    <Text style={[styles.pinRowLabel, { color: colors.text }]}>Set PIN</Text>
                    <Text style={[styles.pinRowNote, { color: colors.textTertiary }]}>
                      Require a 4-digit PIN to disable Kid Mode
                    </Text>
                  </View>
                  <ChevronLeft
                    size={20}
                    color={colors.textTertiary}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </TouchableOpacity>
              ) : (
                // PIN is set - show Change/Remove options
                <>
                  <View style={styles.pinStatusRow}>
                    <View style={[styles.pinIconContainer, { backgroundColor: 'rgba(243,182,12,0.15)' }]}>
                      <Lock size={scale(18)} color={ACCENT} strokeWidth={2} />
                    </View>
                    <View style={styles.pinRowContent}>
                      <Text style={[styles.pinRowLabel, { color: colors.text }]}>PIN Protected</Text>
                      <Text style={[styles.pinRowNote, { color: colors.textTertiary }]}>
                        A PIN is required to disable Kid Mode
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pinButtonsRow}>
                    <TouchableOpacity
                      style={[styles.pinActionButton, { borderColor: colors.border }]}
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
                      <KeyRound size={16} color={ACCENT} />
                      <Text style={[styles.pinActionButtonText, { color: ACCENT }]}>
                        Change PIN
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.pinActionButton, { borderColor: DANGER }]}
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
          colors={colors}
          Icon={Users}
        />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Toggle */}
          <View style={styles.ageToggleRow}>
            <View style={styles.ageToggleContent}>
              <Text style={[styles.ageToggleLabel, { color: colors.text }]}>
                Use Category Filtering
              </Text>
              <Text style={[styles.ageToggleNote, { color: colors.textTertiary }]}>
                Filter books by age category tags if present
              </Text>
            </View>
            <Switch
              value={useAgeFiltering}
              onValueChange={(value) => {
                haptics.selection();
                setUseAgeFiltering(value);
              }}
              trackColor={{ false: colors.border, true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          {/* Category Picker - shown when filtering is enabled */}
          {useAgeFiltering && (
            <View style={styles.categoryPickerContainer}>
              <Text style={[styles.categoryPickerLabel, { color: colors.text }]}>
                Maximum Age Category
              </Text>
              <Text style={[styles.categoryPickerHint, { color: colors.textTertiary }]}>
                Books in higher categories will be hidden
              </Text>
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
                        { borderColor: isSelected ? ACCENT : colors.border },
                        isSelected && { backgroundColor: 'rgba(243,182,12,0.15)' },
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
                          { color: isSelected ? ACCENT : colors.text },
                          isSelected && { fontWeight: '700' },
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
          colors={colors}
          Icon={Star}
        />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Toggle */}
          <View style={styles.ageToggleRow}>
            <View style={styles.ageToggleContent}>
              <Text style={[styles.ageToggleLabel, { color: colors.text }]}>
                Use Rating Filtering
              </Text>
              <Text style={[styles.ageToggleNote, { color: colors.textTertiary }]}>
                Filter books by content rating tags if present
              </Text>
            </View>
            <Switch
              value={useRatingFiltering}
              onValueChange={(value) => {
                haptics.selection();
                setUseRatingFiltering(value);
              }}
              trackColor={{ false: colors.border, true: ACCENT }}
              thumbColor="#fff"
            />
          </View>

          {/* Rating Picker - shown when filtering is enabled */}
          {useRatingFiltering && (
            <View style={styles.ratingPickerContainer}>
              <Text style={[styles.ratingPickerLabel, { color: colors.text }]}>
                Maximum Content Rating
              </Text>
              <Text style={[styles.ratingPickerHint, { color: colors.textTertiary }]}>
                Books rated higher will be hidden
              </Text>
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
                        { borderColor: isSelected ? ACCENT : colors.border },
                        isSelected && { backgroundColor: 'rgba(243,182,12,0.15)' },
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
                          { color: isSelected ? ACCENT : colors.text },
                          isSelected && { fontWeight: '700' },
                        ]}
                      >
                        {RATING_LABELS[rating]}
                      </Text>
                      <Text
                        style={[
                          styles.ratingOptionAge,
                          { color: isSelected ? ACCENT : colors.textTertiary },
                        ]}
                      >
                        {rating === 'g' ? 'All Ages' : rating === 'pg' ? '8+' : rating === 'pg-13' ? '13+' : '17+'}
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
          colors={colors}
          Icon={Check}
        />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Toggle */}
          <View style={styles.ageToggleRow}>
            <View style={styles.ageToggleContent}>
              <Text style={[styles.ageToggleLabel, { color: colors.text }]}>
                Require Allowed Genres/Tags
              </Text>
              <Text style={[styles.ageToggleNote, { color: colors.textTertiary }]}>
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
              trackColor={{ false: colors.border, true: ACCENT }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Allowed Genres - only show if toggle is on */}
        {useAllowedGenresTags && (
          <>
            <Text style={[styles.subSectionLabel, { color: colors.textSecondary }]}>
              Allowed Genres
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.chipGrid}>
                {allowedGenres.map((genre) => (
                  <Chip
                    key={genre}
                    label={genre}
                    onRemove={() => removeAllowedGenre(genre)}
                    colors={colors}
                    variant="allowed"
                  />
                ))}
                <AddItemInput
                  placeholder="Add genre..."
                  onAdd={addAllowedGenre}
                  colors={colors}
                />
              </View>
            </View>

            {/* Allowed Tags */}
            <Text style={[styles.subSectionLabel, { color: colors.textSecondary }]}>
              Allowed Tags
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.chipGrid}>
                {allowedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onRemove={() => removeAllowedTag(tag)}
                    colors={colors}
                    variant="allowed"
                  />
                ))}
                <AddItemInput
                  placeholder="Add tag..."
                  onAdd={addAllowedTag}
                  colors={colors}
                />
              </View>
            </View>
          </>
        )}

        {/* Blocked Genres */}
        <SectionHeader
          title="Blocked Genres"
          subtitle="Books with these genres will be hidden"
          colors={colors}
          Icon={Ban}
        />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.chipGrid}>
            {blockedGenres.map((genre) => (
              <Chip
                key={genre}
                label={genre}
                onRemove={() => removeBlockedGenre(genre)}
                colors={colors}
                variant="blocked"
              />
            ))}
            <AddItemInput
              placeholder="Add blocked genre..."
              onAdd={addBlockedGenre}
              colors={colors}
            />
          </View>
        </View>

        {/* Blocked Tags */}
        <SectionHeader
          title="Blocked Tags"
          subtitle="Books with these tags will be hidden"
          colors={colors}
          Icon={Ban}
        />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.chipGrid}>
            {blockedTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onRemove={() => removeBlockedTag(tag)}
                colors={colors}
                variant="blocked"
              />
            ))}
            <AddItemInput
              placeholder="Add blocked tag..."
              onAdd={addBlockedTag}
              colors={colors}
            />
          </View>
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { borderColor: colors.border }]}>
          <Text style={[styles.tipsTitle, { color: colors.textSecondary }]}>Tips</Text>
          <Text style={[styles.tipText, { color: colors.textTertiary }]}>
            • Age categories: Children's → Teens → Young Adult → Adult
          </Text>
          <Text style={[styles.tipText, { color: colors.textTertiary }]}>
            • Content ratings: G → PG → PG-13 → R
          </Text>
          <Text style={[styles.tipText, { color: colors.textTertiary }]}>
            • Both filters apply independently - book must pass both if enabled
          </Text>
          <Text style={[styles.tipText, { color: colors.textTertiary }]}>
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
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(243,182,12,0.15)' }]}>
                <Lock size={scale(32)} color={ACCENT} strokeWidth={2} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {getPinModalTitle()}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textTertiary }]}>
                {getPinModalSubtitle()}
              </Text>
            </View>

            {/* PIN Input */}
            <PinInput
              value={
                pinModalMode === 'set' && isConfirmStep
                  ? confirmPinValue
                  : pinModalMode === 'change' && isConfirmStep
                    ? (pinValue.length === 4 ? confirmPinValue : pinValue)
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
                // Clear error when typing
                if (pinError) setPinError(null);
              }}
              length={4}
              secure
              autoFocus
              disabled={lockoutSeconds > 0}
              error={!!pinError}
            />

            {/* Error Message */}
            {pinError && (
              <Text style={styles.pinErrorText}>{pinError}</Text>
            )}

            {/* Confirm step indicator for set/change */}
            {(pinModalMode === 'set' || pinModalMode === 'change') && isConfirmStep && pinModalMode === 'change' && pinValue.length === 4 && (
              <Text style={[styles.confirmHint, { color: colors.textTertiary }]}>
                Confirm your new PIN
              </Text>
            )}

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closePinModal}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: 'rgba(255,255,255,0.6)' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              {(pinModalMode === 'set' || (pinModalMode === 'change' && isConfirmStep)) && (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalConfirmButton,
                    { backgroundColor: ACCENT },
                    (pinModalMode === 'set' && !isConfirmStep && pinValue.length !== 4) && styles.modalButtonDisabled,
                  ]}
                  onPress={handlePinSubmit}
                  activeOpacity={0.7}
                  disabled={pinModalMode === 'set' && !isConfirmStep && pinValue.length !== 4}
                >
                  <Text style={[styles.modalButtonText, { color: '#000' }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.headlineLarge,
    flex: 1,
    fontWeight: fontWeight.bold,
    marginLeft: spacing.xs,
  },
  resetButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: scale(12),
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  masterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  masterToggleContent: {
    flex: 1,
  },
  masterToggleLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
  },
  masterToggleNote: {
    ...typography.bodyMedium,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: scale(10),
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.bodyMedium,
    flex: 1,
    lineHeight: scale(18),
  },
  sectionHeaderContainer: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeader: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: scale(16),
    borderWidth: 1,
    gap: spacing.xs,
  },
  chipText: {
    ...typography.bodyMedium,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: scale(16),
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  addButtonText: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.medium,
  },
  addInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(16),
    borderWidth: 1,
    paddingLeft: spacing.sm,
    minWidth: scale(150),
  },
  addInput: {
    ...typography.bodyMedium,
    flex: 1,
    paddingVertical: spacing.xs,
  },
  addInputButton: {
    padding: spacing.xs,
  },
  tipsCard: {
    padding: spacing.md,
    borderRadius: scale(10),
    borderWidth: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  tipsTitle: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.bodySmall,
    lineHeight: scale(18),
    marginBottom: 4,
  },
  // Age category filtering styles
  ageToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageToggleContent: {
    flex: 1,
  },
  ageToggleLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
  },
  ageToggleNote: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  // Category picker styles
  categoryPickerContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  categoryPickerLabel: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  categoryPickerHint: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryOption: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryOptionLabel: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.semibold,
  },
  // Rating picker styles
  ratingPickerContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  ratingPickerLabel: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  ratingPickerHint: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  ratingOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratingOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
  },
  ratingOptionLabel: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.semibold,
  },
  ratingOptionAge: {
    ...typography.labelSmall,
    marginTop: 2,
  },
  // Sub-section label
  subSectionLabel: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  // PIN Protection styles
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  pinIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  pinRowContent: {
    flex: 1,
  },
  pinRowLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
  },
  pinRowNote: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  pinStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  pinButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  pinActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: scale(8),
    borderWidth: 1,
    gap: spacing.xs,
  },
  pinActionButtonText: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
  },
  // PIN Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: scale(340),
    borderRadius: scale(24),
    paddingTop: scale(32),
    paddingBottom: scale(24),
    paddingHorizontal: scale(24),
    alignItems: 'center',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIconContainer: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.displaySmall,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    ...typography.bodyLarge,
    textAlign: 'center',
    lineHeight: scale(20),
    opacity: 0.7,
  },
  pinErrorText: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    color: DANGER,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  confirmHint: {
    ...typography.bodyMedium,
    textAlign: 'center',
    marginTop: spacing.sm,
    opacity: 0.6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: scale(28),
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: scale(14),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalConfirmButton: {
    // backgroundColor set inline (ACCENT)
  },
  modalButtonText: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
});
