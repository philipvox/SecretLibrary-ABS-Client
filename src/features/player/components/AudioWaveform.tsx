/**
 * src/features/player/components/AudioWaveform.tsx
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WAVEFORM_WIDTH, WAVEFORM_HEIGHT } from '../constants';

interface AudioWaveformProps {
  color: string;
  isPlaying: boolean;
}

export function AudioWaveform({ color, isPlaying }: AudioWaveformProps) {
  // TODO: Re-enable audio sample visualization once player switching is stable
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    width: WAVEFORM_WIDTH,
    height: WAVEFORM_HEIGHT,
  },
});

export default AudioWaveform;