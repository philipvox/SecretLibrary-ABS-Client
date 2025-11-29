/**
 * src/features/player/components/PlayerControls.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
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
        ) : (isRewinding || isFastForwarding) ? (
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
      <Pressable 
        style={[styles.controlButton, { backgroundColor: cardColor, opacity: isRewinding ? 0.7 : 1 }]}
        onPress={onLeftPress}
        onPressIn={onLeftPressIn}
        onPressOut={onLeftPressOut}
      >
        <Icon 
          name={controlMode === 'rewind' ? 'play-back' : 'play-skip-back'} 
          size={45} 
          color={textColor} 
          set="ionicons" 
        />
      </Pressable>

      {/* Fast Forward / Next Chapter Button */}
      <Pressable 
        style={[styles.controlButton, { backgroundColor: cardColor, opacity: isFastForwarding ? 0.7 : 1 }]}
        onPress={onRightPress}
        onPressIn={onRightPressIn}
        onPressOut={onRightPressOut}
      >
        <Icon 
          name={controlMode === 'rewind' ? 'play-forward' : 'play-skip-forward'} 
          size={45} 
          color={textColor} 
          set="ionicons" 
        />
      </Pressable>
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
  seekDeltaText: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
