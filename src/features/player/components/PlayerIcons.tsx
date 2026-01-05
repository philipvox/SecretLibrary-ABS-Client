/**
 * src/features/player/components/PlayerIcons.tsx
 *
 * SVG icons for the player UI.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { Settings } from 'lucide-react-native';
import { scale } from '@/shared/theme';

/**
 * Moon icon for sleep timer
 */
export const MoonIcon = () => (
  <Svg width={scale(13)} height={scale(13)} viewBox="0 0 13 13" fill="none">
    <Path
      d="M13 7.08559C12.8861 8.31757 12.4238 9.49165 11.667 10.4704C10.9102 11.4492 9.89037 12.1923 8.72672 12.6126C7.56307 13.0329 6.30378 13.1131 5.09621 12.8439C3.88863 12.5746 2.78271 11.967 1.90785 11.0921C1.033 10.2173 0.425392 9.11137 0.156131 7.90379C-0.11313 6.69622 -0.0329082 5.43693 0.38741 4.27328C0.807727 3.10963 1.55076 2.08975 2.52955 1.33298C3.50835 0.576212 4.68243 0.113851 5.91441 0C5.19313 0.975819 4.84604 2.17811 4.93628 3.38821C5.02652 4.59831 5.54809 5.73582 6.40614 6.59386C7.26418 7.45191 8.40169 7.97348 9.61179 8.06372C10.8219 8.15396 12.0242 7.80687 13 7.08559Z"
      fill="white"
    />
  </Svg>
);

/**
 * Double-chevron rewind icon (<<)
 */
export const RewindIcon = ({ color = "white" }: { color?: string }) => (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M9.65391 13.3207C9.65391 13.8212 9.08125 14.1058 8.68224 13.8036L0.391342 7.52258C0.0713467 7.28016 0.0713462 6.79919 0.391341 6.55677L8.68223 0.275788C9.08125 -0.0264932 9.65391 0.258109 9.65391 0.758693V13.3207Z"
      fill={color}
    />
    <Path
      d="M21.7539 13.3207C21.7539 13.8212 21.1812 14.1058 20.7822 13.8036L12.4913 7.52258C12.1713 7.28016 12.1713 6.79919 12.4913 6.55677L20.7822 0.275788C21.1812 -0.0264932 21.7539 0.258109 21.7539 0.758693V13.3207Z"
      fill={color}
    />
  </Svg>
);

/**
 * Double-chevron fast-forward icon (>>)
 */
export const FastForwardIcon = ({ color = "white" }: { color?: string }) => (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M12.2514 13.3207C12.2514 13.8212 12.824 14.1058 13.223 13.8036L21.5139 7.52258C21.8339 7.28016 21.8339 6.79919 21.5139 6.55677L13.223 0.275788C12.824 -0.0264932 12.2514 0.258109 12.2514 0.758693V13.3207Z"
      fill={color}
    />
    <Path
      d="M0.151367 13.3207C0.151367 13.8212 0.724027 14.1058 1.12304 13.8036L9.41393 7.52258C9.73393 7.28016 9.73393 6.79919 9.41393 6.55677L1.12304 0.275788C0.724028 -0.0264932 0.151367 0.258109 0.151367 0.758693V13.3207Z"
      fill={color}
    />
  </Svg>
);

/**
 * Down arrow icon for close button
 */
export const DownArrowIcon = ({ color = "#FFFFFF" }: { color?: string }) => (
  <Svg width={scale(16)} height={scale(10)} viewBox="0 0 16 10" fill="none">
    <Path
      d="M1 1L8 8L15 1"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Bookmark flag icon for timeline - flag on a pole
 */
export const BookmarkFlagIcon = ({ size = 24, color = "#2196F3" }: { size?: number; color?: string }) => {
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
        stroke={color}
        strokeWidth={poleWidth}
      />
      {/* Flag - notched pennant shape */}
      <Path
        d={`M${poleWidth} 0 L${poleWidth + flagWidth} ${flagHeight / 2} L${poleWidth} ${flagHeight} Z`}
        fill={color}
      />
    </Svg>
  );
};

/**
 * Settings icon in a circular background
 */
export const SettingsIconCircle = ({ color = "#FFFFFF", dark = false }: { color?: string; dark?: boolean }) => (
  <View style={{
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: dark ? 'transparent' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Settings size={scale(18)} color={dark ? color : '#000000'} strokeWidth={2} />
  </View>
);
