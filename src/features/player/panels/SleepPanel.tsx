/**
 * src/features/player/panels/SleepPanel.tsx
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LiquidSlider } from '../components/LiquidSlider';

// =============================================================================
// TYPES
// =============================================================================

interface SleepPanelProps {
  tempSleepMins: number;
  setTempSleepMins: (mins: number) => void;
  sleepInputValue: string;
  setSleepInputValue: (val: string) => void;
  onClear: () => void;
  onStart: () => void;
  isLight: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SLEEP_PRESETS = [15, 30, 45, 60, 90];
const MIN_MINUTES = 0;
const MAX_MINUTES = 120;
const MINUTE_STEP = 5;

// =============================================================================
// COMPONENT
// =============================================================================

export function SleepPanel({
  tempSleepMins,
  setTempSleepMins,
  sleepInputValue,
  setSleepInputValue,
  onClear,
  onStart,
  isLight,
}: SleepPanelProps) {
  const textColor = isLight ? '#000000' : '#FFFFFF';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const buttonBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const activeButtonBg = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const activeButtonText = isLight ? '#FFFFFF' : '#000000';

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleSliderChange = useCallback((value: number) => {
    const rounded = Math.round(value);
    setTempSleepMins(rounded);
    setSleepInputValue(String(rounded));
  }, [setTempSleepMins, setSleepInputValue]);

  const handlePresetPress = useCallback((minutes: number) => {
    setTempSleepMins(minutes);
    setSleepInputValue(String(minutes));
  }, [setTempSleepMins, setSleepInputValue]);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  const formatMinutes = (mins: number): string => {
    if (mins === 0) return 'Off';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    if (remaining === 0) return `${hours}h`;
    return `${hours}h ${remaining}m`;
  };

  const formatPreset = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const hours = mins / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${mins}m`;
  };

  const isPresetActive = (preset: number): boolean => {
    return tempSleepMins === preset;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <View style={styles.container}>
      {/* Time Value Display */}
      <Text style={[styles.valueText, { color: textColor }]}>
        {formatMinutes(tempSleepMins)}
      </Text>

      {/* Slider */}
      <View style={styles.sliderSection}>
        <LiquidSlider
          value={tempSleepMins}
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={MINUTE_STEP}
          onValueChange={handleSliderChange}
          isDark={!isLight}
        />
        
        {/* Slider Labels */}
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderLabel, { color: secondaryColor }]}>Off</Text>
          <Text style={[styles.sliderLabel, { color: secondaryColor }]}>30m</Text>
          <Text style={[styles.sliderLabel, { color: secondaryColor }]}>1h</Text>
          <Text style={[styles.sliderLabel, { color: secondaryColor }]}>1.5h</Text>
          <Text style={[styles.sliderLabel, { color: secondaryColor }]}>2h</Text>
        </View>
      </View>

      {/* Preset Buttons */}
      <View style={styles.presetRow}>
        {SLEEP_PRESETS.map((preset) => {
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
                {formatPreset(preset)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: buttonBg }]}
          onPress={onClear}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelButtonText, { color: textColor }]}>
            Off
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: activeButtonBg }]}
          onPress={onStart}
          activeOpacity={0.7}
        >
          <Text style={[styles.applyButtonText, { color: activeButtonText }]}>
            Start
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
  valueText: {
    fontSize: 64,
    fontWeight: '700',
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

export default SleepPanel;