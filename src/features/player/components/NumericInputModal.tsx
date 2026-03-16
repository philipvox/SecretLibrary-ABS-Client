/**
 * src/features/player/components/NumericInputModal.tsx
 *
 * Shared numeric input modal with custom keypad.
 * Used for manual speed and sleep timer entry.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { X, Delete } from 'lucide-react-native';
import { haptics } from '@/core/native/haptics';
import { spacing, scale, useTheme } from '@/shared/theme';

// =============================================================================
// TYPES
// =============================================================================

interface NumericInputModalProps {
  visible: boolean;
  title: string;
  suffix?: string;
  mode: 'speed' | 'time';
  min?: number;
  max?: number;
  decimals?: number;
  presets?: { label: string; value: number }[];
  showOffButton?: boolean;
  onApply: (value: number | null) => void;
  onCancel: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const KEYPAD_LAYOUT = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

// =============================================================================
// COMPONENT
// =============================================================================

export function NumericInputModal({
  visible,
  title,
  suffix = '',
  mode,
  min = 0,
  max = 999,
  decimals = 2,
  presets,
  showOffButton = false,
  onApply,
  onCancel,
}: NumericInputModalProps) {
  const { colors } = useTheme();

  // For speed mode: single value string
  // For time mode: hours and minutes
  const [inputValue, setInputValue] = useState('');
  const [hoursValue, setHoursValue] = useState('');
  const [minutesValue, setMinutesValue] = useState('');
  const [activeField, setActiveField] = useState<'hours' | 'minutes'>('minutes');
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setInputValue('');
      setHoursValue('');
      setMinutesValue('');
      setActiveField('minutes');
      setError(null);
    }
  }, [visible]);

  // Handle key press
  const handleKeyPress = useCallback((key: string) => {
    haptics.selection();
    setError(null);

    if (mode === 'speed') {
      if (key === '.') {
        if (!inputValue.includes('.')) {
          setInputValue(prev => prev === '' ? '0.' : prev + '.');
        }
      } else if (key === 'delete') {
        setInputValue(prev => prev.slice(0, -1));
      } else {
        // Check decimal places
        const parts = inputValue.split('.');
        if (parts[1] && parts[1].length >= decimals) return;
        setInputValue(prev => prev + key);
      }
    } else {
      // Time mode
      if (key === 'delete') {
        if (activeField === 'hours') {
          setHoursValue(prev => prev.slice(0, -1));
        } else {
          setMinutesValue(prev => prev.slice(0, -1));
        }
      } else if (key !== '.') {
        if (activeField === 'hours') {
          if (hoursValue.length < 2) {
            setHoursValue(prev => prev + key);
          }
        } else {
          if (minutesValue.length < 2) {
            setMinutesValue(prev => prev + key);
          }
        }
      }
    }
  }, [mode, inputValue, hoursValue, minutesValue, activeField, decimals]);

  // Handle OFF button
  const handleOff = useCallback(() => {
    haptics.impact('medium');
    onApply(null);
  }, [onApply]);

  // Handle preset
  const handlePreset = useCallback((value: number) => {
    haptics.selection();
    if (mode === 'speed') {
      setInputValue(value.toString());
    } else {
      const hours = Math.floor(value / 60);
      const mins = value % 60;
      setHoursValue(hours > 0 ? hours.toString() : '');
      setMinutesValue(mins.toString());
    }
  }, [mode]);

  // Validate and apply
  const handleApply = useCallback(() => {
    let value: number;

    if (mode === 'speed') {
      value = parseFloat(inputValue) || 0;
      if (value < min || value > max) {
        setError(`Range: ${min}x – ${max}x`);
        haptics.error();
        return;
      }
    } else {
      const hours = parseInt(hoursValue) || 0;
      const minutes = parseInt(minutesValue) || 0;
      value = hours * 60 + minutes;
      if (value < min || value > max) {
        setError(`Range: ${min} min – ${Math.floor(max / 60)} hours`);
        haptics.error();
        return;
      }
    }

    haptics.impact('medium');
    onApply(value);
  }, [mode, inputValue, hoursValue, minutesValue, min, max, onApply]);

  // Get display value
  const _displayValue = mode === 'speed'
    ? inputValue || '0'
    : `${hoursValue || '0'}h ${minutesValue || '0'}m`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background.elevated }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <X size={24} color={colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Input Display */}
          {mode === 'speed' ? (
            <View style={styles.inputRow}>
              <View style={[styles.inputBox, { borderColor: colors.border.default }]}>
                <Text style={[styles.inputText, { color: colors.text.primary }]}>
                  {inputValue || '0'}
                </Text>
              </View>
              <Text style={[styles.suffix, { color: colors.text.secondary }]}>{suffix}</Text>
            </View>
          ) : (
            <View style={styles.timeInputRow}>
              <TouchableOpacity
                style={[
                  styles.timeInputBox,
                  { borderColor: activeField === 'hours' ? colors.text.primary : colors.border.default },
                ]}
                onPress={() => setActiveField('hours')}
              >
                <Text style={[styles.inputText, { color: colors.text.primary }]}>
                  {hoursValue.padStart(2, '0') || '00'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.timeSeparator, { color: colors.text.secondary }]}>h</Text>
              <TouchableOpacity
                style={[
                  styles.timeInputBox,
                  { borderColor: activeField === 'minutes' ? colors.text.primary : colors.border.default },
                ]}
                onPress={() => setActiveField('minutes')}
              >
                <Text style={[styles.inputText, { color: colors.text.primary }]}>
                  {minutesValue.padStart(2, '0') || '00'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.timeSeparator, { color: colors.text.secondary }]}>m</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <Text style={[styles.errorText, { color: colors.accent.primary }]}>{error}</Text>
          )}

          {/* Range hint */}
          <Text style={[styles.rangeHint, { color: colors.text.tertiary }]}>
            {mode === 'speed'
              ? `Range: ${min}x – ${max}x`
              : `Range: 1 min – 12 hours`}
          </Text>

          {/* Presets */}
          {presets && presets.length > 0 && (
            <View style={styles.presetsRow}>
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.presetButton, { backgroundColor: colors.border.default }]}
                  onPress={() => handlePreset(preset.value)}
                >
                  <Text style={[styles.presetText, { color: colors.text.primary }]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border.default }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.text.primary }]}
              onPress={handleApply}
            >
              <Text style={[styles.applyButtonText, { color: colors.background.primary }]}>Apply</Text>
            </TouchableOpacity>
          </View>

          {/* Keypad */}
          <View style={styles.keypad}>
            {KEYPAD_LAYOUT.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keypadButton, { backgroundColor: colors.border.default }]}
                    onPress={() => handleKeyPress(key)}
                  >
                    <Text style={[styles.keypadText, { color: colors.text.primary }]}>{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            {/* Bottom row */}
            <View style={styles.keypadRow}>
              {showOffButton ? (
                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.border.default }]}
                  onPress={handleOff}
                >
                  <Text style={[styles.keypadText, { color: colors.text.primary }]}>OFF</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.border.default }]}
                  onPress={() => handleKeyPress('.')}
                >
                  <Text style={[styles.keypadText, { color: colors.text.primary }]}>.</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.keypadButton, { backgroundColor: colors.border.default }]}
                onPress={() => handleKeyPress('0')}
              >
                <Text style={[styles.keypadText, { color: colors.text.primary }]}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keypadButton, { backgroundColor: colors.border.default }]}
                onPress={() => handleKeyPress('delete')}
              >
                <Delete size={24} color={colors.text.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: scale(16),
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: scale(18),
    fontWeight: '600',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  inputBox: {
    borderWidth: 2,
    borderRadius: scale(8),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: scale(120),
    alignItems: 'center',
  },
  inputText: {
    fontSize: scale(32),
    fontWeight: '300',
  },
  suffix: {
    fontSize: scale(24),
    fontWeight: '400',
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  timeInputBox: {
    borderWidth: 2,
    borderRadius: scale(8),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minWidth: scale(70),
    alignItems: 'center',
  },
  timeSeparator: {
    fontSize: scale(20),
    fontWeight: '500',
    marginHorizontal: spacing.xs,
  },
  errorText: {
    fontSize: scale(13),
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  rangeHint: {
    fontSize: scale(12),
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(8),
  },
  presetText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: scale(8),
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
  },
  keypad: {
    gap: spacing.sm,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  keypadButton: {
    width: scale(64),
    height: scale(52),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadText: {
    fontSize: scale(22),
    fontWeight: '500',
  },
});

export default NumericInputModal;
