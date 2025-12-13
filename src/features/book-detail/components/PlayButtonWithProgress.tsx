// File: src/shared/components/PlayButtonWithProgress.tsx
import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from '@/shared/components/Icon';
import { colors } from '@/shared/theme';

interface PlayButtonWithProgressProps {
  coverUrl: string;
  progress: number;
  size?: number;
  onPress: () => void;
  accentColor?: string;
  isPlaying?: boolean;
}

export function PlayButtonWithProgress({
  coverUrl,
  progress,
  size = 56,
  onPress,
  accentColor = colors.accent,
  isPlaying = false,
}: PlayButtonWithProgressProps) {
  const borderWidth = 3;
  const innerSize = size - borderWidth * 2;
  const radius = (size - borderWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* SVG Progress Ring */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth={borderWidth}
          />
          {/* Progress arc - starts from top (-90 rotation) */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={borderWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
      </View>

      {/* Cover image */}
      <Image
        source={{ uri: coverUrl }}
        style={[
          styles.cover,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
        resizeMode="cover"
      />

      {/* Play/Pause icon overlay */}
      <View style={[styles.playOverlay, { borderRadius: size / 2 }]}>
        <Icon 
          name={isPlaying ? 'pause' : 'play'} 
          size={size * 0.35} 
          color="#FFFFFF" 
          set="ionicons" 
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cover: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: '#333',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingLeft: 2,
  },
});