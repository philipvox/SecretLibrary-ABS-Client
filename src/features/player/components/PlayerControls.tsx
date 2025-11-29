/**
 * src/features/player/components/PlayerControls.tsx
 * 
 * Improved with native touch events for reliable Android support
 * Uses View + onTouchStart/End/Cancel instead of Pressable
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { formatDelta } from '../utils';
import { CARD_MARGIN, BUTTON_GAP, BUTTON_SIZE, RADIUS } from '../constants';

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  isRewinding: boolean;
  isFastForwarding: boolean;
  seekDelta: number;
  controlMode: 'rewind' | 'chapter';
  cardColor: string;
  textColor: string;
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
  style,
}: {
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  isActive: boolean;
  children: React.ReactNode;
  style: any;
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
      style={[style, isActive && styles.buttonActive]}
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
  cardColor,
  textColor,
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
        style={[styles.controlButton, { backgroundColor: cardColor }]}
        onPress={onPlayPause}
        activeOpacity={0.7}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={textColor} />
        ) : isSeeking ? (
          <Text style={[styles.seekDeltaText, { color: textColor }]}>
            {formatDelta(seekDelta)}
          </Text>
        ) : (
          <Icon 
            name={isPlaying ? 'pause' : 'play'} 
            size={45} 
            color={textColor} 
            set="ionicons" 
          />
        )}
      </TouchableOpacity>

      {/* Rewind / Prev Chapter Button */}
      {controlMode === 'rewind' ? (
        <HoldButton
          onPress={onLeftPress}
          onPressIn={onLeftPressIn}
          onPressOut={onLeftPressOut}
          isActive={isRewinding}
          style={[styles.controlButton, { backgroundColor: cardColor }]}
        >
          <Icon name="play-back" size={45} color={textColor} set="ionicons" />
        </HoldButton>
      ) : (
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: cardColor }]}
          onPress={onLeftPress}
          activeOpacity={0.7}
        >
          <Icon name="play-skip-back" size={45} color={textColor} set="ionicons" />
        </TouchableOpacity>
      )}

      {/* Fast Forward / Next Chapter Button */}
      {controlMode === 'rewind' ? (
        <HoldButton
          onPress={onRightPress}
          onPressIn={onRightPressIn}
          onPressOut={onRightPressOut}
          isActive={isFastForwarding}
          style={[styles.controlButton, { backgroundColor: cardColor }]}
        >
          <Icon name="play-forward" size={45} color={textColor} set="ionicons" />
        </HoldButton>
      ) : (
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: cardColor }]}
          onPress={onRightPress}
          activeOpacity={0.7}
        >
          <Icon name="play-skip-forward" size={45} color={textColor} set="ionicons" />
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
  controlButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonActive: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  seekDeltaText: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});