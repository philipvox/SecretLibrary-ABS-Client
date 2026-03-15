/**
 * src/shared/components/HolographicSticker.tsx
 *
 * Holographic sticker effect — renders a circular sticker image with
 * chrome/iridescent sheen that shifts based on device gyroscope tilt.
 *
 * Uses Reanimated + expo-linear-gradient (no Skia dependency).
 * Silver/lavender/cyan palette for realistic holographic chrome look.
 */

import { useEffect } from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gyroscope } from 'expo-sensors';

const RAD2DEG = 180 / Math.PI;
const MAX_ANGLE = 20;

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

// Base holographic background — darker chrome
const HOLO_BASE = [
  '#9088a8',  // dark lavender
  '#8898b8',  // steel blue
  '#7898b0',  // deep ice blue
  '#9880b0',  // purple
  '#a888a0',  // mauve
  '#8890a8',  // slate
] as const;

// Iridescent shimmer layer 1 — shifts over the base
const HOLO_COLORS_1 = [
  'rgba(120, 140, 200, 0.0)',
  'rgba(120, 140, 200, 0.7)',   // deep lavender blue
  'rgba(100, 180, 220, 0.6)',   // deep ice blue
  'rgba(160, 120, 200, 0.7)',   // deep purple
  'rgba(200, 140, 180, 0.6)',   // deep pink
  'rgba(120, 140, 200, 0.0)',
] as const;

// Iridescent shimmer layer 2 — cross direction
const HOLO_COLORS_2 = [
  'rgba(100, 200, 190, 0.0)',
  'rgba(100, 200, 190, 0.6)',   // dark cyan
  'rgba(170, 140, 210, 0.5)',   // dark lavender
  'rgba(210, 160, 140, 0.5)',   // dark peach
  'rgba(100, 160, 210, 0.6)',   // dark sky blue
  'rgba(100, 200, 190, 0.0)',
] as const;

// White glare / specular highlight
const GLARE_COLORS = [
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.5)',
  'rgba(255, 255, 255, 0.05)',
  'rgba(255, 255, 255, 0.4)',
  'rgba(255, 255, 255, 0)',
] as const;

interface HolographicStickerProps {
  source: number | { uri: string };
  size: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function HolographicSticker({ source, size, onPress, style }: HolographicStickerProps) {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);

  useEffect(() => {
    Gyroscope.setUpdateInterval(32);

    let prev = Date.now();
    const subscription = Gyroscope.addListener((data) => {
      const now = Date.now();
      const dt = (now - prev) / 1000;
      prev = now;

      rotateX.value = clamp(
        rotateX.value + (data.x / 2) * dt * RAD2DEG,
        -MAX_ANGLE,
        MAX_ANGLE,
      );
      rotateY.value = clamp(
        rotateY.value - (data.y / 2) * dt * RAD2DEG,
        -MAX_ANGLE,
        MAX_ANGLE,
      );
    });

    return () => {
      subscription.remove();
    };
  }, [rotateX, rotateY]);

  // Subtle 3D perspective tilt
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 300 },
      { rotateX: `${rotateX.value * 0.4}deg` },
      { rotateY: `${rotateY.value * 0.4}deg` },
    ],
  }));

  // Holographic layer 1 — shifts with tilt
  const holo1Style = useAnimatedStyle(() => {
    const tx = interpolate(rotateY.value, [-MAX_ANGLE, MAX_ANGLE], [-size * 0.8, size * 0.8], Extrapolation.CLAMP);
    const ty = interpolate(rotateX.value, [-MAX_ANGLE, MAX_ANGLE], [-size * 0.6, size * 0.6], Extrapolation.CLAMP);
    const rotate = interpolate(rotateY.value, [-MAX_ANGLE, MAX_ANGLE], [-30, 30], Extrapolation.CLAMP);
    const opacity = 0.4 + Math.abs(rotateY.value / MAX_ANGLE) * 0.5;

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${rotate}deg` },
        { scale: 2.2 },
      ],
      opacity,
    };
  });

  // Holographic layer 2 — opposite direction for depth
  const holo2Style = useAnimatedStyle(() => {
    const tx = interpolate(rotateY.value, [-MAX_ANGLE, MAX_ANGLE], [size * 0.6, -size * 0.6], Extrapolation.CLAMP);
    const ty = interpolate(rotateX.value, [-MAX_ANGLE, MAX_ANGLE], [size * 0.5, -size * 0.5], Extrapolation.CLAMP);
    const rotate = interpolate(rotateX.value, [-MAX_ANGLE, MAX_ANGLE], [25, -25], Extrapolation.CLAMP);
    const opacity = 0.3 + Math.abs(rotateX.value / MAX_ANGLE) * 0.4;

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${rotate}deg` },
        { scale: 2.0 },
      ],
      opacity,
    };
  });

  // Glare — specular highlight that tracks tilt
  const glareStyle = useAnimatedStyle(() => {
    const tx = interpolate(rotateY.value, [-MAX_ANGLE, MAX_ANGLE], [-size * 0.5, size * 0.5], Extrapolation.CLAMP);
    const ty = interpolate(rotateX.value, [-MAX_ANGLE, MAX_ANGLE], [-size * 0.4, size * 0.4], Extrapolation.CLAMP);
    const speed = Math.sqrt(
      (rotateX.value / MAX_ANGLE) ** 2 + (rotateY.value / MAX_ANGLE) ** 2
    );
    const opacity = 0.15 + speed * 0.5;

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: 1.8 },
      ],
      opacity,
    };
  });

  const content = (
    <Animated.View style={[styles.container, { width: size, height: size }, style, containerStyle]}>
      {/* Layer 1: Holographic chrome base — fills the circle */}
      <LinearGradient
        colors={HOLO_BASE as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.overlay, { borderRadius: size / 2 }]}
      />

      {/* Layer 2: Iridescent shimmer — shifts with tilt */}
      <Animated.View style={[styles.overlay, holo1Style]} pointerEvents="none">
        <LinearGradient
          colors={HOLO_COLORS_1 as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Layer 3: Cross-direction shimmer for depth */}
      <Animated.View style={[styles.overlay, holo2Style]} pointerEvents="none">
        <LinearGradient
          colors={HOLO_COLORS_2 as unknown as string[]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Layer 4: Specular glare highlight */}
      <Animated.View style={[styles.overlay, glareStyle]} pointerEvents="none">
        <LinearGradient
          colors={GLARE_COLORS as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Layer 5: White sticker graphic — slightly translucent so holo shows through */}
      <Image
        source={source as any}
        style={[styles.image, { width: size, height: size, opacity: 0.8 }]}
        contentFit="contain"
      />
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 999,
    shadowColor: 'rgba(200, 210, 255, 0.6)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  image: {
    borderRadius: 999,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
