/**
 * src/features/player/components/PlayerIcons.tsx
 *
 * SVG icons for the player UI.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { Settings } from 'lucide-react-native';
import { scale, useTheme } from '@/shared/theme';

/**
 * Moon icon for sleep timer
 */
export const MoonIcon = ({ color }: { color?: string }) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
    <Svg width={scale(13)} height={scale(13)} viewBox="0 0 13 13" fill="none">
      <Path
        d="M13 7.08559C12.8861 8.31757 12.4238 9.49165 11.667 10.4704C10.9102 11.4492 9.89037 12.1923 8.72672 12.6126C7.56307 13.0329 6.30378 13.1131 5.09621 12.8439C3.88863 12.5746 2.78271 11.967 1.90785 11.0921C1.033 10.2173 0.425392 9.11137 0.156131 7.90379C-0.11313 6.69622 -0.0329082 5.43693 0.38741 4.27328C0.807727 3.10963 1.55076 2.08975 2.52955 1.33298C3.50835 0.576212 4.68243 0.113851 5.91441 0C5.19313 0.975819 4.84604 2.17811 4.93628 3.38821C5.02652 4.59831 5.54809 5.73582 6.40614 6.59386C7.26418 7.45191 8.40169 7.97348 9.61179 8.06372C10.8219 8.15396 12.0242 7.80687 13 7.08559Z"
        fill={fillColor}
      />
    </Svg>
  );
};

/**
 * Double-chevron rewind icon (<<)
 */
export const RewindIcon = ({ color }: { color?: string }) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M9.65391 13.3207C9.65391 13.8212 9.08125 14.1058 8.68224 13.8036L0.391342 7.52258C0.0713467 7.28016 0.0713462 6.79919 0.391341 6.55677L8.68223 0.275788C9.08125 -0.0264932 9.65391 0.258109 9.65391 0.758693V13.3207Z"
      fill={fillColor}
    />
    <Path
      d="M21.7539 13.3207C21.7539 13.8212 21.1812 14.1058 20.7822 13.8036L12.4913 7.52258C12.1713 7.28016 12.1713 6.79919 12.4913 6.55677L20.7822 0.275788C21.1812 -0.0264932 21.7539 0.258109 21.7539 0.758693V13.3207Z"
      fill={fillColor}
    />
  </Svg>
  );
};

/**
 * Double-chevron fast-forward icon (>>)
 */
export const FastForwardIcon = ({ color }: { color?: string }) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M12.2514 13.3207C12.2514 13.8212 12.824 14.1058 13.223 13.8036L21.5139 7.52258C21.8339 7.28016 21.8339 6.79919 21.5139 6.55677L13.223 0.275788C12.824 -0.0264932 12.2514 0.258109 12.2514 0.758693V13.3207Z"
      fill={fillColor}
    />
    <Path
      d="M0.151367 13.3207C0.151367 13.8212 0.724027 14.1058 1.12304 13.8036L9.41393 7.52258C9.73393 7.28016 9.73393 6.79919 9.41393 6.55677L1.12304 0.275788C0.724028 -0.0264932 0.151367 0.258109 0.151367 0.758693V13.3207Z"
      fill={fillColor}
    />
  </Svg>
  );
};

/**
 * Down arrow icon for close button
 */
export const DownArrowIcon = ({ color }: { color?: string }) => {
  const { colors } = useTheme();
  const strokeColor = color ?? colors.text.primary;
  return (
  <Svg width={scale(16)} height={scale(10)} viewBox="0 0 16 10" fill="none">
    <Path
      d="M1 1L8 8L15 1"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
  );
};

/**
 * Bookmark flag icon for timeline - flag on a pole
 */
export const BookmarkFlagIcon = ({ size = 24, color }: { size?: number; color?: string }) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.accent.primary;
  const flagWidth = size * 0.6;
  const flagHeight = size * 0.4;
  const poleWidth = 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {/* Pole */}
      <Line
        x1={poleWidth / 2}
        y1={0}
        x2={poleWidth / 2}
        y2={size}
        stroke={fillColor}
        strokeWidth={poleWidth}
      />
      {/* Flag - notched pennant shape */}
      <Path
        d={`M${poleWidth} 0 L${poleWidth + flagWidth} ${flagHeight / 2} L${poleWidth} ${flagHeight} Z`}
        fill={fillColor}
      />
    </Svg>
  );
};

/**
 * Previous chapter icon (|<<) - bar with double chevron
 */
export const PrevChapterIcon = ({ color }: { color?: string }) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    {/* Vertical bar on left */}
    <Path d="M0 0H2.5V15H0V0Z" fill={fillColor} />
    {/* Double chevron */}
    <Path
      d="M11.65 13.32C11.65 13.82 11.08 14.1 10.68 13.8L4.39 7.52C4.07 7.28 4.07 6.8 4.39 6.56L10.68 0.28C11.08 -0.03 11.65 0.26 11.65 0.76V13.32Z"
      fill={fillColor}
    />
    <Path
      d="M21.75 13.32C21.75 13.82 21.18 14.1 20.78 13.8L14.49 7.52C14.17 7.28 14.17 6.8 14.49 6.56L20.78 0.28C21.18 -0.03 21.75 0.26 21.75 0.76V13.32Z"
      fill={fillColor}
    />
  </Svg>
  );
};

/**
 * Next chapter icon (>>|) - double chevron with bar
 */
export const NextChapterIcon = ({ color }: { color?: string }) => {
  const { colors } = useTheme();
  const fillColor = color ?? colors.text.primary;
  return (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    {/* Double chevron */}
    <Path
      d="M10.35 13.32C10.35 13.82 10.92 14.1 11.32 13.8L17.61 7.52C17.93 7.28 17.93 6.8 17.61 6.56L11.32 0.28C10.92 -0.03 10.35 0.26 10.35 0.76V13.32Z"
      fill={fillColor}
    />
    <Path
      d="M0.25 13.32C0.25 13.82 0.82 14.1 1.22 13.8L7.51 7.52C7.83 7.28 7.83 6.8 7.51 6.56L1.22 0.28C0.82 -0.03 0.25 0.26 0.25 0.76V13.32Z"
      fill={fillColor}
    />
    {/* Vertical bar on right */}
    <Path d="M19.5 0H22V15H19.5V0Z" fill={fillColor} />
  </Svg>
  );
};

/**
 * Settings icon in a circular background
 */
export const SettingsIconCircle = ({ color, transparent = false, darkPill = false }: { color?: string; transparent?: boolean; darkPill?: boolean }) => {
  const { colors } = useTheme();
  const iconColor = color ?? (darkPill ? colors.text.inverse : colors.text.primary);
  return (
    <View style={{
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      backgroundColor: darkPill ? 'rgba(0,0,0,0.5)' : transparent ? 'transparent' : colors.background.secondary,
      borderWidth: darkPill ? 1 : 0,
      borderColor: darkPill ? 'rgba(255,255,255,0.6)' : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Settings size={scale(18)} color={iconColor} strokeWidth={2} />
    </View>
  );
};
