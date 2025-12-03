/**
 * src/features/home/components/icons/SkipBackwardIcon.tsx
 *
 * Double chevron backward icon for skip backward button
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../homeDesign';

interface SkipBackwardIconProps {
  size?: number;
  color?: string;
}

export function SkipBackwardIcon({
  size = 26,
  color = COLORS.textPrimary,
}: SkipBackwardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 53 56" fill="none">
      {/* First chevron (left) */}
      <Path
        d="M24.9025 22.8357C24.9025 21.1714 22.9884 20.2352 21.6746 21.2569L14.8809 26.541C13.8514 27.3417 13.8514 28.8977 14.8809 29.6984L21.6746 34.9824C22.9884 36.0042 24.9025 35.068 24.9025 33.4037L24.9025 22.8357Z"
        fill={color}
      />
      {/* Second chevron (right) */}
      <Path
        d="M39.632 22.8357C39.632 21.1714 37.7178 20.2352 36.4041 21.2569L29.6104 26.541C28.5809 27.3417 28.5809 28.8977 29.6104 29.6984L36.4041 34.9824C37.7178 36.0042 39.632 35.068 39.632 33.4037L39.632 22.8357Z"
        fill={color}
      />
    </Svg>
  );
}
