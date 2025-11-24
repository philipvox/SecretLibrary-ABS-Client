import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { theme } from '@/shared/theme';

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

  // Calculate the perimeter of the rounded rectangle
  // 4 straight sides + 4 quarter circles (= 1 full circle of radius borderRadius)
  const straightSides = (size - 2 * borderRadius) * 4;
  const corners = 2 * Math.PI * borderRadius;
  const totalPerimeter = straightSides + corners;

  // How much of the perimeter to fill
  const progressLength = totalPerimeter * Math.min(Math.max(progress, 0), 1);

  // SVG Rect draws starting from top-left, going clockwise: right, down, left, up
  // We want to START from bottom-left corner, going UP (clockwise visually)
  // 
  // Path order from SVG start (top-left):
  // 1. Top edge (left to right): size - 2*radius
  // 2. Top-right corner: quarter circle
  // 3. Right edge (top to bottom): size - 2*radius  
  // 4. Bottom-right corner: quarter circle
  // 5. Bottom edge (right to left): size - 2*radius
  // 6. Bottom-left corner: quarter circle
  // 7. Left edge (bottom to top): size - 2*radius
  // 8. Top-left corner back to start: quarter circle
  
  const edgeLength = size - 2 * borderRadius;
  const quarterCircle = (2 * Math.PI * borderRadius) / 4;
  
  // Distance from SVG start to bottom-left corner (where we want our progress to start):
  // top edge + TR corner + right edge + BR corner + bottom edge + BL corner
  const distanceToBottomLeft = edgeLength + quarterCircle + edgeLength + quarterCircle + edgeLength + quarterCircle;
  
  // To make the stroke START at bottom-left and go UP (continuing the clockwise path),
  // we offset backwards by the distance to bottom-left
  const dashOffset = -distanceToBottomLeft;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Track (subtle background ring) */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
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
        </Svg>
      </View>

      {/* Progress stroke */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Rect
            x={borderWidth / 2}
            y={borderWidth / 2}
            width={size - borderWidth}
            height={size - borderWidth}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={accentColor}
            strokeWidth={borderWidth}
            strokeDasharray={`${progressLength} ${totalPerimeter}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {/* Cover Image */}
      <Image
        source={{ uri: coverUrl }}
        style={[
          styles.cover,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            margin: borderWidth,
          },
        ]}
        resizeMode="cover"
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