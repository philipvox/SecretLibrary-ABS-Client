/**
 * src/features/home/components/icons/PauseIcon.tsx
 *
 * Pause icon (two vertical bars)
 */

import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { COLORS } from '../../homeDesign';

interface PauseIconProps {
  size?: number;
  color?: string;
}

export function PauseIcon({ size = 24, color = COLORS.playButton }: PauseIconProps) {
  const barWidth = size * 0.2;
  const barHeight = size * 0.6;
  const gap = size * 0.15;
  const y = size * 0.2;
  const x1 = size * 0.5 - gap / 2 - barWidth;
  const x2 = size * 0.5 + gap / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <Rect x={x1} y={y} width={barWidth} height={barHeight} rx={2} fill={color} />
      <Rect x={x2} y={y} width={barWidth} height={barHeight} rx={2} fill={color} />
    </Svg>
  );
}
