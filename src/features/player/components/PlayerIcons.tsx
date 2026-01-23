/**
 * src/features/player/components/PlayerIcons.tsx
 *
 * Shared SVG icons for player components.
 * Centralizes icon definitions to prevent duplication across sheets and screens.
 */

import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { secretLibraryColors as colors } from '@/shared/theme/secretLibrary';

export interface IconProps {
  color?: string;
  size?: number;
}

// =============================================================================
// PLAYBACK CONTROL ICONS
// =============================================================================

export const PlayIcon = ({ color = colors.white, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

export const PauseIcon = ({ color = colors.white, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Rect x={6} y={5} width={4} height={14} />
    <Rect x={14} y={5} width={4} height={14} />
  </Svg>
);

export const RewindIcon = ({ color = colors.black, size = 20 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12.5 8L7 12l5.5 4V8z" />
    <Path d="M18 8l-5.5 4 5.5 4V8z" />
  </Svg>
);

export const FastForwardIcon = ({ color = colors.black, size = 20 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11.5 16l5.5-4-5.5-4v8z" />
    <Path d="M6 16l5.5-4L6 8v8z" />
  </Svg>
);

export const PrevIcon = ({ color = colors.black, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </Svg>
);

export const NextIcon = ({ color = colors.black, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
  </Svg>
);

export const SkipPrevIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M19 20L9 12l10-8v16z" />
    <Line x1={5} y1={4} x2={5} y2={20} />
  </Svg>
);

export const SkipNextIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M5 4l10 8-10 8V4z" />
    <Line x1={19} y1={4} x2={19} y2={20} />
  </Svg>
);

// =============================================================================
// UI ICONS
// =============================================================================

export const CloseIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Line x1={18} y1={6} x2={6} y2={18} />
    <Line x1={6} y1={6} x2={18} y2={18} />
  </Svg>
);

export const ChevronDownIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export const CheckIcon = ({ color = colors.gray, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

export const SearchIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={11} cy={11} r={8} />
    <Line x1={21} y1={21} x2={16.65} y2={16.65} />
  </Svg>
);

export const PlusIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Line x1={12} y1={5} x2={12} y2={19} />
    <Line x1={5} y1={12} x2={19} y2={12} />
  </Svg>
);

export const MinusIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Line x1={5} y1={12} x2={19} y2={12} />
  </Svg>
);

// =============================================================================
// FEATURE ICONS
// =============================================================================

export const BookmarkIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

export const BookmarkFilledIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

export const ClockIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

export const ListIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Line x1={8} y1={6} x2={21} y2={6} />
    <Line x1={8} y1={12} x2={21} y2={12} />
    <Line x1={8} y1={18} x2={21} y2={18} />
    <Line x1={3} y1={6} x2={3.01} y2={6} />
    <Line x1={3} y1={12} x2={3.01} y2={12} />
    <Line x1={3} y1={18} x2={3.01} y2={18} />
  </Svg>
);

export const DownloadIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Line x1={12} y1={15} x2={12} y2={3} />
  </Svg>
);

export const EditIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Svg>
);

export const DeleteIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const NoteIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Line x1={16} y1={13} x2={8} y2={13} />
    <Line x1={16} y1={17} x2={8} y2={17} />
    <Line x1={10} y1={9} x2={8} y2={9} />
  </Svg>
);

export const ExportIcon = ({ color = colors.black, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M17 8l-5-5-5 5" />
    <Line x1={12} y1={3} x2={12} y2={15} />
  </Svg>
);

export const ResetIcon = ({ color = colors.black, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M1 4v6h6M23 20v-6h-6" />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
  </Svg>
);

export const BookIcon = ({ color = colors.black, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Svg>
);

export const BooksIcon = ({ color = colors.black, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <Path d="M8 7h8M8 12h8" />
  </Svg>
);
