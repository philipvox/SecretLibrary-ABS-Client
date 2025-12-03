/**
 * src/features/home/components/icons/SkipForwardIcon.tsx
 *
 * Double chevron forward icon for skip forward button
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../homeDesign';

interface SkipForwardIconProps {
  size?: number;
  color?: string;
}

export function SkipForwardIcon({
  size = 26,
  color = COLORS.textPrimary,
}: SkipForwardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 53 56" fill="none">
      {/* First chevron (right) */}
      <Path
        d="M29.15 22.8357C29.15 21.1714 31.0641 20.2352 32.3779 21.2569L39.1716 26.541C40.2011 27.3417 40.2011 28.8977 39.1716 29.6984L32.3779 34.9824C31.0641 36.0042 29.15 35.068 29.15 33.4037L29.15 22.8357Z"
        fill={color}
      />
      {/* Second chevron (left) */}
      <Path
        d="M14.4205 22.8357C14.4205 21.1714 16.3347 20.2352 17.6484 21.2569L24.4421 26.541C25.4716 27.3417 25.4716 28.8977 24.4421 29.6984L17.6484 34.9824C16.3347 36.0042 14.4205 35.068 14.4205 33.4037L14.4205 22.8357Z"
        fill={color}
      />
    </Svg>
  );
}
