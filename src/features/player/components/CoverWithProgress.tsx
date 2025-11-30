// File: src/features/player/components/CoverWithProgress.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

interface CoverWithProgressProps {
  coverUrl: string;
  progress: number;
  size: number;
  accentColor: string;
  borderWidth?: number;
}

export function CoverWithProgress({
  coverUrl,
  progress,
  size,
  accentColor,
  borderWidth = 5,
}: CoverWithProgressProps) {
  const borderRadius = 24;
  const innerSize = size - borderWidth * 2;
  const innerRadius = borderRadius - borderWidth;

  // Calculate path dimensions (stroke center)
  const offset = borderWidth / 2;
  const rectSize = size - borderWidth;
  const r = borderRadius;

  // Create a path starting from bottom-left, going UP (clockwise)
  const createRoundedRectPath = () => {
    const left = offset;
    const top = offset;
    const right = offset + rectSize;
    const bottom = offset + rectSize;
    
    // Start at bottom of left edge, go UP (clockwise direction)
    return `
      M ${left} ${bottom - r}
      L ${left} ${top + r}
      Q ${left} ${top} ${left + r} ${top}
      L ${right - r} ${top}
      Q ${right} ${top} ${right} ${top + r}
      L ${right} ${bottom - r}
      Q ${right} ${bottom} ${right - r} ${bottom}
      L ${left + r} ${bottom}
      Q ${left} ${bottom} ${left} ${bottom - r}
    `;
  };

  // Calculate total path length
  const straightEdge = rectSize - 2 * r;
  const cornerArc = (Math.PI * r) / 2;
  const totalLength = (straightEdge * 4) + (cornerArc * 4);

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const progressLength = totalLength * clampedProgress;

  const pathD = createRoundedRectPath();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Track (subtle background ring) */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={borderWidth}
          />
        </Svg>
      </View>

      {/* Progress stroke */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Path
            d={pathD}
            fill="none"
            stroke={accentColor}
            strokeWidth={borderWidth}
            strokeDasharray={`${progressLength} ${totalLength}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {/* Cover Image */}
      <Image
        source={coverUrl}
        style={[
          styles.cover,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            margin: borderWidth,
          },
        ]}
        contentFit="cover"
        transition={200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  cover: {
    backgroundColor: '#333',
  },
});