/**
 * src/features/player/panels/SpeedPanel.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  clamp,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_WIDTH = 58;
const THUMB_HEIGHT = 38;
const TRACK_HEIGHT = THUMB_HEIGHT;
const TRACK_PADDING = 4;

interface SpeedPanelColors {
  text: string;
  textSecondary: string;
  surface: string;
  isDark: boolean;
}

interface SpeedPanelProps {
  currentSpeed?: number;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
  colors?: SpeedPanelColors;
}

const DEFAULT_COLORS: SpeedPanelColors = {
  text: '#000000',
  textSecondary: 'rgba(0,0,0,0.5)',
  surface: '#FFFFFF',
  isDark: false,
};

const SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 2];
const MIN_SPEED = 0.75;
const MAX_SPEED = 2;

function valueToPosition(value: number, trackWidth: number): number {
  'worklet';
  const usableWidth = trackWidth - THUMB_WIDTH;
  const progress = (value - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  return progress * usableWidth;
}

function positionToValue(position: number, trackWidth: number): number {
  'worklet';
  const usableWidth = trackWidth - THUMB_WIDTH;
  const progress = position / usableWidth;
  return MIN_SPEED + progress * (MAX_SPEED - MIN_SPEED);
}

export function SpeedPanel({ 
  currentSpeed = 1, 
  onSpeedChange, 
  onClose, 
  colors = DEFAULT_COLORS 
}: SpeedPanelProps) {
  const [tempSpeed, setTempSpeed] = useState(currentSpeed);
  const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 48);
  
  const translateX = useSharedValue(valueToPosition(currentSpeed, trackWidth));
  const isDragging = useSharedValue(false);
  
  const isLight = !colors.isDark;
  const textColor = colors.text;
  const secondaryColor = colors.textSecondary;
  const buttonBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const activeButtonBg = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const activeButtonText = colors.surface;
  const trackBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const thumbBg = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(40,40,40,0.95)';
  const thumbShadowColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.4)';

  useEffect(() => {
    setTempSpeed(currentSpeed);
    translateX.value = withSpring(valueToPosition(currentSpeed, trackWidth), {
      damping: 20,
      stiffness: 300,
    });
  }, [currentSpeed, trackWidth]);

  const updateSpeed = useCallback((value: number) => {
    const snapped = Math.round(value * 20) / 20;
    setTempSpeed(snapped);
  }, []);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setTrackWidth(width);
    translateX.value = valueToPosition(tempSpeed, width);
  }, [tempSpeed]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      const maxX = trackWidth - THUMB_WIDTH;
      translateX.value = clamp(event.translationX + valueToPosition(tempSpeed, trackWidth), 0, maxX);
      const newValue = positionToValue(translateX.value, trackWidth);
      runOnJS(updateSpeed)(newValue);
    })
    .onEnd(() => {
      isDragging.value = false;
      const currentValue = positionToValue(translateX.value, trackWidth);
      const snapped = Math.round(currentValue * 20) / 20;
      translateX.value = withSpring(valueToPosition(snapped, trackWidth), {
        damping: 20,
        stiffness: 300,
      });
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handlePresetPress = (speed: number) => {
    setTempSpeed(speed);
    translateX.value = withSpring(valueToPosition(speed, trackWidth), {
      damping: 20,
      stiffness: 300,
    });
  };

  const handleApply = () => {
    onSpeedChange(tempSpeed);
    onClose();
  };

  const formatSpeed = (speed: number) => {
    if (Number.isInteger(speed)) return `${speed}x`;
    return `${speed.toFixed(2)}x`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: secondaryColor }]}>PLAYBACK SPEED</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeIcon, { color: secondaryColor }]}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.valueText, { color: textColor }]}>
        {formatSpeed(tempSpeed)}
      </Text>

      <View style={styles.sliderContainer} onLayout={handleTrackLayout}>
        <View style={[styles.track, { backgroundColor: trackBg }]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View 
              style={[
                styles.thumb, 
                thumbStyle,
                { 
                  backgroundColor: thumbBg,
                  shadowColor: thumbShadowColor,
                }
              ]}
            >
              <View style={[styles.thumbInner, { backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)' }]} />
            </Animated.View>
          </GestureDetector>
        </View>
        
        <View style={styles.sliderLabels}>
          {SPEED_PRESETS.map((speed) => (
            <Text key={speed} style={[styles.sliderLabel, { color: secondaryColor }]}>
              {speed}x
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.presetRow}>
        {SPEED_PRESETS.map((speed) => {
          const isActive = Math.abs(tempSpeed - speed) < 0.01;
          return (
            <TouchableOpacity
              key={speed}
              style={[
                styles.presetButton,
                { 
                  backgroundColor: isActive ? activeButtonBg : buttonBg,
                  borderWidth: isActive ? 0 : 1,
                  borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)',
                }
              ]}
              onPress={() => handlePresetPress(speed)}
            >
              <Text style={[
                styles.presetText,
                { color: isActive ? activeButtonText : textColor }
              ]}>
                {speed}x
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.applyContainer}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: buttonBg }]}
          onPress={onClose}
        >
          <Text style={[styles.cancelButtonText, { color: textColor }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: activeButtonBg }]}
          onPress={handleApply}
        >
          <Text style={[styles.applyButtonText, { color: activeButtonText }]}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: -8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '400',
  },
  valueText: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
    marginLeft: -4,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: TRACK_PADDING,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT - 8,
    borderRadius: (THUMB_HEIGHT - 8) / 2,
    marginLeft: TRACK_PADDING,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbInner: {
    width: THUMB_WIDTH - 16,
    height: 4,
    borderRadius: 2,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  presetText: {
    fontSize: 15,
    fontWeight: '600',
  },
  applyContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
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
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});