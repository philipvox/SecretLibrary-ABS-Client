/**
 * src/features/player/components/PlayerButton.tsx
 * 
 * Skeuomorphic player buttons matching the HTML mockup.
 * Variants: rewind, fastforward, skip-back, skip-forward, play, restart
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle, ActivityIndicator, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { GlassPanel, LightingVariant } from './GlassPanel';

const BUTTON_WIDTH = 128;
const BUTTON_HEIGHT = 136;
const DEFAULT_ACCENT = '#F55F05';

export type ButtonVariant = 'rewind' | 'fastforward' | 'skip-back' | 'skip-forward' | 'play' | 'restart';

interface PlayerButtonProps {
  variant: ButtonVariant;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  isActive?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
  seekDelta?: number;
  accentColor?: string;
}

const VARIANT_CONFIG: Record<ButtonVariant, LightingVariant> = {
  rewind: 'diagonal-left',
  fastforward: 'vertical',
  'skip-back': 'diagonal-left',
  'skip-forward': 'vertical',
  play: 'diagonal-right',
  restart: 'diagonal-right',
};

export function PlayerButton({
  variant,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  style,
  disabled,
  isActive,
  isPlaying,
  isLoading,
  seekDelta,
  accentColor = DEFAULT_ACCENT,
}: PlayerButtonProps) {
  const lighting = VARIANT_CONFIG[variant];
  const iconColor = (variant === 'play' || variant === 'restart') ? accentColor : 'white';

  const formatDelta = (delta: number) => {
    const sign = delta >= 0 ? '+' : '';
    const seconds = Math.abs(Math.round(delta));
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${sign}${delta >= 0 ? '' : '-'}${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${sign}${Math.round(delta)}s`;
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <GlassPanel
        width={BUTTON_WIDTH}
        height={BUTTON_HEIGHT}
        variant={lighting}
      >
        {isLoading && (variant === 'play' || variant === 'restart') ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={iconColor} />
          </View>
        ) : (
          <View style={styles.iconContainer}>
            <ButtonIcon 
              variant={variant} 
              color={iconColor} 
              isPlaying={isPlaying}
            />
          </View>
        )}
        
        {/* Seek delta overlay */}
        {isActive && seekDelta !== undefined && seekDelta !== 0 && (
          <View style={styles.deltaOverlay}>
            <Text style={styles.deltaText}>{formatDelta(seekDelta)}</Text>
          </View>
        )}
      </GlassPanel>
    </Pressable>
  );
}

function ButtonIcon({ 
  variant, 
  color,
  isPlaying,
}: { 
  variant: ButtonVariant; 
  color: string;
  isPlaying?: boolean;
}) {
  const iconSize = 56;
  const iconHeight = 46;

  if (variant === 'rewind') {
    return (
      <Svg width={iconSize} height={iconHeight} viewBox="0 0 56 46">
        <Path
          d="M26 3.5C26 1.8 24.1 0.7 22.6 1.6L1.5 22C0.2 22.8 0.2 24.7 1.5 25.5L22.6 45.9C24.1 46.8 26 45.7 26 44V3.5Z"
          fill={color}
        />
        <Path
          d="M54 3.5C54 1.8 52.1 0.7 50.6 1.6L29.5 22C28.2 22.8 28.2 24.7 29.5 25.5L50.6 45.9C52.1 46.8 54 45.7 54 44V3.5Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (variant === 'fastforward') {
    return (
      <Svg width={iconSize} height={iconHeight} viewBox="0 0 56 46">
        <Path
          d="M2 3.5C2 1.8 3.9 0.7 5.4 1.6L26.5 22C27.8 22.8 27.8 24.7 26.5 25.5L5.4 45.9C3.9 46.8 2 45.7 2 44V3.5Z"
          fill={color}
        />
        <Path
          d="M30 3.5C30 1.8 31.9 0.7 33.4 1.6L54.5 22C55.8 22.8 55.8 24.7 54.5 25.5L33.4 45.9C31.9 46.8 30 45.7 30 44V3.5Z"
          fill={color}
        />
      </Svg>
    );
  }

  // Skip back |<
  if (variant === 'skip-back') {
    return (
      <Svg width={iconSize} height={iconHeight} viewBox="0 0 56 46">
        {/* Bar */}
        <Rect x="2" y="0" width="8" height="46" rx="2" fill={color} />
        {/* Triangle pointing left */}
        <Path
          d="M54 3.5C54 1.8 52.1 0.7 50.6 1.6L18 22C16.7 22.8 16.7 24.7 18 25.5L50.6 45.9C52.1 46.8 54 45.7 54 44V3.5Z"
          fill={color}
        />
      </Svg>
    );
  }

  // Skip forward >|
  if (variant === 'skip-forward') {
    return (
      <Svg width={iconSize} height={iconHeight} viewBox="0 0 56 46">
        {/* Triangle pointing right */}
        <Path
          d="M2 3.5C2 1.8 3.9 0.7 5.4 1.6L38 22C39.3 22.8 39.3 24.7 38 25.5L5.4 45.9C3.9 46.8 2 45.7 2 44V3.5Z"
          fill={color}
        />
        {/* Bar */}
        <Rect x="46" y="0" width="8" height="46" rx="2" fill={color} />
      </Svg>
    );
  }

  // Restart (circular arrow)
  if (variant === 'restart') {
    return (
      <Svg width={44} height={44} viewBox="0 0 24 24">
        <Path
          d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
          fill={color}
        />
      </Svg>
    );
  }

  // Play/Pause
  if (isPlaying) {
    return (
      <Svg width={36} height={iconHeight} viewBox="0 0 36 46">
        <Rect x="2" y="0" width="12" height="46" rx="3" fill={color} />
        <Rect x="22" y="0" width="12" height="46" rx="3" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg width={36} height={iconHeight} viewBox="0 0 36 46">
      <Path
        d="M0 3.5C0 1.8 1.9 0.7 3.4 1.6L34.5 22C35.8 22.8 35.8 24.7 34.5 25.5L3.4 45.9C1.9 46.8 0 45.7 0 44V3.5Z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deltaOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  deltaText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});