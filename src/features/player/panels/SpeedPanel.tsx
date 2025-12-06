/**
 * src/features/player/panels/SpeedPanel.tsx
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Keyboard } from 'react-native';
import { LiquidSlider } from '../components/LiquidSlider';

// =============================================================================
// TYPES
// =============================================================================

interface SpeedPanelProps {
  tempSpeed: number;
  setTempSpeed: (speed: number) => void;
  onApply: () => void;
  onClose: () => void;
  isLight: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 2];
const MIN_SPEED = 0.75;
const MAX_SPEED = 2;
const SPEED_STEP = 0.05;

// =============================================================================
// COMPONENT
// =============================================================================

export function SpeedPanel({
  tempSpeed,
  setTempSpeed,
  onApply,
  onClose,
  isLight,
}: SpeedPanelProps) {
  // NN/g: Precision input state - allows typing exact speed values
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(tempSpeed.toFixed(2));

  const textColor = isLight ? '#000000' : '#FFFFFF';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const buttonBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const activeButtonBg = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const activeButtonText = isLight ? '#FFFFFF' : '#000000';

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleSliderChange = useCallback((value: number) => {
    setTempSpeed(value);
    setInputValue(value.toFixed(2));
  }, [setTempSpeed]);

  const handlePresetPress = useCallback((speed: number) => {
    setTempSpeed(speed);
    setInputValue(speed.toFixed(2));
  }, [setTempSpeed]);

  // NN/g: Handle precision input for exact speed values
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setInputValue(tempSpeed.toFixed(2));
  }, [tempSpeed]);

  const handleInputChange = useCallback((text: string) => {
    // Allow only valid number input
    const cleaned = text.replace(/[^0-9.]/g, '');
    setInputValue(cleaned);
  }, []);

  const handleInputSubmit = useCallback(() => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      // Clamp to valid range
      const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, parsed));
      // Round to nearest step
      const stepped = Math.round(clamped / SPEED_STEP) * SPEED_STEP;
      setTempSpeed(stepped);
      setInputValue(stepped.toFixed(2));
    }
    setIsEditing(false);
    Keyboard.dismiss();
  }, [inputValue, setTempSpeed]);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  const formatSpeed = (speed: number): string => {
    if (Number.isInteger(speed)) return `${speed}x`;
    const formatted = speed.toFixed(2).replace(/\.?0+$/, '');
    return `${formatted}x`;
  };

  const isPresetActive = (preset: number): boolean => {
    return Math.abs(tempSpeed - preset) < 0.01;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <View style={styles.container}>
      {/* NN/g: Speed Value Display - tap to type exact value */}
      {isEditing ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.valueInput, { color: textColor, borderColor: secondaryColor }]}
            value={inputValue}
            onChangeText={handleInputChange}
            onBlur={handleInputSubmit}
            onSubmitEditing={handleInputSubmit}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
          <Text style={[styles.inputSuffix, { color: textColor }]}>x</Text>
        </View>
      ) : (
        <TouchableOpacity onPress={handleStartEdit} style={styles.valueButton}>
          <Text style={[styles.valueText, { color: textColor }]}>
            {formatSpeed(tempSpeed)}
          </Text>
          <Text style={[styles.tapHint, { color: secondaryColor }]}>
            tap to type
          </Text>
        </TouchableOpacity>
      )}

      {/* Slider */}
      <View style={styles.sliderSection}>
        <LiquidSlider
          value={tempSpeed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={SPEED_STEP}
          onValueChange={handleSliderChange}
          isDark={!isLight}
        />
        
        {/* Slider Labels */}
        <View style={styles.sliderLabels}>
          {SPEED_PRESETS.map((preset) => (
            <Text 
              key={preset} 
              style={[styles.sliderLabel, { color: secondaryColor }]}
            >
              {formatSpeed(preset)}
            </Text>
          ))}
        </View>
      </View>

      {/* Preset Buttons */}
      <View style={styles.presetRow}>
        {SPEED_PRESETS.map((preset) => {
          const isActive = isPresetActive(preset);
          return (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetButton,
                { backgroundColor: isActive ? activeButtonBg : buttonBg },
              ]}
              onPress={() => handlePresetPress(preset)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.presetText,
                  { color: isActive ? activeButtonText : textColor },
                ]}
              >
                {formatSpeed(preset)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: buttonBg }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelButtonText, { color: textColor }]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: activeButtonBg }]}
          onPress={onApply}
          activeOpacity={0.7}
        >
          <Text style={[styles.applyButtonText, { color: activeButtonText }]}>
            Apply
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  // NN/g: Tappable value display for precision input
  valueButton: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 64,
    fontWeight: '700',
  },
  tapHint: {
    fontSize: 12,
    marginTop: -4,
    marginLeft: 2,
  },
  // NN/g: Precision input field
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  valueInput: {
    fontSize: 64,
    fontWeight: '700',
    borderBottomWidth: 2,
    minWidth: 120,
    paddingBottom: 4,
  },
  inputSuffix: {
    fontSize: 48,
    fontWeight: '700',
    marginLeft: 4,
    marginBottom: 8,
  },
  sliderSection: {
    marginBottom: 10,
    width: '100%',
    overflow: 'visible',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -15,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
    width: '100%',
  },
  presetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  applyButton: {
    width: 125,
    height: 125,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

export default SpeedPanel;