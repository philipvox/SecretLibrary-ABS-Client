/**
 * src/features/home/components/GlassButton.tsx
 *
 * Glassmorphism button with multiple gradient layers
 * Used for playback control buttons
 */

import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, DIMENSIONS, SHADOWS, GLASS_LAYERS } from '../homeDesign';

interface GlassButtonProps {
  onPress: () => void;
  size?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  isPlayButton?: boolean;
  disabled?: boolean;
}

export function GlassButton({
  onPress,
  size = DIMENSIONS.skipButtonSize,
  children,
  style,
  isPlayButton = false,
  disabled = false,
}: GlassButtonProps) {
  const borderRadius = size * 0.1; // ~10% of size for rounded corners

  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress();
    }
  }, [onPress, disabled]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={disabled}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        isPlayButton && SHADOWS.playButtonGlow,
        style,
      ]}
    >
      {/* Layer 1: Base dark fill */}
      <View
        style={[
          styles.layer,
          {
            backgroundColor: GLASS_LAYERS.base.color,
            borderRadius,
          },
        ]}
      />

      {/* Layer 2: Top gradient (dark at top) */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.2)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={[styles.layer, { borderRadius }]}
      />

      {/* Layer 3: Bottom gradient (light at bottom) */}
      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.15)']}
        start={{ x: 0.5, y: 0.6 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.layer, { borderRadius }]}
      />

      {/* Layer 4: Corner highlight (top-left) */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={[styles.layer, { borderRadius }]}
      />

      {/* Layer 5: Corner highlight (bottom-right) */}
      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.05)']}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={[styles.layer, { borderRadius }]}
      />

      {/* Border highlight */}
      <View
        style={[
          styles.border,
          {
            borderRadius,
            borderColor: GLASS_LAYERS.border.color,
            borderWidth: GLASS_LAYERS.border.width,
          },
        ]}
      />

      {/* Content (icon) */}
      <View style={styles.content}>{children}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    ...SHADOWS.button,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
