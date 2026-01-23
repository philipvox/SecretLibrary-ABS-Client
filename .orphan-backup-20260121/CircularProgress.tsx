/**
 * src/features/player/components/CircularProgress.tsx
 *
 * Circular progress indicator for download status.
 */

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { scale, useTheme } from '@/shared/theme';

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
  progressColor,
  backgroundColor,
}) => {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  // Use provided colors or theme defaults
  const effectiveProgressColor = progressColor ?? colors.accent.primary;
  const effectiveBackgroundColor = backgroundColor ?? `${colors.text.primary}30`;

  return (
    <View style={{ width: size, height: size, backgroundColor: colors.background.primary, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={effectiveBackgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={effectiveProgressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: scale(9), fontWeight: '700', color: colors.text.primary }}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
};
