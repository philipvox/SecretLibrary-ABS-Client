/**
 * src/features/home/components/icons/PlayIcon.tsx
 *
 * Lime green play triangle icon
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../homeDesign';

interface PlayIconProps {
  size?: number;
  color?: string;
}

export function PlayIcon({ size = 24, color = COLORS.playButton }: PlayIconProps) {
  // Scale factor from original viewBox (78x81) to desired size
  const scale = size / 24;
  const width = 78 * scale;
  const height = 81 * scale;

  return (
    <Svg width={width} height={height} viewBox="0 0 78 81" fill="none">
      <Path
        d="M38.7003 43.493C38.7003 40.3412 42.1759 38.4276 44.8392 40.113L59.7278 49.5346C62.2092 51.1049 62.2092 54.7245 59.7278 56.2948L44.8392 65.7164C42.1759 67.4018 38.7003 65.4882 38.7003 62.3364V43.493Z"
        fill={color}
      />
    </Svg>
  );
}

// Simple centered play triangle for use in play button
export function PlayTriangle({ size = 24, color = COLORS.playButton }: PlayIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 5.14v13.72c0 1.18 1.32 1.89 2.28 1.21l9.12-6.86c.82-.62.82-1.8 0-2.42L10.28 3.93C9.32 3.25 8 3.96 8 5.14z"
        fill={color}
      />
    </Svg>
  );
}
