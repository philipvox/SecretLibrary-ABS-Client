/**
 * src/shared/accessibility/accessibilityUtils.ts
 *
 * Accessibility utilities for building accessible components.
 * Based on WCAG 2.1 AA, Apple HIG, and Material Design guidelines.
 *
 * Key requirements:
 * - Minimum touch target: 44x44 points
 * - Sufficient color contrast: 4.5:1 for normal text, 3:1 for large text
 * - Meaningful labels for screen readers
 * - Support for Reduce Motion preference
 */

import { AccessibilityRole, AccessibilityState, AccessibilityValue } from 'react-native';
import { scale } from '../theme';

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum touch target size per platform guidelines.
 * Apple HIG and Material Design both recommend 44pt minimum.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Hit slop values to expand touch area for small elements.
 * Use these to ensure elements smaller than 44pt still meet touch target requirements.
 */
export const HIT_SLOP = {
  /** For elements 32pt - adds 6pt padding each side */
  small: { top: 6, bottom: 6, left: 6, right: 6 },
  /** For elements 24pt - adds 10pt padding each side */
  xsmall: { top: 10, bottom: 10, left: 10, right: 10 },
  /** For elements 16pt - adds 14pt padding each side */
  xxsmall: { top: 14, bottom: 14, left: 14, right: 14 },
};

/**
 * Font size thresholds for WCAG contrast requirements.
 * Large text (18pt+ or 14pt+ bold) has relaxed contrast requirements.
 */
export const LARGE_TEXT_THRESHOLD = {
  normal: 18,
  bold: 14,
};

// =============================================================================
// Types
// =============================================================================

export interface AccessibilityProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityValue?: AccessibilityValue;
  accessible?: boolean;
}

export interface ButtonAccessibilityOptions {
  label: string;
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
  busy?: boolean;
  expanded?: boolean;
}

export interface SliderAccessibilityOptions {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
}

export interface ProgressAccessibilityOptions {
  label: string;
  progress: number;
  total?: number;
  unit?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate hit slop to ensure minimum touch target size.
 * Returns hit slop values that expand the touch area to at least 44pt.
 *
 * @param width - Current element width
 * @param height - Current element height
 */
export function calculateHitSlop(width: number, height: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const horizontalPadding = Math.max(0, (MIN_TOUCH_TARGET - width) / 2);
  const verticalPadding = Math.max(0, (MIN_TOUCH_TARGET - height) / 2);

  return {
    top: verticalPadding,
    bottom: verticalPadding,
    left: horizontalPadding,
    right: horizontalPadding,
  };
}

/**
 * Build accessibility props for a button element.
 * Includes label, hint, role, and state.
 *
 * @example
 * ```tsx
 * <TouchableOpacity {...buildButtonAccessibility({
 *   label: 'Play',
 *   hint: 'Plays the current audiobook',
 *   disabled: false,
 * })} />
 * ```
 */
export function buildButtonAccessibility(options: ButtonAccessibilityOptions): AccessibilityProps {
  const state: AccessibilityState = {};

  if (options.disabled !== undefined) state.disabled = options.disabled;
  if (options.selected !== undefined) state.selected = options.selected;
  if (options.busy !== undefined) state.busy = options.busy;
  if (options.expanded !== undefined) state.expanded = options.expanded;

  return {
    accessible: true,
    accessibilityLabel: options.label,
    accessibilityHint: options.hint,
    accessibilityRole: 'button',
    accessibilityState: Object.keys(state).length > 0 ? state : undefined,
  };
}

/**
 * Build accessibility props for a slider/adjustable element.
 * Includes label, value, min, max, and optional unit.
 *
 * @example
 * ```tsx
 * <Slider {...buildSliderAccessibility({
 *   label: 'Playback speed',
 *   value: 1.5,
 *   min: 0.5,
 *   max: 3.0,
 *   unit: 'x',
 * })} />
 * ```
 */
export function buildSliderAccessibility(options: SliderAccessibilityOptions): AccessibilityProps {
  const valueText = options.unit
    ? `${options.value}${options.unit}`
    : options.value.toString();

  return {
    accessible: true,
    accessibilityLabel: options.label,
    accessibilityRole: 'adjustable',
    accessibilityValue: {
      min: options.min,
      max: options.max,
      now: options.value,
      text: valueText,
    },
  };
}

/**
 * Build accessibility props for a progress indicator.
 * Includes label, current progress, and total.
 *
 * @example
 * ```tsx
 * <ProgressBar {...buildProgressAccessibility({
 *   label: 'Download progress',
 *   progress: 45,
 *   total: 100,
 *   unit: '%',
 * })} />
 * ```
 */
export function buildProgressAccessibility(options: ProgressAccessibilityOptions): AccessibilityProps {
  const total = options.total ?? 100;
  const percentage = Math.round((options.progress / total) * 100);
  const valueText = options.unit
    ? `${options.progress}${options.unit}`
    : `${percentage}%`;

  return {
    accessible: true,
    accessibilityLabel: `${options.label}: ${valueText}`,
    accessibilityRole: 'progressbar',
    accessibilityValue: {
      min: 0,
      max: total,
      now: options.progress,
      text: valueText,
    },
  };
}

/**
 * Build accessibility props for an image.
 * Use this for meaningful images (not decorative).
 *
 * @example
 * ```tsx
 * <Image {...buildImageAccessibility('Cover art for Harry Potter')} />
 * ```
 */
export function buildImageAccessibility(description: string): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: description,
    accessibilityRole: 'image',
  };
}

/**
 * Build accessibility props for a heading/header.
 *
 * @example
 * ```tsx
 * <Text {...buildHeadingAccessibility('Chapter 5: The Journey Begins')} />
 * ```
 */
export function buildHeadingAccessibility(text: string): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: text,
    accessibilityRole: 'header',
  };
}

/**
 * Build accessibility props for a link.
 *
 * @example
 * ```tsx
 * <TouchableOpacity {...buildLinkAccessibility('View author profile', 'Opens author details')} />
 * ```
 */
export function buildLinkAccessibility(label: string, hint?: string): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'link',
  };
}

/**
 * Build accessibility props for a toggle/switch.
 *
 * @example
 * ```tsx
 * <Switch {...buildToggleAccessibility('Dark mode', true)} />
 * ```
 */
export function buildToggleAccessibility(label: string, isOn: boolean, hint?: string): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'switch',
    accessibilityState: { checked: isOn },
  };
}

/**
 * Build accessibility props for a tab button.
 *
 * @example
 * ```tsx
 * <TouchableOpacity {...buildTabAccessibility('Home', true)} />
 * ```
 */
export function buildTabAccessibility(label: string, isSelected: boolean): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: 'tab',
    accessibilityState: { selected: isSelected },
  };
}

/**
 * Build accessibility props for a list item.
 *
 * @example
 * ```tsx
 * <View {...buildListItemAccessibility('Harry Potter, by J.K. Rowling, 12 hours')} />
 * ```
 */
export function buildListItemAccessibility(description: string, hint?: string): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: description,
    accessibilityHint: hint,
  };
}

/**
 * Format time duration for accessibility announcement.
 * Converts seconds to a readable format.
 *
 * @example
 * formatTimeForAccessibility(3665) // "1 hour, 1 minute, 5 seconds"
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
    parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(', ');
}

/**
 * Format progress percentage for accessibility announcement.
 *
 * @example
 * formatProgressForAccessibility(0.456) // "46 percent complete"
 */
export function formatProgressForAccessibility(progress: number): string {
  const percentage = Math.round(progress * 100);
  return `${percentage} percent complete`;
}

/**
 * Build an accessible description for a book item.
 *
 * @example
 * buildBookDescription({ title: 'Harry Potter', author: 'J.K. Rowling', duration: 36000, progress: 0.5 })
 * // "Harry Potter by J.K. Rowling, 10 hours, 50 percent complete"
 */
export function buildBookDescription(options: {
  title: string;
  author?: string;
  narrator?: string;
  duration?: number;
  progress?: number;
}): string {
  const parts: string[] = [options.title];

  if (options.author) {
    parts.push(`by ${options.author}`);
  }

  if (options.narrator) {
    parts.push(`narrated by ${options.narrator}`);
  }

  if (options.duration) {
    parts.push(formatTimeForAccessibility(options.duration));
  }

  if (options.progress !== undefined && options.progress > 0) {
    parts.push(formatProgressForAccessibility(options.progress));
  }

  return parts.join(', ');
}

/**
 * Check if a color combination meets WCAG AA contrast requirements.
 * Returns the contrast ratio (4.5:1 required for normal text, 3:1 for large text).
 *
 * Note: This is a simplified check. For production, use a proper color contrast library.
 */
export function checkColorContrast(foreground: string, background: string): {
  ratio: number;
  passesNormal: boolean;
  passesLarge: boolean;
} {
  // Simplified luminance calculation (use a proper library for production)
  const getLuminance = (hex: string): number => {
    const rgb = hex.replace('#', '').match(/.{2}/g);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map((c) => {
      const value = parseInt(c, 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio,
    passesNormal: ratio >= 4.5,
    passesLarge: ratio >= 3,
  };
}
