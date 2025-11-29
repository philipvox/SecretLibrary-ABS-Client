/**
 * src/features/player/components/LiquidSlider.tsx
 * 
 * Cross-platform liquid glass slider that recreates the Apple aesthetic
 * without relying on complex SVG tiling.
 * 
 * Architecture:
 * - Single rounded rect track with layered effects
 * - Native shadows + gradients for the liquid look
 * - Gesture handler for smooth cross-platform touch
 */

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  clamp,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  G,
} from 'react-native-svg';

// =============================================================================
// CONSTANTS
// =============================================================================

const THUMB_WIDTH = 72;
const THUMB_HEIGHT = 48;
const TRACK_HEIGHT = THUMB_HEIGHT;
const TRACK_BORDER_RADIUS = TRACK_HEIGHT / 2;
const THUMB_BORDER_RADIUS = (THUMB_HEIGHT - 8) / 2;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

// =============================================================================
// TYPES
// =============================================================================

interface LiquidSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  isDark?: boolean;
  disabled?: boolean;
  width?: number;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Track background with liquid glass effect
 * Recreates the layered look from the SVGs using native gradients
 */
function TrackBackground({ 
  width, 
  height, 
  isDark 
}: { 
  width: number; 
  height: number; 
  isDark: boolean;
}) {
  const trackBg = isDark 
    ? 'rgba(255,255,255,0.12)' 
    : 'rgba(0,0,0,0.08)';
  
  return (
    <View style={[styles.trackContainer, { width, height }]}>
      {/* Base track fill */}
      <View 
        style={[
          styles.trackBase, 
          { 
            backgroundColor: trackBg,
            borderRadius: height / 2,
          }
        ]} 
      />
      
      {/* Gradient overlay for liquid sheen */}
      <Svg 
        width={width} 
        height={height} 
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Top-left highlight (simulates light reflection) */}
          <RadialGradient
            id="topHighlight"
            cx="0.3"
            cy="0"
            rx="0.5"
            ry="1"
          >
            <Stop offset="0" stopColor="white" stopOpacity={isDark ? 0.08 : 0.15} />
            <Stop offset="1" stopColor="white" stopOpacity="0" />
          </RadialGradient>
          
          {/* Bottom-right subtle glow */}
          <LinearGradient
            id="bottomGlow"
            x1="1"
            y1="1"
            x2="0.5"
            y2="0.3"
          >
            <Stop offset="0" stopColor="white" stopOpacity={isDark ? 0.04 : 0.08} />
            <Stop offset="1" stopColor="white" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        
        <G>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={height / 2}
            ry={height / 2}
            fill="url(#topHighlight)"
          />
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={height / 2}
            ry={height / 2}
            fill="url(#bottomGlow)"
          />
        </G>
      </Svg>
      
      {/* Inner shadow effect (inset appearance) */}
      <View 
        style={[
          styles.trackInnerShadow, 
          { 
            borderRadius: height / 2,
            shadowColor: isDark ? '#000' : '#000',
            shadowOpacity: isDark ? 0.4 : 0.15,
          }
        ]} 
      />
    </View>
  );
}

/**
 * Thumb component with liquid glass pill styling
 */
function ThumbPill({ isDark }: { isDark: boolean }) {
  const bgColor = isDark 
    ? 'rgba(60,60,60,0.95)' 
    : 'rgba(255,255,255,0.98)';
  
  const innerBarColor = isDark
    ? 'rgba(255,255,255,0.3)'
    : 'rgba(0,0,0,0.15)';
    
  const shadowColor = isDark ? '#000' : '#000';
  const shadowOpacity = isDark ? 0.5 : 0.2;

  return (
    <View
      style={[
        styles.thumb,
        {
          backgroundColor: bgColor,
          shadowColor,
          shadowOpacity,
        },
      ]}
    >
      {/* Inner grip bar */}
      <View style={[styles.thumbGrip, { backgroundColor: innerBarColor }]} />
      
      {/* Top highlight for 3D effect */}
      <View style={[styles.thumbHighlight, { opacity: isDark ? 0.1 : 0.5 }]} />
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LiquidSlider({
  value,
  min,
  max,
  step = 0.05,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  isDark = false,
  disabled = false,
  width: propWidth,
}: LiquidSliderProps) {
  // Layout state
  const trackWidth = useSharedValue(propWidth ?? 300);
  const maxTranslateX = useSharedValue((propWidth ?? 300) - THUMB_WIDTH);
  
  // Gesture state
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const valueToPosition = useCallback((val: number, width: number): number => {
    'worklet';
    const range = max - min;
    const normalized = (val - min) / range;
    const maxX = width - THUMB_WIDTH;
    return normalized * maxX;
  }, [min, max]);

  const positionToValue = useCallback((pos: number, width: number): number => {
    'worklet';
    const maxX = width - THUMB_WIDTH;
    const normalized = pos / maxX;
    const range = max - min;
    const raw = min + normalized * range;
    // Snap to step
    const stepped = Math.round(raw / step) * step;
    // Clamp to range
    return Math.min(max, Math.max(min, stepped));
  }, [min, max, step]);

  // ==========================================================================
  // SYNC VALUE -> POSITION
  // ==========================================================================

  useEffect(() => {
    const pos = valueToPosition(value, trackWidth.value);
    translateX.value = withSpring(pos, SPRING_CONFIG);
  }, [value, trackWidth.value]);

  // ==========================================================================
  // LAYOUT
  // ==========================================================================

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const newWidth = e.nativeEvent.layout.width;
    trackWidth.value = newWidth;
    maxTranslateX.value = newWidth - THUMB_WIDTH;
    // Update position for current value
    translateX.value = valueToPosition(value, newWidth);
  }, [value, valueToPosition]);

  // ==========================================================================
  // GESTURES
  // ==========================================================================

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      isDragging.value = true;
      startX.value = translateX.value;
      if (onSlidingStart) {
        runOnJS(onSlidingStart)();
      }
    })
    .onUpdate((event) => {
      const newX = clamp(
        startX.value + event.translationX,
        0,
        maxTranslateX.value
      );
      translateX.value = newX;
      
      const newValue = positionToValue(newX, trackWidth.value);
      runOnJS(onValueChange)(newValue);
    })
    .onEnd(() => {
      isDragging.value = false;
      const finalValue = positionToValue(translateX.value, trackWidth.value);
      // Snap to final position
      translateX.value = withSpring(
        valueToPosition(finalValue, trackWidth.value),
        SPRING_CONFIG
      );
      if (onSlidingComplete) {
        runOnJS(onSlidingComplete)(finalValue);
      }
    });

  // Tap gesture for direct positioning
  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((event) => {
      const tapX = event.x - THUMB_WIDTH / 2;
      const clampedX = clamp(tapX, 0, maxTranslateX.value);
      
      if (onSlidingStart) {
        runOnJS(onSlidingStart)();
      }
      
      translateX.value = withSpring(clampedX, SPRING_CONFIG);
      const newValue = positionToValue(clampedX, trackWidth.value);
      runOnJS(onValueChange)(newValue);
      
      if (onSlidingComplete) {
        runOnJS(onSlidingComplete)(newValue);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // ==========================================================================
  // ANIMATED STYLES
  // ==========================================================================

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const thumbScaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: isDragging.value ? 1.05 : 1 },
    ],
  }));

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View 
      style={[styles.container, propWidth ? { width: propWidth } : undefined]}
      onLayout={propWidth ? undefined : handleLayout}
    >
      <GestureDetector gesture={composedGesture}>
        <View style={styles.touchArea}>
          {/* Track background */}
          <TrackBackground 
            width={propWidth ?? trackWidth.value} 
            height={TRACK_HEIGHT} 
            isDark={isDark} 
          />
          
          {/* Animated thumb */}
          <Animated.View style={[styles.thumbContainer, thumbAnimatedStyle]}>
            <Animated.View style={thumbScaleStyle}>
              <ThumbPill isDark={isDark} />
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    height: TRACK_HEIGHT + 16, // Extra padding for touch
    justifyContent: 'center',
  },
  touchArea: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  trackContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  trackBase: {
    ...StyleSheet.absoluteFillObject,
  },
  trackInnerShadow: {
    ...StyleSheet.absoluteFillObject,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    // Note: Inner shadows aren't native in RN, this creates a subtle top shadow
    // For true inner shadow, would need additional overlays
  },
  thumbContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT - 8,
    borderRadius: THUMB_BORDER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  thumbGrip: {
    width: THUMB_WIDTH - 24,
    height: 4,
    borderRadius: 2,
  },
  thumbHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'white',
    borderTopLeftRadius: THUMB_BORDER_RADIUS,
    borderTopRightRadius: THUMB_BORDER_RADIUS,
  },
});

export default LiquidSlider;