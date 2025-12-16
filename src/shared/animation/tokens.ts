/**
 * src/shared/animation/tokens.ts
 *
 * Unified Animation & Motion Design System
 *
 * Based on UX research from NNGroup, Material Design, Apple HIG, and Spotify.
 * Motion serves three purposes: feedback, orientation, and delight.
 *
 * Design Philosophy: Motion should feel like the rhythm of music—purposeful
 * pulses, fluid transitions, and natural easing that never overwhelm content.
 */

import { Easing } from 'react-native-reanimated';

// ============================================================================
// DURATION TOKENS
// ============================================================================

/**
 * Duration scale (in milliseconds)
 *
 * Guidelines:
 * - Micro-interaction (toggle, button): 100-150ms
 * - Simple transition (fade, reveal): 150-250ms
 * - Standard navigation: 250-350ms
 * - Complex/full-screen: 350-400ms
 * - Maximum acceptable: 400ms
 */
export const DURATION = {
  // Scale values
  instant: 100,      // Button press feedback, toggles
  fast: 150,         // Icon changes, micro-interactions
  normal: 250,       // Standard transitions, reveals
  moderate: 300,     // Navigation, modal appear
  slow: 400,         // Complex transitions, player expand

  // Semantic aliases
  press: 100,        // Button/icon press feedback
  toggle: 150,       // Toggle switch, checkbox
  fade: 200,         // Fade in/out content
  slide: 250,        // Slide in panel/sheet
  expand: 350,       // Mini player → Full player
  collapse: 300,     // Full player → Mini player (slightly faster)
  navigation: 300,   // Page navigation
} as const;

// ============================================================================
// EASING TOKENS
// ============================================================================

/**
 * Easing curves for natural motion
 *
 * When to use:
 * - decelerate: Elements entering the screen (default choice)
 * - accelerate: Elements leaving the screen
 * - standard: Elements moving within the screen
 * - expressive: Brand moments, celebrations, CD spin-up
 * - bounce: Like button, success states, playful feedback
 * - linear: Progress bars, continuous rotation
 */
export const EASING = {
  // Standard curves (Material Design inspired)
  standard: Easing.bezier(0.4, 0.0, 0.2, 1),     // General purpose
  decelerate: Easing.bezier(0.0, 0.0, 0.2, 1),   // Ease-out (entering)
  accelerate: Easing.bezier(0.4, 0.0, 1, 1),     // Ease-in (exiting)

  // Expressive curves (for brand moments)
  expressive: Easing.bezier(0.4, 0.0, 0.0, 1),   // More dramatic deceleration
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),    // Overshoot bounce

  // Linear (use sparingly - progress bars, rotations)
  linear: Easing.linear,
} as const;

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Spring physics for natural, responsive motion
 *
 * When to use:
 * - responsive: Buttons, toggles, quick feedback
 * - gentle: Modals, sheets, larger elements
 * - bouncy: Celebrations, like button, playful moments
 * - smooth: Player transitions, navigation
 */
export const SPRING = {
  // Responsive spring (buttons, toggles)
  responsive: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },

  // Gentle spring (modals, sheets)
  gentle: {
    damping: 25,
    stiffness: 200,
    mass: 1,
  },

  // Bouncy spring (celebratory moments)
  bouncy: {
    damping: 12,
    stiffness: 180,
    mass: 0.8,
  },

  // Smooth spring (player transitions)
  smooth: {
    damping: 28,
    stiffness: 250,
    mass: 1,
  },

  // Snappy spring (tab indicators, quick snaps)
  snappy: {
    damping: 22,
    stiffness: 280,
    mass: 0.7,
  },
} as const;

// ============================================================================
// ANIMATION SCALE VALUES
// ============================================================================

/**
 * Scale values for press feedback
 */
export const SCALE = {
  buttonPress: 0.96,     // Standard button press
  iconPress: 0.92,       // Smaller icon press
  cardPress: 0.98,       // Card/row press (subtle)
  bounceUp: 1.05,        // Focus/hover bounce up
  bounceMax: 1.2,        // Maximum celebration bounce
} as const;

// ============================================================================
// CD DISC ROTATION
// ============================================================================

/**
 * CD/Vinyl rotation speeds
 *
 * The signature visual element - rotation inspired by vinyl records
 */
export const CD_ROTATION = {
  // Degrees per second at 1x playback speed
  baseSpeed: 6,          // 1 rotation per 60 seconds (subtle, relaxed)

  // Alternative speeds for reference
  vinylSpeed: 33,        // 33 RPM ≈ 1 rotation per 1.8s (classic vinyl)
  energeticSpeed: 12,    // 1 rotation per 30s (more energetic)

  // Buffering oscillation
  bufferingAmplitude: 1.5, // ±1.5 degrees
  bufferingFrequency: 0.009, // Oscillation speed multiplier
} as const;

// ============================================================================
// TIMING CONFIGURATIONS
// ============================================================================

/**
 * Pre-configured timing objects for common animations
 */
export const TIMING = {
  press: {
    duration: DURATION.press,
    easing: EASING.decelerate,
  },
  toggle: {
    duration: DURATION.toggle,
    easing: EASING.standard,
  },
  fade: {
    duration: DURATION.fade,
    easing: EASING.decelerate,
  },
  fadeOut: {
    duration: DURATION.fade,
    easing: EASING.accelerate,
  },
  slide: {
    duration: DURATION.slide,
    easing: EASING.decelerate,
  },
  slideOut: {
    duration: DURATION.collapse,
    easing: EASING.accelerate,
  },
  expand: {
    duration: DURATION.expand,
    easing: EASING.expressive,
  },
  navigation: {
    duration: DURATION.navigation,
    easing: EASING.standard,
  },
} as const;

// ============================================================================
// ANIMATION CATEGORIES
// ============================================================================

/**
 * Animation specifications by category
 * Reference for implementing specific animations
 */
export const ANIMATION_SPECS = {
  // Category 1: Micro-Interactions (100-150ms)
  microInteraction: {
    buttonPress: { scale: SCALE.buttonPress, duration: DURATION.press, easing: EASING.decelerate },
    iconPress: { scale: SCALE.iconPress, duration: DURATION.press, easing: EASING.decelerate },
    toggle: { duration: DURATION.toggle, spring: SPRING.responsive },
    checkbox: { duration: DURATION.toggle, spring: SPRING.bouncy },
  },

  // Category 2: State Changes (150-250ms)
  stateChange: {
    playPause: { duration: 200, easing: EASING.standard },
    likeHeart: { duration: 200, spring: SPRING.bouncy },
    downloadComplete: { duration: DURATION.normal, easing: EASING.decelerate },
    error: { duration: 200, easing: EASING.expressive },
  },

  // Category 3: Reveals & Dismissals (200-350ms)
  reveal: {
    modalAppear: { duration: DURATION.moderate, easing: EASING.decelerate },
    modalDismiss: { duration: DURATION.normal, easing: EASING.accelerate },
    sheetAppear: { duration: DURATION.moderate, spring: SPRING.gentle },
    sheetDismiss: { duration: DURATION.normal, easing: EASING.accelerate },
    toastAppear: { duration: DURATION.normal, easing: EASING.decelerate },
    toastDismiss: { duration: DURATION.fade, easing: EASING.accelerate },
  },

  // Category 4: Navigation (250-350ms)
  navigation: {
    pushScreen: { duration: DURATION.moderate, easing: EASING.standard },
    popScreen: { duration: DURATION.moderate, easing: EASING.standard },
    tabSwitch: { duration: DURATION.normal, easing: EASING.decelerate },
    playerExpand: { duration: DURATION.expand, spring: SPRING.smooth },
    playerCollapse: { duration: DURATION.collapse, spring: SPRING.smooth },
  },

  // Category 5: Continuous & Progress (Linear)
  continuous: {
    cdRotation: { easing: EASING.linear },
    progressBar: { easing: EASING.linear },
    skeletonShimmer: { duration: 1500, easing: EASING.linear },
    loadingSpinner: { duration: 1000, easing: EASING.linear },
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DurationKey = keyof typeof DURATION;
export type EasingKey = keyof typeof EASING;
export type SpringKey = keyof typeof SPRING;
export type ScaleKey = keyof typeof SCALE;
