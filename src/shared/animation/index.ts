/**
 * src/shared/animation/index.ts
 *
 * Unified Animation & Motion Design System
 *
 * Export all animation tokens, hooks, and components.
 *
 * @example
 * // Import tokens
 * import { DURATION, EASING, SPRING, SCALE } from '@/shared/animation';
 *
 * // Import hooks
 * import { useReduceMotion, usePressAnimation } from '@/shared/animation';
 *
 * // Import components
 * import { AnimatedPressable } from '@/shared/animation';
 */

// Tokens
export {
  DURATION,
  EASING,
  SPRING,
  SCALE,
  CD_ROTATION,
  TIMING,
  ANIMATION_SPECS,
  type DurationKey,
  type EasingKey,
  type SpringKey,
  type ScaleKey,
} from './tokens';

// Hooks
export {
  useReduceMotion,
  useAccessibleAnimation,
  usePressAnimation,
  useBounceAnimation,
  useFadeAnimation,
  useSlideAnimation,
} from './hooks';

// Components
export {
  AnimatedPressable,
  AnimatedIconPressable,
  AnimatedCardPressable,
} from './AnimatedPressable';
