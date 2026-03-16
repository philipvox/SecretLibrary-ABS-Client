/**
 * src/shared/components/AppIcons.tsx
 *
 * SINGLE SOURCE OF TRUTH for all app icons.
 *
 * This file provides:
 * 1. Custom SVG icons with consistent style (filled, clean shapes)
 * 2. Re-exports of the Icon component for Lucide icons
 * 3. Standard sizes and colors
 *
 * Usage:
 *   import { BackIcon, CloseIcon, Icon } from '@/shared/components/AppIcons';
 *
 *   // Custom icons
 *   <BackIcon size={24} color="#000" />
 *   <CloseIcon size={20} />
 *
 *   // Lucide icons via Icon component
 *   <Icon name="Search" size="md" />
 *   <Icon name="Settings" size="lg" color={colors.accent} />
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { scale, useTheme } from '@/shared/theme';

// Re-export Icon component and types for convenience
export { Icon, ICON_SIZES } from './Icon';
export type { IconSize } from './Icon';

// ============================================================================
// TYPES
// ============================================================================

interface IconBaseProps {
  size?: number;
  color?: string;
}

interface _IconButtonProps extends IconBaseProps {
  /** Show circular border around icon */
  bordered?: boolean;
  /** Background color for button style */
  backgroundColor?: string;
}

// ============================================================================
// SIZE CONSTANTS
// ============================================================================

/** Standard icon sizes (use these for consistency) */
export const IconSizes = {
  xs: scale(12),   // Tiny - badges, indicators
  sm: scale(16),   // Small - inline, secondary
  md: scale(20),   // Medium - buttons, list items (default)
  lg: scale(24),   // Large - headers, primary actions
  xl: scale(32),   // Extra large - feature icons
  xxl: scale(48),  // Huge - empty states, hero
} as const;

// ============================================================================
// NAVIGATION ICONS
// ============================================================================

/**
 * Back arrow icon (chevron left)
 */
export function BackIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Close icon (X)
 */
export function CloseIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Down chevron icon
 */
export function ChevronDownIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9L12 15L18 9"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Up chevron icon
 */
export function ChevronUpIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 15L12 9L6 15"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Right chevron icon
 */
export function ChevronRightIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18L15 12L9 6"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ============================================================================
// SYSTEM ICONS
// ============================================================================

/**
 * Search icon
 */
export function SearchIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={fillColor} strokeWidth={2} />
      <Path
        d="M21 21L16.5 16.5"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Settings gear icon
 */
export function SettingsIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={fillColor} strokeWidth={2} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Menu icon (hamburger)
 */
export function MenuIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={3} y1={6} x2={21} y2={6} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={12} x2={21} y2={12} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={18} x2={21} y2={18} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * More options icon (three dots vertical)
 */
export function MoreVerticalIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={1.5} fill={fillColor} />
      <Circle cx={12} cy={12} r={1.5} fill={fillColor} />
      <Circle cx={12} cy={19} r={1.5} fill={fillColor} />
    </Svg>
  );
}

/**
 * More options icon (three dots horizontal)
 */
export function MoreHorizontalIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={12} r={1.5} fill={fillColor} />
      <Circle cx={12} cy={12} r={1.5} fill={fillColor} />
      <Circle cx={19} cy={12} r={1.5} fill={fillColor} />
    </Svg>
  );
}

// ============================================================================
// ACTION ICONS
// ============================================================================

/**
 * Plus icon
 */
export function PlusIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5V19M5 12H19"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Check icon
 */
export function CheckIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Heart icon (outline)
 */
export function HeartIcon({ size = IconSizes.md, color, filled = false }: IconBaseProps & { filled?: boolean }) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? fillColor : 'none'}
      />
    </Svg>
  );
}

/**
 * Download icon
 */
export function DownloadIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 10L12 15L17 10"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15V3"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Share icon
 */
export function ShareIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={3} stroke={fillColor} strokeWidth={2} />
      <Circle cx={6} cy={12} r={3} stroke={fillColor} strokeWidth={2} />
      <Circle cx={18} cy={19} r={3} stroke={fillColor} strokeWidth={2} />
      <Path
        d="M8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ============================================================================
// PLAYER ICONS (Re-exported from PlayerIcons for convenience)
// ============================================================================

/**
 * Play icon (filled triangle)
 */
export function PlayIcon({ size = IconSizes.lg, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3L19 12L5 21V3Z"
        fill={fillColor}
      />
    </Svg>
  );
}

/**
 * Pause icon (two bars)
 */
export function PauseIcon({ size = IconSizes.lg, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4H10V20H6V4Z" fill={fillColor} />
      <Path d="M14 4H18V20H14V4Z" fill={fillColor} />
    </Svg>
  );
}

/**
 * Skip back icon (double chevron left)
 */
export function SkipBackIcon({ size = IconSizes.lg, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 19L2 12L11 5V19Z"
        fill={fillColor}
      />
      <Path
        d="M22 19L13 12L22 5V19Z"
        fill={fillColor}
      />
    </Svg>
  );
}

/**
 * Skip forward icon (double chevron right)
 */
export function SkipForwardIcon({ size = IconSizes.lg, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 5L22 12L13 19V5Z"
        fill={fillColor}
      />
      <Path
        d="M2 5L11 12L2 19V5Z"
        fill={fillColor}
      />
    </Svg>
  );
}

/**
 * Moon icon for sleep timer (filled)
 */
export function MoonIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill={fillColor}
      />
    </Svg>
  );
}

// ============================================================================
// ENTITY ICONS (Author, Narrator, etc.)
// ============================================================================

/**
 * User icon (person silhouette)
 */
export function UserIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={7} r={4} stroke={fillColor} strokeWidth={2} />
    </Svg>
  );
}

/**
 * Mic icon (microphone for narrator)
 */
export function MicIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7956 1 12 1Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 10V12C19 13.8565 18.2625 15.637 16.9497 16.9497C15.637 18.2625 13.8565 19 12 19C10.1435 19 8.36301 18.2625 7.05025 16.9497C5.7375 15.637 5 13.8565 5 12V10"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 19V23M8 23H16"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Bell icon (notifications/follow)
 */
export function BellIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Bell off icon (notifications muted/unfollow)
 */
export function BellOffIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.63 13C18.8728 11.661 18.9867 10.3022 18.98 8.94C18.9802 7.52 18.4897 6.14229 17.5898 5.03C16.6899 3.91772 15.4344 3.13658 14.0301 2.81M6.26 6.26C6.09328 6.8113 6.00572 7.38427 6 7.96C6 15 3 17 3 17H17"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 1L23 23"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Library icon (books on shelf)
 */
export function LibraryIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19.5C4 20.163 4.26339 20.7989 4.73223 21.2678C5.20107 21.7366 5.83696 22 6.5 22H20"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Book icon (single book)
 */
export function BookIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19.5C4 20.163 4.26339 20.7989 4.73223 21.2678C5.20107 21.7366 5.83696 22 6.5 22H20"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 6H16M8 10H16M8 14H13"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Clock icon (time/duration)
 */
export function ClockIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={fillColor} strokeWidth={2} />
      <Path
        d="M12 6V12L16 14"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Grid icon (category/browse)
 */
export function GridIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3H10V10H3V3Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 3H21V10H14V3Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 14H21V21H14V14Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 14H10V21H3V14Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Tag icon (genre/category)
 */
export function TagIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41L13.42 20.58C13.2343 20.766 13.0137 20.9135 12.7709 21.0141C12.5281 21.1148 12.2678 21.1666 12.005 21.1666C11.7422 21.1666 11.4819 21.1148 11.2391 21.0141C10.9963 20.9135 10.7757 20.766 10.59 20.58L2 12V2H12L20.59 10.59C20.9625 10.9647 21.1716 11.4716 21.1716 12C21.1716 12.5284 20.9625 13.0353 20.59 13.41Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7H7.01"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Smile icon (mood)
 */
export function SmileIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={fillColor} strokeWidth={2} />
      <Path
        d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={9} y1={9} x2={9.01} y2={9} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={15} y1={9} x2={15.01} y2={9} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Book open icon (reading/open book)
 */
export function BookOpenIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 3H8C9.06087 3 10.0783 3.42143 10.8284 4.17157C11.5786 4.92172 12 5.93913 12 7V21C12 20.2044 11.6839 19.4413 11.1213 18.8787C10.5587 18.3161 9.79565 18 9 18H2V3Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 3H16C14.9391 3 13.9217 3.42143 13.1716 4.17157C12.4214 4.92172 12 5.93913 12 7V21C12 20.2044 12.3161 19.4413 12.8787 18.8787C13.4413 18.3161 14.2044 18 15 18H22V3Z"
        stroke={fillColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * List icon (list view)
 */
export function ListIcon({ size = IconSizes.md, color }: IconBaseProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={8} y1={6} x2={21} y2={6} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8} y1={12} x2={21} y2={12} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8} y1={18} x2={21} y2={18} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={6} x2={3.01} y2={6} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={12} x2={3.01} y2={12} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3} y1={18} x2={3.01} y2={18} stroke={fillColor} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ============================================================================
// ICON BUTTON WRAPPER
// ============================================================================

/**
 * Icon button with optional circular border (like browse screen)
 */
export function IconButton({
  children,
  size = 36,
  bordered = true,
  backgroundColor,
  _onPress,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  bordered?: boolean;
  backgroundColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.text.primary,
          backgroundColor: backgroundColor ?? 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/** All custom icons for easy access */
export const AppIcons = {
  // Navigation
  Back: BackIcon,
  Close: CloseIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  ChevronRight: ChevronRightIcon,
  // System
  Search: SearchIcon,
  Settings: SettingsIcon,
  Menu: MenuIcon,
  MoreVertical: MoreVerticalIcon,
  MoreHorizontal: MoreHorizontalIcon,
  // Actions
  Plus: PlusIcon,
  Check: CheckIcon,
  Heart: HeartIcon,
  Download: DownloadIcon,
  Share: ShareIcon,
  // Player
  Play: PlayIcon,
  Pause: PauseIcon,
  SkipBack: SkipBackIcon,
  SkipForward: SkipForwardIcon,
  Moon: MoonIcon,
  // Entity
  User: UserIcon,
  Mic: MicIcon,
  Bell: BellIcon,
  BellOff: BellOffIcon,
  // Content
  Library: LibraryIcon,
  Book: BookIcon,
  BookOpen: BookOpenIcon,
  Clock: ClockIcon,
  Grid: GridIcon,
  Tag: TagIcon,
  Smile: SmileIcon,
  List: ListIcon,
};
