/**
 * src/shared/animation/hooks.ts
 *
 * Animation hooks and utilities
 *
 * Provides:
 * - useReduceMotion: Detect accessibility preference
 * - useAccessibleAnimation: Animate with reduced motion support
 * - usePressAnimation: Standard press feedback animation
 */

import { useEffect, useState, useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  cancelAnimation,
  SharedValue,
  WithTimingConfig,
  WithSpringConfig,
  runOnJS,
} from 'react-native-reanimated';
import { DURATION, EASING, SPRING, SCALE, TIMING } from './tokens';
import { haptics } from '@/core/native/haptics';

// ============================================================================
// REDUCE MOTION HOOK
// ============================================================================

/**
 * Hook to detect if user has enabled Reduce Motion accessibility setting
 *
 * @returns {boolean} True if reduce motion is enabled
 *
 * @example
 * const reduceMotion = useReduceMotion();
 * if (reduceMotion) {
 *   // Use instant or crossfade animation
 * } else {
 *   // Use full animation
 * }
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Check initial state
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => subscription.remove();
  }, []);

  return reduceMotion;
}

// ============================================================================
// ACCESSIBLE ANIMATION HOOK
// ============================================================================

interface AccessibleAnimationOptions {
  /** Duration for reduced motion (default: 0 for instant) */
  reducedDuration?: number;
  /** Whether to skip animation entirely when reduce motion is on */
  skipWhenReduced?: boolean;
}

/**
 * Hook for animations that respect Reduce Motion setting
 *
 * @returns Object with animate function and reduceMotion state
 *
 * @example
 * const { animate, reduceMotion } = useAccessibleAnimation();
 *
 * const handlePress = () => {
 *   animate(scale, 0.96, { duration: 100 });
 * };
 */
export function useAccessibleAnimation() {
  const reduceMotion = useReduceMotion();

  const animateTiming = useCallback(
    (
      value: SharedValue<number>,
      toValue: number,
      config: WithTimingConfig,
      options?: AccessibleAnimationOptions
    ) => {
      if (reduceMotion) {
        if (options?.skipWhenReduced) {
          return;
        }
        // Instant change or very brief fade
        value.value = withTiming(toValue, {
          duration: options?.reducedDuration ?? 0,
        });
      } else {
        value.value = withTiming(toValue, config);
      }
    },
    [reduceMotion]
  );

  const animateSpring = useCallback(
    (
      value: SharedValue<number>,
      toValue: number,
      config: WithSpringConfig,
      options?: AccessibleAnimationOptions
    ) => {
      if (reduceMotion) {
        if (options?.skipWhenReduced) {
          return;
        }
        // Instant change
        value.value = toValue;
      } else {
        value.value = withSpring(toValue, config);
      }
    },
    [reduceMotion]
  );

  return {
    animateTiming,
    animateSpring,
    reduceMotion,
  };
}

// ============================================================================
// PRESS ANIMATION HOOK
// ============================================================================

interface PressAnimationOptions {
  /** Scale value when pressed (default: 0.96) */
  pressScale?: number;
  /** Duration of press animation (default: 100ms) */
  duration?: number;
  /** Enable haptic feedback (default: true) */
  haptic?: boolean;
  /** Haptic type (default: 'light') */
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection';
}

/**
 * Hook for standard press feedback animation
 *
 * @returns Object with scale value, handlers, and animated style creator
 *
 * @example
 * const { scale, onPressIn, onPressOut, animatedStyle } = usePressAnimation();
 *
 * <Animated.View style={animatedStyle}>
 *   <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
 *     <Button />
 *   </Pressable>
 * </Animated.View>
 */
export function usePressAnimation(options: PressAnimationOptions = {}) {
  const {
    pressScale = SCALE.buttonPress,
    duration = DURATION.press,
    haptic = true,
    hapticType = 'light',
  } = options;

  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (haptic) {
      switch (hapticType) {
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

    if (reduceMotion) {
      scale.value = pressScale;
    } else {
      scale.value = withTiming(pressScale, {
        duration,
        easing: EASING.decelerate,
      });
    }
  }, [reduceMotion, pressScale, duration, haptic, hapticType]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) {
      scale.value = 1;
    } else {
      scale.value = withTiming(1, {
        duration,
        easing: EASING.decelerate,
      });
    }
  }, [reduceMotion, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, []);

  return {
    scale,
    onPressIn,
    onPressOut,
  };
}

// ============================================================================
// BOUNCE ANIMATION HOOK
// ============================================================================

interface BounceAnimationOptions {
  /** Maximum scale during bounce (default: 1.2) */
  maxScale?: number;
  /** Enable haptic feedback (default: true) */
  haptic?: boolean;
}

/**
 * Hook for celebratory bounce animation (like button, achievements)
 *
 * @example
 * const { scale, trigger } = useBounceAnimation();
 *
 * const handleLike = () => {
 *   trigger();
 *   // ... toggle like state
 * };
 */
export function useBounceAnimation(options: BounceAnimationOptions = {}) {
  const { maxScale = SCALE.bounceMax, haptic = true } = options;

  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const trigger = useCallback(() => {
    if (haptic) {
      haptics.success();
    }

    if (reduceMotion) {
      // Simple scale pulse for reduced motion
      scale.value = withSequence(
        withTiming(1.05, { duration: 50 }),
        withTiming(1, { duration: 50 })
      );
    } else {
      // Full bounce animation
      scale.value = withSequence(
        withTiming(0.8, { duration: 100, easing: EASING.accelerate }),
        withSpring(maxScale, SPRING.bouncy),
        withSpring(1, SPRING.responsive)
      );
    }
  }, [reduceMotion, maxScale, haptic]);

  useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, []);

  return {
    scale,
    trigger,
  };
}

// ============================================================================
// FADE ANIMATION HOOK
// ============================================================================

interface FadeAnimationOptions {
  /** Initial opacity (default: 0) */
  initialOpacity?: number;
  /** Duration of fade (default: 200ms) */
  duration?: number;
}

/**
 * Hook for fade in/out animations
 *
 * @example
 * const { opacity, fadeIn, fadeOut } = useFadeAnimation();
 */
export function useFadeAnimation(options: FadeAnimationOptions = {}) {
  const { initialOpacity = 0, duration = DURATION.fade } = options;

  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(initialOpacity);

  const fadeIn = useCallback(() => {
    opacity.value = withTiming(1, {
      duration: reduceMotion ? 50 : duration,
      easing: EASING.decelerate,
    });
  }, [reduceMotion, duration]);

  const fadeOut = useCallback(() => {
    opacity.value = withTiming(0, {
      duration: reduceMotion ? 50 : duration,
      easing: EASING.accelerate,
    });
  }, [reduceMotion, duration]);

  useEffect(() => {
    return () => {
      cancelAnimation(opacity);
    };
  }, []);

  return {
    opacity,
    fadeIn,
    fadeOut,
  };
}

// ============================================================================
// SLIDE ANIMATION HOOK
// ============================================================================

type SlideDirection = 'up' | 'down' | 'left' | 'right';

interface SlideAnimationOptions {
  /** Slide direction (default: 'up') */
  direction?: SlideDirection;
  /** Distance to slide (default: 100) */
  distance?: number;
  /** Duration of slide (default: 250ms) */
  duration?: number;
}

/**
 * Hook for slide in/out animations
 *
 * @example
 * const { translateY, slideIn, slideOut } = useSlideAnimation({ direction: 'up' });
 */
export function useSlideAnimation(options: SlideAnimationOptions = {}) {
  const { direction = 'up', distance = 100, duration = DURATION.slide } = options;

  const reduceMotion = useReduceMotion();

  // Determine which axis to animate
  const isVertical = direction === 'up' || direction === 'down';
  const translateX = useSharedValue(isVertical ? 0 : (direction === 'left' ? -distance : distance));
  const translateY = useSharedValue(isVertical ? (direction === 'up' ? distance : -distance) : 0);
  const opacity = useSharedValue(0);

  const slideIn = useCallback(() => {
    if (reduceMotion) {
      // Just fade for reduced motion
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = withTiming(1, { duration: 100 });
    } else {
      opacity.value = withTiming(1, { duration: duration * 0.6, easing: EASING.decelerate });
      if (isVertical) {
        translateY.value = withSpring(0, SPRING.gentle);
      } else {
        translateX.value = withSpring(0, SPRING.gentle);
      }
    }
  }, [reduceMotion, duration, isVertical]);

  const slideOut = useCallback(() => {
    const targetX = isVertical ? 0 : (direction === 'left' ? -distance : distance);
    const targetY = isVertical ? (direction === 'up' ? distance : -distance) : 0;

    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: 100 });
      translateX.value = targetX;
      translateY.value = targetY;
    } else {
      opacity.value = withTiming(0, { duration: duration * 0.6, easing: EASING.accelerate });
      if (isVertical) {
        translateY.value = withTiming(targetY, { duration, easing: EASING.accelerate });
      } else {
        translateX.value = withTiming(targetX, { duration, easing: EASING.accelerate });
      }
    }
  }, [reduceMotion, duration, isVertical, direction, distance]);

  useEffect(() => {
    return () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(opacity);
    };
  }, []);

  return {
    translateX,
    translateY,
    opacity,
    slideIn,
    slideOut,
  };
}
