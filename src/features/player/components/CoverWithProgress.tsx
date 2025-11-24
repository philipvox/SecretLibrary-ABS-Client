// File: src/features/player/components/CoverWithProgress.tsx
import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '@/shared/theme';

interface CoverWithProgressProps {
  coverUrl: string;
  progress: number; // 0 to 1
  size: number;
  borderColor: string;
  borderWidth?: number;
}

export function CoverWithProgress({
  coverUrl,
  progress,
  size,
  borderColor,
  borderWidth = 4,
}: CoverWithProgressProps) {
  const borderRadius = theme.radius.xlarge;
  
  // Calculate the perimeter of the rounded rectangle
  const straightEdges = (size - 2 * borderRadius) * 4;
  const corners = 2 * Math.PI * borderRadius;
  const totalPerimeter = straightEdges + corners;
  
  // Progress starts from bottom-left, goes clockwise
  const progressLength = totalPerimeter * progress;
  
  // SVG rect uses stroke-dasharray for the progress effect
  // We need to offset and reverse the direction
  const strokeDasharray = `${progressLength} ${totalPerimeter}`;
  
  // Offset to start from bottom-left
  // Bottom-left corner starts at: left side (size - 2*radius) + bottom side (size - 2*radius) + right side (size - 2*radius) + top side (size - 2*radius) + 3 corners
  // Actually simpler: we want to start from bottom-left going UP, then clockwise
  // SVG rect draws: top-left -> top-right -> bottom-right -> bottom-left
  // So we need to offset by 3/4 of the perimeter plus adjust for where we want to start
  const startOffset = totalPerimeter * 0.625; // Start from bottom-left going clockwise
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Cover Image */}
      <Image
        source={{ uri: coverUrl }}
        style={[
          styles.cover,
          {
            width: size - borderWidth * 2,
            height: size - borderWidth * 2,
            borderRadius: borderRadius - borderWidth,
          },
        ]}
        resizeMode="cover"
      />
      
      {/* Progress Border */}
      <View style={styles.svgContainer}>
        <Svg width={size} height={size}>
          {/* Background track (subtle) */}
          <Rect
            x={borderWidth / 2}
            y={borderWidth / 2}
            width={size - borderWidth}
            height={size - borderWidth}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={borderWidth}
          />
          
          {/* Progress stroke */}
          <Rect
            x={borderWidth / 2}
            y={borderWidth / 2}
            width={size - borderWidth}
            height={size - borderWidth}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={borderColor}
            strokeWidth={borderWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={startOffset}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.large,
  },
  cover: {
    backgroundColor: theme.colors.neutral[200],
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});