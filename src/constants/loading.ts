/**
 * src/constants/loading.ts
 *
 * Centralized timing constants for the loading system.
 * All magic numbers related to loading, navigation, and initialization live here.
 */

// =============================================================================
// GLOBAL LOADING OVERLAY
// =============================================================================

/**
 * Minimum time the loading overlay stays visible (ms).
 * Prevents visual jitter from fast operations.
 * User testing suggests 500-800ms feels responsive but not rushed.
 */
export const LOADING_MIN_DISPLAY_MS = 600;

/**
 * Delay between calling show() and triggering navigation (ms).
 * Allows the Modal to render before the navigation transition begins.
 * Too short = loading appears after destination screen.
 * Too long = noticeable delay after button press.
 */
export const LOADING_NAVIGATION_DELAY_MS = 150;

/**
 * Longer delay for screens returning from modals (e.g., MoodDiscovery).
 * Modal dismissal animation needs more time.
 */
export const LOADING_MODAL_RETURN_DELAY_MS = 200;

// =============================================================================
// APP INITIALIZATION
// =============================================================================

/**
 * Maximum time to wait for app initialization before showing error (ms).
 * Prevents infinite splash screen on slow networks or failures.
 * 30 seconds is generous but prevents complete hangs.
 */
export const INIT_GLOBAL_TIMEOUT_MS = 30000;

/**
 * Timeout for individual initialization steps (ms).
 * Non-critical steps can fail without blocking app startup.
 */
export const INIT_STEP_TIMEOUT_MS = 10000;

/**
 * Minimum time splash screen displays (ms).
 * Prevents jarring flash on fast startups.
 */
export const SPLASH_MIN_DISPLAY_MS = 400;

/**
 * Splash fade-out animation duration (ms).
 */
export const SPLASH_FADE_DURATION_MS = 200;

/**
 * Time before showing "taking longer than expected" message (ms).
 * Shows after 8 seconds to reassure user that app is still loading.
 */
export const INIT_SLOW_THRESHOLD_MS = 8000;

/**
 * Time before showing "please check your connection" hint (ms).
 * Shows after 15 seconds - likely a network issue at this point.
 */
export const INIT_VERY_SLOW_THRESHOLD_MS = 15000;

// =============================================================================
// MOOD DISCOVERY
// =============================================================================

/**
 * Duration of scoring overlay animation (ms).
 * Time for progress bar to fill from 0-100%.
 */
export const MOOD_SCORING_DURATION_MS = 1500;

/**
 * Interval for scoring progress updates (ms).
 * 75ms = ~20 updates over 1500ms = smooth animation.
 */
export const MOOD_SCORING_INTERVAL_MS = 75;

/**
 * Auto-advance delay after selecting a mood/flavor (ms).
 * Brief pause before moving to next step.
 */
export const MOOD_AUTO_ADVANCE_DELAY_MS = 300;

// =============================================================================
// ANIMATION DURATIONS
// =============================================================================

/**
 * Standard animation duration for UI transitions (ms).
 */
export const ANIMATION_STANDARD_MS = 200;

/**
 * Candle animation frame rate.
 * 28 frames at 24fps = ~42ms per frame.
 */
export const CANDLE_FRAME_DURATION_MS = 42;
export const CANDLE_TOTAL_FRAMES = 28;

// =============================================================================
// DEBOUNCE & THROTTLE
// =============================================================================

/**
 * Debounce for rapid show/hide calls (ms).
 * Prevents jitter from multiple sources triggering loading.
 */
export const LOADING_DEBOUNCE_MS = 50;
