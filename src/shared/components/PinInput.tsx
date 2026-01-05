/**
 * src/shared/components/PinInput.tsx
 *
 * PIN input component for secure code entry (e.g., Kid Mode PIN).
 * Displays elegant circular dots with smooth visual feedback.
 *
 * Usage:
 *   <PinInput
 *     value={pin}
 *     onChange={setPin}
 *     length={4}
 *     secure
 *   />
 */

import React, { useRef, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { scale, spacing, accentColors } from '@/shared/theme';
import { useThemeColors } from '@/shared/theme';

// ============================================================================
// CONSTANTS
// ============================================================================

const ACCENT = accentColors.gold;
const DOT_SIZE = scale(18);
const CELL_SIZE = scale(56);
const ERROR_COLOR = '#FF3B30';

// ============================================================================
// TYPES
// ============================================================================

export interface PinInputProps {
  /** Current PIN value */
  value: string;
  /** Called when PIN changes */
  onChange: (value: string) => void;
  /** Number of digits (default: 4) */
  length?: number;
  /** Hide digits with dots (default: true) */
  secure?: boolean;
  /** Auto-focus on mount (default: true) */
  autoFocus?: boolean;
  /** Disable input */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PinInput: React.FC<PinInputProps> = ({
  value,
  onChange,
  length = 4,
  secure = true,
  autoFocus = true,
  disabled = false,
  error = false,
}) => {
  const themeColors = useThemeColors();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus && !disabled) {
      // Small delay to ensure keyboard opens reliably
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const handlePress = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const handleChange = (text: string) => {
    // Only allow digits, limit to length
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      {/* Hidden input for keyboard */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        editable={!disabled}
        autoComplete="off"
        textContentType="oneTimeCode"
        caretHidden
        selectTextOnFocus={false}
      />

      {/* Visual dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length }).map((_, index) => {
          const isFilled = index < value.length;
          const isActive = index === value.length && !disabled;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  backgroundColor: error
                    ? 'rgba(255,59,48,0.08)'
                    : isFilled
                      ? 'rgba(243,182,12,0.12)'
                      : themeColors.border,
                },
                isActive && styles.cellActive,
                disabled && styles.cellDisabled,
              ]}
            >
              {isFilled ? (
                secure ? (
                  <View
                    style={[
                      styles.filledDot,
                      { backgroundColor: error ? ERROR_COLOR : ACCENT },
                    ]}
                  />
                ) : (
                  <Text style={[styles.digitText, { color: themeColors.text }]}>
                    {value[index]}
                  </Text>
                )
              ) : (
                <View
                  style={[
                    styles.emptyDot,
                    {
                      backgroundColor: error
                        ? 'rgba(255,59,48,0.3)'
                        : isActive
                          ? ACCENT
                          : 'rgba(255,255,255,0.2)',
                    },
                    isActive && styles.emptyDotActive,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellActive: {
    // Active cell styling handled by inner dot
  },
  cellDisabled: {
    opacity: 0.4,
  },
  filledDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  emptyDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  emptyDotActive: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
  },
  digitText: {
    fontSize: scale(24),
    fontWeight: '700',
  },
});

export default PinInput;
