/**
 * src/features/player/components/PlayerButton.tsx
 * 
 * Skeuomorphic player buttons using custom SVG components.
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle, View, Text } from 'react-native';
import {
  PlayButton as PlaySvg,
  PauseButton as PauseSvg,
  RewindButton as RewindSvg,
  FastForwardButton as FastForwardSvg,
  ChapterBackButton as ChapterBackSvg,
  ChapterForwardButton as ChapterForwardSvg,
  LoadingDots,
} from './assets/svg';

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

  const renderButton = () => {
    if (isLoading && (variant === 'play' || variant === 'restart')) {
      return <LoadingDots width={BUTTON_WIDTH} height={BUTTON_HEIGHT} animating />;
    }

    switch (variant) {
      case 'rewind':
        return <RewindSvg width={BUTTON_WIDTH} height={BUTTON_HEIGHT} />;
      case 'fastforward':
        return <FastForwardSvg width={BUTTON_WIDTH} height={BUTTON_HEIGHT} />;
      case 'skip-back':
        return <ChapterBackSvg width={BUTTON_WIDTH} height={BUTTON_HEIGHT} />;
      case 'skip-forward':
        return <ChapterForwardSvg width={BUTTON_WIDTH} height={BUTTON_HEIGHT} />;
      case 'play':
      case 'restart':
        return isPlaying ? (
          <PauseSvg width={BUTTON_WIDTH} height={BUTTON_HEIGHT} accentColor={accentColor} />
        ) : (
          <PlaySvg width={BUTTON_WIDTH} height={BUTTON_HEIGHT} accentColor={accentColor} />
        );
      default:
        return null;
    }
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
      {renderButton()}
      
      {isActive && seekDelta !== undefined && seekDelta !== 0 && (
        <View style={styles.deltaOverlay}>
          <Text style={styles.deltaText}>{formatDelta(seekDelta)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 5,
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
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