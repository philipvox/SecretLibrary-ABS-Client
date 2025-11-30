/**
 * src/shared/components/AnimatedComponents.tsx
 *
 * Reusable animated components using react-native-reanimated
 * for smooth 60fps animations on the UI thread.
 */

import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
  Layout,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// ANIMATED ENTER/EXIT
// ============================================================================

interface AnimatedEnterProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

/**
 * Fade in from bottom with spring
 */
export function FadeInUp({ children, delay = 0, duration = 300, style }: AnimatedEnterProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 15 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Scale in with bounce
 */
export function ScaleIn({ children, delay = 0, style }: AnimatedEnterProps) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 180 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Staggered list item animation
 */
export function StaggeredItem({
  children,
  index,
  style,
}: {
  children: React.ReactNode;
  index: number;
  style?: ViewStyle;
}) {
  const delay = index * 50; // 50ms stagger
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(300).springify()}
      layout={Layout.springify()}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ============================================================================
// ANIMATED PROGRESS
// ============================================================================

interface AnimatedProgressProps {
  progress: number; // 0-1
  height?: number;
  backgroundColor?: string;
  progressColor?: string;
  style?: ViewStyle;
}

/**
 * Smooth animated progress bar
 */
export function AnimatedProgress({
  progress,
  height = 4,
  backgroundColor = '#E5E5E5',
  progressColor = '#007AFF',
  style,
}: AnimatedProgressProps) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  return (
    <View style={[styles.progressContainer, { height, backgroundColor }, style]}>
      <Animated.View
        style={[
          styles.progressBar,
          { backgroundColor: progressColor },
          progressStyle,
        ]}
      />
    </View>
  );
}

// ============================================================================
// ANIMATED NUMBER
// ============================================================================

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  style?: any;
}

/**
 * Animated counting number
 */
export function AnimatedNumber({
  value,
  duration = 500,
  formatter = (v) => Math.round(v).toString(),
  style,
}: AnimatedNumberProps) {
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = React.useState(formatter(0));

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration });
  }, [value]);

  // Note: In a real implementation, you'd use a worklet callback
  // This is a simplified version
  useEffect(() => {
    const steps = Math.ceil(duration / 16); // ~60fps
    const stepValue = (value - 0) / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current += stepValue;
      if (step >= steps) {
        setDisplayValue(formatter(value));
        clearInterval(interval);
      } else {
        setDisplayValue(formatter(current));
      }
    }, 16);

    return () => clearInterval(interval);
  }, [value, duration, formatter]);

  return (
    <Animated.Text style={style}>{displayValue}</Animated.Text>
  );
}

// ============================================================================
// ANIMATED MODAL
// ============================================================================

interface AnimatedModalProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  position?: 'bottom' | 'center';
}

/**
 * Animated modal with backdrop
 */
export function AnimatedModal({
  visible,
  onClose,
  children,
  position = 'bottom',
}: AnimatedModalProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(position === 'bottom' ? SCREEN_HEIGHT : 50);
  const scale = useSharedValue(position === 'center' ? 0.9 : 1);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20 });
      scale.value = withSpring(1);
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(position === 'bottom' ? SCREEN_HEIGHT : 50);
      scale.value = withTiming(0.9);
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.5,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (!visible && opacity.value === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.modalBackdrop, backdropStyle]}
        onTouchEnd={onClose}
      />
      <Animated.View
        style={[
          styles.modalContent,
          position === 'center' && styles.modalCenter,
          position === 'bottom' && styles.modalBottom,
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ============================================================================
// PULSE ANIMATION
// ============================================================================

interface PulseProps {
  children: React.ReactNode;
  active?: boolean;
  style?: ViewStyle;
}

/**
 * Pulsing animation for attention
 */
export function Pulse({ children, active = true, style }: PulseProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withSequence(
        withTiming(1.05, { duration: 500 }),
        withTiming(1, { duration: 500 })
      );
      // Repeat
      const interval = setInterval(() => {
        scale.value = withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 })
        );
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

// ============================================================================
// LAYOUT ANIMATIONS (for lists)
// ============================================================================

export const layoutAnimations = {
  // Pre-built entering animations
  fadeIn: FadeIn.duration(300),
  fadeInUp: FadeIn.duration(300).springify(),
  slideInRight: SlideInRight.duration(300).springify(),
  zoomIn: ZoomIn.duration(200).springify(),

  // Pre-built exiting animations
  fadeOut: FadeOut.duration(200),
  slideOutLeft: SlideOutLeft.duration(200),

  // Layout animation for reordering
  layout: Layout.springify().damping(15),
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  progressContainer: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -150,
    marginLeft: -SCREEN_WIDTH * 0.4,
    width: SCREEN_WIDTH * 0.8,
  },
  modalBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
});
