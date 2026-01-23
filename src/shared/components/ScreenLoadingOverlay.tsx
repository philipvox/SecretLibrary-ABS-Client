/**
 * src/shared/components/ScreenLoadingOverlay.tsx
 *
 * Simple full-screen loading overlay with animated candle.
 * Shows a black screen with centered animation until screen is ready.
 */

import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import { CandleLoading } from './Loading';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ScreenLoadingOverlayProps {
  /** Whether to show the overlay */
  visible: boolean;
}

export const ScreenLoadingOverlay = memo(function ScreenLoadingOverlay({
  visible,
}: ScreenLoadingOverlayProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(300)}
      style={[styles.overlay, { backgroundColor: colors.background.primary }]}
    >
      <CandleLoading size={100} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  spinner: {
    marginTop: 20,
  },
});
