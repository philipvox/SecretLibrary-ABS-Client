/**
 * src/shared/animation/AnimatedPressable.tsx
 *
 * Animated Pressable wrapper with built-in press feedback
 *
 * Features:
 * - Automatic scale animation on press
 * - Haptic feedback
 * - Reduce Motion accessibility support
 * - Customizable scale and duration
 */

import React, { useCallback } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { DURATION, EASING, SCALE } from './tokens';
import { useReduceMotion } from './hooks';
import { haptics } from '@/core/native/haptics';

// ============================================================================
// TYPES
// ============================================================================

type HapticType = 'none' | 'light' | 'medium' | 'heavy' | 'selection';

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  /** Style for the animated container */
  style?: StyleProp<ViewStyle>;
  /** Scale when pressed (default: 0.96) */
  pressScale?: number;
  /** Duration of press animation in ms (default: 100) */
  pressDuration?: number;
  /** Haptic feedback type (default: 'light') */
  haptic?: HapticType;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Children to render */
  children: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable component with built-in scale animation and haptic feedback
 *
 * @example
 * <AnimatedPressable onPress={handlePress} pressScale={0.97}>
 *   <MyButton />
 * </AnimatedPressable>
 *
 * @example
 * // Card press with subtle scale
 * <AnimatedPressable
 *   onPress={handleCardPress}
 *   pressScale={0.98}
 *   haptic="selection"
 * >
 *   <Card />
 * </AnimatedPressable>
 *
 * @example
 * // Icon button with smaller scale
 * <AnimatedPressable
 *   onPress={handleIconPress}
 *   pressScale={0.92}
 *   haptic="medium"
 * >
 *   <Icon />
 * </AnimatedPressable>
 */
export function AnimatedPressable({
  style,
  pressScale = SCALE.buttonPress,
  pressDuration = DURATION.press,
  haptic = 'light',
  disabled = false,
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...rest
}: AnimatedPressableProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (event: any) => {
      // Trigger haptic feedback
      if (haptic !== 'none' && !disabled) {
        switch (haptic) {
          case 'light':
            haptics.buttonPress();
            break;
          case 'medium':
            haptics.impact('medium');
            break;
          case 'heavy':
            haptics.impact('heavy');
            break;
          case 'selection':
            haptics.selection();
            break;
        }
      }

      // Animate scale
      if (reduceMotion) {
        scale.value = pressScale;
      } else {
        scale.value = withTiming(pressScale, {
          duration: pressDuration,
          easing: EASING.decelerate,
        });
      }

      // Call original handler
      onPressIn?.(event);
    },
    [reduceMotion, pressScale, pressDuration, haptic, disabled, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: any) => {
      // Return to normal scale
      if (reduceMotion) {
        scale.value = 1;
      } else {
        scale.value = withTiming(1, {
          duration: pressDuration,
          easing: EASING.decelerate,
        });
      }

      // Call original handler
      onPressOut?.(event);
    },
    [reduceMotion, pressDuration, onPressOut]
  );

  // Cleanup animation on unmount
  React.useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, []);

  return (
    <AnimatedPressableComponent
      {...rest}
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      {children}
    </AnimatedPressableComponent>
  );
}

// ============================================================================
// PRESET VARIANTS
// ============================================================================

/**
 * Animated pressable optimized for icon buttons
 */
export function AnimatedIconPressable(
  props: Omit<AnimatedPressableProps, 'pressScale' | 'haptic'>
) {
  return (
    <AnimatedPressable
      {...props}
      pressScale={SCALE.iconPress}
      haptic="light"
    />
  );
}

/**
 * Animated pressable optimized for cards/rows
 */
export function AnimatedCardPressable(
  props: Omit<AnimatedPressableProps, 'pressScale' | 'haptic'>
) {
  return (
    <AnimatedPressable
      {...props}
      pressScale={SCALE.cardPress}
      haptic="selection"
    />
  );
}

export default AnimatedPressable;
