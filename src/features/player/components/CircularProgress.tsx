/**
 * src/features/player/components/CircularProgress.tsx
 *
 * Circular progress indicator for download status.
 */

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { scale } from '@/shared/theme';

export interface CircularProgressProps {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  progressColor?: string;
  backgroundColor?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = scale(32),
  strokeWidth = 3,
  progressColor = '#000000',
  backgroundColor = 'rgba(0,0,0,0.2)',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  return (
    <View style={{ width: size, height: size, backgroundColor: '#FFFFFF', borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: scale(9), fontWeight: '700', color: '#000000' }}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
};
