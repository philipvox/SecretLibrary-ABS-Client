/**
 * src/features/player/components/PlayerControls.tsx
 *
 * Improved with native touch events for reliable Android support
 * Uses View + onTouchStart/End/Cancel instead of Pressable
 * Uses custom SVG buttons from Figma designs
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  PlayButton,
  PauseButton,
  RewindButton,
  FastForwardButton,
  ChapterBackButton,
  ChapterForwardButton,
  LoadingDots,
} from '@/shared/assets/svg';
import { formatDelta } from '../utils';
import { CARD_MARGIN, BUTTON_GAP, BUTTON_SIZE, RADIUS } from '../constants';

// Button aspect ratio from SVG (128x136)
const BUTTON_HEIGHT = BUTTON_SIZE * (136 / 128);

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  isRewinding: boolean;
  isFastForwarding: boolean;
  seekDelta: number;
  controlMode: 'rewind' | 'chapter';
  accentColor?: string;
  onPlayPause: () => void;
  onLeftPress: () => void;
  onLeftPressIn: () => void;
  onLeftPressOut: () => void;
  onRightPress: () => void;
  onRightPressIn: () => void;
  onRightPressOut: () => void;
}

// Touch-based button for reliable hold detection
function HoldButton({
  onPress,
  onPressIn,
  onPressOut,
  isActive,
  children,
}: {
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const touchActiveRef = useRef(false);
  const pressStartRef = useRef(0);
  const HOLD_THRESHOLD = 150; // ms before considered a hold

  const handleTouchStart = useCallback(() => {
    touchActiveRef.current = true;
    pressStartRef.current = Date.now();
    onPressIn();
  }, [onPressIn]);

  const handleTouchEnd = useCallback(() => {
    if (!touchActiveRef.current) return;
    touchActiveRef.current = false;

    const duration = Date.now() - pressStartRef.current;
    onPressOut();

    // If it was a quick tap (not a hold), also fire onPress
    if (duration < HOLD_THRESHOLD) {
      onPress();
    }
  }, [onPress, onPressOut]);

  const handleTouchCancel = useCallback(() => {
    if (!touchActiveRef.current) return;
    touchActiveRef.current = false;
    onPressOut();
  }, [onPressOut]);

  return (
    <View
      style={[styles.buttonWrapper, isActive && styles.buttonActive]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {children}
    </View>
  );
}

export function PlayerControls({
  isPlaying,
  isLoading,
  isRewinding,
  isFastForwarding,
  seekDelta,
  controlMode,
  accentColor = '#F55F05',
  onPlayPause,
  onLeftPress,
  onLeftPressIn,
  onLeftPressOut,
  onRightPress,
  onRightPressIn,
  onRightPressOut,
}: PlayerControlsProps) {
  const isSeeking = isRewinding || isFastForwarding;

  return (
    <View style={styles.controlsRow}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={styles.buttonWrapper}
        onPress={onPlayPause}
        activeOpacity={0.7}
        disabled={isLoading}
      >
        {isLoading ? (
          <LoadingDots width={BUTTON_SIZE} height={BUTTON_HEIGHT} animating={true} />
        ) : isSeeking ? (
          <View style={styles.seekDeltaOverlay}>
            <Text style={styles.seekDeltaText}>{formatDelta(seekDelta)}</Text>
          </View>
        ) : isPlaying ? (
          <PauseButton width={BUTTON_SIZE} height={BUTTON_HEIGHT} accentColor={accentColor} />
        ) : (
          <PlayButton width={BUTTON_SIZE} height={BUTTON_HEIGHT} accentColor={accentColor} />
        )}
      </TouchableOpacity>

      {/* Rewind / Prev Chapter Button */}
      {controlMode === 'rewind' ? (
        <HoldButton
          onPress={onLeftPress}
          onPressIn={onLeftPressIn}
          onPressOut={onLeftPressOut}
          isActive={isRewinding}
        >
          <RewindButton width={BUTTON_SIZE} height={BUTTON_HEIGHT} />
        </HoldButton>
      ) : (
        <TouchableOpacity
          style={styles.buttonWrapper}
          onPress={onLeftPress}
          activeOpacity={0.7}
        >
          <ChapterBackButton width={BUTTON_SIZE} height={BUTTON_HEIGHT} />
        </TouchableOpacity>
      )}

      {/* Fast Forward / Next Chapter Button */}
      {controlMode === 'rewind' ? (
        <HoldButton
          onPress={onRightPress}
          onPressIn={onRightPressIn}
          onPressOut={onRightPressOut}
          isActive={isFastForwarding}
        >
          <FastForwardButton width={BUTTON_SIZE} height={BUTTON_HEIGHT} />
        </HoldButton>
      ) : (
        <TouchableOpacity
          style={styles.buttonWrapper}
          onPress={onRightPress}
          activeOpacity={0.7}
        >
          <ChapterForwardButton width={BUTTON_SIZE} height={BUTTON_HEIGHT} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: BUTTON_GAP,
    marginHorizontal: CARD_MARGIN,
    marginTop: 5,
  },
  buttonWrapper: {
    width: BUTTON_SIZE,
    height: BUTTON_HEIGHT,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  buttonActive: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  seekDeltaOverlay: {
    width: BUTTON_SIZE,
    height: BUTTON_HEIGHT,
    borderRadius: RADIUS,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekDeltaText: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#fff',
  },
});