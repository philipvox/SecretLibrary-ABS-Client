/**
 * src/shared/accessibility/accessibilityUtils.ts
 *
 * Accessibility utilities for building accessible React Native components.
 * Provides helpers for common accessibility patterns following WCAG 2.1 guidelines.
 */

import { AccessibilityRole, AccessibilityState } from 'react-native';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Minimum touch target size (44pt) per Apple HIG and Material Design guidelines
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Predefined hit slop values for common element sizes
 */
export const HIT_SLOP = {
  /** For 32pt elements (44 - 32 = 12, split = 6) */
  small: { top: 6, bottom: 6, left: 6, right: 6 },
  /** For 24pt elements (44 - 24 = 20, split = 10) */
  xsmall: { top: 10, bottom: 10, left: 10, right: 10 },
  /** For 16pt elements (44 - 16 = 28, split = 14) */
  xxsmall: { top: 14, bottom: 14, left: 14, right: 14 },
} as const;

// =============================================================================
// HIT SLOP CALCULATION
// =============================================================================

interface HitSlop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Calculate hit slop needed to meet minimum touch target size
 *
 * @param width - Current width of the element
 * @param height - Current height of the element
 * @returns HitSlop object with padding values
 */
export function calculateHitSlop(width: number, height: number): HitSlop {
  const horizontalPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - width) / 2));
  const verticalPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - height) / 2));

  return {
    top: verticalPadding,
    bottom: verticalPadding,
    left: horizontalPadding,
    right: horizontalPadding,
  };
}

// =============================================================================
// ACCESSIBILITY PROPS BUILDERS
// =============================================================================

interface ButtonAccessibilityOptions {
  label: string;
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
  busy?: boolean;
}

interface ButtonAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityHint: string | undefined;
  accessibilityRole: 'button';
  accessibilityState: AccessibilityState | undefined;
}

/**
 * Build accessibility props for a button
 */
export function buildButtonAccessibility(
  options: ButtonAccessibilityOptions
): ButtonAccessibilityProps {
  const { label, hint, disabled, selected, busy } = options;

  // Only include state if any state values are provided
  let accessibilityState: AccessibilityState | undefined;
  if (disabled !== undefined || selected !== undefined || busy !== undefined) {
    accessibilityState = {};
    if (disabled !== undefined) accessibilityState.disabled = disabled;
    if (selected !== undefined) accessibilityState.selected = selected;
    if (busy !== undefined) accessibilityState.busy = busy;
  }

  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'button',
    accessibilityState,
  };
}

interface SliderAccessibilityOptions {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
}

interface SliderAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityRole: 'adjustable';
  accessibilityValue: {
    min: number;
    max: number;
    now: number;
    text: string;
  };
}

/**
 * Build accessibility props for a slider
 */
export function buildSliderAccessibility(
  options: SliderAccessibilityOptions
): SliderAccessibilityProps {
  const { label, value, min, max, unit = '' } = options;

  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'adjustable',
    accessibilityValue: {
      min,
      max,
      now: value,
      text: `${value}${unit}`,
    },
  };
}

interface ProgressAccessibilityOptions {
  label: string;
  progress: number;
  total?: number;
  unit?: string;
}

interface ProgressAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityRole: 'progressbar';
  accessibilityValue: {
    min: number;
    max: number;
    now: number;
    text: string;
  };
}

/**
 * Build accessibility props for a progress indicator
 */
export function buildProgressAccessibility(
  options: ProgressAccessibilityOptions
): ProgressAccessibilityProps {
  const { label, progress, total = 100, unit } = options;

  // If unit is provided, use the progress value directly
  // Otherwise calculate percentage
  const percentage = unit ? progress : Math.round((progress / total) * 100);
  const text = unit ? `${progress}${unit}` : `${percentage}%`;
  const displayLabel = unit ? `${label}: ${progress}${unit}` : `${label}: ${percentage}%`;

  return {
    accessible: true,
    accessibilityLabel: displayLabel,
    accessibilityRole: 'progressbar',
    accessibilityValue: {
      min: 0,
      max: total,
      now: progress,
      text,
    },
  };
}

interface ImageAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityRole: 'image';
}

/**
 * Build accessibility props for an image
 */
export function buildImageAccessibility(label: string): ImageAccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'image',
  };
}

interface HeadingAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityRole: 'header';
}

/**
 * Build accessibility props for a heading
 */
export function buildHeadingAccessibility(label: string): HeadingAccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'header',
  };
}

interface LinkAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityHint: string | undefined;
  accessibilityRole: 'link';
}

/**
 * Build accessibility props for a link
 */
export function buildLinkAccessibility(label: string, hint?: string): LinkAccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'link',
  };
}

interface ToggleAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityHint: string | undefined;
  accessibilityRole: 'switch';
  accessibilityState: { checked: boolean };
}

/**
 * Build accessibility props for a toggle/switch
 */
export function buildToggleAccessibility(
  label: string,
  isOn: boolean,
  hint?: string
): ToggleAccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'switch',
    accessibilityState: { checked: isOn },
  };
}

interface TabAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityRole: 'tab';
  accessibilityState: { selected: boolean };
}

/**
 * Build accessibility props for a tab
 */
export function buildTabAccessibility(label: string, isSelected: boolean): TabAccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'tab',
    accessibilityState: { selected: isSelected },
  };
}

interface ListItemAccessibilityProps {
  accessible: true;
  accessibilityLabel: string;
  accessibilityHint: string | undefined;
}

/**
 * Build accessibility props for a list item
 */
export function buildListItemAccessibility(
  label: string,
  hint?: string
): ListItemAccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
  };
}

// =============================================================================
// TIME AND PROGRESS FORMATTERS
// =============================================================================

/**
 * Format seconds into human-readable time for screen readers
 *
 * @param seconds - Total seconds
 * @returns Human-readable string like "1 hour, 30 minutes, 15 seconds"
 */
export function formatTimeForAccessibility(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  if (secs > 0 || parts.length === 0) {
    // Always include seconds if nothing else, or if there are remaining seconds
    if (hours === 0 || secs > 0) {
      parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);
    }
  }

  return parts.join(', ');
}

/**
 * Format progress as a percentage for screen readers
 *
 * @param progress - Progress value between 0 and 1
 * @returns String like "50 percent complete"
 */
export function formatProgressForAccessibility(progress: number): string {
  const percent = Math.round(progress * 100);
  return `${percent} percent complete`;
}

// =============================================================================
// BOOK DESCRIPTION BUILDER
// =============================================================================

interface BookDescriptionOptions {
  title: string;
  author?: string;
  narrator?: string;
  duration?: number;
  progress?: number;
}

/**
 * Build a comprehensive accessibility description for a book
 */
export function buildBookDescription(options: BookDescriptionOptions): string {
  const { title, author, narrator, duration, progress } = options;

  const parts: string[] = [title];

  if (author) {
    parts.push(`by ${author}`);
  }

  if (narrator) {
    parts.push(`narrated by ${narrator}`);
  }

  if (duration) {
    const hours = Math.round(duration / 3600);
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (progress && progress > 0) {
    const percent = Math.round(progress * 100);
    parts.push(`${percent} percent complete`);
  }

  return parts.join(', ');
}

// =============================================================================
// COLOR CONTRAST CHECKER
// =============================================================================

interface ColorContrastResult {
  ratio: number;
  passesNormal: boolean;
  passesLarge: boolean;
}

/**
 * Calculate relative luminance of a color
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getRelativeLuminance(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const gammaCorrect = (value: number) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

  const R = gammaCorrect(r);
  const G = gammaCorrect(g);
  const B = gammaCorrect(b);

  // Calculate luminance
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Check color contrast ratio between foreground and background
 * WCAG 2.1 requirements:
 * - Normal text: 4.5:1 minimum
 * - Large text (18pt or 14pt bold): 3:1 minimum
 *
 * @param foreground - Foreground color in hex format (#RRGGBB)
 * @param background - Background color in hex format (#RRGGBB)
 * @returns Contrast ratio and pass/fail status
 */
export function checkColorContrast(
  foreground: string,
  background: string
): ColorContrastResult {
  const L1 = getRelativeLuminance(foreground);
  const L2 = getRelativeLuminance(background);

  // Contrast ratio formula: (L1 + 0.05) / (L2 + 0.05)
  // Where L1 is the lighter color
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio,
    passesNormal: ratio >= 4.5,
    passesLarge: ratio >= 3,
  };
}
