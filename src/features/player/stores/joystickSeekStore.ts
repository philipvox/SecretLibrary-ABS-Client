/**
 * src/features/player/stores/joystickSeekStore.ts
 *
 * Store for joystick-style seek control settings.
 * Allows users to customize seek speed range, response curve, and feedback.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type CurvePreset = 'fine' | 'swift' | 'even' | 'rush' | 'custom';

export interface JoystickSeekSettings {
  /** Whether joystick seek is enabled */
  enabled: boolean;
  /** Minimum seek speed multiplier (0.1-30, default: 1) */
  minSpeed: number;
  /** Maximum seek speed multiplier (30-600, default: 300) */
  maxSpeed: number;
  /** Response curve preset */
  curvePreset: CurvePreset;
  /** Curve exponent (0.2-2.0, default: 0.65) */
  curveExponent: number;
  /** Deadzone in points before seeking starts (0-30, default: 12) */
  deadzone: number;
  /** Whether haptic feedback is enabled during seeking */
  hapticEnabled: boolean;
}

interface JoystickSeekState extends JoystickSeekSettings {
  // Actions
  setEnabled: (enabled: boolean) => void;
  setMinSpeed: (speed: number) => void;
  setMaxSpeed: (speed: number) => void;
  setCurvePreset: (preset: CurvePreset) => void;
  setCurveExponent: (exponent: number) => void;
  setDeadzone: (deadzone: number) => void;
  setHapticEnabled: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Curve preset exponent mappings
 * - fine (1.5): Expo curve - slow start, more precision, then accelerates
 * - swift (0.65): Balanced response
 * - even (1.0): Linear - constant rate of acceleration
 * - rush (0.4): Log curve - quick to reach high speeds
 */
export const CURVE_PRESETS: Record<Exclude<CurvePreset, 'custom'>, number> = {
  fine: 1.5,    // Expo - precision at low drag, accelerates later
  swift: 0.65,  // Balanced
  even: 1.0,    // Linear
  rush: 0.4,    // Log - quick to high speeds
};

/** Default settings */
const DEFAULT_SETTINGS: JoystickSeekSettings = {
  enabled: true,
  minSpeed: 1,
  maxSpeed: 300,
  curvePreset: 'fine',
  curveExponent: 1.5,
  deadzone: 12,
  hapticEnabled: true,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the preset name from an exponent value, or 'custom' if no match
 */
export function getPresetFromExponent(exponent: number): CurvePreset {
  for (const [preset, value] of Object.entries(CURVE_PRESETS)) {
    if (Math.abs(exponent - value) < 0.01) {
      return preset as CurvePreset;
    }
  }
  return 'custom';
}

/**
 * Calculate seek speed based on normalized drag distance and settings
 *
 * @param dragDistance - Normalized drag distance (0-1, after deadzone)
 * @param settings - Current joystick seek settings
 * @returns Seek speed multiplier (e.g., 60 = 60 seconds per second of drag)
 *
 * @example
 * // With balanced curve (exponent 0.65) and default speeds:
 * calculateSeekSpeed(0.0, settings)  // → 5× (min)
 * calculateSeekSpeed(0.25, settings) // → ~38×
 * calculateSeekSpeed(0.5, settings)  // → ~98×
 * calculateSeekSpeed(0.75, settings) // → ~175×
 * calculateSeekSpeed(1.0, settings)  // → 300× (max)
 */
export function calculateSeekSpeed(
  dragDistance: number,
  settings: JoystickSeekSettings
): number {
  // Clamp input to 0-1
  const clampedDistance = Math.max(0, Math.min(1, dragDistance));

  // Apply curve: output = input ^ exponent
  const curvedDistance = Math.pow(clampedDistance, settings.curveExponent);

  // Map to speed range
  const speedRange = settings.maxSpeed - settings.minSpeed;
  const speed = settings.minSpeed + curvedDistance * speedRange;

  // Round to 1 decimal for sub-1x, otherwise whole numbers
  if (speed < 1) {
    return Math.round(speed * 10) / 10;
  }
  return Math.round(speed);
}

/**
 * Apply deadzone to raw displacement
 *
 * @param displacement - Raw displacement in points
 * @param maxDisplacement - Maximum displacement to consider
 * @param deadzone - Deadzone in points
 * @returns Normalized distance (0-1) after deadzone, or 0 if in deadzone
 */
export function applyDeadzone(
  displacement: number,
  maxDisplacement: number,
  deadzone: number
): number {
  const absDisplacement = Math.abs(displacement);

  if (absDisplacement <= deadzone) {
    return 0;
  }

  // Normalize remaining range to 0-1
  const effectiveRange = maxDisplacement - deadzone;
  const effectiveDisplacement = absDisplacement - deadzone;

  return Math.min(1, effectiveDisplacement / effectiveRange);
}

/**
 * Format speed multiplier as human-readable string
 *
 * @param speed - Speed multiplier (e.g., 60 = 60 seconds per second)
 * @returns Formatted string (e.g., "1 minute per second", "5 minutes per second")
 */
export function formatSpeedLabel(speed: number): string {
  if (speed < 1) {
    return `${(speed * 100).toFixed(0)}% speed (slow motion)`;
  }
  if (speed < 60) {
    return `${Math.round(speed)} seconds per second`;
  }
  const minutes = Math.round(speed / 60);
  if (minutes === 1) {
    return '1 minute per second';
  }
  return `${minutes} minutes per second`;
}

/**
 * Format speed as short label
 *
 * @param speed - Speed multiplier
 * @returns Short format (e.g., "0.5×", "5×", "60×", "300×")
 */
export function formatSpeedShort(speed: number): string {
  if (speed < 1) {
    return `${speed.toFixed(1)}×`;
  }
  return `${Math.round(speed)}×`;
}

// ============================================================================
// STORE
// ============================================================================

export const useJoystickSeekStore = create<JoystickSeekState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setEnabled: (enabled) => set({ enabled }),

      setMinSpeed: (speed) => {
        const { maxSpeed } = get();
        // Ensure min doesn't exceed max
        const validSpeed = Math.min(speed, maxSpeed - 1);
        set({ minSpeed: Math.max(0.1, validSpeed) });
      },

      setMaxSpeed: (speed) => {
        const { minSpeed } = get();
        // Ensure max doesn't go below min
        const validSpeed = Math.max(speed, minSpeed + 1);
        set({ maxSpeed: Math.min(600, validSpeed) });
      },

      setCurvePreset: (preset) => {
        if (preset === 'custom') {
          set({ curvePreset: 'custom' });
        } else {
          const exponent = CURVE_PRESETS[preset];
          set({ curvePreset: preset, curveExponent: exponent });
        }
      },

      setCurveExponent: (exponent) => {
        const clampedExponent = Math.max(0.2, Math.min(2.0, exponent));
        const preset = getPresetFromExponent(clampedExponent);
        set({ curveExponent: clampedExponent, curvePreset: preset });
      },

      setDeadzone: (deadzone) => {
        set({ deadzone: Math.max(0, Math.min(30, deadzone)) });
      },

      setHapticEnabled: (enabled) => set({ hapticEnabled: enabled }),

      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'joystick-seek-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Get all settings as a plain object (for passing to calculateSeekSpeed) */
export const useJoystickSeekSettings = () =>
  useJoystickSeekStore(
    useShallow((s) => ({
      enabled: s.enabled,
      minSpeed: s.minSpeed,
      maxSpeed: s.maxSpeed,
      curvePreset: s.curvePreset,
      curveExponent: s.curveExponent,
      deadzone: s.deadzone,
      hapticEnabled: s.hapticEnabled,
    }))
  );
